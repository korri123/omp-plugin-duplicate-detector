/**
 * Detector worker: one per process, shared by every session. Holds many
 * workspaces keyed by (git root, options hash). Each workspace owns a
 * CloneIndex; token streams are shared across workspaces by content hash so
 * an isolated worktree of the same repo reuses tokenization.
 */

import * as path from "node:path";
import { CloneIndex } from "../engine/clone-index";
import { type TokenStream, tokenize } from "../engine/tokenize";
import type {
	CheckRequest,
	CheckResult,
	DetectorOptions,
	SkipReason,
	WorkspaceStatus,
} from "../types";
import {
	contentSkipReason,
	createPathClassifier,
	errorMessage,
	type FileStat,
	MAX_FILE_BYTES,
	type PathClassifier,
	readSourceFile,
	resolveRepoRoot,
	statFile,
	streamGitPaths,
	toRepoRelative,
} from "./files";
import type { WorkerMessage, WorkerRequest } from "./protocol";

declare const self: {
	onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
	postMessage(message: WorkerMessage): void;
};

/** Files stat'ed / read / tokenized per step before yielding to messages. */
const BATCH_SIZE = 64;
const PROGRESS_INTERVAL_MS = 150;
/** Stat recorded when the on-disk version is unknown: forces a re-read on rescan. */
const UNKNOWN_STAT: FileStat = { size: -1, mtimeMs: -1 };

function skipped(reason: SkipReason): CheckResult {
	return { status: "skipped", reason };
}
const UNAVAILABLE = skipped("unavailable");

/** Token streams shared by every workspace, keyed by format + content hash. */
class TokenPool {
	readonly #entries = new Map<string, { stream: TokenStream; refs: number }>();

	/** Returns the stream for `key`, tokenizing on a miss; takes one reference. */
	acquire(key: string, content: string, format: string): TokenStream {
		const hit = this.#entries.get(key);
		if (hit) {
			hit.refs++;
			return hit.stream;
		}
		const stream = tokenize(content, format);
		this.#entries.set(key, { stream, refs: 1 });
		return stream;
	}

	peek(key: string): TokenStream | undefined {
		return this.#entries.get(key)?.stream;
	}

	release(key: string): void {
		const entry = this.#entries.get(key);
		if (entry && --entry.refs <= 0) this.#entries.delete(key);
	}
}

const pool = new TokenPool();

function contentKey(format: string, content: string): string {
	return `${format}:${Bun.hash(content).toString(36)}`;
}

interface FileEntry {
	/** Pool key of the indexed token stream. */
	key: string;
	size: number;
	mtimeMs: number;
	/** Workspace revision of the last write; guards scans against newer checks. */
	rev: number;
}

interface Candidate {
	rel: string;
	format: string;
}

function yieldToEventLoop(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setImmediate(resolve);
	return promise;
}

class Workspace {
	refs: number;
	#status: WorkspaceStatus;
	#index: CloneIndex;
	readonly #classify: PathClassifier;
	readonly #files = new Map<string, FileEntry>();
	/** Content-rejected files (generated / unreadable) by stat, so rescans skip them until they change. */
	readonly #rejected = new Map<string, FileStat>();
	readonly #abort = new AbortController();
	#rev = 0;
	#failed = 0;
	#closed = false;
	/** Resolves when the current indexing phase ends. */
	#settled: Promise<void> = Promise.resolve();
	#checks: Promise<unknown> = Promise.resolve();
	#sync: Promise<void> | undefined;
	#syncPending = false;
	#lastProgress = 0;

