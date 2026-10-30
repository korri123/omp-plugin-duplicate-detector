/**
 * Messages between the main-thread service (service.ts) and the detector
 * worker (worker.ts). Type-only: safe to import on the main thread.
 *
 * Workspaces are refcounted inside the worker: every `open` adds `refs`,
 * every `close` subtracts `refs`, and the workspace is dropped at zero.
 * Messages are processed in order, so the service never races itself.
 */

import type {
	CheckRequest,
	CheckResult,
	DetectorOptions,
	WorkspaceStatus,
} from "../types";

export type WorkerRequest =
	/** Resolve the git root for `cwd` and open (or share) its workspace. */
	| {
			type: "open";
			id: number;
			cwd: string;
			options: DetectorOptions;
			refs: number;
	  }
	/** Drop `refs` references to a workspace. */
	| { type: "close"; key: string; refs: number }
	/** Runs in arrival order; an unknown `before` is snapshotted from the index on receipt. */
	| { type: "check"; id: number; key: string; request: CheckRequest }
	/** Coalesced rescan of out-of-band changes. */
	| { type: "refresh"; key: string };

export type WorkerMessage =
	| {
			type: "opened";
			id: number;
			/** Workspace identity: canonical root + options hash. */
			key: string;
			/** Git toplevel, or the requested cwd when unavailable. */
			root: string;
			status: WorkspaceStatus;
	  }
	| { type: "checked"; id: number; result: CheckResult }
	/** Unexpected failure while handling request `id`. */
	| { type: "error"; id: number; message: string }
	| { type: "status"; key: string; status: WorkspaceStatus };
