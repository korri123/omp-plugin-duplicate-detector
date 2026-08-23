/**
 * Persistent disk cache for pre-tokenized source shards.
 * Provides atomic writes, fail-open error handling, config-aware workspace keying,
 * and byte-budgeted LRU cache pruning.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	SerializedSourceShard,
	SourceAwareIndexOptions,
} from "./source-aware-index";
import type { WorkspaceOptions } from "./worker-protocol";

export const DEFAULT_MAX_CACHE_BYTES = 100 * 1024 * 1024; // 100 MB

export interface DiskCacheOptions {
	/** Root directory of the workspace */
	rootDir: string;
	/** Custom base cache directory (defaults to OS user cache directory) */
	cacheDir?: string;
	/** Detector configuration used to compute configuration fingerprint */
	config?: WorkspaceOptions | SourceAwareIndexOptions;
	/** Maximum cache size in bytes before pruning (default: 100 MB) */
	maxBytes?: number;
}

/**
 * Resolves the OS user cache directory for duplicate detector shards.
 * Unix/macOS: $XDG_CACHE_HOME/omp/duplicate-detector or ~/.cache/omp/duplicate-detector
 * Windows: %LOCALAPPDATA%/omp/duplicate-detector
 */
export function getDefaultCacheDir(): string {
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		if (localAppData) {
			return path.join(localAppData, "omp", "duplicate-detector");
		}
		return path.join(
			os.homedir(),
			"AppData",
			"Local",
			"omp",
			"duplicate-detector",
		);
	}
	const xdgCacheHome = process.env.XDG_CACHE_HOME;
	if (xdgCacheHome) {
		return path.join(xdgCacheHome, "omp", "duplicate-detector");
	}
	return path.join(os.homedir(), ".cache", "omp", "duplicate-detector");
}

/**
 * Computes a deterministic fingerprint for detector configuration options that affect tokenization.
 */
export function computeConfigFingerprint(
	config?: WorkspaceOptions | SourceAwareIndexOptions,
): string {
	if (!config) return "default";

	let sortedFormats: Record<string, string[]> | undefined;
	if (config.formatsExts) {
		sortedFormats = {};
		for (const key of Object.keys(config.formatsExts).sort()) {
			sortedFormats[key] = (config.formatsExts[key] ?? []).slice().sort();
		}
	}

	const canonical = {
		minTokens: config.minTokens ?? 40,
		minLines: config.minLines ?? 5,
		maxLines: config.maxLines ?? 500,
		crossFormats: config.crossFormats ?? false,
		formatsExts: sortedFormats,
	};

	return crypto
		.createHash("sha256")
		.update(JSON.stringify(canonical))
		.digest("hex")
		.slice(0, 16);
}

/**
 * Computes the workspace cache directory keyed by canonical workspace path and config fingerprint.
 */
export function computeWorkspaceCacheDir(
	baseDir: string,
	rootDir: string,
	configFingerprint: string,
): string {
	const canonicalPath = path.resolve(rootDir);
	const workspaceHash = crypto
		.createHash("sha256")
		.update(canonicalPath)
		.digest("hex")
		.slice(0, 16);
	return path.join(baseDir, `${workspaceHash}_${configFingerprint}`);
}

/**
 * Computes a shard key hash of (sourceRelPath, contentHash, configFingerprint).
 */
export function computeShardKey(
	sourceRelPath: string,
	contentHash: string,
	configFingerprint: string,
): string {
	const normalizedRelPath = sourceRelPath.replace(/\\/g, "/");
	return crypto
		.createHash("sha256")
		.update(`${normalizedRelPath}:${contentHash}:${configFingerprint}`)
		.digest("hex");
}

/**
 * Manages persistent on-disk serialization, hydration, and lifecycle of tokenized source shards.
 */
export class DiskCacheManager {
	readonly rootDir: string;
	readonly baseCacheDir: string;
	readonly workspaceCacheDir: string;
	readonly configFingerprint: string;
	readonly maxBytes: number;

	constructor(options: DiskCacheOptions) {
		this.rootDir = path.resolve(options.rootDir);
		this.baseCacheDir = options.cacheDir
			? path.resolve(options.cacheDir)
			: getDefaultCacheDir();
		this.configFingerprint = computeConfigFingerprint(options.config);
		this.workspaceCacheDir = computeWorkspaceCacheDir(
			this.baseCacheDir,
			this.rootDir,
			this.configFingerprint,
		);
		this.maxBytes = options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
	}

