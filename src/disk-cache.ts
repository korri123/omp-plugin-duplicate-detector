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

export const DEFAULT_MAX_CACHE_BYTES = 250 * 1024 * 1024; // 250 MB

export interface DiskCacheOptions {
	/** Root directory of the workspace */
	rootDir: string;
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
 * Computes the workspace SQLite cache database path keyed by canonical workspace path and config fingerprint.
 */
export function computeWorkspaceCachePath(
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
	return path.join(baseDir, `${workspaceHash}_${configFingerprint}.sqlite`);
}

/**
 * Computes the workspace cache directory or database path keyed by canonical workspace path and config fingerprint.
 */
export function computeWorkspaceCacheDir(
	baseDir: string,
	rootDir: string,
	configFingerprint: string,
): string {
	return computeWorkspaceCachePath(baseDir, rootDir, configFingerprint);
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
 * Encodes a SerializedSourceShard into a high-density, zlib-compressed binary buffer.
 * Prefers ultra-compact DUP3 token format; falls back to DUP2 frame format.
 */
export function packBinaryShard(shard: SerializedSourceShard): Buffer {
	if (shard.tokens && shard.tokens.length > 0) {
		return packBinaryShardV3(shard, shard.tokens);
	}
	if (shard.frames && shard.frames.length > 0) {
		return packBinaryShardV2(shard, shard.frames);
	}
	return packBinaryShardV3(shard, []);
}

/**
 * Packs token sequence into ultra-compact DUP3 binary format using dictionary-encoded
 * token hashes and columnar delta-encoded coordinates.
 */
function packBinaryShardV3(
	shard: SerializedSourceShard,
	tokens: SerializedToken[],
): Buffer {
	const srcIdBuf = Buffer.from(shard.sourceId, "utf8");
	const formatBuf = Buffer.from(shard.format, "utf8");
	const hashBuf = Buffer.from(shard.contentHash, "utf8");
	const tokenCount = tokens.length;
	const minTokens = shard.minTokens ?? 40;

	// Build dictionary of unique 20-character token hashes
	const dict = new Map<string, number>();
	const tokenIndices = new Uint16Array(tokenCount);
	for (let i = 0; i < tokenCount; i++) {
		const h = tokens[i]!.hash;
		let idx = dict.get(h);
		if (idx === undefined) {
			idx = dict.size;
			dict.set(h, idx);
		}
		tokenIndices[i] = idx;
	}

	const dictCount = dict.size;
	const dictPayloadLen = dictCount * 10;
	// Columnar: dictIdx(2) + deltaLine(2) + col(2) + deltaRange(4) + len(2) = 12 bytes/token
	const columnsPayloadLen = tokenCount * (2 + 2 + 2 + 4 + 2);

	const headerLen =
		4 + // magic 'DUP3'
		2 + // version (3)
		2 +
		formatBuf.length +
		2 +
		hashBuf.length +
		4 + // size
		4 + // lines
		4 + // tokenCount
		8 + // updatedAt
		2 + // minTokens
		2 +
		srcIdBuf.length +
		2 + // dictCount
		4; // tokenCount in payload

	const buf = Buffer.allocUnsafe(
		headerLen + dictPayloadLen + columnsPayloadLen,
	);

	let pos = 0;
	buf.write("DUP3", pos, 4, "ascii");
	pos += 4;
	buf.writeUInt16LE(3, pos);
	pos += 2;

	buf.writeUInt16LE(formatBuf.length, pos);
	pos += 2;
	formatBuf.copy(buf, pos);
	pos += formatBuf.length;

	buf.writeUInt16LE(hashBuf.length, pos);
	pos += 2;
	hashBuf.copy(buf, pos);
	pos += hashBuf.length;

	buf.writeUInt32LE(shard.size, pos);
	pos += 4;
	buf.writeUInt32LE(shard.lines, pos);
	pos += 4;
	buf.writeUInt32LE(shard.tokenCount, pos);
	pos += 4;
	buf.writeDoubleLE(shard.updatedAt ?? Date.now(), pos);
	pos += 8;

	buf.writeUInt16LE(minTokens, pos);
	pos += 2;

	buf.writeUInt16LE(srcIdBuf.length, pos);
	pos += 2;
	srcIdBuf.copy(buf, pos);
	pos += srcIdBuf.length;

	buf.writeUInt16LE(dictCount, pos);
	pos += 2;
	buf.writeUInt32LE(tokenCount, pos);
	pos += 4;

	// Write dictionary table
	for (const h of dict.keys()) {
		const hexHash = h.length === 20 ? h : h.padEnd(20, "0");
		buf.write(hexHash, pos, 10, "hex");
		pos += 10;
	}

	// Columnar byte streams:
	const dictIdxOffset = pos;
	const deltaLineOffset = dictIdxOffset + tokenCount * 2;
	const colOffset = deltaLineOffset + tokenCount * 2;
	const deltaRangeOffset = colOffset + tokenCount * 2;
	const lenOffset = deltaRangeOffset + tokenCount * 4;

	let prevLine = 1;
	let prevRangeStart = 0;

	for (let i = 0; i < tokenCount; i++) {
		const t = tokens[i]!;
		const curLine = t.line;
		const curCol = t.column;
		const curRange0 = t.range[0];
		const curRange1 = t.range[1];
		const tokLen = Math.max(0, curRange1 - curRange0);

		buf.writeUInt16LE(tokenIndices[i]!, dictIdxOffset + i * 2);
		buf.writeUInt16LE(
			Math.min(65535, Math.max(0, curLine - prevLine)),
			deltaLineOffset + i * 2,
		);
		buf.writeUInt16LE(Math.min(65535, Math.max(0, curCol)), colOffset + i * 2);
		buf.writeUInt32LE(
			Math.max(0, curRange0 - prevRangeStart),
			deltaRangeOffset + i * 4,
		);
		buf.writeUInt16LE(Math.min(65535, tokLen), lenOffset + i * 2);

		prevLine = curLine;
		prevRangeStart = curRange0;
	}

	pos = lenOffset + tokenCount * 2;
	return zlib.deflateRawSync(buf.subarray(0, pos));
}

/**
 * Packs legacy sliding-window frames into DUP2 format.
 */
function packBinaryShardV2(
	shard: SerializedSourceShard,
	frames: SourceFrame[],
): Buffer {
	const srcIdBuf = Buffer.from(shard.sourceId, "utf8");
	const formatBuf = Buffer.from(shard.format, "utf8");
	const hashBuf = Buffer.from(shard.contentHash, "utf8");

	let framesPayloadLen = 0;
	const frameCount = frames.length;
	const frameIdBufs = new Array<Buffer>(frameCount);
	for (let i = 0; i < frameCount; i++) {
		const idBuf = Buffer.from(frames[i]!.id, "utf8");
		frameIdBufs[i] = idBuf;
		framesPayloadLen += 1 + idBuf.length + 32; // 1b idLen + idBuf + 8 * 4b coords
	}

	const headerLen =
		4 + // magic 'DUP2'
		2 + // version (2)
		2 +
		formatBuf.length +
		2 +
		hashBuf.length +
		4 + // size
		4 + // lines
		4 + // tokenCount
		8 + // updatedAt
		2 +
		srcIdBuf.length +
		4; // frameCount

	const buf = Buffer.allocUnsafe(headerLen + framesPayloadLen);

	let pos = 0;
	buf.write("DUP2", pos, 4, "ascii");
	pos += 4;
	buf.writeUInt16LE(2, pos);
	pos += 2;

	buf.writeUInt16LE(formatBuf.length, pos);
	pos += 2;
	formatBuf.copy(buf, pos);
	pos += formatBuf.length;

	buf.writeUInt16LE(hashBuf.length, pos);
	pos += 2;
	hashBuf.copy(buf, pos);
	pos += hashBuf.length;

	buf.writeUInt32LE(shard.size, pos);
	pos += 4;
	buf.writeUInt32LE(shard.lines, pos);
	pos += 4;
	buf.writeUInt32LE(shard.tokenCount, pos);
	pos += 4;
	buf.writeDoubleLE(shard.updatedAt ?? Date.now(), pos);
	pos += 8;

	buf.writeUInt16LE(srcIdBuf.length, pos);
	pos += 2;
	srcIdBuf.copy(buf, pos);
	pos += srcIdBuf.length;

	buf.writeUInt32LE(frameCount, pos);
	pos += 4;

	for (let i = 0; i < frameCount; i++) {
		const f = frames[i]!;
		const idBuf = frameIdBufs[i]!;
		buf.writeUInt8(idBuf.length, pos);
		pos += 1;
		idBuf.copy(buf, pos);
		pos += idBuf.length;

		buf.writeInt32LE(f.start.loc?.start.line ?? f.start.line ?? 1, pos);
		pos += 4;
		buf.writeInt32LE(f.start.loc?.start.column ?? f.start.column ?? 1, pos);
		pos += 4;
		buf.writeInt32LE(f.start.loc?.start.position ?? f.start.position ?? 0, pos);
		pos += 4;
		buf.writeInt32LE(f.start.range ? f.start.range[0] : 0, pos);
		pos += 4;
		buf.writeInt32LE(f.end.loc?.end.line ?? f.end.line ?? 1, pos);
		pos += 4;
		buf.writeInt32LE(f.end.loc?.end.column ?? f.end.column ?? 1, pos);
		pos += 4;
		buf.writeInt32LE(f.end.loc?.end.position ?? f.end.position ?? 0, pos);
		pos += 4;
		buf.writeInt32LE(f.end.range ? f.end.range[1] : 0, pos);
		pos += 4;
	}

	return zlib.deflateRawSync(buf);
}

/**
 * Decodes a zlib-compressed binary buffer into a SerializedSourceShard.
 * Supports both DUP3 (Token-based) and DUP2 (Frame-based legacy) formats.
 * Returns null if invalid or corrupted.
 */
export function unpackBinaryShard(
	compressed: Buffer,
): SerializedSourceShard | null {
	try {
		const buf = zlib.inflateRawSync(compressed);
		if (buf.length < 4) return null;
		const magic = buf.toString("ascii", 0, 4);

		if (magic === "DUP3") {
			return unpackBinaryShardV3(buf);
		}
		if (magic === "DUP2") {
			return unpackBinaryShardV2(buf);
		}
		return null;
	} catch {
		return null;
	}
}

function unpackBinaryShardV3(buf: Buffer): SerializedSourceShard | null {
	let pos = 4;
	const version = buf.readUInt16LE(pos);
	pos += 2;
	if (version !== 3) return null;

	const formatLen = buf.readUInt16LE(pos);
	pos += 2;
	const format = buf.toString("utf8", pos, pos + formatLen);
	pos += formatLen;

	const hashLen = buf.readUInt16LE(pos);
	pos += 2;
	const contentHash = buf.toString("utf8", pos, pos + hashLen);
	pos += hashLen;

	const size = buf.readUInt32LE(pos);
	pos += 4;
	const lines = buf.readUInt32LE(pos);
	pos += 4;
	const tokenCount = buf.readUInt32LE(pos);
	pos += 4;
	const updatedAt = buf.readDoubleLE(pos);
	pos += 8;

	const minTokens = buf.readUInt16LE(pos);
	pos += 2;

	const srcLen = buf.readUInt16LE(pos);
	pos += 2;
	const sourceId = buf.toString("utf8", pos, pos + srcLen);
	pos += srcLen;

	const dictCount = buf.readUInt16LE(pos);
	pos += 2;
	const tokensPayloadCount = buf.readUInt32LE(pos);
	pos += 4;

	// Read dictionary table
	const dict = new Array<string>(dictCount);
	for (let i = 0; i < dictCount; i++) {
		dict[i] = buf.toString("hex", pos, pos + 10);
		pos += 10;
	}

	const dictIdxOffset = pos;
	const deltaLineOffset = dictIdxOffset + tokensPayloadCount * 2;
	const colOffset = deltaLineOffset + tokensPayloadCount * 2;
	const deltaRangeOffset = colOffset + tokensPayloadCount * 2;
	const lenOffset = deltaRangeOffset + tokensPayloadCount * 4;

	const tokens: SerializedToken[] = new Array(tokensPayloadCount);
	let prevLine = 1;
	let prevRangeStart = 0;

	for (let i = 0; i < tokensPayloadCount; i++) {
		const dictIdx = buf.readUInt16LE(dictIdxOffset + i * 2);
		const hash = dict[dictIdx] || "";
		const deltaLine = buf.readUInt16LE(deltaLineOffset + i * 2);
		const col = buf.readUInt16LE(colOffset + i * 2);
		const deltaRange = buf.readUInt32LE(deltaRangeOffset + i * 4);
		const tokLen = buf.readUInt16LE(lenOffset + i * 2);

		const line = prevLine + deltaLine;
		const rangeStart = prevRangeStart + deltaRange;
		const rangeEnd = rangeStart + tokLen;

		tokens[i] = {
			hash,
			line,
			column: col,
			position: i,
			range: [rangeStart, rangeEnd],
		};

		prevLine = line;
		prevRangeStart = rangeStart;
	}

	let memoizedFrames: SourceFrame[] | null = null;

	return {
		version: 1,
		sourceId,
		contentHash,
		format,
		size,
		lines,
		tokenCount,
		minTokens,
		updatedAt,
		tokens,
		get frames(): SourceFrame[] {
			if (!memoizedFrames) {
				memoizedFrames = reconstructFramesFromTokens(
					tokens,
					sourceId,
					minTokens || 40,
				);
			}
			return memoizedFrames;
		},
	};
}

function unpackBinaryShardV2(buf: Buffer): SerializedSourceShard | null {
	let pos = 4;
	const version = buf.readUInt16LE(pos);
	pos += 2;
	if (version !== 2) return null;

	const formatLen = buf.readUInt16LE(pos);
	pos += 2;
	const format = buf.toString("utf8", pos, pos + formatLen);
	pos += formatLen;

	const hashLen = buf.readUInt16LE(pos);
	pos += 2;
	const contentHash = buf.toString("utf8", pos, pos + hashLen);
	pos += hashLen;

	const size = buf.readUInt32LE(pos);
	pos += 4;
	const lines = buf.readUInt32LE(pos);
	pos += 4;
	const tokenCount = buf.readUInt32LE(pos);
	pos += 4;
	const updatedAt = buf.readDoubleLE(pos);
	pos += 8;

	const srcLen = buf.readUInt16LE(pos);
	pos += 2;
	const sourceId = buf.toString("utf8", pos, pos + srcLen);
	pos += srcLen;

	const frameCount = buf.readUInt32LE(pos);
	pos += 4;
	const frames = new Array<SourceFrame>(frameCount);

	for (let i = 0; i < frameCount; i++) {
		const idLen = buf.readUInt8(pos);
		pos += 1;
		const id = buf.toString("utf8", pos, pos + idLen);
		pos += idLen;
		const startLine = buf.readInt32LE(pos);
		pos += 4;
		const startCol = buf.readInt32LE(pos);
		pos += 4;
		const startPos = buf.readInt32LE(pos);
		pos += 4;
		const startRange0 = buf.readInt32LE(pos);
		pos += 4;
		const endLine = buf.readInt32LE(pos);
		pos += 4;
		const endCol = buf.readInt32LE(pos);
		pos += 4;
		const endPos = buf.readInt32LE(pos);
		pos += 4;
		const endRange1 = buf.readInt32LE(pos);
		pos += 4;

		frames[i] = {
			id,
			sourceId,
			start: {
				line: startLine,
				column: startCol,
				position: startPos,
				range: [startRange0, startRange0],
				loc: {
					start: { line: startLine, column: startCol, position: startPos },
					end: { line: startLine, column: startCol, position: startPos },
				},
			},
			end: {
				line: endLine,
				column: endCol,
				position: endPos,
				range: [endRange1, endRange1],
				loc: {
					start: { line: endLine, column: endCol, position: endPos },
					end: { line: endLine, column: endCol, position: endPos },
				},
			},
		};
	}

	return {
		version: 1,
		sourceId,
		contentHash,
		format,
		size,
		lines,
		tokenCount,
		updatedAt,
		frames,
	};
}

/**
 * Manages persistent SQLite database caching, hydration, and lifecycle of tokenized source shards.
 */
export class DiskCacheManager {
	readonly rootDir: string;
	readonly baseCacheDir: string;
	readonly dbPath: string;
	readonly workspaceCacheDir: string;
	readonly configFingerprint: string;
	readonly maxBytes: number;

	#db: Database | null = null;
	#getStmt: Statement | null = null;
	#saveStmt: Statement | null = null;
	#updateMtimeStmt: Statement | null = null;
	#deleteStmt: Statement | null = null;
	#totalSizeStmt: Statement | null = null;
	#oldestShardsStmt: Statement | null = null;
	#deleteAllStmt: Statement | null = null;
	#closed = false;

	constructor(options: DiskCacheOptions) {
		this.rootDir = path.resolve(options.rootDir);
		this.baseCacheDir = options.cacheDir
			? path.resolve(options.cacheDir)
			: getDefaultCacheDir();
		this.configFingerprint = computeConfigFingerprint(options.config);
		this.dbPath = computeWorkspaceCachePath(
			this.baseCacheDir,
			this.rootDir,
			this.configFingerprint,
		);
		this.workspaceCacheDir = this.baseCacheDir;
		this.maxBytes = options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
	}

	#getDb(): Database | null {
		if (this.#closed) return null;
		if (this.#db) return this.#db;

		try {
			const dir = path.dirname(this.dbPath);
			if (!fsSync.existsSync(dir)) {
				fsSync.mkdirSync(dir, { recursive: true });
			}

			const db = new Database(this.dbPath, { create: true });
			db.exec("PRAGMA journal_mode = WAL;");
			db.exec("PRAGMA synchronous = NORMAL;");
			db.exec("PRAGMA temp_store = MEMORY;");

			db.exec(`
				CREATE TABLE IF NOT EXISTS shards (
					rel_path TEXT NOT NULL PRIMARY KEY,
					content_hash TEXT NOT NULL,
					payload BLOB NOT NULL,
					mtime REAL NOT NULL
				);
				CREATE INDEX IF NOT EXISTS idx_shards_content_hash ON shards(content_hash);
				CREATE INDEX IF NOT EXISTS idx_shards_mtime ON shards(mtime);
			`);

			this.#getStmt = db.prepare(
				"SELECT payload, content_hash FROM shards WHERE rel_path = ?1",
			);
			this.#saveStmt = db.prepare(`
				INSERT INTO shards (rel_path, content_hash, payload, mtime)
				VALUES (?1, ?2, ?3, ?4)
				ON CONFLICT(rel_path) DO UPDATE SET
					content_hash = excluded.content_hash,
					payload = excluded.payload,
					mtime = excluded.mtime
			`);
			this.#updateMtimeStmt = db.prepare(
				"UPDATE shards SET mtime = ?1 WHERE rel_path = ?2",
			);
			this.#deleteStmt = db.prepare("DELETE FROM shards WHERE rel_path = ?1");
			this.#totalSizeStmt = db.prepare(
				"SELECT COALESCE(SUM(LENGTH(payload)), 0) as total FROM shards",
			);
			this.#oldestShardsStmt = db.prepare(
				"SELECT rel_path, LENGTH(payload) as size FROM shards ORDER BY mtime ASC",
			);
			this.#deleteAllStmt = db.prepare("DELETE FROM shards");

			this.#db = db;
			return db;
		} catch {
			// Fail open on SQLite creation or permission errors
			return null;
		}
	}

	/**
	 * Retrieves a serialized shard from the SQLite cache if present and valid.
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
			const row = this.#getStmt.get(normalizedRelPath) as
				| {
						payload: Uint8Array | Buffer;
						content_hash: string;
				  }
				| null
				| undefined;

			if (!row || row.content_hash !== contentHash) {
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
				typeof shard.sourceId === "string" &&
				Array.isArray(shard.frames)
			) {
				try {
					this.#updateMtimeStmt?.run(Date.now(), normalizedRelPath);
				} catch {
					// Non-fatal
				}
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
	 * Prunes the oldest shards in the SQLite cache if total payload size exceeds budget.
	 */
	async prune(maxBytes?: number): Promise<void> {
		const budget = maxBytes !== undefined ? maxBytes : this.maxBytes;

		try {
			const db = this.#getDb();
			if (!db) return;

			if (budget <= 0) {
				this.#deleteAllStmt?.run();
				try {
					db.exec("VACUUM;");
				} catch {
					// Ignore vacuum errors
				}
				return;
			}

			const totalRow = this.#totalSizeStmt?.get() as
				| { total: number }
				| null
				| undefined;
			let totalSize = totalRow?.total ?? 0;

			if (totalSize <= budget) {
				return;
			}

			const oldestShards = (this.#oldestShardsStmt?.all() ?? []) as Array<{
				rel_path: string;
				size: number;
			}>;

			let deletedAny = false;
			for (const entry of oldestShards) {
				if (totalSize <= budget) {
					break;
				}
				try {
					this.#deleteStmt?.run(entry.rel_path);
					totalSize -= entry.size;
					deletedAny = true;
				} catch {
					// Ignore individual deletion errors
				}
			}

			if (deletedAny) {
				try {
					db.exec("VACUUM;");
				} catch {
					// Ignore vacuum errors
				}
			}
		} catch {
			// Fail open on pruning errors
		}
	}

	/**
	 * Clears all cached shards in the current workspace cache database.
	 */
	async clear(): Promise<void> {
		try {
			if (this.#db) {
				try {
					this.#db.close();
				} catch {}
				this.#db = null;
				this.#getStmt = null;
				this.#saveStmt = null;
				this.#updateMtimeStmt = null;
				this.#deleteStmt = null;
				this.#totalSizeStmt = null;
				this.#oldestShardsStmt = null;
				this.#deleteAllStmt = null;
			}

			await fs.unlink(this.dbPath).catch(() => {});
			await fs.unlink(`${this.dbPath}-wal`).catch(() => {});
			await fs.unlink(`${this.dbPath}-shm`).catch(() => {});
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
			this.#updateMtimeStmt = null;
			this.#deleteStmt = null;
			this.#totalSizeStmt = null;
			this.#oldestShardsStmt = null;
			this.#deleteAllStmt = null;
		}
	}
}
