/**
 * Main-thread detector service: a module-level singleton shared by every
 * session in the process (main + subagents). Lazily spawns one worker,
 * refcounts workspaces, and terminates the worker when the last workspace is
 * released. Never imports the tokenizer.
 */

import { fileURLToPath } from "node:url";
import type {
	CheckRequest,
	CheckResult,
	DetectorOptions,
	WorkspaceStatus,
} from "../types";
import type { WorkerMessage, WorkerRequest } from "./protocol";

let workerUrl: Promise<string> | undefined;

/**
 * Object URL of a runtime bundle of worker.ts, built once per module
 * instance. Inside omp's compiled binary a worker started from source cannot
 * resolve the plugin's node_modules (only the main thread goes through omp's
 * loader hooks), so the worker always runs from a self-contained bundle.
 */
function bundledWorkerUrl(): Promise<string> {
	workerUrl ??= buildWorker().catch((error: unknown) => {
		workerUrl = undefined;
		throw error;
	});
	return workerUrl;
}

async function buildWorker(): Promise<string> {
	const entrypoint = fileURLToPath(new URL("./worker.ts", import.meta.url));
	const result = await Bun.build({ entrypoints: [entrypoint], target: "bun" });
	const output = result.outputs[0];
	if (!result.success || !output) {
		throw new Error(
			result.logs.map((log) => log.message).join("; ") ||
				"bundle produced no output",
		);
	}
	const code = await output.text();
	return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}

/** Message of an Error, a Bun build AggregateError, or a BuildMessage. */
function describeError(error: unknown): string {
	if (error instanceof AggregateError && error.errors.length > 0) {
		return error.errors.map(describeError).join("; ");
	}
	const message = (error as { message?: unknown } | undefined)?.message;
	return typeof message === "string" && message ? message : String(error);
}

export interface WorkspaceHandle {
	/** Git toplevel (canonical); equals the given cwd when unavailable. */
	readonly root: string;
	status(): WorkspaceStatus;
	/** Returns unsubscribe. Fires on every state/progress change. */
	onStatus(listener: (status: WorkspaceStatus) => void): () => void;
	/** Queues behind the baseline; resolves when checked. Never rejects for detection failures: resolves skipped/unavailable. Rejects only if the handle was released. Updates the index with `after`. */
	check(request: CheckRequest): Promise<CheckResult>;
	/** Coalesced rescan for out-of-band changes. Fire-and-forget, cheap to call often. */
	refresh(): void;
	/** Decrement refcount; last release drops the workspace; no workspaces left → worker terminated. Idempotent, bounded (<1 s). */
	release(): Promise<void>;
}

/** Crashes tolerated within {@link CRASH_WINDOW_MS} before respawning stops. */
const MAX_CRASHES = 3;
const CRASH_WINDOW_MS = 10 * 60_000;
const UNAVAILABLE: CheckResult = { status: "skipped", reason: "unavailable" };

/** One workspace as seen by the service; shared by every handle on it. */
interface Entry {
	/** Git toplevel once opened; the requested cwd before that. */
	root: string;
	options: DetectorOptions;
	/** Live handles plus in-flight acquires. */
	refs: number;
	/** Worker-side key; undefined while (re)opening or without a worker. */
	key: string | undefined;
	status: WorkspaceStatus;
	handles: Set<Handle>;
	/** Acquirers waiting for this entry's open to settle. */
	waiters: ((entry: Entry) => void)[];
}

class Handle implements WorkspaceHandle {
	#released = false;
	readonly #listeners = new Set<(status: WorkspaceStatus) => void>();

	constructor(
		readonly service: DetectorService,
		public entry: Entry,
	) {}

	get root(): string {
		return this.entry.root;
	}

	status(): WorkspaceStatus {
		return this.entry.status;
	}

