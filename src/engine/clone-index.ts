/**
 * Compact incremental clone index over token streams.
 *
 * Long-lived state is per file one TokenStream (typed arrays) plus one
 * numeric-keyed fingerprint map. Fingerprints are winnowed k-gram hashes
 * (Schleimer et al.): with k-gram size K and window W chosen so that
 * K + W - 1 = minTokens, any exact shared run of ≥ minTokens tokens shares at
 * least one fingerprint. Postings are packed numbers (fileId · 2^32 + offset).
 * Candidates are verified on the token hash arrays and extended to maximal runs.
 */
import type { DuplicateMatch } from "../types";
import { SEPARATOR_HASH, type TokenStream } from "./tokenize";

export interface CloneIndexOptions {
	minTokens: number;
	minLines: number;
}

interface FileEntry {
	path: string;
	tokens: TokenStream;
}

/** Packed posting = fileId * POSTING_RADIX + token offset. */
const POSTING_RADIX = 2 ** 32;
/** k-gram value for windows that contain a separator; never recorded. */
const INVALID_FP = 0xffffffff;
const ROLL_BASE = 0x01000193;
/** File id used for runs inside the edited file itself. */
const SELF = -1;
/** Occurrences of one fingerprint considered for intra-file pairs (pairs grow quadratically). */
const MAX_SELF_OCCURRENCES = 128;
/** Token diff gives up beyond this edit distance and treats the changed middle as new. */
const MAX_DIFF_DISTANCE = 1000;

function fmix32(value: number): number {
	let h = value;
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return h >>> 0;
}

interface Fingerprints {
	hashes: Uint32Array;
	positions: Uint32Array;
}

/** Scratch k-gram buffer shared by every kgramHashes() call (single-threaded, not re-entrant). */
let kgramScratch = new Uint32Array(1024);

/**
 * Rolling hash of every K-gram of `tokens` (index = start offset;
 * separator-containing K-grams are INVALID_FP). Returns a view of a shared
 * scratch buffer, valid until the next call.
 */
function kgramHashes(tokens: Uint32Array, k: number): Uint32Array {
	const n = tokens.length;
	const m = Math.max(0, n - k + 1);
	if (kgramScratch.length < m) kgramScratch = new Uint32Array(m * 2);
	const fp = kgramScratch;
	let pow = 1;
	for (let i = 1; i < k; i++) pow = Math.imul(pow, ROLL_BASE);
	let rolling = 0;
	let lastSeparator = -1;
	for (let i = 0; i < n; i++) {
		const t = tokens[i];
		if (i >= k) rolling = (rolling - Math.imul(tokens[i - k], pow)) | 0;
		rolling = (Math.imul(rolling, ROLL_BASE) + t) | 0;
		if (t === SEPARATOR_HASH) lastSeparator = i;
		const start = i - k + 1;
		if (start < 0) continue;
		if (lastSeparator >= start) {
			fp[start] = INVALID_FP;
		} else {
			const mixed = fmix32(rolling);
			fp[start] = mixed === INVALID_FP ? INVALID_FP - 1 : mixed;
		}
	}
	return fp.subarray(0, m);
}

/**
 * Robust winnowing: K-gram hashes, then the rightmost minimum of every window
 * of W consecutive K-grams, recorded once per change of selection.
 */
