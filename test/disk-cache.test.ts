/**
 * Unit tests for Phase 3: Persistent Disk Cache.
 * Covers shard serialization, hydration, tokenizer bypass on cache hits,
 * atomic writes, corrupted shard fail-open resilience, and LRU byte-budget pruning.
 */

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { Tokenizer } from "@jscpd/tokenizer";
import {
	CACHE_FORMAT_MAGIC,
	CACHE_FORMAT_VERSION,
	computeConfigFingerprint,
	computeShardKey,
	computeWorkspaceCachePath,
	DiskCacheManager,
	getDefaultCacheDir,
	unpackBinaryShard,
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
			const wsDirA = computeWorkspaceCachePath(
				cacheBaseDir,
				"/path/to/projectA",
				"fp123",
			);
			const wsDirB = computeWorkspaceCachePath(
				cacheBaseDir,
				"/path/to/projectB",
				"fp123",
			);
			const wsDirDifferentConfig = computeWorkspaceCachePath(
				cacheBaseDir,
				"/path/to/projectA",
				"fp456",
			);

			expect(wsDirA).not.toBe(wsDirB);
			expect(wsDirA).not.toBe(wsDirDifferentConfig);
			expect(wsDirA.startsWith(cacheBaseDir)).toBe(true);
			expect(wsDirA.endsWith(".sqlite")).toBe(true);
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

	describe("DiskCacheManager: SQLite Storage, Atomic Writes & Fail-Open Resilience", () => {
		it("atomically saves and retrieves shards from SQLite database in WAL mode", async () => {
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

			// Save to SQLite disk cache
			await cacheManager.saveShard(shard, relPath);

			// Retrieve from SQLite disk cache
			const retrieved = await cacheManager.getShard(relPath, contentHash);
			expect(retrieved).not.toBeNull();
			expect(retrieved?.sourceId).toBe(fullPath);
			expect(retrieved?.contentHash).toBe(contentHash);
			expect(retrieved?.frames.length).toBe(shard.frames.length);

			// Verify single SQLite file exists and zero .bin files created
			const exists = await fs
				.stat(cacheManager.dbPath)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);

			const files = await fs.readdir(cacheBaseDir);
			const binFiles = files.filter((f) => f.endsWith(".bin"));
			expect(binFiles.length).toBe(0);

			// Verify WAL journal mode
			const db = new Database(cacheManager.dbPath);
			const journalPragma = db.prepare("PRAGMA journal_mode;").get() as {
				journal_mode: string;
			};
			expect(journalPragma.journal_mode).toBe("wal");
			db.close();

			cacheManager.close();
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
			cacheManager.close();
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
			cacheManager.close();
		});

		it("fails open on corrupted or malformed database payload", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			// Prime the database
			await cacheManager.saveShard({
				version: 1,
				sourceId: "src/dummy.ts",
				contentHash: "dummy",
				format: "typescript",
				size: 10,
				lines: 1,
				tokenCount: 1,
				frames: [],
			});

			// Inject corrupted binary payload directly into the shards table
			const db = new Database(cacheManager.dbPath);
			db.prepare(
				"INSERT INTO shards (rel_path, content_hash, payload, mtime) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(rel_path, content_hash) DO UPDATE SET payload = excluded.payload",
			).run(
				"src/corrupt.ts",
				"abc123456",
				Buffer.from("invalid corrupted zlib binary stream data"),
				Date.now(),
			);
			db.close();

			const result = await cacheManager.getShard("src/corrupt.ts", "abc123456");
			expect(result).toBeNull();
			cacheManager.close();
		});

		it("deletes cached shards by relative path via deleteByRelPath", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const shard: SerializedSourceShard = {
				version: CACHE_FORMAT_VERSION,
				sourceId: "src/to-delete.ts",
				contentHash: "hash123",
				format: "typescript",
				size: 100,
				lines: 10,
				tokenCount: 20,
				frames: [],
			};
			await cacheManager.saveShard(shard, "src/to-delete.ts");
			const before = await cacheManager.getShard("src/to-delete.ts", "hash123");
			expect(before).not.toBeNull();

			await cacheManager.deleteByRelPath("src/to-delete.ts");
			const after = await cacheManager.getShard("src/to-delete.ts", "hash123");
			expect(after).toBeNull();
			cacheManager.close();
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

			// Adjust modification times in SQLite: shard 0 is oldest, shard 2 is newest
			const db = new Database(cacheManager.dbPath);
			db.prepare("UPDATE shards SET mtime = ?1 WHERE rel_path = ?2").run(
				1000,
				"src/file_1.ts",
			);
			db.prepare("UPDATE shards SET mtime = ?1 WHERE rel_path = ?2").run(
				2000,
				"src/file_2.ts",
			);
			db.prepare("UPDATE shards SET mtime = ?1 WHERE rel_path = ?2").run(
				3000,
				"src/file_3.ts",
			);

			const size2 = (
				db
					.prepare(
						"SELECT LENGTH(payload) as size FROM shards WHERE rel_path = 'src/file_2.ts'",
					)
					.get() as { size: number }
			).size;
			const size3 = (
				db
					.prepare(
						"SELECT LENGTH(payload) as size FROM shards WHERE rel_path = 'src/file_3.ts'",
					)
					.get() as { size: number }
			).size;
			db.close();

			// Prune with a budget that only fits the 2 newest files (file_2 and file_3)
			const maxBudget = size2 + size3 + 10;
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

			cacheManager.close();
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

			cacheManager.close();
		});

		it("clears workspace database cleanly with clear()", async () => {
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
			const afterClear = await cacheManager.getShard(relPath, contentHash);
			expect(afterClear).toBeNull();
			cacheManager.close();
		});
	});

	describe("High-Density Binary Shard Packing & Legacy Fallback", () => {
		it("round-trips binary shard serialization with accurate frame coordinates", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 3 });
			const relPath = "src/roundtrip.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const hash = crypto
				.createHash("sha256")
				.update(sampleCodeA)
				.digest("hex");

			index.addSource(fullPath, sampleCodeA);
			const shard = index.exportSourceShard(fullPath, hash)!;

			await cacheManager.saveShard(shard, relPath);
			const retrieved = await cacheManager.getShard(relPath, hash);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.version).toBe(CACHE_FORMAT_VERSION);
			expect(retrieved?.sourceId).toBe(fullPath);
			expect(retrieved?.contentHash).toBe(hash);
			const retFrames = retrieved?.frames ?? [];
			expect(retFrames.length).toBe(shard.frames.length);

			for (let i = 0; i < shard.frames.length; i++) {
				expect(retFrames[i]?.id).toBe(shard.frames[i]!.id);
				expect(retFrames[i]?.start.line).toBe(
					shard.frames[i]!.start.loc?.start.line ?? shard.frames[i]!.start.line,
				);
				expect(retFrames[i]?.end.line).toBe(
					shard.frames[i]!.end.loc?.end.line ?? shard.frames[i]!.end.line,
				);
			}
		});
		it("clears old shards and resets schema on SQLite cache version mismatch", async () => {
			const cfgFingerprint = computeConfigFingerprint();
			const dbPath = computeWorkspaceCachePath(
				cacheBaseDir,
				workspaceDir,
				cfgFingerprint,
			);
			await fs.mkdir(path.dirname(dbPath), { recursive: true });

			// Simulate a pre-existing cache database with user_version = 1 (outdated)
			const rawDb = new Database(dbPath, { create: true });
			rawDb.exec(`
				PRAGMA user_version = 1;
				CREATE TABLE shards (
					rel_path TEXT NOT NULL PRIMARY KEY,
					content_hash TEXT NOT NULL,
					payload BLOB NOT NULL,
					mtime REAL NOT NULL
				);
				INSERT INTO shards VALUES ('old/file.ts', 'hash_old', X'001122', 1000);
			`);
			rawDb.close();

			// Initialize DiskCacheManager against this workspace
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			// Cache should clear old entries on version difference and allow fresh writes
			const oldShard = await cacheManager.getShard("old/file.ts", "hash_old");
			expect(oldShard).toBeNull();

			// Verify PRAGMA user_version updated to CACHE_FORMAT_VERSION
			const verifyDb = new Database(dbPath, { readonly: true });
			const versionRow = verifyDb.query("PRAGMA user_version;").get() as {
				user_version: number;
			};
			expect(versionRow.user_version).toBe(CACHE_FORMAT_VERSION);
			const rowCount = verifyDb
				.query("SELECT COUNT(*) as count FROM shards")
				.get() as { count: number };
			expect(rowCount.count).toBe(0);
			verifyDb.close();

			cacheManager.close();
		});

		it("rejects and purges shards with mismatched magic or binary version", () => {
			// Create a buffer with invalid magic
			const invalidMagicBuf = Buffer.alloc(32);
			invalidMagicBuf.write("BAD0", 0, 4, "ascii");
			invalidMagicBuf.writeUInt16LE(1, 4);
			const compressedInvalidMagic = zlib.deflateRawSync(invalidMagicBuf);
			expect(unpackBinaryShard(compressedInvalidMagic)).toBeNull();

			// Create a buffer with valid magic but mismatched version
			const invalidVerBuf = Buffer.alloc(32);
			invalidVerBuf.write(CACHE_FORMAT_MAGIC, 0, 4, "ascii");
			invalidVerBuf.writeUInt16LE(999, 4);
			const compressedInvalidVer = zlib.deflateRawSync(invalidVerBuf);
			expect(unpackBinaryShard(compressedInvalidVer)).toBeNull();
		});

		it("handles database close gracefully and fails open on subsequent calls", async () => {
			const cacheManager = new DiskCacheManager({
				rootDir: workspaceDir,
				cacheDir: cacheBaseDir,
			});

			const relPath = "src/close-test.ts";
			const fullPath = path.join(workspaceDir, relPath);
			const contentHash = "close_hash_123";

			await cacheManager.saveShard(
				{
					version: 1,
					sourceId: fullPath,
					contentHash,
					format: "typescript",
					size: 10,
					lines: 1,
					tokenCount: 1,
					frames: [],
				},
				relPath,
			);

			cacheManager.close();

			// After close, operations fail open safely
			const retrieved = await cacheManager.getShard(relPath, contentHash);
			expect(retrieved).toBeNull();
		});
	});
});