	onStatus(listener: (status: WorkspaceStatus) => void): () => void {
		if (this.#released) return () => {};
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	check(request: CheckRequest): Promise<CheckResult> {
		if (this.#released) {
			return Promise.reject(new Error("Workspace handle was released"));
		}
		return this.service.check(this.entry, request);
	}

	refresh(): void {
		if (!this.#released) this.service.refresh(this.entry);
	}

	release(): Promise<void> {
		if (!this.#released) {
			this.#released = true;
			this.#listeners.clear();
			this.service.release(this);
		}
		return Promise.resolve();
	}

	notify(status: WorkspaceStatus): void {
		for (const listener of this.#listeners) {
			try {
				listener(status);
			} catch (error) {
				// Isolate listeners from each other and from worker message handling.
				console.error("duplicate-detector: status listener failed", error);
			}
		}
	}
}

class DetectorService {
	#worker: Worker | undefined;
	/** A spawn (bundle build + worker start) is in progress. */
	#spawning = false;
	/** Bumped on spawn and terminate; stale spawns check it after awaiting. */
	#generation = 0;
	/** The current worker has sent at least one message (it loaded). */
	#replied = false;
	#reffed = false;
	#disabledReason: string | undefined;
	#lastError: string | undefined;
	#nextId = 1;
	readonly #entries = new Set<Entry>();
	readonly #byKey = new Map<string, Entry>();
	readonly #opens = new Map<number, { entry: Entry; refs: number }>();
	readonly #checks = new Map<number, (result: CheckResult) => void>();
	readonly #crashes: number[] = [];

	get workerRunning(): boolean {
		return this.#worker !== undefined || this.#spawning;
	}

	get workspaceCount(): number {
		return this.#entries.size;
	}

	async acquire(cwd: string, options: DetectorOptions): Promise<Handle> {
		const { promise, resolve } = Promise.withResolvers<Entry>();
		const entry: Entry = {
			root: cwd,
			options,
			refs: 1,
			key: undefined,
			status: { state: "indexing", indexedFiles: 0 },
			handles: new Set(),
			waiters: [resolve],
		};
		this.#entries.add(entry);
		if (this.#worker) {
			this.#sendOpen(entry);
		} else if (!this.#spawning && !this.#startWorker()) {
			this.#setStatus(entry, this.#disabledStatus());
			this.#settleWaiters(entry, entry);
		}
		// While spawning, the spawn opens every entry once the worker exists.
		const target = await promise;
		const handle = new Handle(this, target);
		target.handles.add(handle);
		return handle;
	}

	check(entry: Entry, request: CheckRequest): Promise<CheckResult> {
		const state = entry.status.state;
		if (
			!this.#worker ||
			entry.key === undefined ||
			state === "unavailable" ||
			state === "failed"
		) {
			return Promise.resolve(UNAVAILABLE);
		}
		const id = this.#nextId++;
		const { promise, resolve } = Promise.withResolvers<CheckResult>();
		this.#checks.set(id, resolve);
		this.#post({
			type: "check",
			id,
			key: entry.key,
			request: {
				path: request.path,
				before: request.before,
				beforePath: request.beforePath,
				after: request.after,
			},
		});
		return promise;
	}

	refresh(entry: Entry): void {
		if (!this.#worker) {
			// Respawning reopens (and therefore rescans) every workspace.
			if (!this.#spawning && !this.#startWorker()) {
				const status = this.#disabledStatus();
				for (const each of this.#entries) {
					if (each.status.message !== status.message) {
						this.#setStatus(each, status);
					}
				}
			}
			return;
		}
		if (entry.key !== undefined) {
			this.#post({ type: "refresh", key: entry.key });
		}
	}

	release(handle: Handle): void {
		const entry = handle.entry;
		entry.handles.delete(handle);
		entry.refs--;
		// While an open is in flight the surplus is closed when it lands.
		if (entry.key !== undefined && this.#worker) {
			this.#post({ type: "close", key: entry.key, refs: 1 });
		}
		if (entry.refs <= 0) {
			this.#entries.delete(entry);
			if (entry.key !== undefined && this.#byKey.get(entry.key) === entry) {
				this.#byKey.delete(entry.key);
			}
		}
		if (this.#entries.size === 0) this.#terminate();
	}

	/**
	 * Starts an async spawn unless the crash budget is spent. The spawn
	 * reopens every live workspace once the worker exists.
	 */
	#startWorker(): boolean {
		const now = Date.now();
		while (
			this.#crashes.length > 0 &&
			now - this.#crashes[0]! > CRASH_WINDOW_MS
		) {
			this.#crashes.shift();
		}
		if (this.#crashes.length >= MAX_CRASHES) {
			this.#disabledReason = `Duplicate detector worker failed ${this.#crashes.length} times in ${CRASH_WINDOW_MS / 60_000} minutes; not restarting yet. Last error: ${this.#lastError ?? "unknown"}`;
			return false;
		}
		this.#disabledReason = undefined;
		this.#spawning = true;
		void this.#spawn(++this.#generation);
		return true;
	}

	async #spawn(generation: number): Promise<void> {
		let url: string;
		try {
			url = await bundledWorkerUrl();
		} catch (error) {
			if (generation !== this.#generation) return;
			this.#spawning = false;
			this.#crashes.push(Date.now());
			this.#failAll(
				`Cannot build duplicate detector worker: ${describeError(error)}`,
			);
			return;
		}
		if (generation !== this.#generation) return;
		this.#spawning = false;
		if (this.#entries.size === 0) return;
		let worker: Worker;
		try {
			worker = new Worker(url);
		} catch (error) {
			this.#crashes.push(Date.now());
			this.#failAll(
				`Cannot start duplicate detector worker: ${describeError(error)}`,
			);
			return;
		}
		worker.unref();
		this.#reffed = false;
		this.#replied = false;
		this.#worker = worker;
		worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
			if (this.#worker !== worker) return;
			this.#replied = true;
			this.#onMessage(event.data);
		});
		worker.addEventListener("error", (event: ErrorEvent) => {
			if (this.#worker === worker) {
				// Bun's message embeds a source frame; keep the "<Type>: reason" line.
				const text = event.message || "unknown error";
				const reason =
					/^(?:\w*Error|error): (.+)$/m.exec(text)?.[1] ?? text.split("\n")[0];
				this.#onCrash(`Duplicate detector worker crashed: ${reason}`);
			}
		});
		worker.addEventListener("messageerror", () => {
			if (this.#worker === worker) {
				this.#onCrash("Duplicate detector worker sent an unreadable message");
			}
		});
		worker.addEventListener("close", () => {
			if (this.#worker === worker) {
				this.#onCrash("Duplicate detector worker exited unexpectedly");
			}
		});
		this.#byKey.clear();
		for (const entry of this.#entries) {
			entry.key = undefined;
			this.#sendOpen(entry);
		}
	}

