/**
 * omp extension: warns the model when a write/edit it just made duplicates
 * existing code in the repository.
 *
 * The factory only registers handlers. Each session (main and subagents)
 * acquires a shared workspace from the detector service on `session_start`
 * and releases it on `session_shutdown`; every write/edit is checked against
 * the index and new duplicates are reported once per session.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolResultEvent,
} from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader";
import type {
	EditToolDetails,
	EditToolPerFileResult,
} from "@oh-my-pi/pi-tui/tools/edit";
import { PLUGIN_NAME, type ResolvedConfig, resolveConfig } from "./config";
import { acquireWorkspace, type WorkspaceHandle } from "./detector/service";
import { WarningLedger } from "./ledger";
import {
	isProjectEnabled,
	removeLegacyCacheFiles,
	resolveProjectRoot,
	setProjectEnabled,
} from "./project-state";
import { buildReminder, type Reminder } from "./reminder";
import { createWarningRenderer } from "./render";
import {
	type CheckRequest,
	WARNING_MESSAGE_TYPE,
	type WorkspaceStatus,
} from "./types";

const STATUS_KEY = "duplicate-detector";
/** How long a tool_result waits for its check before the warning is delivered later instead. */
const CHECK_BUDGET_MS = 1_500;
/** `write` pre-images above this size are not captured (the service falls back to the indexed version). */
const MAX_BEFORE_BYTES = 100 * 1024;
/** Cap on captured pre-images awaiting their tool_result (a blocked call never gets one). */
const MAX_PENDING_BEFORES = 64;
/** How long a `write`'s tool_call waits for a pending workspace start (omp fails a stalled tool_call closed). */
const START_WAIT_MS = 1_000;
/** omp 18.14 tools that never change files; every other non-reported tool triggers a rescan. */
const READ_ONLY_TOOLS = new Set([
	"read",
	"grep",
	"glob",
	"find",
	"ast_grep",
	"lsp",
	"web_search",
	"ask",
	"wait",
	"todo",
	"think",
	"yield",
	"goal",
	"advise",
	"checkpoint",
	"rewind",
	"context_notes",
	"recall",
]);

export interface ExtensionDeps {
	/** Merged omp plugin settings for this plugin. */
	loadPluginSettings(cwd: string): Promise<Record<string, unknown>>;
	/** Overrides the `/duplicates on|off` state directory (defaults to the user cache dir). */
	cacheDir?: string;
}

interface ActiveWorkspace {
	handle: WorkspaceHandle;
	config: ResolvedConfig;
	unsubscribe: () => void;
}

/** A `write` pre-image captured in tool_call, valid only for the path it was read from. */
interface CapturedBefore {
	path: string;
	content: string | null | undefined;
}
/** Fields shared by single-file `EditToolDetails` and multi-file `perFileResults` entries. */
type EditEntry = Pick<
	EditToolPerFileResult,
	"oldText" | "newText" | "op" | "snapshotsPruned" | "sourcePath" | "isError"
> & { path?: string };

let legacyCleanupStarted = false;

function resolveToolPath(cwd: string, raw: unknown): string | undefined {
	if (typeof raw !== "string" || raw.trim() === "" || raw.includes("://"))
		return undefined;
	const expanded =
		raw === "~" || raw.startsWith("~/")
			? path.join(os.homedir(), raw.slice(1))
			: raw;
	return path.resolve(cwd, expanded);
}

/** Pre-image for a `write`: content, `null` when absent, `undefined` when unknown or too large. */
async function readBefore(
	filePath: string,
): Promise<string | null | undefined> {
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile() || stat.size > MAX_BEFORE_BYTES) return undefined;
		return await fs.readFile(filePath, "utf8");
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "ENOENT" ? null : undefined;
	}
}

