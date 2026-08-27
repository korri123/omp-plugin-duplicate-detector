/**
 * Persistent disk cache for pre-tokenized source shards.
 * Provides atomic writes, fail-open error handling, config-aware workspace keying,
 * high-density binary compression, and byte-budgeted LRU cache pruning.
 */

import { Database, type Statement } from "bun:sqlite";
import * as crypto from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import {
	reconstructFramesFromTokens,
	type SerializedSourceShard,
	type SerializedToken,
	type SourceAwareIndexOptions,
	type SourceFrame,
} from "./source-aware-index";
import type { WorkspaceOptions } from "./worker-protocol";

const DEFAULT_MAX_CACHE_BYTES = 250 * 1024 * 1024; // 250 MB
const TOKENIZER_CACHE_VERSION = "5.0";

export interface DiskCacheOptions {
	/** Root directory of the workspace */
	rootDir: string;
	/** Stable repository key (from resolveRepositoryContext) */
	repositoryKey?: string;
	/** Custom base cache directory (defaults to OS user cache directory) */
	cacheDir?: string;
	/** Detector configuration used to compute configuration fingerprint */
	config?: WorkspaceOptions | SourceAwareIndexOptions;
	/** Maximum cache size in bytes before pruning (default: 250 MB) */
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
	if (!config) return `default_${TOKENIZER_CACHE_VERSION}`;

	let sortedFormats: Record<string, string[]> | undefined;
	if (config.formatsExts) {
		sortedFormats = {};
		for (const key of Object.keys(config.formatsExts).sort()) {
			sortedFormats[key] = (config.formatsExts[key] ?? []).slice().sort();
		}
	}