function winnow(tokens: Uint32Array, k: number, w: number): Fingerprints {
	const m = tokens.length - k + 1;
	if (m < w)
		return { hashes: new Uint32Array(0), positions: new Uint32Array(0) };
	const fp = kgramHashes(tokens, k);
	const outHashes = new Uint32Array(
		Math.min(m, Math.ceil((2 * m) / (w + 1)) + 16),
	);
	const outPositions = new Uint32Array(outHashes.length);
	let count = 0;
	let hashes = outHashes;
	let positions = outPositions;
	const record = (pos: number): void => {
		const value = fp[pos];
		if (value === INVALID_FP) return;
		if (count === hashes.length) {
			const grownHashes = new Uint32Array(Math.min(m, count * 2));
			grownHashes.set(hashes);
			const grownPositions = new Uint32Array(grownHashes.length);
			grownPositions.set(positions);
			hashes = grownHashes;
			positions = grownPositions;
		}
		hashes[count] = value;
		positions[count] = pos;
		count++;
	};
	let minPos = -1;
	for (let r = w - 1; r < m; r++) {
		const l = r - w + 1;
		if (minPos < l) {
			minPos = l;
			for (let j = l + 1; j <= r; j++) {
				if (fp[j] <= fp[minPos]) minPos = j;
			}
			record(minPos);
		} else if (fp[r] <= fp[minPos]) {
			minPos = r;
			record(r);
		}
	}
	return {
		hashes: hashes.slice(0, count),
		positions: positions.slice(0, count),
	};
}

/** Start offsets of the last run found by extendRun (avoids allocating a result per candidate). */
let runStartA = 0;
let runStartB = 0;

/**
 * Verifies that `a[ai..ai+k)` equals `b[bi..bi+k)` and extends the match to a
 * maximal run in both directions, never across a separator. Returns the run
 * length (0 when the k-grams differ: fingerprint collision) and sets
 * runStartA/runStartB.
 */
function extendRun(
	a: Uint32Array,
	ai: number,
	b: Uint32Array,
	bi: number,
	k: number,
): number {
	for (let t = 0; t < k; t++) {
		if (a[ai + t] !== b[bi + t]) return 0;
	}
	let back = 0;
	while (
		ai - back > 0 &&
		bi - back > 0 &&
		a[ai - back - 1] === b[bi - back - 1] &&
		a[ai - back - 1] !== SEPARATOR_HASH
	) {
		back++;
	}
	let forward = k;
	while (
		ai + forward < a.length &&
		bi + forward < b.length &&
		a[ai + forward] === b[bi + forward] &&
		a[ai + forward] !== SEPARATOR_HASH
	) {
		forward++;
	}
	runStartA = ai - back;
	runStartB = bi - back;
	return back + forward;
}

/**
 * Remembers runs already extended, keyed by (counterpart, diagonal), so every
 * further fingerprint inside a known run is skipped without re-verification.
 */
class SeenRuns {
	readonly #byDiagonal = new Map<number, number[]>();

	static key(fileId: number, diagonal: number): number {
		return fileId * POSTING_RADIX + diagonal + 2 ** 31;
	}

	covers(key: number, pos: number): boolean {
		const intervals = this.#byDiagonal.get(key);
		if (!intervals) return false;
		for (let i = 0; i < intervals.length; i += 2) {
			if (pos >= intervals[i] && pos < intervals[i + 1]) return true;
		}
		return false;
	}

	add(key: number, start: number, end: number): void {
		const intervals = this.#byDiagonal.get(key);
		if (intervals) intervals.push(start, end);
		else this.#byDiagonal.set(key, [start, end]);
	}
}

/** Visits maximal intra-stream runs `[p, p+len)` / `[q, q+len)` with p < q, clipped so the two sides never overlap. */
function forEachSelfRun(
	tokens: Uint32Array,
	fps: Fingerprints,
	k: number,
	visit: (p: number, q: number, len: number) => void,
): void {
	const occurrences = new Map<number, number | number[]>();
	for (let i = 0; i < fps.hashes.length; i++) {
		const hash = fps.hashes[i];
		const pos = fps.positions[i];
		const current = occurrences.get(hash);
		if (current === undefined) occurrences.set(hash, pos);
		else if (typeof current === "number") occurrences.set(hash, [current, pos]);
		else if (current.length < MAX_SELF_OCCURRENCES) current.push(pos);
	}
	const seen = new SeenRuns();
	for (const value of occurrences.values()) {
		if (typeof value === "number") continue;
		for (let i = 0; i < value.length; i++) {
			for (let j = i + 1; j < value.length; j++) {
				const p = Math.min(value[i], value[j]);
				const q = Math.max(value[i], value[j]);
				if (p === q) continue;
				const key = SeenRuns.key(SELF, q - p);
				if (seen.covers(key, p)) continue;
				let len = extendRun(tokens, p, tokens, q, k);
				if (len === 0) continue;
				const start = runStartA;
				const other = runStartB;
				seen.add(key, start, start + len);
				if (start + len > other) len = other - start;
				visit(start, other, len);
			}
		}
	}
}

