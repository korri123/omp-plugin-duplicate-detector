import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DuplicateDetectorCoordinator } from "../src/coordinator";
import { DiskCacheManager } from "../src/disk-cache";
import { execGit } from "../src/jscpd-engine";
import {
	canonicalizePath,
	isOmpWorktreePath,
	resolveRepositoryContext,
} from "../src/repo-context";
import { SourceAwareCloneIndex } from "../src/source-aware-index";

describe("Repository Context & CoW Worktree Shared Cache Integration", () => {
	let tempDir: string;
	let cacheDir: string;

	beforeEach(async () => {
		tempDir = path.join(
			os.tmpdir(),
			`omp-dup-context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		cacheDir = path.join(tempDir, "cache");
		await fs.mkdir(cacheDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	it("detects Oh My Pi worktree paths accurately", () => {
		expect(isOmpWorktreePath("/Users/user/.omp/wt/t123456/m")).toBe(true);
		expect(isOmpWorktreePath("C:\\Users\\user\\.omp\\wt\\t123456\\m")).toBe(
			true,
		);
		expect(isOmpWorktreePath("/Users/user/.omp/worktrees/feat1/m")).toBe(true);
		expect(isOmpWorktreePath("/Users/user/Projects/my-app")).toBe(false);
	});

	it("resolves repository context and unifies repositoryKey across primary and CoW worktree", async () => {
		const primaryRepo = path.join(tempDir, "primary-repo");
		await fs.mkdir(primaryRepo, { recursive: true });
		await execGit(["init", "-q", "-b", "main"], primaryRepo);
		await execGit(["config", "user.name", "TestUser"], primaryRepo);
		await execGit(["config", "user.email", "test@example.com"], primaryRepo);

		const testFile = path.join(primaryRepo, "index.ts");
		await fs.writeFile(testFile, "console.log('hello world');\n");
		await execGit(["add", "index.ts"], primaryRepo);
		await execGit(["commit", "-m", "initial commit", "-q"], primaryRepo);

		const primaryContext = await resolveRepositoryContext(primaryRepo);
		expect(primaryContext.isGit).toBe(true);
		expect(primaryContext.workspaceRoot).toBe(canonicalizePath(primaryRepo));
		expect(primaryContext.repositoryKey).toBeDefined();

		// Simulate Oh My Pi CoW detached worktree at ~/.omp/wt/t<hash>/m
		const cowWorktree = path.join(tempDir, ".omp", "wt", "t999999", "m");
		await fs.mkdir(cowWorktree, { recursive: true });
		await execGit(["init", "-q", "-b", "omp/task/test-agent"], cowWorktree);

		// Write alternates pointing to primary repo objects
		const primaryObjects = path.join(primaryContext.gitDir!, "objects");
		const cowObjectsInfo = path.join(cowWorktree, ".git", "objects", "info");
		await fs.mkdir(cowObjectsInfo, { recursive: true });
		await fs.writeFile(
			path.join(cowObjectsInfo, "alternates"),
			`${primaryObjects}\n`,
		);

		const cowContext = await resolveRepositoryContext(cowWorktree);
		expect(cowContext.isGit).toBe(true);
		expect(cowContext.isOmpIsolation).toBe(true);
		expect(cowContext.workspaceRoot).toBe(canonicalizePath(cowWorktree));

		// Crucial verification: repositoryKey MUST be identical
		expect(cowContext.repositoryKey).toBe(primaryContext.repositoryKey);
	});

	it("shares SQLite cache seamlessly between primary repo and CoW worktrees with zero thrashing", async () => {
		const primaryRepo = path.join(tempDir, "primary-repo");
		await fs.mkdir(primaryRepo, { recursive: true });
		await execGit(["init", "-q", "-b", "main"], primaryRepo);
		await execGit(["config", "user.name", "TestUser"], primaryRepo);
		await execGit(["config", "user.email", "test@example.com"], primaryRepo);

		const primaryContext = await resolveRepositoryContext(primaryRepo);

		// 1. Primary repo indexes and writes shards into shared cache
		const primaryCache = new DiskCacheManager({
			rootDir: primaryContext.workspaceRoot,
			repositoryKey: primaryContext.repositoryKey,
			cacheDir,
		});

		const sampleCodeA = `
export function calculateMetrics(a: number, b: number): number {
	const step1 = a * 10;
	const step2 = b * 20;
	const step3 = step1 + step2;
	return step3 / 2;
}
`;
		const sampleCodeAHash = crypto
			.createHash("sha256")
			.update(sampleCodeA)
			.digest("hex");

		const primaryIndex = new SourceAwareCloneIndex({
			minTokens: 5,
			minLines: 2,
		});
		const relPath = "src/math.ts";
		const primaryFullPath = path.join(primaryRepo, relPath);
		await fs.mkdir(path.dirname(primaryFullPath), { recursive: true });
		await fs.writeFile(primaryFullPath, sampleCodeA);

		primaryIndex.addSource(primaryFullPath, sampleCodeA);
		const shardA = primaryIndex.exportSourceShard(
			primaryFullPath,
			sampleCodeAHash,
		)!;
		await primaryCache.saveShard(shardA, relPath);

		// Verify shard is in cache
		const readAFromPrimary = await primaryCache.getShard(
			relPath,
			sampleCodeAHash,
		);
		expect(readAFromPrimary).not.toBeNull();
		expect(readAFromPrimary?.contentHash).toBe(sampleCodeAHash);

		// 2. CoW Worktree opens the shared cache with its own workspaceRoot
		const cowWorktree = path.join(tempDir, ".omp", "wt", "t888888", "m");
		await fs.mkdir(cowWorktree, { recursive: true });
		await execGit(["init", "-q", "-b", "omp/task/test-agent"], cowWorktree);

		const primaryObjects = path.join(primaryContext.gitDir!, "objects");
		const cowObjectsInfo = path.join(cowWorktree, ".git", "objects", "info");
		await fs.mkdir(cowObjectsInfo, { recursive: true });
		await fs.writeFile(
			path.join(cowObjectsInfo, "alternates"),
			`${primaryObjects}\n`,
		);

		const cowContext = await resolveRepositoryContext(cowWorktree);
		const cowCache = new DiskCacheManager({
			rootDir: cowContext.workspaceRoot,
			repositoryKey: cowContext.repositoryKey,
			cacheDir,
		});

		// CoW worktree MUST get a 100% warm cache hit for sampleCodeA!
		const readAFromCow = await cowCache.getShard(relPath, sampleCodeAHash);
		expect(readAFromCow).not.toBeNull();
		expect(readAFromCow?.contentHash).toBe(sampleCodeAHash);

		// 3. CoW worktree mutates src/math.ts with different content (sampleCodeB)
		const sampleCodeB = `
export function calculateMetrics(a: number, b: number): number {
	const step1 = a * 100;
	const step2 = b * 200;
	const step3 = step1 + step2;
	return step3 / 4;
}
`;
		const sampleCodeBHash = crypto
			.createHash("sha256")
			.update(sampleCodeB)
			.digest("hex");

		const cowIndex = new SourceAwareCloneIndex({ minTokens: 5, minLines: 2 });
		const cowFullPath = path.join(cowWorktree, relPath);
		await fs.mkdir(path.dirname(cowFullPath), { recursive: true });
		await fs.writeFile(cowFullPath, sampleCodeB);

		cowIndex.addSource(cowFullPath, sampleCodeB);
		const shardB = cowIndex.exportSourceShard(cowFullPath, sampleCodeBHash)!;
		await cowCache.saveShard(shardB, relPath);

		// 4. Coexistence check: BOTH versions MUST coexist in SQLite without thrashing!
		const readBFromCow = await cowCache.getShard(relPath, sampleCodeBHash);
		expect(readBFromCow).not.toBeNull();
		expect(readBFromCow?.contentHash).toBe(sampleCodeBHash);

		const reReadAFromPrimary = await primaryCache.getShard(
			relPath,
			sampleCodeAHash,
		);
		expect(reReadAFromPrimary).not.toBeNull();
		expect(reReadAFromPrimary?.contentHash).toBe(sampleCodeAHash);

		primaryCache.close();
		cowCache.close();
	});

	it("rejects generic standalone reference clones from borrowing primary identity when outside OMP hierarchy", async () => {
		const primaryRepo = path.join(tempDir, "primary-repo");
		await fs.mkdir(primaryRepo, { recursive: true });
		await execGit(["init", "-q", "-b", "main"], primaryRepo);
		const primaryObjects = path.join(primaryRepo, ".git", "objects");

		// Ordinary reference clone outside ~/.omp/wt/
		const genericClone = path.join(tempDir, "generic-reference-clone");
		await fs.mkdir(genericClone, { recursive: true });
		await execGit(["init", "-q", "-b", "feature"], genericClone);

		const cloneObjectsInfo = path.join(genericClone, ".git", "objects", "info");
		await fs.mkdir(cloneObjectsInfo, { recursive: true });
		await fs.writeFile(
			path.join(cloneObjectsInfo, "alternates"),
			`${primaryObjects}\n`,
		);

		const primaryContext = await resolveRepositoryContext(primaryRepo);
		const genericContext = await resolveRepositoryContext(genericClone);

		expect(genericContext.isGit).toBe(true);
		expect(genericContext.isOmpIsolation).toBe(false);
		// Must NOT unify repositoryKey with primaryRepo for generic non-OMP clones
		expect(genericContext.repositoryKey).not.toBe(primaryContext.repositoryKey);
	});

	it("handles concurrent multi-process shard writes in WAL mode cleanly", async () => {
		const primaryRepo = path.join(tempDir, "primary-concurrent");
		await fs.mkdir(primaryRepo, { recursive: true });
		await execGit(["init", "-q", "-b", "main"], primaryRepo);

		const primaryContext = await resolveRepositoryContext(primaryRepo);
		const WORKER_COUNT = 8;
		const SHARDS_PER_WORKER = 25;

		const workers = Array.from({ length: WORKER_COUNT }, () => {
			return new DiskCacheManager({
				rootDir: primaryContext.workspaceRoot,
				repositoryKey: primaryContext.repositoryKey,
				cacheDir,
			});
		});

		// Run concurrent writes across all workers
		await Promise.all(
			workers.map(async (worker, wIdx) => {
				const items: Array<{
					shard: {
						version: number;
						sourceId: string;
						contentHash: string;
						format: string;
						size: number;
						lines: number;
						tokenCount: number;
						frames: [];
					};
					relPath: string;
				}> = [];

				for (let i = 0; i < SHARDS_PER_WORKER; i++) {
					const relPath = `src/worker_${wIdx}_file_${i}.ts`;
					const contentHash = crypto
						.createHash("sha256")
						.update(`content_w${wIdx}_f${i}`)
						.digest("hex");
					items.push({
						relPath,
						shard: {
							version: 4,
							sourceId: relPath,
							contentHash,
							format: "typescript",
							size: 50,
							lines: 5,
							tokenCount: 10,
							frames: [],
						},
					});
				}
				await worker.saveShards(items);
			}),
		);

		// Read back all shards and verify
		const verifier = new DiskCacheManager({
			rootDir: primaryContext.workspaceRoot,
			repositoryKey: primaryContext.repositoryKey,
			cacheDir,
		});

		for (let wIdx = 0; wIdx < WORKER_COUNT; wIdx++) {
			for (let i = 0; i < SHARDS_PER_WORKER; i++) {
				const relPath = `src/worker_${wIdx}_file_${i}.ts`;
				const contentHash = crypto
					.createHash("sha256")
					.update(`content_w${wIdx}_f${i}`)
					.digest("hex");
				const shard = await verifier.getShard(relPath, contentHash);
				expect(shard).not.toBeNull();
				expect(shard?.contentHash).toBe(contentHash);
			}
		}

		for (const w of workers) w.close();
		verifier.close();
	});

	it("propagates error on coordinator.reconcile failure", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		await coordinator.dispose();
		expect(coordinator.reconcile([])).rejects.toThrow("disposed");
	});
});