function editRequests(
	details: EditToolDetails | undefined,
	input: Record<string, unknown>,
	cwd: string,
): CheckRequest[] {
	const entries: EditEntry[] = details?.perFileResults?.length
		? details.perFileResults
		: details
			? [details]
			: [];
	const requests: CheckRequest[] = [];
	for (const entry of entries) {
		if (entry.isError) continue;
		const target = resolveToolPath(cwd, entry.path ?? input.path);
		if (!target) continue;
		const source = entry.sourcePath
			? resolveToolPath(cwd, entry.sourcePath)
			: undefined;
		const moved = source !== undefined && source !== target;
		const pruned = entry.snapshotsPruned === true;
		const before =
			pruned || (entry.oldText === undefined && entry.op !== "create")
				? undefined
				: (entry.oldText ?? null);
		const request: CheckRequest =
			!pruned && typeof entry.newText === "string"
				? { path: target, before, after: entry.newText }
				: { path: target, before };
		// Without a snapshot, the source's indexed version is the move target's pre-image.
		if (moved) request.beforePath = source;
		requests.push(request);
		// After the target (which snapshots the source at enqueue): checking the gone source drops it from the index.
		if (moved) requests.push({ path: source });
	}
	return requests;
}

/** Check requests for a file-mutating tool result, or `undefined` when the tool is not reported per file. */
function mutationRequests(
	event: ToolResultEvent,
	cwd: string,
	captured: CapturedBefore | undefined,
): CheckRequest[] | undefined {
	if (event.toolName === "write") {
		// omp resolves `@`, `:`, hashline wrappers and file:// itself; trust only its result.
		const resolved = (event.details as { resolvedPath?: unknown } | undefined)
			?.resolvedPath;
		if (typeof resolved !== "string" || resolved === "") return undefined;
		const target = path.resolve(resolved);
		return [
			{
				path: target,
				before: captured?.path === target ? captured.content : undefined,
			},
		];
	}
	if (event.toolName === "edit")
		return editRequests(
			event.details as EditToolDetails | undefined,
			event.input,
			cwd,
		);
	return undefined;
}

function isMainWithUi(ctx: ExtensionContext): boolean {
	return ctx.hasUI && ctx.agent?.kind === "main";
}