	/** Spawn failed: every workspace fails with `reason`; pending acquires settle. */
	#failAll(reason: string): void {
		this.#lastError = reason;
		for (const entry of this.#entries) {
			entry.key = undefined;
			this.#setStatus(entry, {
				state: "failed",
				indexedFiles: 0,
				message: reason,
			});
			this.#settleWaiters(entry, entry);
		}
	}

	#sendOpen(entry: Entry): void {
		const id = this.#nextId++;
		this.#opens.set(id, { entry, refs: entry.refs });
		this.#post({
			type: "open",
			id,
			cwd: entry.root,
			options: entry.options,
			refs: entry.refs,
		});
	}

	#post(request: WorkerRequest): void {
		this.#worker?.postMessage(request);
		this.#updateRef();
	}

	/** Keep the process alive only while a caller awaits the worker. */
	#updateRef(): void {
		const busy = this.#opens.size > 0 || this.#checks.size > 0;
		if (!this.#worker || busy === this.#reffed) return;
		this.#reffed = busy;
		if (busy) this.#worker.ref();
		else this.#worker.unref();
	}

	#onMessage(message: WorkerMessage): void {
		switch (message.type) {
			case "opened":
				this.#onOpened(message);
				break;
			case "checked":
				this.#takeCheck(message.id)?.(message.result);
				break;
			case "error": {
				const check = this.#takeCheck(message.id);
				if (check) {
					check(UNAVAILABLE);
					break;
				}
				const open = this.#opens.get(message.id);
				if (!open) break;
				this.#opens.delete(message.id);
				this.#setStatus(open.entry, {
					state: "failed",
					indexedFiles: 0,
					message: message.message,
				});
				this.#settleWaiters(open.entry, open.entry);
				break;
			}
			case "status": {
				const entry = this.#byKey.get(message.key);
				if (entry) this.#setStatus(entry, message.status);
				break;
			}
		}
		this.#updateRef();
	}

	#onOpened(message: Extract<WorkerMessage, { type: "opened" }>): void {
		const open = this.#opens.get(message.id);
		if (!open) return;
		this.#opens.delete(message.id);
		const { entry, refs } = open;
		const surplus = refs - Math.max(entry.refs, 0);
		if (surplus > 0) {
			this.#post({ type: "close", key: message.key, refs: surplus });
		}
		if (!this.#entries.has(entry)) return;
		let target = entry;
		const existing = this.#byKey.get(message.key);
		if (existing && existing !== entry) {
			// Same root + options: fold into the workspace already attached.
			existing.refs += entry.refs;
			for (const handle of entry.handles) {
				handle.entry = existing;
				existing.handles.add(handle);
			}
			this.#entries.delete(entry);
			target = existing;
		} else {
			entry.key = message.key;
			entry.root = message.root;
			this.#byKey.set(message.key, entry);
		}
		this.#setStatus(target, message.status);
		this.#settleWaiters(entry, target);
	}

	#takeCheck(id: number): ((result: CheckResult) => void) | undefined {
		const resolve = this.#checks.get(id);
		if (resolve) this.#checks.delete(id);
		return resolve;
	}

	#onCrash(reason: string): void {
		const loaded = this.#replied;
		const worker = this.#worker;
		this.#worker = undefined;
		worker?.terminate();
		this.#crashes.push(Date.now());
		this.#lastError = reason;
		this.#byKey.clear();
		this.#failPendingChecks();
		const opening = new Set<Entry>();
		for (const { entry } of this.#opens.values()) opening.add(entry);
		this.#opens.clear();
		for (const entry of this.#entries) {
			entry.key = undefined;
			this.#setStatus(entry, {
				state: "failed",
				indexedFiles: 0,
				message: reason,
			});
		}
		if (opening.size === 0) return;
		// Acquires in flight must not hang. Respawn at once only if the worker
		// had loaded (a crash before its first message is a load failure that
		// would just repeat); otherwise settle them as failed and let the next
		// acquire/refresh retry within the crash budget.
		if (loaded && this.#startWorker()) return;
		for (const entry of opening) {
			if (!this.#entries.has(entry)) continue;
			this.#setStatus(entry, this.#disabledStatus(reason));
			this.#settleWaiters(entry, entry);
		}
	}

	#terminate(): void {
		const worker = this.#worker;
		this.#worker = undefined;
		this.#spawning = false;
		this.#generation++;
		this.#reffed = false;
		worker?.terminate();
		this.#byKey.clear();
		this.#opens.clear();
		this.#failPendingChecks();
	}

	#failPendingChecks(): void {
		const pending = [...this.#checks.values()];
		this.#checks.clear();
		for (const resolve of pending) resolve(UNAVAILABLE);
	}

	#disabledStatus(fallback?: string): WorkspaceStatus {
		return {
			state: "failed",
			indexedFiles: 0,
			message:
				this.#disabledReason ??
				fallback ??
				"Duplicate detector worker unavailable",
		};
	}

	#setStatus(entry: Entry, status: WorkspaceStatus): void {
		entry.status = status;
		for (const handle of entry.handles) handle.notify(status);
	}

	#settleWaiters(entry: Entry, target: Entry): void {
		const waiters = entry.waiters;
		entry.waiters = [];
		for (const resolve of waiters) resolve(target);
	}
}

const service = new DetectorService();

/**
 * Opens (or shares) the workspace for the git repository containing `cwd`.
 * Never rejects: failures surface as `unavailable` / `failed` status.
 */
export function acquireWorkspace(
	cwd: string,
	options: DetectorOptions,
): Promise<WorkspaceHandle> {
	return service.acquire(cwd, options);
}

/** Diagnostics: whether the worker thread is alive and how many workspaces are open. */
export function detectorServiceStats(): {
	workerRunning: boolean;
	workspaces: number;
} {
	return {
		workerRunning: service.workerRunning,
		workspaces: service.workspaceCount,
	};
}