interface TokenDiff {
	/** 1 for every `after` token that is not matched to a `before` token. */
	isNew: Uint8Array;
	newCount: number;
	/** `after` index of each `before` token, -1 when deleted/unmatched. */
	beforeToAfter: Int32Array;
	/** True when the edit distance exceeded MAX_DIFF_DISTANCE: the whole changed middle is new and unmapped. */
	capped: boolean;
}

/**
 * Token-level diff: common prefix/suffix trimming, then Myers' O((N+M)D) diff
 * on the changed middle, capped at MAX_DIFF_DISTANCE (beyond it the whole
 * middle counts as new and unmatched).
 */
function diffTokens(after: Uint32Array, before: Uint32Array): TokenDiff {
	const nA = after.length;
	const nB = before.length;
	const isNew = new Uint8Array(nA);
	const beforeToAfter = new Int32Array(nB).fill(-1);
	let prefix = 0;
	while (prefix < nA && prefix < nB && after[prefix] === before[prefix]) {
		beforeToAfter[prefix] = prefix;
		prefix++;
	}
	let suffix = 0;
	while (
		suffix < nA - prefix &&
		suffix < nB - prefix &&
		after[nA - 1 - suffix] === before[nB - 1 - suffix]
	) {
		beforeToAfter[nB - 1 - suffix] = nA - 1 - suffix;
		suffix++;
	}
	const oldLen = nB - prefix - suffix;
	const newLen = nA - prefix - suffix;
	let newCount = 0;
	const markAllNew = (): void => {
		for (let y = 0; y < newLen; y++) isNew[prefix + y] = 1;
		newCount = newLen;
	};
	if (newLen === 0) return { isNew, newCount, beforeToAfter, capped: false };
	if (oldLen === 0) {
		markAllNew();
		return { isNew, newCount, beforeToAfter, capped: false };
	}

	const max = Math.min(oldLen + newLen, MAX_DIFF_DISTANCE);
	const offset = max + 1;
	const v = new Int32Array(2 * max + 3);
	const trace: Int32Array[] = [];
	let distance = -1;
	outer: for (let d = 0; d <= max; d++) {
		// Snapshot V[-d-1 .. d+1] before step d.
		trace.push(v.slice(offset - d - 1, offset + d + 2));
		for (let k = -d; k <= d; k += 2) {
			let x =
				k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
					? v[offset + k + 1]
					: v[offset + k - 1] + 1;
			let y = x - k;
			while (
				x < oldLen &&
				y < newLen &&
				before[prefix + x] === after[prefix + y]
			) {
				x++;
				y++;
			}
			v[offset + k] = x;
			if (x >= oldLen && y >= newLen) {
				distance = d;
				break outer;
			}
		}
	}
	if (distance < 0) {
		markAllNew();
		return { isNew, newCount, beforeToAfter, capped: true };
	}

	let x = oldLen;
	let y = newLen;
	for (let d = distance; d > 0; d--) {
		const snapshot = trace[d];
		// snapshot[i] holds V[k] for k = i - d - 1.
		const at = (k: number): number => snapshot[k + d + 1];
		const k = x - y;
		const prevK =
			k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
		const prevX = at(prevK);
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			x--;
			y--;
			beforeToAfter[prefix + x] = prefix + y;
		}
		if (prevK === k + 1) {
			isNew[prefix + prevY] = 1;
			newCount++;
		}
		x = prevX;
		y = prevY;
	}
	while (x > 0 && y > 0) {
		x--;
		y--;
		beforeToAfter[prefix + x] = prefix + y;
	}
	return { isNew, newCount, beforeToAfter, capped: false };
}

