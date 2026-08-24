/**
 * Source-aware clone index with multi-contributor frame promotion and fast O(frames) deletion.
 * Correctly maintains multi-source clone tracking so deleting one contributor does not
 * wipe out shared code hashes for remaining sources.
 */

import {
	getDefaultOptions,
	type IClone,
	type IMapFrame,
	type IOptions,
	type ITokenMap,
	mild,
} from "@jscpd/core";
import { Tokenizer } from "@jscpd/tokenizer";
import { getSupportedCodeFormat } from "./jscpd-engine";
export class CompactSourceFrame {
	constructor(
		public readonly id: string,
		public readonly sourceId: string,
		public readonly startLine: number,
		public readonly startCol: number,
		public readonly startPos: number,
		public readonly startRange: number,
		public readonly endLine: number,
		public readonly endCol: number,
		public readonly endPos: number,
		public readonly endRange: number,
	) {}

	get start() {
		return {
			line: this.startLine,
			column: this.startCol,
			position: this.startPos,
			range: [this.startRange, this.startRange] as [number, number],
			loc: {
				start: {
					line: this.startLine,
					column: this.startCol,
					position: this.startPos,
				},
				end: {
					line: this.startLine,
					column: this.startCol,
					position: this.startPos,
				},
			},
		};
	}

	get end() {
		return {
			line: this.endLine,
			column: this.endCol,
			position: this.endPos,
			range: [this.endRange, this.endRange] as [number, number],
			loc: {
				start: {
					line: this.endLine,
					column: this.endCol,
					position: this.endPos,
				},
				end: {
					line: this.endLine,
					column: this.endCol,
					position: this.endPos,
				},
			},
		};
	}
}

export type SourceFrame = IMapFrame | CompactSourceFrame;

export interface SerializedToken {
	hash: string;
	line: number;
	column: number;
	position: number;
	range: [number, number];
}

export interface SerializedSourceShard {
	version: number;
	sourceId: string;
	contentHash: string;
	format: string;
	size: number;
	lines: number;
	tokenCount: number;
	minTokens?: number;
	updatedAt?: number;
	tokens?: SerializedToken[];
	frames: SourceFrame[];
}

export const fastTokenHash = (val: string): string =>
	Bun.hash(val).toString(16).padStart(20, "0");

/**
 * Reconstructs sliding window SourceFrames from a pre-tokenized token sequence.
 */
export function reconstructFramesFromTokens(
	tokens: SerializedToken[],
	sourceId: string,
	minTokens: number,
	hashFunction: (val: string) => string = fastTokenHash,
): CompactSourceFrame[] {
	const tokenCount = tokens.length;
	const frameCount = Math.max(0, tokenCount - minTokens);
	const hashMap = tokens.map((t) => t.hash).join("");
	const TOKEN_HASH_LEN = 20;

	const frames: CompactSourceFrame[] = new Array(frameCount);
	for (let i = 0; i < frameCount; i++) {
		const windowSub = hashMap.substring(
			i * TOKEN_HASH_LEN,
			(i + minTokens) * TOKEN_HASH_LEN,
		);
		const windowHash = hashFunction(windowSub).substring(0, TOKEN_HASH_LEN);
		const startTok = tokens[i]!;
		const endTok = tokens[i + minTokens]!;

		frames[i] = new CompactSourceFrame(
			windowHash,
			sourceId,
			startTok.line,
			startTok.column,
			startTok.position,
			startTok.range[0],
			endTok.line,
			endTok.column,
			endTok.position,
			endTok.range[1],
		);
	}
	return frames;
}

/**
 * Tokenize a source file into a SerializedSourceShard without modifying index state.
 */
export function tokenizeSource(
	sourceId: string,
	content: string,
	contentHash = "",
	options: SourceAwareIndexOptions = {},
): SerializedSourceShard | null {
	const index = new SourceAwareCloneIndex(options);
	return index.tokenizeSource(sourceId, content, contentHash);
}
export interface SourceMeta {
	sourceId: string;
	format: string;
	size: number;
	lines: number;
	tokenCount: number;
	updatedAt: number;
}