	const canonical = {
		version: TOKENIZER_CACHE_VERSION,
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
 * Computes the workspace SQLite cache database path keyed by repository identity and config fingerprint.
 */
export function computeWorkspaceCachePath(
	baseDir: string,
	repositoryKeyOrRootDir: string,
	configFingerprint: string,
): string {
	const isKey = /^[0-9a-f]{16}$/i.test(repositoryKeyOrRootDir);
	const repoKey = isKey
		? repositoryKeyOrRootDir
		: crypto
				.createHash("sha256")
				.update(path.resolve(repositoryKeyOrRootDir))
				.digest("hex")
				.slice(0, 16);

	return path.join(
		baseDir,
		`${repoKey}_${configFingerprint}_v${CACHE_FORMAT_VERSION}.sqlite`,
	);
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

/** Current binary format magic identifier ('DUP3') */
export const CACHE_FORMAT_MAGIC = "DUP3";

/** Current binary format & SQLite schema version */
export const CACHE_FORMAT_VERSION = 5;

/**
 * Encodes a SerializedSourceShard into a high-density, zlib-compressed binary buffer (DUP3 format).
 */
function packBinaryShard(shard: SerializedSourceShard): Buffer {
	return packBinaryShardV3(shard, shard.tokens ?? []);
}

/**
 * Packs token sequence into ultra-compact DUP3 binary format using dictionary-encoded
 * token hashes and columnar delta-encoded coordinates.
 */
function packBinaryShardV3(
	shard: SerializedSourceShard,
	tokens: SerializedToken[],
): Buffer {
	const tokenCount = tokens.length;
	const dictionary: string[] = [];
	const dictMap = new Map<string, number>();

	for (let i = 0; i < tokenCount; i++) {
		const h = tokens[i]!.hash;
		if (!dictMap.has(h)) {
			dictMap.set(h, dictionary.length);
			dictionary.push(h);
		}
	}

	const dictCount = dictionary.length;
	const dictEntries: Buffer[] = new Array(dictCount);
	for (let i = 0; i < dictCount; i++) {
		const hex = dictionary[i]!;
		dictEntries[i] = Buffer.from(hex, "hex");
	}
	const dictBuf = Buffer.concat(dictEntries);

	const indicesBuf = Buffer.allocUnsafe(tokenCount * 2);
	for (let i = 0; i < tokenCount; i++) {
		const idx = dictMap.get(tokens[i]!.hash)!;
		indicesBuf.writeUInt16LE(idx, i * 2);
	}

	const colBytes = tokenCount * 4;
	const dLinesBuf = Buffer.allocUnsafe(colBytes);
	const dColsBuf = Buffer.allocUnsafe(colBytes);
	const dPosBuf = Buffer.allocUnsafe(colBytes);
	const dLenBuf = Buffer.allocUnsafe(colBytes);

	let prevLine = 0;
	let prevCol = 0;
	let prevRangeStart = 0;

	for (let i = 0; i < tokenCount; i++) {
		const tok = tokens[i]!;
		const dLine = tok.line - prevLine;
		const dCol = tok.column - prevCol;
		const startRange =
			Array.isArray(tok.range) && tok.range.length >= 2
				? tok.range[0]
				: (tok.position ?? i);
		const endRange =
			Array.isArray(tok.range) && tok.range.length >= 2
				? tok.range[1]
				: startRange;
		const len = Math.max(0, endRange - startRange);
		const dRangeStart = startRange - prevRangeStart;

		dLinesBuf.writeInt32LE(dLine, i * 4);
		dColsBuf.writeInt32LE(dCol, i * 4);
		dPosBuf.writeInt32LE(dRangeStart, i * 4);
		dLenBuf.writeUInt32LE(len, i * 4);

		prevLine = tok.line;
		prevCol = tok.column;
		prevRangeStart = startRange;
	}

	const meta = {
		sourceId: shard.sourceId,
		contentHash: shard.contentHash,
		format: shard.format,
		size: shard.size,
		lines: shard.lines,
		tokenCount: shard.tokenCount,
		minTokens: shard.minTokens,
		updatedAt: shard.updatedAt ?? Date.now(),
	};
	const metaJson = Buffer.from(JSON.stringify(meta), "utf-8");

	const HEADER_SIZE = 16;
	const header = Buffer.allocUnsafe(HEADER_SIZE);
	header.write(CACHE_FORMAT_MAGIC, 0, 4, "ascii");
	header.writeUInt16LE(CACHE_FORMAT_VERSION, 4);
	header.writeUInt16LE(metaJson.length, 6);
	header.writeUInt32LE(tokenCount, 8);
	header.writeUInt32LE(dictCount, 12);

	const rawUncompressed = Buffer.concat([
		header,
		metaJson,
		dictBuf,
		indicesBuf,
		dLinesBuf,
		dColsBuf,
		dPosBuf,
		dLenBuf,
	]);

	return zlib.deflateSync(rawUncompressed, { level: 6 });
}

/**
 * Decodes a zlib-compressed binary buffer into a SerializedSourceShard.
 * Returns null if invalid, corrupted, or version mismatch (fails open).
 */
export function unpackBinaryShard(
	compressed: Buffer,
): SerializedSourceShard | null {
	try {
		const raw = zlib.inflateSync(compressed);
		if (raw.length < 16) return null;

		const magic = raw.toString("ascii", 0, 4);
		if (magic === CACHE_FORMAT_MAGIC) {
			return unpackBinaryShardV3(raw);
		}
		return null;
	} catch {
		return null;
	}
}

function unpackBinaryShardV3(buf: Buffer): SerializedSourceShard | null {
	try {
		const version = buf.readUInt16LE(4);
		if (version !== CACHE_FORMAT_VERSION) return null;

		const metaLen = buf.readUInt16LE(6);
		const tokenCount = buf.readUInt32LE(8);
		const dictCount = buf.readUInt32LE(12);

		let offset = 16;
		const metaJsonBuf = buf.subarray(offset, offset + metaLen);
		offset += metaLen;

		const meta = JSON.parse(metaJsonBuf.toString("utf-8"));
		const TOKEN_HASH_RAW_BYTES = 10;
		const dictByteLen = dictCount * TOKEN_HASH_RAW_BYTES;
		if (buf.length < offset + dictByteLen) return null;

		const dictionary: string[] = new Array(dictCount);
		for (let i = 0; i < dictCount; i++) {
			dictionary[i] = buf
				.subarray(offset + i * 10, offset + (i + 1) * 10)
				.toString("hex");
		}
		offset += dictByteLen;

		const indicesByteLen = tokenCount * 2;
		if (buf.length < offset + indicesByteLen) return null;
		const indices = new Uint16Array(tokenCount);
		for (let i = 0; i < tokenCount; i++) {
			indices[i] = buf.readUInt16LE(offset + i * 2);
		}
		offset += indicesByteLen;

		const colBytes = tokenCount * 4;
		if (buf.length < offset + colBytes * 4) return null;

		const dLines = new Int32Array(tokenCount);
		const dCols = new Int32Array(tokenCount);
		const dPos = new Int32Array(tokenCount);
		const dLens = new Uint32Array(tokenCount);

		for (let i = 0; i < tokenCount; i++) {
			dLines[i] = buf.readInt32LE(offset + i * 4);
		}
		offset += colBytes;

		for (let i = 0; i < tokenCount; i++) {
			dCols[i] = buf.readInt32LE(offset + i * 4);
		}
		offset += colBytes;

		for (let i = 0; i < tokenCount; i++) {
			dPos[i] = buf.readInt32LE(offset + i * 4);
		}
		offset += colBytes;

		for (let i = 0; i < tokenCount; i++) {
			dLens[i] = buf.readUInt32LE(offset + i * 4);
		}
		offset += colBytes;

		const tokens: SerializedToken[] = new Array(tokenCount);
		let curLine = 0;
		let curCol = 0;
		let curRangeStart = 0;

		for (let i = 0; i < tokenCount; i++) {
			curLine += dLines[i]!;
			curCol += dCols[i]!;
			curRangeStart += dPos[i]!;
			const len = dLens[i]!;
			const dictIdx = indices[i]!;
			const hash = dictionary[dictIdx] ?? "";

			tokens[i] = {
				hash,
				line: curLine,
				column: curCol,
				position: i,
				range: [curRangeStart, curRangeStart + len],
			};
		}

		const minTokens = meta.minTokens ?? 40;
		const frames: SourceFrame[] = reconstructFramesFromTokens(
			tokens,
			meta.sourceId,
			minTokens,
		);

		return {
			version,
			sourceId: meta.sourceId,
			contentHash: meta.contentHash,
			format: meta.format,
			size: meta.size,
			lines: meta.lines,
			tokenCount,
			minTokens,
			updatedAt: meta.updatedAt,
			tokens,
			frames,
		};
	} catch {
		return null;
	}
}

/**
 * Manages persistent SQLite database caching, hydration, and lifecycle of tokenized source shards.
 */
export class DiskCacheManager {
	readonly rootDir: string;
	readonly repositoryKey: string;
	readonly baseCacheDir: string;
	readonly dbPath: string;
	readonly workspaceCacheDir: string;
	readonly configFingerprint: string;
	readonly maxBytes: number;

	#db: Database | null = null;
	#getStmt: Statement | null = null;
	#saveStmt: Statement | null = null;
	#deleteStmt: Statement | null = null;
	#deleteByRelPathStmt: Statement | null = null;
	#totalSizeStmt: Statement | null = null;
	#oldestShardsStmt: Statement | null = null;
	#deleteAllStmt: Statement | null = null;
	#closed = false;

	constructor(options: DiskCacheOptions) {
		this.rootDir = path.resolve(options.rootDir);
		this.repositoryKey =
			options.repositoryKey ??
			crypto
				.createHash("sha256")
				.update(this.rootDir)
				.digest("hex")
				.slice(0, 16);
		this.baseCacheDir = options.cacheDir
			? path.resolve(options.cacheDir)
			: getDefaultCacheDir();
		this.configFingerprint = computeConfigFingerprint(options.config);
		this.dbPath = computeWorkspaceCachePath(
			this.baseCacheDir,
			this.repositoryKey,
			this.configFingerprint,
		);
		this.workspaceCacheDir = this.baseCacheDir;
		this.maxBytes = options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
	}

	#getDb(): Database | null {
		if (this.#closed) return null;
		if (this.#db) return this.#db;

		let db: Database | null = null;
		try {
			const dir = path.dirname(this.dbPath);
			if (!fsSync.existsSync(dir)) {
				fsSync.mkdirSync(dir, { recursive: true });
			}

			db = new Database(this.dbPath, { create: true });
			db.exec("PRAGMA busy_timeout = 2000;");
			const journalRow = db.query("PRAGMA journal_mode = WAL;").get() as
				| { journal_mode?: string }
				| undefined;
			if (journalRow?.journal_mode?.toLowerCase() !== "wal") {
				try {
					db.close();
				} catch {}
				return null;
			}
			db.exec("PRAGMA synchronous = NORMAL;");
			db.exec("PRAGMA temp_store = MEMORY;");
			const versionRow = db.query("PRAGMA user_version;").get() as
				| { user_version: number }
				| undefined;
			const schemaVersion = versionRow?.user_version ?? 0;
			if (schemaVersion !== CACHE_FORMAT_VERSION) {
				try {
					db.exec("DELETE FROM shards;");
				} catch {}
				db.exec(`PRAGMA user_version = ${CACHE_FORMAT_VERSION};`);
			}

			db.exec(`
				CREATE TABLE IF NOT EXISTS shards (
					rel_path TEXT NOT NULL,
					content_hash TEXT NOT NULL,
					payload BLOB NOT NULL,
					mtime REAL NOT NULL,
					PRIMARY KEY (rel_path, content_hash)
				);
				CREATE INDEX IF NOT EXISTS idx_shards_mtime ON shards(mtime);
			`);
			this.#getStmt = db.prepare(
				"SELECT payload FROM shards WHERE rel_path = ?1 AND content_hash = ?2",
			);
			this.#saveStmt = db.prepare(`
				INSERT INTO shards (rel_path, content_hash, payload, mtime)
				VALUES (?1, ?2, ?3, ?4)
				ON CONFLICT(rel_path, content_hash) DO UPDATE SET
					mtime = excluded.mtime
			`);
			this.#deleteStmt = db.prepare(
				"DELETE FROM shards WHERE rel_path = ?1 AND content_hash = ?2",
			);
			this.#deleteByRelPathStmt = db.prepare(
				"DELETE FROM shards WHERE rel_path = ?1",
			);
			this.#totalSizeStmt = db.prepare(
				"SELECT COALESCE(SUM(LENGTH(payload)), 0) as total FROM shards",
			);
			this.#oldestShardsStmt = db.prepare(
				"SELECT rowid, LENGTH(payload) as size FROM shards ORDER BY mtime ASC LIMIT ?1",
			);
			this.#deleteAllStmt = db.prepare("DELETE FROM shards");

			this.#db = db;
			return db;
		} catch {
			if (db) {
				try {
					db.close();
				} catch {}
			}
			// Fail open on SQLite creation or permission errors
			return null;
		}
	}

	/**
	 * Retrieves a serialized shard from the SQLite cache if present and valid.
	 * Pure read-only operation: does not issue write transactions on cache hits.
	 * Returns null on cache miss or corrupted/invalid shard (fails open).
	 */
	async getShard(
		relPath: string,
		contentHash: string,
	): Promise<SerializedSourceShard | null> {
		try {
			const db = this.#getDb();
			if (!db || !this.#getStmt) return null;

			const normalizedRelPath = relPath.replace(/\\/g, "/");
			const row = this.#getStmt.get(normalizedRelPath, contentHash) as
				| {
						payload: Uint8Array | Buffer;
				  }
				| null
				| undefined;

			if (!row) {
				return null;
			}

			const payloadBuf = Buffer.isBuffer(row.payload)
				? row.payload
				: Buffer.from(
						row.payload.buffer,
						row.payload.byteOffset,
						row.payload.byteLength,
					);

			const shard = unpackBinaryShard(payloadBuf);
			if (
				shard &&
				shard.contentHash === contentHash &&
				Array.isArray(shard.frames)
			) {
				return shard;
			}

			return null;
		} catch {
			// Fail open on any error
			return null;
		}
	}

	/**
	 * Atomically saves a pre-tokenized shard to SQLite cache table.
	 * Fails open without throwing on I/O errors.
	 */
	async saveShard(
		shard: SerializedSourceShard,
		relPath?: string,
	): Promise<void> {
		try {
			const db = this.#getDb();
			if (!db || !this.#saveStmt) return;

			const targetRelPath =
				relPath ??
				(path.isAbsolute(shard.sourceId)
					? path.relative(this.rootDir, shard.sourceId)
					: shard.sourceId);

			const normalizedRelPath = targetRelPath.replace(/\\/g, "/");
			const payload = packBinaryShard(shard);

			this.#saveStmt.run(
				normalizedRelPath,
				shard.contentHash,
				payload,
				Date.now(),
			);
		} catch {
			// Fail open: cache write failures should not disrupt indexing
		}
	}
	/**
	 * Deletes a cached shard by relPath and contentHash if present.
	 */
	async deleteShard(relPath: string, contentHash: string): Promise<void> {
		try {
			const db = this.#getDb();
			if (!db || !this.#deleteStmt) return;
			const normalizedRelPath = relPath.replace(/\\/g, "/");
			this.#deleteStmt.run(normalizedRelPath, contentHash);
		} catch {
			// Fail open
		}
	}
	/**
	 * Deletes all cached shards for a given relPath regardless of contentHash.
	 */
	async deleteByRelPath(relPath: string): Promise<void> {
		try {
			const db = this.#getDb();
			if (!db || !this.#deleteByRelPathStmt) return;
			const normalizedRelPath = relPath.replace(/\\/g, "/");
			this.#deleteByRelPathStmt.run(normalizedRelPath);
		} catch {
			// Fail open
		}
	}

	/**
	 * Atomically saves a batch of pre-tokenized shards inside a single SQLite transaction.
	 */
	async saveShards(
		items: Array<{ shard: SerializedSourceShard; relPath?: string }>,
	): Promise<void> {
		if (items.length === 0) return;
		try {
			const db = this.#getDb();
			if (!db || !this.#saveStmt) return;

			const stmt = this.#saveStmt;
			const root = this.rootDir;
			const now = Date.now();

			// Pre-pack payloads outside transaction to minimize write lock time
			const prepared: Array<{
				relPath: string;
				hash: string;
				payload: Buffer;
			}> = [];
			for (const item of items) {
				const targetRelPath =
					item.relPath ??
					(path.isAbsolute(item.shard.sourceId)
						? path.relative(root, item.shard.sourceId)
						: item.shard.sourceId);
				const normalizedRelPath = targetRelPath.replace(/\\/g, "/");
				const payload = packBinaryShard(item.shard);
				prepared.push({
					relPath: normalizedRelPath,
					hash: item.shard.contentHash,
					payload,
				});
			}

			const tx = db.transaction((entries: typeof prepared) => {
				for (const entry of entries) {
					stmt.run(entry.relPath, entry.hash, entry.payload, now);
				}
			});

			tx(prepared);
		} catch {
			// Fail open
		}
	}

	/**
	 * Prunes oldest shards if total payload size exceeds budget using atomic windowed DELETE.
	 * Avoids concurrent VACUUM calls during active sessions.
	 */
	async prune(maxBytes?: number): Promise<void> {
		const budget = maxBytes !== undefined ? maxBytes : this.maxBytes;

		try {
			const db = this.#getDb();
			if (!db) return;

			if (budget <= 0) {
				this.#deleteAllStmt?.run();
				return;
			}

			// Iteratively prune oldest shards in bounded windows
			for (let iter = 0; iter < 10; iter++) {
				const totalRow = this.#totalSizeStmt?.get() as
					| { total: number }
					| null
					| undefined;
				const totalSize = totalRow?.total ?? 0;

				if (totalSize <= budget) {
					break;
				}

				const excess = totalSize - budget;
				const rows = (this.#oldestShardsStmt?.all(100) ?? []) as Array<{
					rowid: number;
					size: number;
				}>;

				if (rows.length === 0) break;

				const rowidsToDelete: number[] = [];
				let freed = 0;
				for (const r of rows) {
					rowidsToDelete.push(r.rowid);
					freed += r.size;
					if (freed >= excess) break;
				}

				if (rowidsToDelete.length > 0) {
					const deleteBatchStmt = db.prepare(
						`DELETE FROM shards WHERE rowid IN (${rowidsToDelete.join(",")})`,
					);
					deleteBatchStmt.run();
				} else {
					break;
				}
			}
		} catch {
			// Fail open on pruning errors
		}
	}

	/**
	 * Clears all cached shards in the current workspace cache database non-destructively.
	 */
	async clear(): Promise<void> {
		try {
			const db = this.#getDb();
			if (db && this.#deleteAllStmt) {
				this.#deleteAllStmt.run();
			}
		} catch {
			// Fail open
		}
	}

	/**
	 * Safely closes the SQLite database connection.
	 */
	close(): void {
		this.#closed = true;
		if (this.#db) {
			try {
				this.#db.close();
			} catch {}
			this.#db = null;
			this.#getStmt = null;
			this.#saveStmt = null;
			this.#deleteStmt = null;
			this.#deleteByRelPathStmt = null;
			this.#totalSizeStmt = null;
			this.#oldestShardsStmt = null;
			this.#deleteAllStmt = null;
		}
	}
}

/**
 * Removes legacy pre-v4 cache files from the cache directory.
 */
export async function cleanupLegacyCacheFiles(
	customCacheDir?: string,
): Promise<void> {
	const baseDir = customCacheDir ?? getDefaultCacheDir();
	try {
		if (!fsSync.existsSync(baseDir)) return;
		const entries = await fs.readdir(baseDir);
		for (const entry of entries) {
			if (
				entry.endsWith(".sqlite") &&
				!entry.includes(`_v${CACHE_FORMAT_VERSION}.sqlite`)
			) {
				await fs.unlink(path.join(baseDir, entry)).catch(() => {});
				await fs.unlink(path.join(baseDir, `${entry}-wal`)).catch(() => {});
				await fs.unlink(path.join(baseDir, `${entry}-shm`)).catch(() => {});
			}
		}
	} catch {
		// Fail open
	}
}