function hashString(h: number, value: string): number {
	let out = h;
	for (let i = 0; i < value.length; i++) {
		out = Math.imul(out ^ value.charCodeAt(i), 0x01000193);
	}
	return Math.imul(out ^ 0xffff, 0x01000193);
}

function hashTokens(
	h: number,
	tokens: Uint32Array,
	start: number,
	len: number,
): number {
	let out = h;
	for (let i = start; i < start + len; i++) {
		const t = tokens[i];
		out = Math.imul(out ^ (t & 0xffff), 0x01000193);
		out = Math.imul(out ^ (t >>> 16), 0x01000193);
	}
	return out;
}

/** Stable match identity: edited path, counterpart path, duplicated token content. */
function matchKey(
	file: string,
	other: string,
	tokens: Uint32Array,
	start: number,
	len: number,
): string {
	let key = "";
	for (const seed of [0x811c9dc5, 0x2f8b1a97]) {
		let h = hashString(hashString(seed, file), other);
		h = hashTokens(h, tokens, start, len);
		key += fmix32(h ^ len)
			.toString(16)
			.padStart(8, "0");
	}
	return key;
}

function hasNewToken(isNew: Uint8Array, start: number, len: number): boolean {
	for (let i = start; i < start + len; i++) {
		if (isNew[i] === 1) return true;
	}
	return false;
}

function countUncovered(
	covered: Uint8Array | undefined,
	start: number,
	len: number,
): number {
	if (!covered) return len;
	let count = 0;
	for (let i = start; i < start + len; i++) {
		if (covered[i] === 0) count++;
	}
	return count;
}

/** Start of the run returned by trimPartialLines. */
let trimmedStart = 0;

/**
 * Drops a run's leading/trailing partial line when it holds no more run tokens
 * than non-run tokens on that line (typically a `;` or `}` before the copy, or a
 * keyword of the statement after it), so reported lines and keys reflect the
 * copied code rather than incidental neighbors. Returns the trimmed length and
 * sets trimmedStart.
 */
function trimPartialLines(
	stream: TokenStream,
	start: number,
	len: number,
): number {
	const { startLines, endLines } = stream;
	let first = start;
	let end = start + len;
	if (first > 0 && endLines[first - 1] === startLines[first]) {
		const line = startLines[first];
		let inRun = 0;
		while (first + inRun < end && startLines[first + inRun] === line) inRun++;
		let outside = 0;
		while (first - outside > 0 && endLines[first - outside - 1] === line)
			outside++;
		if (inRun <= outside) first += inRun;
	}
	if (
		end > first &&
		end < startLines.length &&
		startLines[end] === endLines[end - 1]
	) {
		const line = endLines[end - 1];
		let inRun = 0;
		while (end - inRun > first && endLines[end - inRun - 1] === line) inRun++;
		let outside = 0;
		while (
			end + outside < startLines.length &&
			startLines[end + outside] === line
		)
			outside++;
		if (inRun <= outside) end -= inRun;
	}
	trimmedStart = first;
	return end - first;
}

/** A candidate run between the edited file's `after` stream and a counterpart. */
interface Candidate {
	/** Counterpart file id, or SELF for intra-file. */
	fileId: number;
	/** Start of the reported region in `after`. */
	region: number;
	/** Start of the counterpart (in the counterpart file, or in `after` for SELF). */
	other: number;
	len: number;
}

export class CloneIndex {
	readonly #minTokens: number;
	readonly #minLines: number;
	/** K-gram size and winnowing window: K + W - 1 = minTokens. */
	readonly #k: number;
	readonly #w: number;
	readonly #ids = new Map<string, number>();
	readonly #entries: (FileEntry | undefined)[] = [];
	readonly #freeIds: number[] = [];
	/** Fingerprint → one packed posting, or several. */
	readonly #postings = new Map<number, number | number[]>();