export interface SourceAwareIndexOptions {
	minTokens?: number;
	minLines?: number;
	maxLines?: number;
	formatsExts?: Record<string, string[]>;
	crossFormats?: boolean;
	hashFunction?: (val: string) => string;
}

export interface IndexStats {
	sourceCount: number;
	hashCount: number;
	totalTokens: number;
}

interface ActiveCloneCandidate {
	clone: IClone;
	targetFrame: SourceFrame;
	lastSourceEndRange: number;
	lastTargetEndRange: number;
}

interface TokenMapsResult {
	format: string;
	maps: ITokenMap[];
}

/**
 * High-performance, source-aware clone index.
 * Stores token frames by hash, promoting from single frames to arrays when multiple
 * sources or locations share a token sequence.
 */
export class SourceAwareCloneIndex {
	readonly framesByHash = new Map<
		string,
		CompactSourceFrame | CompactSourceFrame[]
	>();
	readonly hashesBySource = new Map<string, string[]>();
	readonly sources = new Map<string, SourceMeta>();
	readonly #tokensBySource = new Map<string, SerializedToken[]>();
	clones: IClone[] = [];
	readonly #tokenizer: Tokenizer;
	readonly #options: IOptions;
	readonly #minTokens: number;
	readonly #minLines: number;
	readonly #maxLines: number;
	readonly #formatsExts: Record<string, string[]>;
	readonly #hashFunction: (val: string) => string;

