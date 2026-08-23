/**
 * Source-aware clone index with multi-contributor frame promotion and fast O(frames) deletion.
 * Correctly maintains multi-source clone tracking so deleting one contributor does not
 * wipe out shared code hashes for remaining sources.
 */

import * as crypto from "node:crypto";
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
export type SourceFrame = IMapFrame;

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
): SourceFrame[] {
	const tokenCount = tokens.length;
	const frameCount = Math.max(0, tokenCount - minTokens);
	const hashMap = tokens.map((t) => t.hash).join("");
	const TOKEN_HASH_LEN = 20;

	const frames: SourceFrame[] = new Array(frameCount);
	for (let i = 0; i < frameCount; i++) {
		const windowSub = hashMap.substring(
			i * TOKEN_HASH_LEN,
			(i + minTokens) * TOKEN_HASH_LEN,
		);
		const windowHash = hashFunction(windowSub).substring(0, TOKEN_HASH_LEN);
		const startTok = tokens[i]!;
		const endTok = tokens[i + minTokens]!;

		const startLine = startTok.line;
		const startCol = startTok.column;
		const startPos = startTok.position;
		const startRange0 = startTok.range[0];

		const endLine = endTok.line;
		const endCol = endTok.column;
		const endPos = endTok.position;
		const endRange1 = endTok.range[1];

		frames[i] = {
			id: windowHash,
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
	readonly framesByHash = new Map<string, SourceFrame | SourceFrame[]>();
	readonly hashesBySource = new Map<string, Set<string>>();
	readonly sources = new Map<string, SourceMeta>();
	readonly #framesBySource = new Map<string, SourceFrame[]>();
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
		this.#framesBySource.clear();
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

		const tokenData = this.#generateTokenMaps(sourceId, content, format);
		if (!tokenData) {
			return [];
		}

		const hashes = new Set<string>();
		const sourceFrames: SourceFrame[] = [];
		const sourceTokens: SerializedToken[] = [];
		const TOKEN_HASH_LEN = 20;

		for (const tokenMap of tokenData.maps) {
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

			while (true) {
				const nextResult = tokenMap.next();
				if (
					nextResult.done ||
					!nextResult.value ||
					typeof nextResult.value === "boolean"
				) {
					break;
				}
				sourceFrames.push(nextResult.value as SourceFrame);
			}
		}

		const newClones = this.#detectClonesFromFrames(
			sourceFrames,
			sourceId,
			tokenData.format,
			{
				insertFrames: true,
				hashes,
			},
		);

		let totalTokens = 0;
		let totalLines = 0;
		for (const map of tokenData.maps) {
			totalTokens += map.getTokensCount();
			totalLines += map.getLinesCount();
		}

		this.hashesBySource.set(sourceId, hashes);
		this.#framesBySource.set(sourceId, sourceFrames);
		if (sourceTokens.length > 0) {
			this.#tokensBySource.set(sourceId, sourceTokens);
		}
		this.sources.set(sourceId, {
			sourceId,
			format: tokenData.format,
			size: content.length,
			lines: totalLines || content.split(/\r?\n/).length,
			tokenCount: totalTokens,
			updatedAt: Date.now(),
		});

		this.clones.push(...newClones);
		return newClones;
	}

	/**
	 * Export pre-tokenized frames and source metadata as a serialized shard.
	 */
	exportSourceShard(
		sourceId: string,
		contentHash: string,
	): SerializedSourceShard | null {
		const meta = this.sources.get(sourceId);
		const tokens = this.#tokensBySource.get(sourceId);
		const frames = this.#framesBySource.get(sourceId);
		if (!meta || (!tokens && !frames)) {
			return null;
		}
		const minTokens = this.#minTokens;
		const exportedTokens = tokens ? tokens.slice() : undefined;
		const fallbackFrames = frames ? frames.slice() : [];
		const hashFn = this.#hashFunction;

		let memoizedFrames: SourceFrame[] | null =
			fallbackFrames.length > 0 ? fallbackFrames : null;

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
			tokens: exportedTokens,
			get frames(): SourceFrame[] {
				if (!memoizedFrames) {
					if (exportedTokens && exportedTokens.length > 0) {
						memoizedFrames = reconstructFramesFromTokens(
							exportedTokens,
							meta.sourceId,
							minTokens,
							hashFn,
						);
					} else {
						memoizedFrames = [];
					}
				}
				return memoizedFrames;
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

		const sourceFrames: SourceFrame[] = [];
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

			while (true) {
				const nextResult = tokenMap.next();
				if (
					nextResult.done ||
					!nextResult.value ||
					typeof nextResult.value === "boolean"
				) {
					break;
				}
				sourceFrames.push(nextResult.value as SourceFrame);
			}
		}

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

		let normalizedFrames: SourceFrame[];
		const shardTokens = shard.tokens;

		if (shard.frames && shard.frames.length > 0) {
			normalizedFrames =
				shard.frames[0]?.sourceId === sourceId
					? shard.frames
					: shard.frames.map((f) =>
							f.sourceId === sourceId ? f : { ...f, sourceId },
						);
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

		const hashes = new Set<string>();
		const newClones = this.#detectClonesFromFrames(
			normalizedFrames,
			sourceId,
			format,
			{
				insertFrames: true,
				hashes,
			},
		);

		this.hashesBySource.set(sourceId, hashes);
		if (shardTokens && shardTokens.length > 0) {
			this.#tokensBySource.set(sourceId, shardTokens);
		}
		this.#framesBySource.set(sourceId, normalizedFrames);
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

		this.#framesBySource.delete(sourceId);
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

		const sourceFrames: SourceFrame[] = [];
		for (const tokenMap of tokenData.maps) {
			while (true) {
				const nextResult = tokenMap.next();
				if (
					nextResult.done ||
					!nextResult.value ||
					typeof nextResult.value === "boolean"
				) {
					break;
				}
				sourceFrames.push(nextResult.value as SourceFrame);
			}
		}

		return this.#detectClonesFromFrames(
			sourceFrames,
			sourceId,
			tokenData.format,
			{
				insertFrames: false,
			},
		);
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
		options: { insertFrames?: boolean; hashes?: Set<string> } = {},
	): IClone[] {
		const detectedClones: IClone[] = [];
		const { insertFrames = false, hashes } = options;
		let activeClones = new Map<string, ActiveCloneCandidate>();

		for (const frame of frames) {
			const normalizedFrame: SourceFrame =
				frame.sourceId === sourceId
					? frame
					: {
							...frame,
							sourceId,
						};
			const frameHash = normalizedFrame.id;
			if (hashes) {
				hashes.add(frameHash);
			}

			const candidates = this.framesByHash.get(frameHash);

			// Fast-path bypass when there are no candidate frames and no active clones extending
			if (!candidates && activeClones.size === 0) {
				if (insertFrames) {
					this.#insertFrame(frameHash, normalizedFrame);
				}
				continue;
			}

			const matchedFrames: SourceFrame[] = candidates
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

			const frameStartLine =
				normalizedFrame.start.loc?.start.line ??
				normalizedFrame.start.line ??
				1;
			const frameStartCol =
				normalizedFrame.start.loc?.start.column ??
				normalizedFrame.start.column ??
				1;
			const frameStartPos =
				normalizedFrame.start.loc?.start.position ??
				normalizedFrame.start.position;
			const frameEndLine =
				normalizedFrame.end.loc?.end.line ??
				normalizedFrame.end.line ??
				frameStartLine;
			const frameEndCol =
				normalizedFrame.end.loc?.end.column ??
				normalizedFrame.end.column ??
				frameStartCol;
			const frameEndPos =
				normalizedFrame.end.loc?.end.position ?? normalizedFrame.end.position;

			for (const targetFrame of matchedFrames) {
				const targetStartLine =
					targetFrame.start.loc?.start.line ?? targetFrame.start.line ?? 1;
				const targetStartCol =
					targetFrame.start.loc?.start.column ?? targetFrame.start.column ?? 1;
				const targetStartPos =
					targetFrame.start.loc?.start.position ?? targetFrame.start.position;
				const targetEndLine =
					targetFrame.end.loc?.end.line ??
					targetFrame.end.line ??
					targetStartLine;
				const targetEndCol =
					targetFrame.end.loc?.end.column ??
					targetFrame.end.column ??
					targetStartCol;
				const targetEndPos =
					targetFrame.end.loc?.end.position ?? targetFrame.end.position;

				// Disallow exact self-match at identical line/column position
				if (
					targetFrame.sourceId === sourceId &&
					targetStartLine === frameStartLine &&
					targetStartCol === frameStartCol
				) {
					continue;
				}

				const offsetKey = `${targetFrame.sourceId}:${targetFrame.start.range[0] - normalizedFrame.start.range[0]}`;

				if (activeClones.has(offsetKey)) {
					const candidate = activeClones.get(offsetKey)!;
					if (candidate.clone.duplicationA.range) {
						candidate.clone.duplicationA.range[1] =
							normalizedFrame.end.range[1];
					}
					candidate.clone.duplicationA.end = {
						line: frameEndLine,
						column: frameEndCol,
						position: frameEndPos,
					};
					if (candidate.clone.duplicationB.range) {
						candidate.clone.duplicationB.range[1] = targetFrame.end.range[1];
					}
					candidate.clone.duplicationB.end = {
						line: targetEndLine,
						column: targetEndCol,
						position: targetEndPos,
					};
					candidate.lastSourceEndRange = normalizedFrame.end.range[1];
					candidate.lastTargetEndRange = targetFrame.end.range[1];
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
							range: [
								normalizedFrame.start.range[0],
								normalizedFrame.end.range[1],
							],
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
							range: [targetFrame.start.range[0], targetFrame.end.range[1]],
						},
					};

					nextActiveClones.set(offsetKey, {
						clone,
						targetFrame,
						lastSourceEndRange: normalizedFrame.end.range[1],
						lastTargetEndRange: targetFrame.end.range[1],
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
	#insertFrame(hash: string, frame: SourceFrame): void {
		const existing = this.framesByHash.get(hash);
		if (!existing) {
			this.framesByHash.set(hash, frame);
			return;
		}

		if (Array.isArray(existing)) {
			const alreadyPresent = existing.some(
				(f) =>
					f.sourceId === frame.sourceId &&
					f.start.range[0] === frame.start.range[0],
			);
			if (!alreadyPresent) {
				existing.push(frame);
			}
		} else {
			if (
				existing.sourceId !== frame.sourceId ||
				existing.start.range[0] !== frame.start.range[0]
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