function describeStatus(status: WorkspaceStatus): string {
	const files =
		status.candidateFiles !== undefined
			? `${status.indexedFiles}/${status.candidateFiles} files`
			: `${status.indexedFiles} files`;
	const capped = status.capped ? " (capped by maxIndexedFiles)" : "";
	const message = status.message ? ` — ${status.message}` : "";
	return `${status.state}, ${files} indexed${capped}${message}`;
}

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function createDuplicateDetector(
	deps: ExtensionDeps,
): (pi: ExtensionAPI) => void {
	return (pi) => {
		const logger = pi.logger;
		const stateOptions = { cacheDir: deps.cacheDir, logger };
		const ledger = new WarningLedger();
		/** `write` pre-images by toolCallId, captured in tool_call. */
		const befores = new Map<string, CapturedBefore>();
		/** Bumped by every (re)start and stop; stale async work compares against it. */
		let generation = 0;
		let workspace: ActiveWorkspace | undefined;
		/** Settles when the latest start attempt finished (acquired, disabled, or failed). */
		let starting: Promise<void> = Promise.resolve();
		let failureNotified = false;

		const reportFailure = (ctx: ExtensionContext, message: string): void => {
			logger.warn("duplicate-detector: workspace failed", {
				cwd: ctx.cwd,
				error: message,
			});
			if (failureNotified) return;
			failureNotified = true;
			if (isMainWithUi(ctx))
				ctx.ui.notify(`Duplicate detector failed: ${message}`, "error");
		};

		const reportStatus = (
			ctx: ExtensionContext,
			status: WorkspaceStatus,
		): void => {
			if (status.state === "failed")
				reportFailure(ctx, status.message ?? "unknown error");
			else failureNotified = false;
			if (!isMainWithUi(ctx)) return;
			const text =
				status.state === "indexing"
					? `dup: indexing ${status.indexedFiles}${status.candidateFiles !== undefined ? `/${status.candidateFiles}` : ""}`
					: undefined;
			ctx.ui.setStatus(STATUS_KEY, text);
		};

		const releaseHandle = async (current: ActiveWorkspace): Promise<void> => {
			current.unsubscribe();
			try {
				await current.handle.release();
			} catch (err) {
				logger.warn("duplicate-detector: workspace release failed", {
					error: errorText(err),
				});
			}
		};

		const releaseWorkspace = async (ctx: ExtensionContext): Promise<void> => {
			const current = workspace;
			workspace = undefined;
			if (!current) return;
			if (isMainWithUi(ctx)) ctx.ui.setStatus(STATUS_KEY, undefined);
			await releaseHandle(current);
		};

		const loadSettings = async (
			cwd: string,
		): Promise<Record<string, unknown>> => {
			try {
				return await deps.loadPluginSettings(cwd);
			} catch (err) {
				logger.warn(
					"duplicate-detector: failed to load plugin settings, using defaults",
					{ error: errorText(err) },
				);
				return {};
			}
		};

		const start = async (ctx: ExtensionContext): Promise<void> => {
			const gen = ++generation;
			try {
				const enabled = await isProjectEnabled(ctx.cwd, stateOptions);
				if (gen !== generation) return;
				if (!enabled) {
					await releaseWorkspace(ctx);
					return;
				}
				const [root, pluginSettings] = await Promise.all([
					resolveProjectRoot(ctx.cwd),
					loadSettings(ctx.cwd),
				]);
				const config = await resolveConfig({
					cwd: ctx.cwd,
					root,
					pluginSettings,
					logger,
				});
				if (gen !== generation) return;
				// Acquire before releasing the previous handle: with the same root and options the
				// service shares the workspace, so its refcount never hits zero and the index stays warm.
				const handle = await acquireWorkspace(ctx.cwd, config.options);
				if (gen !== generation) {
					await handle.release();
					return;
				}
				const previous = workspace;
				const unsubscribe = handle.onStatus((status) =>
					reportStatus(ctx, status),
				);
				workspace = { handle, config, unsubscribe };
				reportStatus(ctx, handle.status());
				if (previous) await releaseHandle(previous);
			} catch (err) {
				if (gen !== generation) return;
				reportFailure(ctx, errorText(err));
				await releaseWorkspace(ctx);
			}
		};

		const restart = (ctx: ExtensionContext): Promise<void> => {
			starting = start(ctx);
			return starting;
		};

		const stop = async (ctx: ExtensionContext): Promise<void> => {
			generation++;
			befores.clear();
			ledger.clear();
			await releaseWorkspace(ctx);
		};

		const sendWarning = (ctx: ExtensionContext, reminder: Reminder): void => {
			pi.sendMessage(
				{
					customType: WARNING_MESSAGE_TYPE,
					content: reminder.text,
					display: true,
					details: reminder.details,
				},
				// Streaming: `aside` reaches the model at the next step boundary without cutting the
				// running tool batch short (`steer` would). Idle: join the context for the next turn
				// instead of starting an autonomous one.
				{ deliverAs: ctx.isIdle() ? "nextTurn" : "aside" },
			);
		};

		/** Check one mutation; resolves to a reminder for duplicates not reported before. */
		const warnFor = async (
			ctx: ExtensionContext,
			active: ActiveWorkspace,
			request: CheckRequest,
		): Promise<Reminder | undefined> => {
			try {
				const result = await active.handle.check(request);
				if (result.status !== "checked") return undefined;
				const fresh = ledger.filterNew(result.matches);
				if (fresh.length === 0) return undefined;
				return await buildReminder({
					root: active.handle.root,
					file: fresh[0]!.region.file,
					matches: fresh,
					saveArtifact: (content) =>
						ctx.sessionManager.saveArtifact(content, "duplicate-detector"),
				});
			} catch (err) {
				// check() rejects only once the handle was released (session ended or detection turned off).
				if (workspace === active)
					logger.warn("duplicate-detector: check failed", {
						error: errorText(err),
					});
				return undefined;
			}
		};

		pi.registerMessageRenderer(WARNING_MESSAGE_TYPE, createWarningRenderer());

		pi.on("session_start", async (_event, ctx) => {
			if (!legacyCleanupStarted) {
				legacyCleanupStarted = true;
				void removeLegacyCacheFiles(deps.cacheDir);
			}
			await restart(ctx);
		});

		pi.on("session_switch", async (_event, ctx) => {
			befores.clear();
			ledger.clear();
			await restart(ctx);
		});

		pi.on("session_branch", () => {
			ledger.clear();
		});

		pi.on("session_tree", () => {
			ledger.clear();
		});

		pi.on("session_shutdown", async (_event, ctx) => {
			await stop(ctx);
		});

		pi.on("before_agent_start", () => {
			workspace?.handle.refresh();
		});

		pi.on("tool_call", async (event, ctx) => {
			if (event.toolName !== "write") return;
			// Bounded: omp blocks the call when a tool_call handler stalls. A start still pending
			// after the wait may yet enable detection, so capture anyway.
			let started = false;
			const wait = Promise.withResolvers<void>();
			const timer = setTimeout(wait.resolve, START_WAIT_MS);
			await Promise.race([
				starting.then(() => {
					started = true;
				}),
				wait.promise,
			]);
			clearTimeout(timer);
			if (started && !workspace) return;
			const target = resolveToolPath(
				ctx.cwd,
				(event.input as Record<string, unknown>).path,
			);
			if (!target) return;
			const content = await readBefore(target);
			if (befores.size >= MAX_PENDING_BEFORES) {
				const oldest = befores.keys().next();
				if (!oldest.done) befores.delete(oldest.value);
			}
			befores.set(event.toolCallId, { path: target, content });
		});

		pi.on("tool_result", async (event, ctx) => {
			const before = befores.get(event.toolCallId);
			befores.delete(event.toolCallId);
			await starting;
			const active = workspace;
			if (!active) return;
			const requests = mutationRequests(event, ctx.cwd, before);
			if (requests === undefined || event.isError) {
				// Out-of-band or partially applied changes: let the rescan pick them up.
				if (!READ_ONLY_TOOLS.has(event.toolName)) active.handle.refresh();
				return;
			}
			if (requests.length === 0) return;

			const gen = generation;
			const inBand = active.config.settings.reminderMode === "in-band";
			const onTime: Reminder[] = [];
			let inTime = true;
			const deliverLate = (reminder: Reminder): void => {
				if (gen === generation) sendWarning(ctx, reminder);
			};
			const tracked = requests.map((request) =>
				warnFor(ctx, active, request).then((reminder) => {
					if (!reminder) return;
					if (inTime) onTime.push(reminder);
					else deliverLate(reminder);
				}),
			);
			const budget = Promise.withResolvers<void>();
			const timer = ctx.setTimeout(() => budget.resolve(), CHECK_BUDGET_MS);
			await Promise.race([Promise.all(tracked), budget.promise]);
			inTime = false;
			ctx.clearTimer(timer);
			if (onTime.length === 0 || gen !== generation) return;
			if (inBand)
				return {
					additionalContext: onTime
						.map((reminder) => reminder.text)
						.join("\n\n"),
				};
			for (const reminder of onTime) sendWarning(ctx, reminder);
		});

		pi.registerCommand("duplicates", {
			description:
				"Duplicate detector for this project: /duplicates on|off|status",
			getArgumentCompletions: (prefix) =>
				[
					{
						value: "on",
						label: "on",
						description: "Enable duplicate detection for this project",
					},
					{
						value: "off",
						label: "off",
						description: "Disable duplicate detection for this project",
					},
					{
						value: "status",
						label: "status",
						description: "Show duplicate detection status",
					},
				].filter((item) => item.value.startsWith(prefix.trim().toLowerCase())),
			handler: async (args, ctx) => {
				const action = args.trim().toLowerCase();
				try {
					if (action === "on") {
						await setProjectEnabled(ctx.cwd, true, stateOptions);
						await restart(ctx);
						ctx.ui.notify(
							"Duplicate detector enabled for this project.",
							"info",
						);
					} else if (action === "off") {
						await setProjectEnabled(ctx.cwd, false, stateOptions);
						await stop(ctx);
						ctx.ui.notify(
							"Duplicate detector disabled for this project.",
							"info",
						);
					} else if (action === "status" || action === "") {
						await starting;
						const enabled = await isProjectEnabled(ctx.cwd, stateOptions);
						const detail = workspace
							? `${describeStatus(workspace.handle.status())}; root ${workspace.handle.root}; reminders: ${workspace.config.settings.reminderMode}`
							: "not running";
						ctx.ui.notify(
							`Duplicate detector is ${enabled ? "enabled" : "disabled"} for this project (${detail}).`,
							"info",
						);
					} else {
						ctx.ui.notify(
							`Unknown argument "${args.trim()}". Usage: /duplicates on|off|status`,
							"error",
						);
					}
				} catch (err) {
					ctx.ui.notify(`Duplicate detector: ${errorText(err)}`, "error");
				}
			},
		});
	};
}

const duplicateDetector = createDuplicateDetector({
	loadPluginSettings: (cwd) => getPluginSettings(PLUGIN_NAME, cwd),
});

/** @public omp extension entry point. */
export default duplicateDetector;