	constructor(options: SourceAwareIndexOptions = {}) {
		this.#tokenizer = new Tokenizer();
		this.#minTokens = options.minTokens ?? 40;
		this.#minLines = options.minLines ?? 5;
		this.#maxLines = options.maxLines ?? 500;
		this.#formatsExts = options.formatsExts ?? {};
		this.#hashFunction = options.hashFunction ?? fastTokenHash;

		const baseDefaults = getDefaultOptions();
		this.#options = {
			...baseDefaults,
			mode: baseDefaults.mode || mild,
			minTokens: this.#minTokens,
			minLines: this.#minLines,
			maxLines: this.#maxLines,
			formatsExts: this.#formatsExts,
			hashFunction: this.#hashFunction,
		};
	}

	get minTokens(): number {
		return this.#minTokens;
	}

	get minLines(): number {
		return this.#minLines;
	}

	get maxLines(): number {
		return this.#maxLines;
	}

	get hashFunction(): (val: string) => string {
		return this.#hashFunction;
	}

	get discoveredClones(): IClone[] {
		return this.clones.slice();
	}

	/**
	 * Returns true if the index has indexed the specified sourceId.
	 */
	hasSource(sourceId: string): boolean {
		return this.sources.has(sourceId);
	}

	/**
	 * Get metadata for an indexed source.
	 */
	getSource(sourceId: string): SourceMeta | undefined {
		return this.sources.get(sourceId);
	}

	/**
	 * Return a snapshot of all discovered clones.
	 */
	getClones(): IClone[] {
		return this.clones.slice();
	}

	/**
	 * Returns index statistics.
	 */
	stats(): IndexStats {
		let totalTokens = 0;
		for (const meta of this.sources.values()) {
			totalTokens += meta.tokenCount;
		}
		return {
			sourceCount: this.sources.size,
			hashCount: this.framesByHash.size,
			totalTokens,
		};
	}

	/**
	 * Clear all index state and discovered clones.
	 */
	reset(): void {
		this.framesByHash.clear();
		this.hashesBySource.clear();
		this.sources.clear();
		this.#tokensBySource.clear();
		this.clones = [];
	}

	/**
	 * Add or replace a source file in the clone index.
	 * Returns newly detected clones matching against existing indexed files.
	 */
	addSource(sourceId: string, content: string, format?: string): IClone[] {
		if (this.sources.has(sourceId)) {
			this.removeSource(sourceId);
		}

		const shard = this.tokenizeSource(sourceId, content, "", format);
		if (!shard) {
			return [];
		}
		return this.hydrateSourceShard(shard);
	}

	/**
	 * Export pre-tokenized frames and source metadata as a serialized shard.
	 */
	exportSourceShard(
		sourceId: string,
		contentHash: string,
	): SerializedSourceShard | null {
		const meta = this.sources.get(sourceId);
		const hashes = this.hashesBySource.get(sourceId);
		if (!meta || !hashes) {
			return null;
		}

		const minTokens = this.#minTokens;
		const hashFn = this.#hashFunction;
		const tokens = this.#tokensBySource.get(sourceId);
		let memoizedFrames: CompactSourceFrame[] | null = null;

		const getFrames = (): CompactSourceFrame[] => {
			if (!memoizedFrames) {
				if (tokens && tokens.length > 0) {
					memoizedFrames = reconstructFramesFromTokens(
						tokens,
						meta.sourceId,
						minTokens,
						hashFn,
					);
				} else {
					const frames: CompactSourceFrame[] = [];
					for (const hash of hashes) {
						const entry = this.framesByHash.get(hash);
						if (!entry) continue;
						if (Array.isArray(entry)) {
							const match = entry.find((f) => f.sourceId === sourceId);
							if (match) frames.push(match);
						} else if (entry.sourceId === sourceId) {
							frames.push(entry);
						}
					}
					memoizedFrames = frames;
				}
			}
			return memoizedFrames ?? [];
		};

		return {
			version: 1,
			sourceId: meta.sourceId,
			contentHash,
			format: meta.format,
			size: meta.size,
			lines: meta.lines,
			tokenCount: meta.tokenCount,
			minTokens,
			updatedAt: meta.updatedAt,
			tokens,
			get frames(): CompactSourceFrame[] {
				return getFrames();
			},
		};
	}

	/**
	 * Tokenize a source file into a SerializedSourceShard without modifying index state.
	 * Can be run concurrently in parallel batches.
	 */
	tokenizeSource(
		sourceId: string,
		content: string,
		contentHash = "",
		format?: string,
	): SerializedSourceShard | null {
		const resolvedFormat =
			format ?? getSupportedCodeFormat(sourceId, this.#formatsExts);
		if (!resolvedFormat) {
			return null;
		}

		let maps: ITokenMap[];
		try {
			maps = this.#tokenizer.generateMaps(
				sourceId,
				content,
				resolvedFormat,
				this.#options,
			);
		} catch {
			return null;
		}

		if (!maps || maps.length === 0) {
			return null;
		}

		const sourceTokens: SerializedToken[] = [];
		const TOKEN_HASH_LEN = 20;

		for (const tokenMap of maps) {
			const mapTokens = (tokenMap as unknown as { tokens?: unknown[] }).tokens;
			const hashMap = (tokenMap as unknown as { hashMap?: string }).hashMap;

			if (Array.isArray(mapTokens) && typeof hashMap === "string") {
				for (let i = 0; i < mapTokens.length; i++) {
					const t = mapTokens[i] as {
						line?: number;
						column?: number;
						position?: number;
						range?: [number, number];
						loc?: { start: { line: number; column: number; position: number } };
					};
					const hash = hashMap.substring(
						i * TOKEN_HASH_LEN,
						(i + 1) * TOKEN_HASH_LEN,
					);
					sourceTokens.push({
						hash,
						line: t.loc?.start.line ?? t.line ?? 1,
						column: t.loc?.start.column ?? t.column ?? 1,
						position: t.loc?.start.position ?? t.position ?? i,
						range: t.range ? [t.range[0], t.range[1]] : [0, 0],
					});
				}
			}
		}

		const sourceFrames = reconstructFramesFromTokens(
			sourceTokens,
			sourceId,
			this.#minTokens,
			this.#hashFunction,
		);

		let totalTokens = 0;
		let totalLines = 0;
		for (const map of maps) {
			totalTokens += map.getTokensCount();
			totalLines += map.getLinesCount();
		}

		return {
			version: 1,
			sourceId,
			contentHash,
			format: resolvedFormat,
			size: content.length,
			lines: totalLines || content.split(/\r?\n/).length,
			tokenCount: totalTokens,
			minTokens: this.#minTokens,
			updatedAt: Date.now(),
			tokens: sourceTokens,
			frames: sourceFrames,
		};
	}
	/**
	 * Hydrate a pre-tokenized shard directly into framesByHash, hashesBySource,
	 * and sources without re-running Tokenizer.
	 */
	hydrateSourceShard(shard: SerializedSourceShard): IClone[] {
		const { sourceId, format, size, lines, tokenCount } = shard;

		if (this.sources.has(sourceId)) {
			this.removeSource(sourceId);
		}

		let normalizedFrames: CompactSourceFrame[];
		const shardTokens = shard.tokens;

		if (shard.frames && shard.frames.length > 0) {
			normalizedFrames = shard.frames.map((f) => {
				if (f instanceof CompactSourceFrame && f.sourceId === sourceId) {
					return f;
				}
				const startLine =
					"startLine" in f
						? f.startLine
						: (f.start.loc?.start.line ?? f.start.line ?? 1);
				const startCol =
					"startCol" in f
						? f.startCol
						: (f.start.loc?.start.column ?? f.start.column ?? 1);
				const startPos =
					"startPos" in f
						? f.startPos
						: (f.start.loc?.start.position ?? f.start.position ?? 0);
				const startRange =
					"startRange" in f
						? f.startRange
						: f.start.range
							? f.start.range[0]
							: 0;
				const endLine =
					"endLine" in f
						? f.endLine
						: (f.end.loc?.end.line ?? f.end.line ?? startLine);
				const endCol =
					"endCol" in f
						? f.endCol
						: (f.end.loc?.end.column ?? f.end.column ?? startCol);
				const endPos =
					"endPos" in f
						? f.endPos
						: (f.end.loc?.end.position ?? f.end.position ?? 0);
				const endRange =
					"endRange" in f ? f.endRange : f.end.range ? f.end.range[1] : 0;

				return new CompactSourceFrame(
					f.id,
					sourceId,
					startLine,
					startCol,
					startPos,
					startRange,
					endLine,
					endCol,
					endPos,
					endRange,
				);
			});
		} else if (shardTokens && shardTokens.length > 0) {
			normalizedFrames = reconstructFramesFromTokens(
				shardTokens,
				sourceId,
				this.#minTokens,
				this.#hashFunction,
			);
		} else {
			normalizedFrames = [];
		}

		const hashes: string[] = new Array(normalizedFrames.length);
		for (let i = 0; i < normalizedFrames.length; i++) {
			hashes[i] = normalizedFrames[i]!.id;
		}

		const newClones = this.#detectClonesFromFrames(
			normalizedFrames,
			sourceId,
			format,
			{
				insertFrames: true,
			},
		);

		this.hashesBySource.set(sourceId, hashes);
		if (shardTokens && shardTokens.length > 0) {
			this.#tokensBySource.set(sourceId, shardTokens);
		}
		this.sources.set(sourceId, {
			sourceId,
			format,
			size,
			lines,
			tokenCount,
			updatedAt: shard.updatedAt ?? Date.now(),
		});
		this.clones.push(...newClones);
		return newClones;
	}

	/**
	 * Remove a source from the index.
	 * Performs fast O(frames) multi-contributor cleanup:
	 * - If frame is an array, removes only the frame matching sourceId.
	 * - If remaining is 1 frame, unwraps to a single frame so alternate sources remain searchable.
	 * - If frame was single and belonged to sourceId, deletes the hash entry.
	 */
	removeSource(sourceId: string): void {
		if (!this.sources.has(sourceId)) {
			return;
		}

		const hashes = this.hashesBySource.get(sourceId);
		if (hashes) {
			for (const hash of hashes) {
				const entry = this.framesByHash.get(hash);
				if (!entry) {
					continue;
				}

				if (Array.isArray(entry)) {
					const remaining = entry.filter((f) => f.sourceId !== sourceId);
					if (remaining.length === 0) {
						this.framesByHash.delete(hash);
					} else if (remaining.length === 1) {
						this.framesByHash.set(hash, remaining[0]!);
					} else {
						this.framesByHash.set(hash, remaining);
					}
				} else if (entry.sourceId === sourceId) {
					this.framesByHash.delete(hash);
				}
			}
			this.hashesBySource.delete(sourceId);
		}

		this.#tokensBySource.delete(sourceId);
		this.sources.delete(sourceId);
		this.clones = this.clones.filter(
			(c) =>
				c.duplicationA.sourceId !== sourceId &&
				c.duplicationB.sourceId !== sourceId,
		);
	}
	/**
	 * Update an existing source with modified content.
	 */
	updateSource(sourceId: string, content: string, format?: string): IClone[] {
		this.removeSource(sourceId);
		return this.addSource(sourceId, content, format);
	}

	/**
	 * Check a code snippet or modified file against the index without mutating state.
	 * Returns duplicate clones matching against indexed repository files.
	 */
	checkSnippet(sourceId: string, content: string, format?: string): IClone[] {
		const tokenData = this.#generateTokenMaps(sourceId, content, format);
		if (!tokenData) {
			return [];
		}

		const shard = this.tokenizeSource(sourceId, content, "", format);
		if (!shard) {
			return [];
		}

		return this.#detectClonesFromFrames(shard.frames, sourceId, shard.format, {
			insertFrames: false,
		});
	}

	#generateTokenMaps(
		sourceId: string,
		content: string,
		format?: string,
	): TokenMapsResult | null {
		const resolvedFormat =
			format ?? getSupportedCodeFormat(sourceId, this.#formatsExts);
		if (!resolvedFormat) {
			return null;
		}

		try {
			const maps = this.#tokenizer.generateMaps(
				sourceId,
				content,
				resolvedFormat,
				this.#options,
			);
			return maps && maps.length > 0 ? { format: resolvedFormat, maps } : null;
		} catch {
			return null;
		}
	}

	#detectClonesFromFrames(
		frames: SourceFrame[],
		sourceId: string,
		format: string,
		options: { insertFrames?: boolean } = {},
	): IClone[] {
		const detectedClones: IClone[] = [];
		const { insertFrames = false } = options;
		let activeClones = new Map<string, ActiveCloneCandidate>();

		for (const frame of frames) {
			const frameStartLine =
				"startLine" in frame
					? frame.startLine
					: (frame.start.loc?.start.line ?? frame.start.line ?? 1);
			const frameStartCol =
				"startCol" in frame
					? frame.startCol
					: (frame.start.loc?.start.column ?? frame.start.column ?? 1);
			const frameStartPos =
				"startPos" in frame
					? frame.startPos
					: (frame.start.loc?.start.position ?? frame.start.position ?? 0);
			const frameStartRange =
				"startRange" in frame
					? frame.startRange
					: frame.start.range
						? frame.start.range[0]
						: 0;
			const frameEndLine =
				"endLine" in frame
					? frame.endLine
					: (frame.end.loc?.end.line ?? frame.end.line ?? frameStartLine);
			const frameEndCol =
				"endCol" in frame
					? frame.endCol
					: (frame.end.loc?.end.column ?? frame.end.column ?? frameStartCol);
			const frameEndPos =
				"endPos" in frame
					? frame.endPos
					: (frame.end.loc?.end.position ?? frame.end.position ?? 0);
			const frameEndRange =
				"endRange" in frame
					? frame.endRange
					: frame.end.range
						? frame.end.range[1]
						: 0;

			const normalizedFrame: CompactSourceFrame =
				frame instanceof CompactSourceFrame && frame.sourceId === sourceId
					? frame
					: new CompactSourceFrame(
							frame.id,
							sourceId,
							frameStartLine,
							frameStartCol,
							frameStartPos,
							frameStartRange,
							frameEndLine,
							frameEndCol,
							frameEndPos,
							frameEndRange,
						);
			const frameHash = normalizedFrame.id;

			const candidates = this.framesByHash.get(frameHash);

			// Fast-path bypass when there are no candidate frames and no active clones extending
			if (!candidates && activeClones.size === 0) {
				if (insertFrames) {
					this.#insertFrame(frameHash, normalizedFrame);
				}
				continue;
			}

			const matchedFrames: CompactSourceFrame[] = candidates
				? Array.isArray(candidates)
					? candidates
					: [candidates]
				: [];

			if (matchedFrames.length === 0 && activeClones.size === 0) {
				if (insertFrames) {
					this.#insertFrame(frameHash, normalizedFrame);
				}
				continue;
			}

			if (matchedFrames.length === 0) {
				for (const active of activeClones.values()) {
					if (this.#validateClone(active.clone)) {
						detectedClones.push(active.clone);
					}
				}
				activeClones.clear();
				if (insertFrames) {
					this.#insertFrame(frameHash, normalizedFrame);
				}
				continue;
			}

			const nextActiveClones = new Map<string, ActiveCloneCandidate>();

			for (const targetFrame of matchedFrames) {
				const targetStartLine = targetFrame.startLine;
				const targetStartCol = targetFrame.startCol;
				const targetStartPos = targetFrame.startPos;
				const targetStartRange = targetFrame.startRange;
				const targetEndLine = targetFrame.endLine;
				const targetEndCol = targetFrame.endCol;
				const targetEndPos = targetFrame.endPos;
				const targetEndRange = targetFrame.endRange;

				// Disallow exact self-match at identical line/column position
				if (
					targetFrame.sourceId === sourceId &&
					targetStartLine === frameStartLine &&
					targetStartCol === frameStartCol
				) {
					continue;
				}

				const offsetKey = `${targetFrame.sourceId}:${targetStartRange - frameStartRange}`;

				if (activeClones.has(offsetKey)) {
					const candidate = activeClones.get(offsetKey)!;
					if (candidate.clone.duplicationA.range) {
						candidate.clone.duplicationA.range[1] = frameEndRange;
					}
					candidate.clone.duplicationA.end = {
						line: frameEndLine,
						column: frameEndCol,
						position: frameEndPos,
					};
					if (candidate.clone.duplicationB.range) {
						candidate.clone.duplicationB.range[1] = targetEndRange;
					}
					candidate.clone.duplicationB.end = {
						line: targetEndLine,
						column: targetEndCol,
						position: targetEndPos,
					};
					candidate.lastSourceEndRange = frameEndRange;
					candidate.lastTargetEndRange = targetEndRange;
					nextActiveClones.set(offsetKey, candidate);
				} else {
					const clone: IClone = {
						format,
						foundDate: Date.now(),
						duplicationA: {
							sourceId,
							start: {
								line: frameStartLine,
								column: frameStartCol,
								position: frameStartPos,
							},
							end: {
								line: frameEndLine,
								column: frameEndCol,
								position: frameEndPos,
							},
							range: [frameStartRange, frameEndRange],
						},
						duplicationB: {
							sourceId: targetFrame.sourceId,
							start: {
								line: targetStartLine,
								column: targetStartCol,
								position: targetStartPos,
							},
							end: {
								line: targetEndLine,
								column: targetEndCol,
								position: targetEndPos,
							},
							range: [targetStartRange, targetEndRange],
						},
					};

					nextActiveClones.set(offsetKey, {
						clone,
						targetFrame,
						lastSourceEndRange: frameEndRange,
						lastTargetEndRange: targetEndRange,
					});
				}
			}

			if (activeClones.size > 0) {
				for (const [key, active] of activeClones.entries()) {
					if (!nextActiveClones.has(key)) {
						if (this.#validateClone(active.clone)) {
							detectedClones.push(active.clone);
						}
					}
				}
			}

			activeClones = nextActiveClones;

			if (insertFrames) {
				this.#insertFrame(frameHash, normalizedFrame);
			}
		}

		for (const active of activeClones.values()) {
			if (this.#validateClone(active.clone)) {
				detectedClones.push(active.clone);
			}
		}

		return detectedClones;
	}

	#insertFrame(hash: string, frame: CompactSourceFrame): void {
		const existing = this.framesByHash.get(hash);
		if (!existing) {
			this.framesByHash.set(hash, frame);
			return;
		}

		if (Array.isArray(existing)) {
			const alreadyPresent = existing.some(
				(f) =>
					f.sourceId === frame.sourceId && f.startRange === frame.startRange,
			);
			if (!alreadyPresent) {
				existing.push(frame);
			}
		} else {
			if (
				existing.sourceId !== frame.sourceId ||
				existing.startRange !== frame.startRange
			) {
				this.framesByHash.set(hash, [existing, frame]);
			}
		}
	}

	#validateClone(clone: IClone): boolean {
		const lines =
			clone.duplicationA.end.line - clone.duplicationA.start.line + 1;
		if (lines < this.#minLines) {
			return false;
		}
		if (this.#maxLines && lines > this.#maxLines) {
			return false;
		}
		return true;
	}
}