	constructor(
		readonly key: string,
		readonly root: string,
		readonly options: DetectorOptions,
		refs: number,
		unavailable: string | undefined,
	) {
		this.refs = refs;
		this.#index = new CloneIndex(options);
		this.#classify = createPathClassifier(options);
		if (unavailable !== undefined) {
			this.#status = {
				state: "unavailable",
				indexedFiles: 0,
				message: unavailable,
			};
		} else {
			this.#status = { state: "indexing", indexedFiles: 0 };
			this.refresh();
		}
	}

	get status(): WorkspaceStatus {
		return this.#status;
	}

	/** Coalesced: at most one scan running plus one pending. */
	refresh(): void {
		if (this.#closed || this.#status.state === "unavailable") return;
		if (this.#sync) {
			this.#syncPending = true;
			return;
		}
		this.#sync = this.#runSyncs();
	}

	/**
	 * Checks run one at a time, after any running baseline. An unknown
	 * pre-image is snapshotted now: by the time the check runs, a scan may
	 * have indexed the mutated file, or an earlier check dropped a move's source.
	 */
	check(request: CheckRequest): Promise<CheckResult> {
		const rel = toRepoRelative(this.root, request.path);
		let before: TokenStream | undefined;
		if (request.before === undefined) {
			const beforeRel =
				request.beforePath === undefined
					? rel
					: toRepoRelative(this.root, request.beforePath);
			if (beforeRel !== undefined) before = this.#index.get(beforeRel);
		}
		const run = this.#checks.then(() => this.#runCheck(request, rel, before));
		this.#checks = run.catch(() => {});
		return run;
	}

	/** Drops `refs` references; true when the workspace closed. */
	release(refs: number): boolean {
		this.refs -= refs;
		if (this.refs > 0) return false;
		this.#closed = true;
		this.#abort.abort();
		for (const entry of this.#files.values()) pool.release(entry.key);
		this.#files.clear();
		this.#rejected.clear();
		this.#index = new CloneIndex(this.options);
		return true;
	}

	async #runSyncs(): Promise<void> {
		try {
			do {
				this.#syncPending = false;
				await this.#scan();
			} while (this.#syncPending && !this.#closed);
		} finally {
			this.#sync = undefined;
		}
	}

	/**
	 * Enumerates candidates, re-tokenizes files whose (size, mtime) changed,
	 * and drops files that disappeared. The first scan (or a retry after a
	 * failure) is the baseline: state `indexing`, checks wait for it.
	 */
	async #scan(): Promise<void> {
		const baseline = this.#status.state !== "ready";
		let endIndexing: (() => void) | undefined;
		if (baseline) {
			const phase = Promise.withResolvers<void>();
			this.#settled = phase.promise;
			endIndexing = phase.resolve;
			this.#setStatus({ state: "indexing", indexedFiles: this.#files.size });
		}
		const startRev = this.#rev;
		const signal = this.#abort.signal;
		this.#failed = 0;
		try {
			// Fresh classifier per scan: `ignore` caches every tested path.
			const classify = createPathClassifier(this.options);
			const seen = new Set<string>();
			let capped = false;
			let batch: Candidate[] = [];
			for await (const paths of streamGitPaths(this.root, signal)) {
				for (const rel of paths) {
					if (seen.has(rel)) continue;
					const verdict = classify(rel);
					if (verdict.format === undefined) continue;
					seen.add(rel);
					batch.push({ rel, format: verdict.format });
					if (batch.length >= BATCH_SIZE) {
						if (await this.#ingest(batch, signal)) capped = true;
						batch = [];
					}
				}
			}
			if (batch.length > 0 && (await this.#ingest(batch, signal))) {
				capped = true;
			}
			signal.throwIfAborted();
			for (const [rel, entry] of this.#files) {
				if (!seen.has(rel) && entry.rev <= startRev) this.#remove(rel);
			}
			for (const rel of this.#rejected.keys()) {
				if (!seen.has(rel)) this.#rejected.delete(rel);
			}
			this.#setStatus({
				state: "ready",
				indexedFiles: this.#files.size,
				candidateFiles: seen.size,
				...(capped ? { capped } : {}),
				...(this.#failed > 0 ? { failedFiles: this.#failed } : {}),
			});
			// The baseline leaves the tokenizer's per-file garbage behind; collect it
			// now so the worker heap settles at the index size instead of the peak.
			if (baseline) Bun.gc(true);
		} catch (error) {
			if (this.#closed) return;
			const message = errorMessage(error);
			if (baseline) {
				this.#setStatus({
					state: "failed",
					indexedFiles: this.#files.size,
					message: `Indexing failed: ${message}`,
				});
			} else {
				this.#setStatus({
					...this.#status,
					message: `Rescan failed: ${message}`,
				});
			}
		} finally {
			endIndexing?.();
		}
	}

	/** Stats a batch, reads + tokenizes changed files. Returns true when the file cap was hit. */
	async #ingest(batch: Candidate[], signal: AbortSignal): Promise<boolean> {
		const max = this.options.maxIndexedFiles;
		// Revisions before the awaits: a check that stores a file meanwhile wins.
		const revs = batch.map((c) => this.#files.get(c.rel)?.rev);
		const stats = await Promise.all(
			batch.map((c) =>
				statFile(path.join(this.root, c.rel)).catch((error: unknown) =>
					error instanceof Error ? error : new Error(String(error)),
				),
			),
		);
		signal.throwIfAborted();
		let capped = false;
		let pendingNew = 0;
		const toRead: { candidate: Candidate; stat: FileStat; rev?: number }[] = [];
		for (let i = 0; i < batch.length; i++) {
			const candidate = batch[i]!;
			const rev = revs[i];
			if (this.#files.get(candidate.rel)?.rev !== rev) continue;
			const stat = stats[i];
			if (stat instanceof Error) {
				this.#failed++;
				this.#remove(candidate.rel);
				continue;
			}
			if (!stat || stat.size > MAX_FILE_BYTES) {
				// Listed but gone (deleted tracked file), or over the size cap.
				this.#remove(candidate.rel);
				continue;
			}
			const entry = this.#files.get(candidate.rel);
			if (sameStat(entry, stat)) continue;
			if (sameStat(this.#rejected.get(candidate.rel), stat)) continue;
			if (!entry) {
				if (this.#files.size + pendingNew >= max) {
					capped = true;
					continue;
				}
				pendingNew++;
			}
			toRead.push({ candidate, stat, rev });
		}
		if (toRead.length > 0) {
			const reads = await Promise.all(
				toRead.map(({ candidate, stat }) =>
					readSourceFile(path.join(this.root, candidate.rel), stat).catch(
						(error: unknown) =>
							error instanceof Error ? error : new Error(String(error)),
					),
				),
			);
			signal.throwIfAborted();
			for (let i = 0; i < toRead.length; i++) {
				const { candidate, stat, rev } = toRead[i]!;
				const read = reads[i]!;
				const { rel, format } = candidate;
				// A check stored a newer version while this batch was reading.
				if (this.#files.get(rel)?.rev !== rev) continue;
				if (read instanceof Error) {
					this.#failed++;
					this.#remove(rel);
					this.#rejected.set(rel, stat);
					continue;
				}
				if (read.skip !== undefined) {
					this.#remove(rel);
					if (read.skip === "generated" && read.stat) {
						this.#rejected.set(rel, read.stat);
					}
					continue;
				}
				if (!this.#files.has(rel) && this.#files.size >= max) {
					capped = true;
					continue;
				}
				try {
					const key = contentKey(format, read.content);
					this.#put(rel, key, pool.acquire(key, read.content, format), stat);
					this.#rejected.delete(rel);
				} catch {
					this.#failed++;
					this.#remove(rel);
					this.#rejected.set(rel, stat);
				}
			}
		}
		await yieldToEventLoop();
		signal.throwIfAborted();
		if (
			this.#status.state === "indexing" &&
			Date.now() - this.#lastProgress >= PROGRESS_INTERVAL_MS
		) {
			this.#setStatus({ ...this.#status, indexedFiles: this.#files.size });
		}
		return capped;
	}

	async #runCheck(
		request: CheckRequest,
		rel: string | undefined,
		/** Indexed pre-image snapshotted at enqueue; used when `request.before` is undefined. */
		indexedBefore: TokenStream | undefined,
	): Promise<CheckResult> {
		while (this.#status.state === "indexing" && !this.#closed) {
			await this.#settled;
		}
		if (this.#closed || this.#status.state !== "ready") return UNAVAILABLE;
		if (rel === undefined) return skipped("outside-workspace");
		const verdict = this.#classify(rel);
		if (verdict.format === undefined) return skipped(verdict.skip);
		const format = verdict.format;

		let content: string;
		let stat: FileStat;
		try {
			if (request.after !== undefined) {
				const reason = contentSkipReason(request.after);
				if (reason) {
					this.#forget(rel);
					return skipped(reason);
				}
				content = request.after;
				// The disk may already hold a later version (a formatter run): leave
				// the stat unknown so the next rescan re-reads it.
				stat = UNKNOWN_STAT;
			} else {
				const read = await readSourceFile(path.join(this.root, rel));
				if (read.skip !== undefined) {
					this.#forget(rel);
					if (read.skip === "generated" && read.stat) {
						this.#rejected.set(rel, read.stat);
					}
					return skipped(read.skip);
				}
				content = read.content;
				stat = read.stat;
			}
		} catch (error) {
			return this.#checkFailed(rel, error);
		}
		if (this.#closed) return UNAVAILABLE;

		const key = contentKey(format, content);
		let stored = false;
		try {
			const after = pool.acquire(key, content, format);
			try {
				let before = indexedBefore;
				if (request.before !== undefined && request.before !== null) {
					before =
						pool.peek(contentKey(format, request.before)) ??
						tokenize(request.before, format);
				}
				const matches = this.#index.findNewDuplicates(rel, after, before);
				if (
					this.#files.has(rel) ||
					this.#files.size < this.options.maxIndexedFiles
				) {
					const added = !this.#files.has(rel);
					this.#put(rel, key, after, stat);
					stored = true;
					this.#rejected.delete(rel);
					if (added && this.#status.state === "ready") {
						this.#setStatus({
							...this.#status,
							indexedFiles: this.#files.size,
						});
					}
				}
				return { status: "checked", matches };
			} finally {
				if (!stored) pool.release(key);
			}
		} catch (error) {
			return this.#checkFailed(rel, error);
		}
	}

	#checkFailed(rel: string, error: unknown): CheckResult {
		this.#failed++;
		this.#setStatus({
			...this.#status,
			failedFiles: this.#failed,
			message: `Check of ${rel} failed: ${errorMessage(error)}`,
		});
		return UNAVAILABLE;
	}

	/** Stores a stream whose pool reference the caller already holds. */
	#put(rel: string, key: string, stream: TokenStream, stat: FileStat): void {
		if (this.#closed) {
			pool.release(key);
			return;
		}
		const prev = this.#files.get(rel);
		this.#index.set(rel, stream);
		this.#files.set(rel, {
			key,
			size: stat.size,
			mtimeMs: stat.mtimeMs,
			rev: ++this.#rev,
		});
		if (prev) pool.release(prev.key);
	}

	#remove(rel: string): void {
		const entry = this.#files.get(rel);
		if (!entry) return;
		this.#index.delete(rel);
		this.#files.delete(rel);
		pool.release(entry.key);
	}

	/** Removal by a check (file deleted or no longer indexable); publishes the new count. */
	#forget(rel: string): void {
		if (!this.#files.has(rel)) return;
		this.#remove(rel);
		if (this.#status.state === "ready") {
			this.#setStatus({ ...this.#status, indexedFiles: this.#files.size });
		}
	}

	#setStatus(status: WorkspaceStatus): void {
		if (this.#closed) return;
		this.#status = status;
		this.#lastProgress = Date.now();
		self.postMessage({ type: "status", key: this.key, status });
	}
}

