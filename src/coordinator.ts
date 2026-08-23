/**
 * Coordinator for managing duplicate detector worker lifecycle, RPC messaging,
 * workspace epochs, and fault-tolerant event propagation.
 */

import type { IClone } from "@jscpd/core";
import EventEmitter from "eventemitter3";
import type {
	CheckAndUpdatePayload,
	CheckSnippetPayload,
	OpenWorkspacePayload,
	ReconcileFileEntry,
	ReconcilePayload,
	RemoveFilePayload,
	ScanPayload,
	UpdateFilePayload,
	WorkerCompletePayload,
	WorkerEventMessage,
	WorkerLateFindingPayload,
	WorkerProgressPayload,
	WorkerRequestMessage,
	WorkerResponseMessage,
	WorkerStatusPayload,
	WorkspaceOptions,
} from "./worker-protocol";
import { isWorkerEvent, isWorkerResponse } from "./worker-protocol";

export interface DuplicateDetectorConfig {
	minLines?: number;
	minTokens?: number;
	maxLines?: number;
	checkOnMutation?: boolean;
	reminderMode?: "in-band" | "steer" | "none";
	ignorePatterns?: string[];
	formatsExts?: Record<string, string[]>;
	configSource?: string;
}

export interface CoordinatorOptions {
	/** Custom worker script URL or path (defaults to the packaged worker bundle) */
	workerUrl?: string | URL;
	/** Timeout in milliseconds for individual RPC requests (default: 30,000ms) */
	requestTimeoutMs?: number;
	/** Whether to automatically attempt to restart worker on unexpected termination (default: true) */
	autoRestart?: boolean;
	/** Maximum consecutive restart attempts (default: 5) */
	maxRestartAttempts?: number;
	/** Base restart backoff in milliseconds (default: 500ms) */
	restartBackoffMs?: number;
}

export interface CoordinatorEvents {
	progress: (payload: WorkerProgressPayload) => void;
	complete: (payload: WorkerCompletePayload) => void;
	lateFinding: (payload: WorkerLateFindingPayload) => void;
	status: (payload: WorkerStatusPayload) => void;
	error: (error: Error) => void;
}

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
	epoch: number;
	type: string;
	timeoutTimer: NodeJS.Timeout | number;
}
function computeConfigHash(
	config?: DuplicateDetectorConfig | WorkspaceOptions,
): string {
	if (!config) return "default";
	return JSON.stringify({
		minTokens: config.minTokens,
		minLines: config.minLines,
		maxLines: config.maxLines,
		ignorePatterns: (config.ignorePatterns ?? []).slice().sort(),
		formatsExts: config.formatsExts,
	});
}
export function resolveDefaultWorkerUrl(): string {
	try {
		const distFromSrc = new URL("../dist/detector-worker.js", import.meta.url);
		return distFromSrc.href;
	} catch {
		return new URL("../dist/detector-worker.js", import.meta.url).href;
	}
}

/**
 * High-level coordinator managing the background duplicate detector worker thread.
 */
export class DuplicateDetectorCoordinator extends EventEmitter<CoordinatorEvents> {
	readonly #workerUrl: string | URL;
	readonly #requestTimeoutMs: number;
	readonly #autoRestart: boolean;
	readonly #maxRestartAttempts: number;
	readonly #restartBackoffMs: number;

	#worker: Worker | null = null;
	#restartTimer: ReturnType<typeof setTimeout> | null = null;
	#nextReqId = 0;
	#epoch = 0;
	#pendingRequests = new Map<string, PendingRequest>();
	#isDisposed = false;
	#restartCount = 0;
	#lastOpenWorkspacePayload: OpenWorkspacePayload | null = null;
	#activeRootDir: string | null = null;
	#activeConfigHash: string | null = null;
	constructor(options: CoordinatorOptions = {}) {
		super();
		this.#workerUrl = options.workerUrl ?? resolveDefaultWorkerUrl();
		this.#requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
		this.#autoRestart = options.autoRestart ?? true;
		this.#maxRestartAttempts = options.maxRestartAttempts ?? 5;
		this.#restartBackoffMs = options.restartBackoffMs ?? 500;

		this.#initWorker();
	}

	get epoch(): number {
		return this.#epoch;
	}

	get isDisposed(): boolean {
		return this.#isDisposed;
	}

	get isWorkerAlive(): boolean {
		return this.#worker !== null;
	}

	get activeRootDir(): string | null {
		return this.#activeRootDir;
	}

	get activeConfigHash(): string | null {
		return this.#activeConfigHash;
	}

	// ============================================================================
	// Worker Lifecycle & Fault Tolerance
	// ============================================================================

