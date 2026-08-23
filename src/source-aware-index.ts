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
import { getFormatByFile, Tokenizer } from "@jscpd/tokenizer";

export type SourceFrame = IMapFrame;

export interface SerializedSourceShard {
	version: number;
	sourceId: string;
	contentHash: string;
	format: string;
	size: number;
	lines: number;
	tokenCount: number;
	updatedAt?: number;
	frames: SourceFrame[];
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
	clones: IClone[] = [];
	readonly #tokenizer: Tokenizer;
	readonly #options: IOptions;
	readonly #minTokens: number;
	readonly #minLines: number;
	readonly #maxLines: number;
	readonly #formatsExts: Record<string, string[]>;

	constructor(options: SourceAwareIndexOptions = {}) {
		this.#tokenizer = new Tokenizer();
		this.#minTokens = options.minTokens ?? 40;
		this.#minLines = options.minLines ?? 5;
		this.#maxLines = options.maxLines ?? 500;
		this.#formatsExts = options.formatsExts ?? {};

		const baseDefaults = getDefaultOptions();
		this.#options = {
			...baseDefaults,
			mode: baseDefaults.mode || mild,
			minTokens: this.#minTokens,
			minLines: this.#minLines,
			maxLines: this.#maxLines,
			formatsExts: this.#formatsExts,
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
		const frames = this.#framesBySource.get(sourceId);
		if (!meta || !frames) {
			return null;
		}

		return {
			version: 1,
			sourceId: meta.sourceId,
			contentHash,
			format: meta.format,
			size: meta.size,
			lines: meta.lines,
			tokenCount: meta.tokenCount,
			updatedAt: meta.updatedAt,
			frames: frames.slice(),
		};
	}

	/**
	 * Hydrate a pre-tokenized shard directly into framesByHash, hashesBySource,
	 * and sources without re-running Tokenizer.
	 */
	hydrateSourceShard(shard: SerializedSourceShard): IClone[] {
		const { sourceId, format, size, lines, tokenCount, frames } = shard;

		if (this.sources.has(sourceId)) {
			this.removeSource(sourceId);
		}

		const hashes = new Set<string>();
		const normalizedFrames = frames.map((f) =>
			f.sourceId === sourceId ? f : { ...f, sourceId },
		);

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
			format ?? getFormatByFile(sourceId, this.#formatsExts);
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
			const matchedFrames: SourceFrame[] = candidates
				? Array.isArray(candidates)
					? candidates
					: [candidates]
				: [];

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

			for (const [key, active] of activeClones.entries()) {
				if (!nextActiveClones.has(key)) {
					if (this.#validateClone(active.clone)) {
						detectedClones.push(active.clone);
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