function sameStat(
	a: { size: number; mtimeMs: number } | undefined,
	b: FileStat,
): boolean {
	return a !== undefined && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

/** Key-order independent serialization for the options hash. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		const entries = Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

const workspaces = new Map<string, Workspace>();

async function open(
	request: Extract<WorkerRequest, { type: "open" }>,
): Promise<void> {
	const resolved = await resolveRepoRoot(request.cwd);
	const root = resolved.root ?? request.cwd;
	const optionsHash = Bun.hash(stableStringify(request.options)).toString(36);
	const key = `${root}\0${optionsHash}`;
	let workspace = workspaces.get(key);
	if (workspace) {
		workspace.refs += request.refs;
	} else {
		workspace = new Workspace(
			key,
			root,
			request.options,
			request.refs,
			resolved.unavailable,
		);
		workspaces.set(key, workspace);
	}
	self.postMessage({
		type: "opened",
		id: request.id,
		key,
		root,
		status: workspace.status,
	});
}

function fail(id: number, error: unknown): void {
	self.postMessage({ type: "error", id, message: errorMessage(error) });
}

self.onmessage = (event) => {
	const request = event.data;
	switch (request.type) {
		case "open":
			open(request).catch((error: unknown) => fail(request.id, error));
			return;
		case "close": {
			const workspace = workspaces.get(request.key);
			if (workspace?.release(request.refs)) workspaces.delete(request.key);
			return;
		}
		case "check": {
			const workspace = workspaces.get(request.key);
			if (!workspace) {
				self.postMessage({
					type: "checked",
					id: request.id,
					result: UNAVAILABLE,
				});
				return;
			}
			workspace.check(request.request).then(
				(result) =>
					self.postMessage({ type: "checked", id: request.id, result }),
				(error: unknown) => fail(request.id, error),
			);
			return;
		}
		case "refresh":
			workspaces.get(request.key)?.refresh();
			return;
	}
};