	#initWorker(): void {
		if (this.#restartTimer !== null) {
			clearTimeout(this.#restartTimer);
			this.#restartTimer = null;
		}

		if (this.#isDisposed || this.#worker !== null) return;

		try {
			const worker = new Worker(this.#workerUrl);

			worker.onmessage = (event: MessageEvent<unknown>) => {
				this.#handleWorkerMessage(event.data);
			};

			worker.onerror = (event: ErrorEvent) => {
				const error =
					event.error instanceof Error
						? event.error
						: new Error(event.message || "Worker error occurred");
				this.#handleWorkerCrash(error);
			};

			this.#worker = worker;
		} catch (err) {
			const error =
				err instanceof Error
					? err
					: new Error(`Failed to spawn worker: ${String(err)}`);
			this.#handleWorkerCrash(error);
		}
	}

	#handleWorkerMessage(data: unknown): void {
		if (isWorkerResponse(data)) {
			this.#handleResponse(data);
		} else if (isWorkerEvent(data)) {
			this.#handleEvent(data);
		}
	}

	#handleResponse(response: WorkerResponseMessage): void {
		const pending = this.#pendingRequests.get(response.id);
		if (!pending) return;

		clearTimeout(pending.timeoutTimer);
		this.#pendingRequests.delete(response.id);

		if (response.success) {
			pending.resolve(response.data);
		} else {
			pending.reject(new Error(response.error));
		}
	}