	constructor(options: CloneIndexOptions) {
		this.#minTokens = Math.max(1, Math.floor(options.minTokens));
		this.#minLines = Math.max(1, Math.floor(options.minLines));
		this.#k = Math.max(1, Math.ceil(this.#minTokens / 2));
		this.#w = this.#minTokens - this.#k + 1;
	}

	get(file: string): TokenStream | undefined {
		const id = this.#ids.get(file);
		return id === undefined ? undefined : this.#entries[id]?.tokens;
	}

	/** Insert or replace `file`'s tokens. */
	set(file: string, tokens: TokenStream): void {
		let id = this.#ids.get(file);
		if (id === undefined) {
			id = this.#freeIds.pop() ?? this.#entries.length;
			this.#ids.set(file, id);
		} else {
			this.#removePostings(id);
		}
		this.#entries[id] = { path: file, tokens };
		const fps = winnow(tokens.hashes, this.#k, this.#w);
		for (let i = 0; i < fps.hashes.length; i++) {
			const hash = fps.hashes[i];
			const posting = id * POSTING_RADIX + fps.positions[i];
			const current = this.#postings.get(hash);
			if (current === undefined) this.#postings.set(hash, posting);
			else if (typeof current === "number")
				this.#postings.set(hash, [current, posting]);
			else current.push(posting);
		}
	}

	delete(file: string): void {
		const id = this.#ids.get(file);
		if (id === undefined) return;
		this.#removePostings(id);
		this.#entries[id] = undefined;
		this.#ids.delete(file);
		this.#freeIds.push(id);
	}

	/**
	 * Duplicates introduced by changing `file` from `before` to `after`
	 * (`before` undefined = new file, everything is new). Compares against every
	 * other indexed file and against `after` itself (intra-file); `file`'s own
	 * indexed entry is ignored. Does not mutate the index.
	 *
	 * A match is a maximal exact token run shared between a region of `after`
	 * and a counterpart, reported when all hold:
	 * 1. the run has ≥ minTokens tokens and the region spans ≥ minLines lines;
	 * 2. the region contains at least one token new relative to `before`
	 *    (token diff); for intra-file pairs the region is the side holding new
	 *    tokens (the later side when both do);
	 * 3. the run duplicates ≥ minTokens tokens that were not already duplicated
	 *    before the edit:
	 *    - other file: counterpart tokens not covered by any run (≥ minTokens)
	 *      between `before` and that file;
	 *    - intra-file: region tokens that did not map (through the diff) into a
	 *      side of any intra-file run (≥ minTokens) of `before`; when the diff
	 *      is capped, a changed-middle token also counts as mapped when a
	 *      K-gram containing it occurs inside such a run.
	 * Regions overlapping a larger reported match by more than half are dropped.
	 */
	findNewDuplicates(
		file: string,
		after: TokenStream,
		before: TokenStream | undefined,
	): DuplicateMatch[] {
		const minTokens = this.#minTokens;
		const tokens = after.hashes;
		if (tokens.length < minTokens) return [];
		const diff = before ? diffTokens(tokens, before.hashes) : undefined;
		if (diff && diff.newCount === 0) return [];
		const isNew = diff?.isNew;
		const regionIsNew = (start: number, len: number): boolean =>
			!isNew || hasNewToken(isNew, start, len);
		const candidates: Candidate[] = [];
		const consider = (
			fileId: number,
			region: number,
			other: number,
			runLen: number,
		): void => {
			if (runLen < minTokens) return;
			const len = trimPartialLines(after, region, runLen);
			const start = trimmedStart;
			if (len < minTokens || !regionIsNew(start, len)) return;
			const lines =
				after.endLines[start + len - 1] - after.startLines[start] + 1;
			if (lines < this.#minLines) return;
			candidates.push({
				fileId,
				region: start,
				other: other + (start - region),
				len,
			});
		};

		const ownId = this.#ids.get(file);
		const fps = winnow(tokens, this.#k, this.#w);
		this.#forEachCrossRun(tokens, fps, ownId, undefined, consider);
		forEachSelfRun(tokens, fps, this.#k, (p, q, len) => {
			if (len < minTokens) return;
			if (regionIsNew(q, len)) consider(SELF, q, p, len);
			else if (regionIsNew(p, len)) consider(SELF, p, q, len);
		});
		if (candidates.length === 0) return [];

		const fresh =
			before && diff
				? this.#dropPreexisting(candidates, tokens, before, diff, ownId)
				: candidates;
		return this.#toMatches(file, after, fresh);
	}

	#dropPreexisting(
		candidates: Candidate[],
		after: Uint32Array,
		before: TokenStream,
		diff: TokenDiff,
		ownId: number | undefined,
	): Candidate[] {
		const minTokens = this.#minTokens;
		const beforeFps = winnow(before.hashes, this.#k, this.#w);
		const crossIds = new Set<number>();
		let anySelf = false;
		for (const c of candidates) {
			if (c.fileId === SELF) anySelf = true;
			else crossIds.add(c.fileId);
		}
		const counterpartCoverage = new Map<number, Uint8Array>();
		if (crossIds.size > 0) {
			this.#forEachCrossRun(
				before.hashes,
				beforeFps,
				ownId,
				crossIds,
				(fileId, _start, other, len) => {
					if (len < minTokens) return;
					let covered = counterpartCoverage.get(fileId);
					if (!covered) {
						covered = new Uint8Array(
							this.#entries[fileId]?.tokens.hashes.length ?? 0,
						);
						counterpartCoverage.set(fileId, covered);
					}
					covered.fill(1, other, other + len);
				},
			);
		}
		let selfCoverage: Uint8Array | undefined;
		if (anySelf) {
			const covered = new Uint8Array(diff.isNew.length);
			const { beforeToAfter, capped } = diff;
			const k = this.#k;
			// Capped diff leaves the changed middle unmapped: match it by content instead.
			const runGrams = capped ? new Set<number>() : undefined;
			const beforeGrams = runGrams ? kgramHashes(before.hashes, k) : undefined;
			forEachSelfRun(before.hashes, beforeFps, k, (p, q, len) => {
				if (len < minTokens) return;
				for (let t = 0; t < len; t++) {
					const fromP = beforeToAfter[p + t];
					if (fromP >= 0) covered[fromP] = 1;
					const fromQ = beforeToAfter[q + t];
					if (fromQ >= 0) covered[fromQ] = 1;
				}
				// Both sides hold the same content, so one side's K-grams suffice.
				if (runGrams && beforeGrams) {
					for (let i = p; i + k <= p + len; i++) runGrams.add(beforeGrams[i]);
				}
			});
			if (runGrams && runGrams.size > 0) {
				const afterGrams = kgramHashes(after, k);
				const { isNew } = diff;
				let end = 0;
				for (let t = 0; t < isNew.length; t++) {
					if (t < afterGrams.length) {
						const gram = afterGrams[t];
						if (gram !== INVALID_FP && runGrams.has(gram)) end = t + k;
					}
					if (t < end && isNew[t]) covered[t] = 1;
				}
			}
			selfCoverage = covered;
		}
		return candidates.filter((c) =>
			c.fileId === SELF
				? countUncovered(selfCoverage, c.region, c.len) >= minTokens
				: countUncovered(counterpartCoverage.get(c.fileId), c.other, c.len) >=
					minTokens,
		);
	}

	#toMatches(
		file: string,
		after: TokenStream,
		candidates: Candidate[],
	): DuplicateMatch[] {
		const ordered = candidates
			.map((c) => ({
				c,
				path: c.fileId === SELF ? file : (this.#entries[c.fileId]?.path ?? ""),
			}))
			.sort(
				(x, y) =>
					y.c.len - x.c.len ||
					(x.c.fileId === SELF ? 1 : 0) - (y.c.fileId === SELF ? 1 : 0) ||
					(x.path < y.path ? -1 : x.path > y.path ? 1 : 0) ||
					x.c.region - y.c.region,
			);
		const kept: Candidate[] = [];
		const matches: DuplicateMatch[] = [];
		for (const { c, path } of ordered) {
			const overlapsKept = kept.some((k) => {
				const overlap =
					Math.min(k.region + k.len, c.region + c.len) -
					Math.max(k.region, c.region);
				return overlap * 2 > c.len;
			});
			if (overlapsKept) continue;
			kept.push(c);
			const otherTokens =
				c.fileId === SELF ? after : this.#entries[c.fileId]?.tokens;
			if (!otherTokens) continue;
			matches.push({
				region: {
					file,
					startLine: after.startLines[c.region],
					endLine: after.endLines[c.region + c.len - 1],
				},
				other: {
					file: path,
					startLine: otherTokens.startLines[c.other],
					endLine: otherTokens.endLines[c.other + c.len - 1],
				},
				tokens: c.len,
				key: matchKey(file, path, after.hashes, c.region, c.len),
			});
		}
		return matches.sort(
			(x, y) =>
				x.region.startLine - y.region.startLine ||
				(x.other.file < y.other.file
					? -1
					: x.other.file > y.other.file
						? 1
						: 0) ||
				x.other.startLine - y.other.startLine,
		);
	}

	/**
	 * Visits maximal runs between `tokens` and indexed files (excluding
	 * `excludeId`, limited to `onlyIds` when given): visit(fileId, start in
	 * tokens, start in counterpart, length).
	 */
	#forEachCrossRun(
		tokens: Uint32Array,
		fps: Fingerprints,
		excludeId: number | undefined,
		onlyIds: ReadonlySet<number> | undefined,
		visit: (fileId: number, start: number, other: number, len: number) => void,
	): void {
		const seen = new SeenRuns();
		const tryPosting = (posting: number, pos: number): void => {
			const fileId = Math.floor(posting / POSTING_RADIX);
			if (fileId === excludeId || (onlyIds && !onlyIds.has(fileId))) return;
			const otherPos = posting - fileId * POSTING_RADIX;
			const key = SeenRuns.key(fileId, otherPos - pos);
			if (seen.covers(key, pos)) return;
			const entry = this.#entries[fileId];
			if (!entry) return;
			const len = extendRun(
				tokens,
				pos,
				entry.tokens.hashes,
				otherPos,
				this.#k,
			);
			if (len === 0) return;
			const start = runStartA;
			const other = runStartB;
			seen.add(key, start, start + len);
			visit(fileId, start, other, len);
		};
		for (let i = 0; i < fps.hashes.length; i++) {
			const postings = this.#postings.get(fps.hashes[i]);
			if (postings === undefined) continue;
			const pos = fps.positions[i];
			if (typeof postings === "number") tryPosting(postings, pos);
			else for (const posting of postings) tryPosting(posting, pos);
		}
	}

	#removePostings(id: number): void {
		const entry = this.#entries[id];
		if (!entry) return;
		const fps = winnow(entry.tokens.hashes, this.#k, this.#w);
		for (let i = 0; i < fps.hashes.length; i++) {
			const hash = fps.hashes[i];
			const posting = id * POSTING_RADIX + fps.positions[i];
			const current = this.#postings.get(hash);
			if (current === undefined) continue;
			if (typeof current === "number") {
				if (current === posting) this.#postings.delete(hash);
				continue;
			}
			const at = current.indexOf(posting);
			if (at < 0) continue;
			current[at] = current[current.length - 1];
			current.pop();
			if (current.length === 1) this.#postings.set(hash, current[0]);
		}
	}
}