	/**
	 * Retrieves a serialized shard from disk if present and valid.
	 * Returns null on cache miss or corrupted/invalid shard (fails open).
	 */
	async getShard(
		relPath: string,
		contentHash: string,
	): Promise<SerializedSourceShard | null> {
		try {
			const shardKey = computeShardKey(
				relPath,
				contentHash,
				this.configFingerprint,
			);
			const shardPath = path.join(this.workspaceCacheDir, `${shardKey}.json`);

			const raw = await fs.readFile(shardPath, "utf8");
			const shard = JSON.parse(raw) as SerializedSourceShard;

			// Validate shard structure and content hash
			if (
				!shard ||
				typeof shard !== "object" ||
				shard.version !== 1 ||
				shard.contentHash !== contentHash ||
				typeof shard.sourceId !== "string" ||
				!Array.isArray(shard.frames)
			) {
				return null;
			}

			// Touch file for LRU ordering
			fs.utimes(shardPath, new Date(), new Date()).catch(() => {});

			return shard;
		} catch {
			// Fail open on missing file, JSON syntax errors, permission issues
			return null;
		}
	}

	/**
	 * Atomically saves a pre-tokenized shard to disk cache via temp file + rename.
	 * Fails open without throwing on I/O errors.
	 */
	async saveShard(
		shard: SerializedSourceShard,
		relPath?: string,
	): Promise<void> {
		let tempPath: string | null = null;
		try {
			const targetRelPath =
				relPath ??
				(path.isAbsolute(shard.sourceId)
					? path.relative(this.rootDir, shard.sourceId)
					: shard.sourceId);

			const shardKey = computeShardKey(
				targetRelPath,
				shard.contentHash,
				this.configFingerprint,
			);

			await fs.mkdir(this.workspaceCacheDir, { recursive: true });

			const targetPath = path.join(this.workspaceCacheDir, `${shardKey}.json`);
			tempPath = path.join(
				this.workspaceCacheDir,
				`.${shardKey}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
			);

			const payload = JSON.stringify(shard);
			await fs.writeFile(tempPath, payload, "utf8");
			await fs.rename(tempPath, targetPath);
		} catch {
			if (tempPath) {
				await fs.unlink(tempPath).catch(() => {});
			}
			// Fail open: cache write failures should not disrupt indexing
		}
	}

	/**
	 * Prunes the oldest shard files across the cache if total size exceeds budget.
	 */
	async prune(maxBytes?: number): Promise<void> {
		const budget = maxBytes !== undefined ? maxBytes : this.maxBytes;

		try {
			const entries = await this.#collectCacheFiles(this.baseCacheDir);
			let totalSize = entries.reduce((acc, e) => acc + e.size, 0);

			if (totalSize <= budget) {
				return;
			}

			// Sort by oldest access/modification time first
			entries.sort((a, b) => a.mtime - b.mtime);

			for (const entry of entries) {
				if (totalSize <= budget) {
					break;
				}
				try {
					await fs.unlink(entry.filePath);
					totalSize -= entry.size;
				} catch {
					// Ignore individual file deletion errors
				}
			}
		} catch {
			// Fail open on pruning errors
		}
	}

	/**
	 * Clears all cached shards in the current workspace cache directory.
	 */
	async clear(): Promise<void> {
		try {
			await fs.rm(this.workspaceCacheDir, {
				recursive: true,
				force: true,
			});
		} catch {
			// Fail open
		}
	}

	/**
	 * Recursively collects all shard files (.json) and deletes stale temp files (.tmp).
	 */
	async #collectCacheFiles(
		dir: string,
	): Promise<Array<{ filePath: string; size: number; mtime: number }>> {
		const results: Array<{
			filePath: string;
			size: number;
			mtime: number;
		}> = [];

		try {
			const dirents = await fs.readdir(dir, { withFileTypes: true });
			const now = Date.now();

			for (const dirent of dirents) {
				const fullPath = path.join(dir, dirent.name);

				if (dirent.isDirectory()) {
					const subResults = await this.#collectCacheFiles(fullPath);
					results.push(...subResults);
				} else if (dirent.isFile()) {
					if (dirent.name.endsWith(".json")) {
						try {
							const stat = await fs.stat(fullPath);
							results.push({
								filePath: fullPath,
								size: stat.size,
								mtime: stat.mtimeMs,
							});
						} catch {
							// Ignore inaccessible files
						}
					} else if (
						dirent.name.endsWith(".tmp") ||
						dirent.name.startsWith(".")
					) {
						// Clean up stale temporary files older than 60 seconds
						try {
							const stat = await fs.stat(fullPath);
							if (now - stat.mtimeMs > 60_000) {
								await fs.unlink(fullPath).catch(() => {});
							}
						} catch {
							// Ignore
						}
					}
				}
			}
		} catch {
			// Directory may not exist yet
		}

		return results;
	}
}