	#handleEvent(event: WorkerEventMessage): void {
		switch (event.type) {
			case "progress":
				this.emit("progress", event.payload);
				break;
			case "complete":
				this.emit("complete", event.payload);
				break;
			case "lateFinding":
				this.emit("lateFinding", event.payload);
				break;
			case "status":
				this.emit("status", event.payload);
				break;
		}
	}

	#handleWorkerCrash(error: Error): void {
		this.emit("error", error);

		// Reject all in-flight pending requests gracefully
		for (const [_id, pending] of this.#pendingRequests.entries()) {
			clearTimeout(pending.timeoutTimer);
			pending.reject(
				new Error(
					`Worker terminated during request ${pending.type}: ${error.message}`,
				),
			);
		}
		this.#pendingRequests.clear();

		if (this.#worker) {
			try {
				this.#worker.terminate();
			} catch {}
			this.#worker = null;
		}
		if (this.#restartTimer !== null) {
			clearTimeout(this.#restartTimer);
			this.#restartTimer = null;
		}

		if (
			!this.#isDisposed &&
			this.#autoRestart &&
			this.#restartCount < this.#maxRestartAttempts
		) {
			this.#restartCount++;
			const delay = this.#restartBackoffMs * 2 ** (this.#restartCount - 1);
			this.#restartTimer = setTimeout(() => {
				this.#restartTimer = null;
				if (this.#isDisposed || this.#worker !== null) return;
				this.#initWorker();
				// If a workspace was open, automatically re-open on restart
				if (this.#lastOpenWorkspacePayload && this.#worker) {
					this.#sendRequest<void>(
						"openWorkspace",
						this.#lastOpenWorkspacePayload,
					).catch(() => {});
				}
			}, delay);
		}
	}

	// ============================================================================
	// RPC Request Dispatcher
	// ============================================================================

	#sendRequest<T>(
		type: WorkerRequestMessage["type"],
		payload?: unknown,
	): Promise<T> {
		if (this.#isDisposed) {
			return Promise.reject(
				new Error("DuplicateDetectorCoordinator is disposed"),
			);
		}

		if (!this.#worker) {
			this.#initWorker();
			if (!this.#worker) {
				return Promise.reject(new Error("Worker is not available"));
			}
		}

		const { promise, resolve, reject } = Promise.withResolvers<T>();
		const id = `req_${++this.#nextReqId}_${Date.now()}`;
		const currentEpoch = this.#epoch;

		const timeoutTimer = setTimeout(() => {
			this.#pendingRequests.delete(id);
			reject(
				new Error(
					`Worker request '${type}' (id: ${id}) timed out after ${this.#requestTimeoutMs}ms`,
				),
			);
		}, this.#requestTimeoutMs);

		this.#pendingRequests.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject,
			epoch: currentEpoch,
			type,
			timeoutTimer,
		});

		try {
			this.#worker.postMessage({
				id,
				type,
				payload,
			});
		} catch (err) {
			clearTimeout(timeoutTimer);
			this.#pendingRequests.delete(id);
			reject(
				err instanceof Error
					? err
					: new Error(`Failed to postMessage: ${String(err)}`),
			);
		}

		return promise;
	}

	// ============================================================================
	// Public API
	// ============================================================================
	/**
	 * Open a workspace root directory and initiate non-blocking background indexing in the worker.
	 * Returns immediately once the worker acknowledges start.
	 */
	async openWorkspace(
		rootDir: string,
		config?: DuplicateDetectorConfig | WorkspaceOptions,
	): Promise<void> {
		const options: WorkspaceOptions = {
			minTokens: config?.minTokens,
			minLines: config?.minLines,
			maxLines: config?.maxLines,
			ignorePatterns: config?.ignorePatterns,
			formatsExts: config?.formatsExts,
		};

		const configHash = computeConfigHash(options);

		// If already active on same root with same config and worker alive, reuse active worker state
		if (
			this.#activeRootDir === rootDir &&
			this.#activeConfigHash === configHash &&
			this.isWorkerAlive &&
			!this.#isDisposed
		) {
			const payload: OpenWorkspacePayload = { rootDir, options };
			this.#lastOpenWorkspacePayload = payload;
			await this.#sendRequest<{ started: boolean; reused?: boolean }>(
				"openWorkspace",
				payload,
			);
			return;
		}

		this.#epoch++;
		this.#restartCount = 0;
		this.#activeRootDir = rootDir;
		this.#activeConfigHash = configHash;

		const payload: OpenWorkspacePayload = { rootDir, options };
		this.#lastOpenWorkspacePayload = payload;

		await this.#sendRequest<{ started: boolean; reused?: boolean }>(
			"openWorkspace",
			payload,
		);
	}

	/**
	 * Check a snippet or file content for clones against the current index without mutating index state.
	 * Fails open by returning an empty array if the worker is unavailable.
	 */
	async checkSnippet(
		filePath: string,
		content: string,
		format?: string,
	): Promise<IClone[]> {
		try {
			const payload: CheckSnippetPayload = { filePath, content, format };
			return await this.#sendRequest<IClone[]>("checkSnippet", payload);
		} catch (err) {
			// Fail open: log and return empty clones rather than crashing agent
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
			return [];
		}
	}

	/**
	 * Check a modified file snippet against the index, update the index for that file,
	 * and return detected clones along with baseline completion status.
	 *
	 * Unlike read-only checks, mutation failures propagate so the extension can tell
	 * the user that duplicate detection did not run.
	 */
	async checkAndUpdate(
		filePath: string,
		content: string,
		revision?: number,
		format?: string,
	): Promise<{ clones: IClone[]; isComplete: boolean }> {
		try {
			const payload: CheckAndUpdatePayload = {
				filePath,
				content,
				revision,
				format,
			};
			return await this.#sendRequest<{
				clones: IClone[];
				isComplete: boolean;
			}>("checkAndUpdate", payload);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.emit("error", error);
			throw error;
		}
	}

	/**
	 * Update an indexed file with new content.
	 */
	async updateFile(
		filePath: string,
		content: string,
		format?: string,
	): Promise<{ clones: IClone[] }> {
		try {
			const payload: UpdateFilePayload = { filePath, content, format };
			return await this.#sendRequest<{ clones: IClone[] }>(
				"updateFile",
				payload,
			);
		} catch (err) {
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
			return { clones: [] };
		}
	}

	/**
	 * Remove a file from the clone index.
	 */
	async removeFile(filePath: string): Promise<void> {
		try {
			const payload: RemoveFilePayload = { filePath };
			await this.#sendRequest<{ removed: boolean }>("removeFile", payload);
		} catch (err) {
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
		}
	}

	/**
	 * Reconcile multiple modified or removed files with the index.
	 */
	async reconcile(files: ReconcileFileEntry[]): Promise<void> {
		try {
			const payload: ReconcilePayload = { files };
			await this.#sendRequest<{ reconciledCount: number }>(
				"reconcile",
				payload,
			);
		} catch (err) {
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
		}
	}

	/**
	 * Run an ad-hoc clone scan across the workspace or a specified target path.
	 */
	async scan(options?: {
		targetPath?: string;
		options?: WorkspaceOptions;
	}): Promise<IClone[]> {
		try {
			const payload: ScanPayload = {
				targetPath: options?.targetPath,
				options: options?.options,
			};
			return await this.#sendRequest<IClone[]>("scan", payload);
		} catch (err) {
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
			return [];
		}
	}

	/**
	 * Gracefully close the worker thread, clean up all pending requests,
	 * and remove all event listeners.
	 */
	async dispose(): Promise<void> {
		if (this.#isDisposed) return;

		if (this.#restartTimer !== null) {
			clearTimeout(this.#restartTimer);
			this.#restartTimer = null;
		}

		if (this.#worker) {
			try {
				await this.#sendRequest("close").catch(() => {});
			} catch {}
		}

		for (const [_id, pending] of this.#pendingRequests.entries()) {
			clearTimeout(pending.timeoutTimer);
			pending.reject(new Error("DuplicateDetectorCoordinator was disposed"));
		}
		this.#pendingRequests.clear();

		if (this.#worker) {
			try {
				this.#worker.terminate();
			} catch {}
			this.#worker = null;
		}

		this.#isDisposed = true;
		this.#activeRootDir = null;
		this.#activeConfigHash = null;

		this.removeAllListeners();
	}
}
