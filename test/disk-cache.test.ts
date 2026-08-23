/**
 * Unit tests for Phase 3: Persistent Disk Cache.
 * Covers shard serialization, hydration, tokenizer bypass on cache hits,
 * atomic writes, corrupted shard fail-open resilience, and LRU byte-budget pruning.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Tokenizer } from "@jscpd/tokenizer";
import {
	computeConfigFingerprint,
	computeShardKey,
	computeWorkspaceCacheDir,
	DiskCacheManager,
	getDefaultCacheDir,
} from "../src/disk-cache";
import {
	type SerializedSourceShard,
	SourceAwareCloneIndex,
} from "../src/source-aware-index";

describe("Phase 3: Persistent Disk Cache", () => {
	let testTempDir: string;
	let cacheBaseDir: string;
	let workspaceDir: string;

	const sampleCodeA = `
function calculateInvoiceTotal(items: Array<{ price: number; quantity: number }>, taxRate: number): number {
    let subtotal = 0;
    for (const item of items) {
        subtotal += item.price * item.quantity;
    }
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return total;
}
`;

	const sampleCodeB = `
function calculateOrderTotal(items: Array<{ price: number; quantity: number }>, taxRate: number): number {
    let subtotal = 0;
    for (const item of items) {
        subtotal += item.price * item.quantity;
    }
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return total;
}
`;

	const uniqueCode = `
export function formatCurrency(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
}
`;

	beforeEach(async () => {
		testTempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "omp-dup-disk-cache-test-"),
		);
		cacheBaseDir = path.join(testTempDir, "cache");
		workspaceDir = path.join(testTempDir, "workspace");
		await fs.mkdir(cacheBaseDir, { recursive: true });
		await fs.mkdir(workspaceDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(testTempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Path Resolution & Fingerprinting", () => {
		it("resolves default platform-specific cache directory", () => {
			const dir = getDefaultCacheDir();
			expect(typeof dir).toBe("string");
			expect(dir.length).toBeGreaterThan(0);
			if (process.platform === "win32") {
				expect(dir).toContain("duplicate-detector");
			} else {
				expect(dir).toContain(".cache/omp/duplicate-detector");
			}
		});

		it("produces deterministic configuration fingerprints", () => {
			const fp1 = computeConfigFingerprint({
				minTokens: 25,
				minLines: 4,
				maxLines: 200,
			});
			const fp2 = computeConfigFingerprint({
				minTokens: 25,
				minLines: 4,
				maxLines: 200,
			});
			const fpDifferent = computeConfigFingerprint({
				minTokens: 30,
				minLines: 4,
				maxLines: 200,
			});

			expect(fp1).toBe(fp2);
			expect(fp1).not.toBe(fpDifferent);
		});

		it("computes workspace directory isolated by root path and configuration", () => {
			const wsDirA = computeWorkspaceCacheDir(
				cacheBaseDir,
				"/path/to/projectA",
				"fp123",
			);
			const wsDirB = computeWorkspaceCacheDir(
				cacheBaseDir,
				"/path/to/projectB",
				"fp123",
			);
			const wsDirDifferentConfig = computeWorkspaceCacheDir(
				cacheBaseDir,
				"/path/to/projectA",
				"fp456",
			);

			expect(wsDirA).not.toBe(wsDirB);
			expect(wsDirA).not.toBe(wsDirDifferentConfig);
			expect(wsDirA.startsWith(cacheBaseDir)).toBe(true);
		});

		it("computes consistent shard key based on relative path, content hash, and config", () => {
			const key1 = computeShardKey("src/foo.ts", "hash123", "fpA");
			const key2 = computeShardKey("src/foo.ts", "hash123", "fpA");
			const key3 = computeShardKey("src/foo.ts", "hash456", "fpA");
			const keyWindows = computeShardKey("src\\foo.ts", "hash123", "fpA");

			expect(key1).toBe(key2);
			expect(key1).toBe(keyWindows); // Normalized slashes
			expect(key1).not.toBe(key3);
		});
	});

	describe("Shard Serialization & Hydration Round-Trip", () => {
		it("exports valid SerializedSourceShard from SourceAwareCloneIndex", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 3 });
			const filePath = "src/invoice.ts";
			const contentHash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			index.addSource(filePath, sampleCodeA);

			const shard = index.exportSourceShard(filePath, contentHash);
			expect(shard).not.toBeNull();
			expect(shard?.version).toBe(1);
			expect(shard?.sourceId).toBe(filePath);
			expect(shard?.contentHash).toBe(contentHash);
			expect(shard?.format).toBe("typescript");
			expect(shard?.size).toBe(sampleCodeA.length);
			expect(shard?.frames.length).toBeGreaterThan(0);
			expect(shard?.tokenCount).toBeGreaterThan(0);
		});

		it("returns null when exporting non-existent source", () => {
			const index = new SourceAwareCloneIndex();
			const shard = index.exportSourceShard("non-existent.ts", "dummy-hash");
			expect(shard).toBeNull();
		});

		it("hydrates pre-tokenized shard and restores index state accurately", () => {
			const sourceIndex = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 3,
			});
			const filePath = "src/invoice.ts";
			const contentHash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			sourceIndex.addSource(filePath, sampleCodeA);
			const shard = sourceIndex.exportSourceShard(filePath, contentHash)!;

			const targetIndex = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 3,
			});
			expect(targetIndex.hasSource(filePath)).toBe(false);

			targetIndex.hydrateSourceShard(shard);

			expect(targetIndex.hasSource(filePath)).toBe(true);
			const meta = targetIndex.getSource(filePath);
			expect(meta?.sourceId).toBe(filePath);
			expect(meta?.format).toBe("typescript");
			expect(meta?.size).toBe(sampleCodeA.length);

			const statsSource = sourceIndex.stats();
			const statsTarget = targetIndex.stats();
			expect(statsTarget.sourceCount).toBe(statsSource.sourceCount);
			expect(statsTarget.hashCount).toBe(statsSource.hashCount);
			expect(statsTarget.totalTokens).toBe(statsSource.totalTokens);
		});
	});

	describe("Clone Detection Parity & Tokenizer Bypass on Cache Hit", () => {
		it("produces identical clone detection results via hydration vs fresh tokenization", () => {
			const fileA = "src/invoiceA.ts";
			const fileB = "src/invoiceB.ts";
			const contentHashA = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");
			const contentHashB = crypto
				.createHash("sha256")
				.update(sampleCodeB)
				.digest("hex");

			// 1. Fresh tokenization index
			const freshIndex = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 3,
			});
			freshIndex.addSource(fileA, sampleCodeA);
			const freshClones = freshIndex.addSource(fileB, sampleCodeB);

			const shardA = freshIndex.exportSourceShard(fileA, contentHashA)!;
			const shardB = freshIndex.exportSourceShard(fileB, contentHashB)!;

			// 2. Hydrated index
			const hydratedIndex = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 3,
			});
			hydratedIndex.hydrateSourceShard(shardA);
			const hydratedClones = hydratedIndex.hydrateSourceShard(shardB);

			expect(hydratedClones.length).toBe(freshClones.length);
			expect(hydratedClones.length).toBeGreaterThan(0);

			const freshClone = freshClones[0]!;
			const hydratedClone = hydratedClones[0]!;

			expect(hydratedClone.format).toBe(freshClone.format);
			expect(hydratedClone.duplicationA.sourceId).toBe(
				freshClone.duplicationA.sourceId,
			);
			expect(hydratedClone.duplicationB.sourceId).toBe(
				freshClone.duplicationB.sourceId,
			);
			expect(hydratedClone.duplicationA.start.line).toBe(
				freshClone.duplicationA.start.line,
			);
			expect(hydratedClone.duplicationA.end.line).toBe(
				freshClone.duplicationA.end.line,
			);
			expect(hydratedClone.duplicationB.start.line).toBe(
				freshClone.duplicationB.start.line,
			);
			expect(hydratedClone.duplicationB.end.line).toBe(
				freshClone.duplicationB.end.line,
			);
		});

		it("bypasses Tokenizer during shard hydration", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 3 });
			const filePath = "src/code.ts";
			const contentHash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			index.addSource(filePath, sampleCodeA);
			const shard = index.exportSourceShard(filePath, contentHash)!;

			const generateMapsSpy = spyOn(Tokenizer.prototype, "generateMaps");

			const newIndex = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 3,
			});
			newIndex.hydrateSourceShard(shard);

			expect(generateMapsSpy).not.toHaveBeenCalled();
			generateMapsSpy.mockRestore();
		});
	});

	describe("DiskCacheManager: Atomic Writes & Fail-Open Resilience", () => {
		it("atomically saves and retrieves shards from disk cache", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
				config: { minTokens: 10, minLines: 3 },
			});

			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 3 });
			const relPath = "src/service.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const contentHash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			index.addSource(fullPath, sampleCodeA);
			const shard = index.exportSourceShard(fullPath, contentHash)!;

			// Save to disk cache
			await cacheManager.saveShard(shard, relPath);

			// Retrieve from disk cache
			const retrieved = await cacheManager.getShard(relPath, contentHash);
			expect(retrieved).not.toBeNull();
			expect(retrieved?.sourceId).toBe(fullPath);
			expect(retrieved?.contentHash).toBe(contentHash);
			expect(retrieved?.frames.length).toBe(shard.frames.length);

			// Verify no lingering .tmp files in workspace cache dir
			const files = await fs.readdir(cacheManager.workspaceCacheDir);
			const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
			expect(tmpFiles.length).toBe(0);
		});

		it("fails open and returns null for non-existent shard", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const result = await cacheManager.getShard(
				"non-existent.ts",
				"some-hash",
			);
			expect(result).toBeNull();
		});

		it("fails open and returns null when content hash mismatches", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 3 });
			const relPath = "src/service.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const contentHash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			index.addSource(fullPath, sampleCodeA);
			const shard = index.exportSourceShard(fullPath, contentHash)!;

			await cacheManager.saveShard(shard, relPath);

			const result = await cacheManager.getShard(relPath, "different-hash");
			expect(result).toBeNull();
		});

		it("fails open and returns null on corrupted JSON shard file", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const relPath = "src/corrupt.ts";
			const contentHash = "abc123456";
			const shardKey = computeShardKey(
				relPath,
				contentHash,
				cacheManager.configFingerprint,
			);

			await fs.mkdir(cacheManager.workspaceCacheDir, { recursive: true });
			const shardFile = path.join(
				cacheManager.workspaceCacheDir,
				`${shardKey}.json`,
			);

			// Write invalid/corrupted JSON
			await fs.writeFile(shardFile, "{ invalid json data ...", "utf8");

			const result = await cacheManager.getShard(relPath, contentHash);
			expect(result).toBeNull();
		});

		it("fails open on malformed shard payload lacking required fields", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const relPath = "src/malformed.ts";
			const contentHash = "abc123456";
			const shardKey = computeShardKey(
				relPath,
				contentHash,
				cacheManager.configFingerprint,
			);

			await fs.mkdir(cacheManager.workspaceCacheDir, { recursive: true });
			const shardFile = path.join(
				cacheManager.workspaceCacheDir,
				`${shardKey}.json`,
			);

			// Write JSON missing frames and version
			await fs.writeFile(
				shardFile,
				JSON.stringify({ sourceId: relPath, contentHash }),
				"utf8",
			);

			const result = await cacheManager.getShard(relPath, contentHash);
			expect(result).toBeNull();
		});
	});

	describe("DiskCacheManager: LRU Byte-Budget Pruning", () => {
		it("prunes oldest shards when cache size exceeds budget", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const index = new SourceAwareCloneIndex({ minTokens: 5, minLines: 2 });

			// Create 3 shards with distinct relative paths and contents
			const shards: SerializedSourceShard[] = [];
			for (let i = 1; i <= 3; i++) {
				const relPath = `src/file_${i}.ts`;
				const fullPath = path.join(workspaceDir, relPath);
				const content = `function testFunction${i}() {\n  const x = ${i};\n  const y = ${i * 2};\n  return x + y;\n}\n`;
				const hash = crypto.createHash("sha256").update(content).digest("hex");

				index.addSource(fullPath, content);
				const shard = index.exportSourceShard(fullPath, hash)!;
				shards.push(shard);
				await cacheManager.saveShard(shard, relPath);
			}

			// Adjust modification times: shard 0 is oldest, shard 2 is newest
			const now = Date.now();
			for (let i = 0; i < shards.length; i++) {
				const relPath = `src/file_${i + 1}.ts`;
				const shardKey = computeShardKey(
					relPath,
					shards[i]!.contentHash,
					cacheManager.configFingerprint,
				);
				const shardPath = path.join(
					cacheManager.workspaceCacheDir,
					`${shardKey}.json`,
				);
				const pastDate = new Date(now - (3 - i) * 60_000);
				await fs.utimes(shardPath, pastDate, pastDate);
			}

			// Get sizes of individual shard files
			const shardKey0 = computeShardKey(
				"src/file_1.ts",
				shards[0]!.contentHash,
				cacheManager.configFingerprint,
			);
			const shardPath0 = path.join(
				cacheManager.workspaceCacheDir,
				`${shardKey0}.json`,
			);
			const stat0 = await fs.stat(shardPath0);

			const shardKey2 = computeShardKey(
				"src/file_3.ts",
				shards[2]!.contentHash,
				cacheManager.configFingerprint,
			);
			const shardPath2 = path.join(
				cacheManager.workspaceCacheDir,
				`${shardKey2}.json`,
			);
			const stat2 = await fs.stat(shardPath2);

			// Prune with a budget that only fits the 2 newest files
			const maxBudget = stat0.size + stat2.size + 10;
			await cacheManager.prune(maxBudget);

			// Oldest shard (file_1) should be evicted
			const shard1Result = await cacheManager.getShard(
				"src/file_1.ts",
				shards[0]!.contentHash,
			);
			expect(shard1Result).toBeNull();

			// Newest shard (file_3) should remain intact
			const shard3Result = await cacheManager.getShard(
				"src/file_3.ts",
				shards[2]!.contentHash,
			);
			expect(shard3Result).not.toBeNull();
		});

		it("prunes all shards when maxBytes is 0", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const index = new SourceAwareCloneIndex({ minTokens: 5, minLines: 2 });
			const relPath = "src/to_clear.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const contentHash = crypto
				.createHash("sha256")
				.update(uniqueCode)
				.digest("hex");

			index.addSource(fullPath, uniqueCode);
			const shard = index.exportSourceShard(fullPath, contentHash)!;
			await cacheManager.saveShard(shard, relPath);

			// Verify shard exists
			const beforePrune = await cacheManager.getShard(relPath, contentHash);
			expect(beforePrune).not.toBeNull();

			// Prune with 0 budget
			await cacheManager.prune(0);

			// Verify shard was deleted
			const afterPrune = await cacheManager.getShard(relPath, contentHash);
			expect(afterPrune).toBeNull();
		});

		it("clears workspace directory cleanly with clear()", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const index = new SourceAwareCloneIndex({ minTokens: 5, minLines: 2 });
			const relPath = "src/clear_test.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const contentHash = crypto
				.createHash("sha256")
				.update(uniqueCode)
				.digest("hex");

			index.addSource(fullPath, uniqueCode);
			const shard = index.exportSourceShard(fullPath, contentHash)!;
			await cacheManager.saveShard(shard, relPath);

			await cacheManager.clear();

			const exists = await fs
				.stat(cacheManager.workspaceCacheDir)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(false);
		});
	});
});
