import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolResultEventResult,
} from "@oh-my-pi/pi-coding-agent";
import {
	findProjectJscpdConfig,
	type JscpdProjectConfig,
} from "./config-loader";
import { DuplicateDetectorCoordinator } from "./coordinator";
import { DuplicateLedger } from "./duplicate-ledger";
import {
	type BaselineStatus,
	createIgnoreFilter,
	execGit,
	isGeneratedContent,
	isInsideGitWorkTree,
	MAX_INDEXED_FILES,
} from "./jscpd-engine";
import { isProjectEnabled, setProjectEnabled } from "./project-state";
import {
	DuplicateNotificationComponent,
	type DuplicateNotificationData,
	DuplicateStatusComponent,
	type DuplicateStatusData,
	type ThemeLike,
} from "./tui-notification";

export interface DuplicateDetectorConfig {
	minLines: number;
	minTokens: number;
	maxLines?: number;
	maxIndexedFiles?: number;
	checkOnMutation: boolean;
	reminderMode: "in-band" | "steer" | "none";
	ignorePatterns: string[];
	ignoreTests: boolean;
	customTestPatterns?: string[];
	excludeTestPatterns?: string[];
	formatsExts?: Record<string, string[]>;
	configSource?: string;
}

const DEFAULT_CONFIG: DuplicateDetectorConfig = {
	minLines: 5,
	minTokens: 40,
	checkOnMutation: true,
	reminderMode: "steer",
	ignorePatterns: [],
	ignoreTests: true,
};

/**
 * Resolves user settings from configuration context merged with project-level jscpd configuration.
 */
export function resolveConfig(
	rawSettings?: Record<string, unknown>,
	projectConfig?: JscpdProjectConfig | null,
): DuplicateDetectorConfig {
	const baseMinLines = projectConfig?.minLines ?? DEFAULT_CONFIG.minLines;
	const baseMinTokens = projectConfig?.minTokens ?? DEFAULT_CONFIG.minTokens;
	const baseMaxLines = projectConfig?.maxLines;
	const baseMaxIndexedFiles = projectConfig?.maxIndexedFiles;
	const baseFormatsExts = projectConfig?.formatsExts;
	const baseIgnoreTests =
		projectConfig?.ignoreTests ?? DEFAULT_CONFIG.ignoreTests;
	const baseCustomTestPatterns = projectConfig?.customTestPatterns;
	const baseExcludeTestPatterns = projectConfig?.excludeTestPatterns;
	const projectIgnores = projectConfig?.ignore ?? [];

	let configSource: string | undefined;
	if (projectConfig?.sourcePath) {
		configSource =
			projectConfig.sourceType === "package.json"
				? `${projectConfig.sourcePath}#jscpd`
				: projectConfig.sourcePath;
	}

	if (!rawSettings) {
		return {
			minLines: baseMinLines,
			minTokens: baseMinTokens,
			maxLines: baseMaxLines,
			maxIndexedFiles: baseMaxIndexedFiles,
			checkOnMutation: DEFAULT_CONFIG.checkOnMutation,
			reminderMode: DEFAULT_CONFIG.reminderMode,
			ignorePatterns: projectIgnores,
			ignoreTests: baseIgnoreTests,
			customTestPatterns: baseCustomTestPatterns,
			excludeTestPatterns: baseExcludeTestPatterns,
			formatsExts: baseFormatsExts,
			configSource,
		};
	}

	const minLines =
		typeof rawSettings.minLines === "number"
			? Math.max(3, rawSettings.minLines)
			: baseMinLines;
	const minTokens =
		typeof rawSettings.minTokens === "number"
			? Math.max(10, rawSettings.minTokens)
			: baseMinTokens;
	const checkOnMutation =
		typeof rawSettings.checkOnMutation === "boolean"
			? rawSettings.checkOnMutation
			: DEFAULT_CONFIG.checkOnMutation;

	let maxIndexedFiles: number | undefined = baseMaxIndexedFiles;
	if (
		typeof rawSettings.maxIndexedFiles === "number" &&
		!Number.isNaN(rawSettings.maxIndexedFiles) &&
		rawSettings.maxIndexedFiles > 0
	) {
		maxIndexedFiles = Math.floor(rawSettings.maxIndexedFiles);
	} else if (typeof rawSettings.maxIndexedFiles === "string") {
		const parsed = Number.parseInt(rawSettings.maxIndexedFiles, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			maxIndexedFiles = parsed;
		}
	}

	const reminderMode =
		rawSettings.reminderMode === "steer" ||
		rawSettings.reminderMode === "none" ||
		rawSettings.reminderMode === "in-band"
			? rawSettings.reminderMode
			: DEFAULT_CONFIG.reminderMode;

	let userIgnores: string[] = [];
	if (typeof rawSettings.ignorePatterns === "string") {
		userIgnores = rawSettings.ignorePatterns
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	} else if (Array.isArray(rawSettings.ignorePatterns)) {
		userIgnores = rawSettings.ignorePatterns
			.map(String)
			.map((p) => p.trim())
			.filter(Boolean);
	}

	let ignoreTests = baseIgnoreTests;
	if (typeof rawSettings.ignoreTests === "boolean") {
		ignoreTests = rawSettings.ignoreTests;
	} else if (typeof rawSettings.ignoreTests === "string") {
		if (rawSettings.ignoreTests.toLowerCase() === "false") {
			ignoreTests = false;
		} else if (rawSettings.ignoreTests.toLowerCase() === "true") {
			ignoreTests = true;
		}
	}

	let userCustomTests: string[] = [];
	if (typeof rawSettings.customTestPatterns === "string") {
		userCustomTests = rawSettings.customTestPatterns
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	} else if (Array.isArray(rawSettings.customTestPatterns)) {
		userCustomTests = rawSettings.customTestPatterns
			.map(String)
			.map((p) => p.trim())
			.filter(Boolean);
	}
	const mergedCustomTests = Array.from(
		new Set([...(baseCustomTestPatterns ?? []), ...userCustomTests]),
	);

	let userExcludeTests: string[] = [];
	if (typeof rawSettings.excludeTestPatterns === "string") {
		userExcludeTests = rawSettings.excludeTestPatterns
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	} else if (Array.isArray(rawSettings.excludeTestPatterns)) {
		userExcludeTests = rawSettings.excludeTestPatterns
			.map(String)
			.map((p) => p.trim())
			.filter(Boolean);
	}
	const mergedExcludeTests = Array.from(
		new Set([...(baseExcludeTestPatterns ?? []), ...userExcludeTests]),
	);

	const mergedIgnores = Array.from(
		new Set([...projectIgnores, ...userIgnores]),
	);

	return {
		minLines,
		minTokens,
		maxLines: baseMaxLines,
		maxIndexedFiles,
		checkOnMutation,
		reminderMode,
		ignorePatterns: mergedIgnores,
		ignoreTests,
		customTestPatterns:
			mergedCustomTests.length > 0 ? mergedCustomTests : undefined,
		excludeTestPatterns:
			mergedExcludeTests.length > 0 ? mergedExcludeTests : undefined,
		formatsExts: baseFormatsExts,
		configSource,
	};
}

function extractSettingsObject(
	event: unknown,
	ctx: unknown,
): Record<string, unknown> | undefined {
	if (
		event &&
		typeof event === "object" &&
		"settings" in event &&
		event.settings &&
		typeof event.settings === "object"
	) {
		return event.settings as Record<string, unknown>;
	}
	if (
		ctx &&
		typeof ctx === "object" &&
		"settings" in ctx &&
		ctx.settings &&
		typeof ctx.settings === "object"
	) {
		return ctx.settings as Record<string, unknown>;
	}
	return undefined;
}

export function formatBaselineMessage(
	status: BaselineStatus,
	count: number,
	cachedCount?: number,
	maxIndexedFiles?: number,
): string {
	if (status === "disabled") {
		return "Duplicate detector: Disabled for this project (use '/duplicates on' to enable)";
	}

	if (status === "skipped_not_git") {
		return "Duplicate detector: Baseline skipped (not a Git repository; mutation checks active)";
	}
	const fileWord = count === 1 ? "file" : "files";
	const formattedCount = count.toLocaleString();

	let cacheDetail = "";
	if (cachedCount !== undefined && count > 0) {
		if (cachedCount === count) {
			cacheDetail = ", cached";
		} else if (cachedCount === 0) {
			cacheDetail = ", uncached";
		} else {
			cacheDetail = `, ${cachedCount.toLocaleString()} cached`;
		}
	}

	if (status === "complete") {
		const gitLabel = count === 1 ? "Git file" : "Git files";
		return `Duplicate detector: Ready (${formattedCount} ${gitLabel} indexed${cacheDetail})`;
	}

	if (status === "capped_file_count") {
		const limit = (maxIndexedFiles ?? MAX_INDEXED_FILES).toLocaleString();
		return `Duplicate detector: Ready (${formattedCount} ${fileWord} indexed${cacheDetail}, capped at ${limit} file limit)`;
	}

	if (status === "capped_source_bytes") {
		return `Duplicate detector: Ready (${formattedCount} ${fileWord} indexed${cacheDetail}, capped at 64 MB limit)`;
	}

	return "";
}

function notifyBaselineStatus(
	pi: ExtensionAPI,
	ctx:
		| {
				ui?: {
					notify: (msg: string, type?: "info" | "warning" | "error") => void;
				};
		  }
		| undefined,
	status: BaselineStatus,
	count: number,
	cachedCount?: number,
	maxIndexedFiles?: number,
): void {
	const message = formatBaselineMessage(
		status,
		count,
		cachedCount,
		maxIndexedFiles,
	);
	if (!message) return;

	const level: "info" | "warning" =
		status === "capped_file_count" || status === "capped_source_bytes"
			? "warning"
			: "info";

	// 1. Send transient TUI toast if UI is active
	ctx?.ui?.notify?.(message, level);

	// 2. Send persistent transcript notification into the chat feed
	pi.sendMessage(
		{
			customType: "duplicate-detector-status",
			content: message,
			display: true,
			attribution: "user",
			details: {
				status,
				count,
				cachedCount,
				content: message,
			},
		},
		{ triggerTurn: false },
	);
}

/**
 * Main extension factory for oh-my-pi duplicate detector plugin powered by jscpd.
 */
export default function duplicateDetectorExtension(pi: ExtensionAPI): void {
	pi.setLabel("Duplicate Detector");

	let isEnabledForProject = true;
	let activeRawSettings: Record<string, unknown> | undefined;
	let config: DuplicateDetectorConfig = { ...DEFAULT_CONFIG };
	let currentCwd: string = process.cwd();
	let lastCtx: ExtensionContext | undefined;
	const ledger = new DuplicateLedger();
	const fileRevisions = new Map<string, number>();
	const coordinator = new DuplicateDetectorCoordinator();
	let lastKnownHead: string | null = null;
	let workerFailureNotified = false;

	const reconcileParentGitState = async (cwd: string): Promise<void> => {
		if (!isEnabledForProject) return;
		try {
			const isGit = await isInsideGitWorkTree(cwd);
			if (!isGit) return;

			const { stdout: currentHeadRaw } = await execGit(
				["rev-parse", "HEAD"],
				cwd,
			).catch(() => ({ stdout: "" }));
			const currentHead = currentHeadRaw.trim();

			const modifiedFiles: string[] = [];
			let reconciliationSucceeded = true;

			if (lastKnownHead && currentHead && lastKnownHead !== currentHead) {
				try {
					const { stdout: diffOut } = await execGit(
						[
							"diff",
							"--name-status",
							"-z",
							lastKnownHead,
							currentHead,
							"--",
							".",
						],
						cwd,
					);

					const tokens = diffOut.split("\0");
					let t = 0;
					while (t < tokens.length) {
						const status = tokens[t]?.trim();
						t++;
						if (!status) continue;
						if (status.startsWith("R") || status.startsWith("C")) {
							const oldPath = tokens[t]?.trim();
							t++;
							const newPath = tokens[t]?.trim();
							t++;
							if (oldPath) modifiedFiles.push(path.resolve(cwd, oldPath));
							if (newPath) modifiedFiles.push(path.resolve(cwd, newPath));
						} else {
							const filePath = tokens[t]?.trim();
							t++;
							if (filePath) modifiedFiles.push(path.resolve(cwd, filePath));
						}
					}
				} catch {
					reconciliationSucceeded = false;
				}
			}
			const { stdout: statusOut } = await execGit(
				["status", "--porcelain", "-z", "--untracked-files=no", "--", "."],
				cwd,
			).catch(() => ({ stdout: "" }));

			const statusEntries = statusOut.split("\0");
			let i = 0;
			while (i < statusEntries.length) {
				const entry = statusEntries[i];
				i++;
				if (!entry || entry.length < 4) continue;
				const statusCode = entry.slice(0, 2);
				const relPath = entry.slice(3).trim();
				if (statusCode.includes("R") && i < statusEntries.length) {
					const oldRelPath = statusEntries[i]?.trim();
					i++;
					if (oldRelPath) {
						modifiedFiles.push(path.resolve(cwd, oldRelPath));
					}
				}
				if (relPath) {
					modifiedFiles.push(path.resolve(cwd, relPath));
				}
			}
			if (modifiedFiles.length > 0) {
				const uniqueFiles = [...new Set(modifiedFiles)];
				try {
					await coordinator.reconcile(
						uniqueFiles.map((filePath) => ({ filePath })),
					);
				} catch {
					reconciliationSucceeded = false;
				}
			}

			// Only advance the watermark when reconciliation succeeded
			if (reconciliationSucceeded && currentHead) {
				lastKnownHead = currentHead;
			}
		} catch {
			// Fail open
		}
	};
	const notifyWorkerFailure = (error: unknown): void => {
		if (workerFailureNotified || !lastCtx) return;
		workerFailureNotified = true;
		const reason = error instanceof Error ? error.message : String(error);
		const message = `Duplicate detector: Background worker failed (${reason})`;

		lastCtx.ui?.notify?.(message, "error");
		pi.sendMessage(
			{
				customType: "duplicate-detector-status",
				content: message,
				display: true,
				attribution: "user",
				details: {
					status: "failed",
					error: reason,
					content: message,
				},
			},
			{ triggerTurn: false },
		);
	};

	// Wire coordinator event listeners
	coordinator.on("progress", (payload) => {
		pi.logger.debug("Duplicate detector indexing progress", {
			...payload,
		});
	});

	coordinator.on("complete", (payload) => {
		if (!isEnabledForProject) return;
		const status: BaselineStatus = payload.status ?? "complete";
		if (status === "failed") {
			notifyWorkerFailure(payload.error ?? "Baseline indexing failed");
			return;
		}
		workerFailureNotified = false;
		notifyBaselineStatus(
			pi,
			lastCtx,
			status,
			payload.indexedCount,
			payload.cachedCount,
			config.maxIndexedFiles,
		);
	});

	coordinator.on("status", (payload) => {
		pi.logger.debug("Duplicate detector worker status", {
			...payload,
		});
		if (payload.status === "error") {
			notifyWorkerFailure(payload.message ?? "Unknown worker error");
		}
	});

	coordinator.on("error", (err) => {
		pi.logger.warn("Duplicate detector coordinator error", {
			error: err instanceof Error ? err.message : String(err),
		});
		notifyWorkerFailure(err);
	});

	coordinator.on("lateFinding", async ({ clone }) => {
		if (!isEnabledForProject) return;
		if (!config.checkOnMutation || config.reminderMode === "none") return;
		const sourceA = clone.duplicationA.sourceId;
		const sourceB = clone.duplicationB.sourceId;

		const relA = (
			path.isAbsolute(sourceA) && currentCwd
				? path.relative(currentCwd, sourceA)
				: sourceA
		).replace(/\\/g, "/");

		const relB = (
			path.isAbsolute(sourceB) && currentCwd
				? path.relative(currentCwd, sourceB)
				: sourceB
		).replace(/\\/g, "/");

		// Determine if either file is one that was recently mutated in the active session
		const targetRel = fileRevisions.has(relA)
			? relA
			: fileRevisions.has(relB)
				? relB
				: undefined;

		if (!targetRel) return;

		const freshClones = ledger.filterFreshClones(targetRel, [clone]);
		if (freshClones.length > 0) {
			const fullPath = path.isAbsolute(targetRel)
				? targetRel
				: path.join(currentCwd, targetRel);
			let content: string | undefined;
			try {
				const file = Bun.file(fullPath);
				if (await file.exists()) {
					content = await file.text();
				}
			} catch {}

			const reminder = ledger.formatReminder(freshClones, targetRel, content);
			pi.logger.info("Late clone finding surfaced for file mutation", {
				file: targetRel,
				cloneCount: freshClones.length,
			});

			if (
				config.reminderMode === "steer" ||
				config.reminderMode === "in-band"
			) {
				pi.sendMessage(
					{
						customType: "duplicate-detector-warning",
						content: reminder,
						display: true,
						attribution: "user",
						details: {
							filePath: targetRel,
							clones: freshClones,
							content,
						},
					},
					{ deliverAs: "steer" },
				);
			}
		}
	});

	// Session lifecycle: reset on switch and branch
	pi.on("session_switch", async (event, ctx) => {
		ledger.clear();
		fileRevisions.clear();
		workerFailureNotified = false;
		lastKnownHead = null;
		if (ctx?.cwd) {
			currentCwd = ctx.cwd;
			execGit(["rev-parse", "HEAD"], ctx.cwd)
				.then(({ stdout }) => {
					lastKnownHead = stdout.trim() || null;
				})
				.catch(() => {
					lastKnownHead = null;
				});
		}
		lastCtx = ctx as ExtensionContext;
		activeRawSettings = extractSettingsObject(event, ctx);
		config = resolveConfig(activeRawSettings, null);
		const projectConfig = ctx?.cwd
			? await findProjectJscpdConfig(ctx.cwd)
			: null;
		if (projectConfig) {
			config = resolveConfig(activeRawSettings, projectConfig);
		}
		if (ctx?.cwd) {
			isEnabledForProject = await isProjectEnabled(ctx.cwd);
			if (!isEnabledForProject) {
				pi.logger.info("Duplicate detector is disabled for this project", {
					cwd: ctx.cwd,
				});
				notifyBaselineStatus(pi, lastCtx, "disabled", 0);
				return;
			}

			try {
				await coordinator.openWorkspace(ctx.cwd, config);
			} catch (err) {
				notifyWorkerFailure(err);
			}
		}
	});

	pi.on("session_branch", async () => {
		ledger.clear();
		fileRevisions.clear();
	});

	pi.on("session_shutdown", async () => {
		await coordinator.dispose();
	});

	if (typeof process !== "undefined" && typeof process.on === "function") {
		process.once("beforeExit", () => {
			coordinator.dispose().catch(() => {});
		});
	}

	// Trigger parent git reconciliation on turn start
	pi.on("before_agent_start", async (_event, ctx) => {
		if (ctx?.cwd) {
			await reconcileParentGitState(ctx.cwd);
		}
	});

	// Initialize repository index in background on session start (non-blocking)
	pi.on("session_start", async (event, ctx) => {
		currentCwd = ctx.cwd;
		lastCtx = ctx as ExtensionContext;
		fileRevisions.clear();
		workerFailureNotified = false;

		execGit(["rev-parse", "HEAD"], ctx.cwd)
			.then(({ stdout }) => {
				lastKnownHead = stdout.trim() || null;
			})
			.catch(() => {
				lastKnownHead = null;
			});
		pi.logger.debug("Duplicate detector initializing workspace index", {
			cwd: ctx.cwd,
		});

		activeRawSettings = extractSettingsObject(event, ctx);
		config = resolveConfig(activeRawSettings, null);
		const projectConfig = await findProjectJscpdConfig(ctx.cwd);
		if (projectConfig) {
			config = resolveConfig(activeRawSettings, projectConfig);
		}
		if (config.configSource) {
			pi.logger.info("Duplicate detector loaded project configuration", {
				source: config.configSource,
				minLines: config.minLines,
				minTokens: config.minTokens,
				ignoreCount: config.ignorePatterns.length,
			});
		}

		isEnabledForProject = await isProjectEnabled(ctx.cwd);
		if (!isEnabledForProject) {
			pi.logger.info("Duplicate detector is disabled for this project", {
				cwd: ctx.cwd,
			});
			notifyBaselineStatus(pi, lastCtx, "disabled", 0);
			return;
		}

		try {
			await coordinator.openWorkspace(ctx.cwd, config);
		} catch (err) {
			pi.logger.warn("Duplicate detector background indexing failed", {
				error: err instanceof Error ? err.message : String(err),
			});
			notifyWorkerFailure(err);
		}
	});

	// Intercept write and edit tool executions to detect clones in newly added/modified code
	pi.on(
		"tool_result",
		async (event, ctx): Promise<ToolResultEventResult | void> => {
			if (event.isError) return;
			if (!isEnabledForProject) return;
			if (!config.checkOnMutation) return;
			if (config.reminderMode === "none") return;
			if (event.toolName === "task" || event.toolName === "bash") {
				await reconcileParentGitState(ctx.cwd);
				return;
			}
			if (event.toolName !== "write" && event.toolName !== "edit") return;
			const input = event.input as { path?: string };
			const rawPath = input?.path;
			if (!rawPath || typeof rawPath !== "string") return;
			// Skip internal protocol URLs (e.g. xd://, local://)
			if (rawPath.includes("://")) return;

			const fullPath = path.isAbsolute(rawPath)
				? path.resolve(rawPath)
				: path.resolve(ctx.cwd, rawPath);
			const relPath = path.relative(ctx.cwd, fullPath);
			const normalizedRelPath = relPath.replace(/\\/g, "/");

			// If the mutated file is outside the workspace root or invalid, skip it
			if (
				!normalizedRelPath ||
				normalizedRelPath === ".." ||
				normalizedRelPath.startsWith("../") ||
				path.isAbsolute(normalizedRelPath)
			) {
				return;
			}

			try {
				// Skip ignored files (matching ignore patterns, noise files, or test files)
				const ignoreFilter = createIgnoreFilter(config.ignorePatterns, {
					ignoreTests: config.ignoreTests,
					customTestPatterns: config.customTestPatterns,
					excludeTestPatterns: config.excludeTestPatterns,
				});
				if (ignoreFilter(normalizedRelPath)) return;
				const file = Bun.file(fullPath);
				if (!(await file.exists())) return;

				const content = await file.text();

				// Skip generated files
				if (isGeneratedContent(content)) return;

				const revision = (fileRevisions.get(normalizedRelPath) ?? 0) + 1;
				fileRevisions.set(normalizedRelPath, revision);

				const { clones } = await coordinator.checkAndUpdate(
					fullPath,
					content,
					revision,
				);
				const freshClones = ledger.filterFreshClones(normalizedRelPath, clones);

				if (freshClones.length > 0) {
					const fullReminder = ledger.formatReminder(
						freshClones,
						normalizedRelPath,
						content,
						undefined,
						{ maxClones: 0, maxSnippetLines: 0 },
					);

					let artifactId: string | undefined;
					const fullBytes = Buffer.byteLength(fullReminder, "utf-8");
					const needsTruncation =
						freshClones.length > 4 || fullBytes > 8 * 1024;

					if (needsTruncation && ctx?.sessionManager?.saveArtifact) {
						try {
							artifactId = await ctx.sessionManager.saveArtifact(
								fullReminder,
								"duplicates",
							);
						} catch (err) {
							pi.logger.warn(
								"Failed to persist mutation duplicate warning to session artifact",
								{
									error: err instanceof Error ? err.message : String(err),
								},
							);
						}
					}

					const reminder = ledger.formatReminder(
						freshClones,
						normalizedRelPath,
						content,
						undefined,
						{
							maxClones: 4,
							maxSnippetLines: 8,
							artifactId,
						},
					);

					pi.logger.info("Duplicates detected on file mutation", {
						file: normalizedRelPath,
						count: freshClones.length,
						artifactId,
					});

					if (config.reminderMode === "steer") {
						pi.sendMessage(
							{
								customType: "duplicate-detector-warning",
								content: reminder,
								display: true,
								attribution: "user",
								details: {
									filePath: normalizedRelPath,
									clones: freshClones,
									content,
									artifactId,
								},
							},
							{ deliverAs: "steer" },
						);
						return;
					}

					// Prepend <system-reminder> to tool result content for in-band display
					const originalContent = Array.isArray(event.content)
						? (event.content as Array<{ type: "text"; text: string }>)
						: [{ type: "text" as const, text: String(event.content ?? "") }];

					const modifiedContent = [
						{ type: "text" as const, text: reminder },
						...originalContent,
					];

					return {
						content: modifiedContent,
					};
				}
			} catch (err) {
				pi.logger.warn("Failed checking duplicates for mutated file", {
					file: normalizedRelPath,
					error: err instanceof Error ? err.message : String(err),
				});
				notifyWorkerFailure(err);
			}
		},
	);
	// Register /duplicates slash command
	pi.registerCommand("duplicates", {
		description:
			"Toggle duplicate detector on or off for this project (/duplicates on|off)",
		getArgumentCompletions: (prefix) => {
			const options = ["on", "off", "status"];
			return options
				.filter((opt) => opt.startsWith(prefix.toLowerCase()))
				.map((label) => ({
					value: label,
					label,
					description:
						label === "on"
							? "Enable duplicate detection for this project"
							: label === "off"
								? "Disable duplicate detection for this project"
								: "Check duplicate detection status for this project",
				}));
		},
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "on") {
				await setProjectEnabled(ctx.cwd, true);
				isEnabledForProject = true;
				ctx.ui.notify("Duplicate detector enabled for this project.", "info");
				try {
					await coordinator.openWorkspace(ctx.cwd, config);
				} catch (err) {
					notifyWorkerFailure(err);
				}
			} else if (action === "off") {
				await setProjectEnabled(ctx.cwd, false);
				isEnabledForProject = false;
				ledger.clear();
				fileRevisions.clear();
				ctx.ui.notify("Duplicate detector disabled for this project.", "info");
				notifyBaselineStatus(pi, ctx as ExtensionContext, "disabled", 0);
			} else if (action === "status" || action === "") {
				const enabled = await isProjectEnabled(ctx.cwd);
				ctx.ui.notify(
					`Duplicate detector is currently ${enabled ? "enabled" : "disabled"} for this project. Usage: /duplicates on|off`,
					"info",
				);
			} else {
				ctx.ui.notify(
					`Unknown argument "${args.trim()}". Usage: /duplicates on|off`,
					"error",
				);
			}
		},
	});

	// Register TTSR-styled message renderers for duplicate alerts and reports
	if (typeof pi.registerMessageRenderer === "function") {
		pi.registerMessageRenderer<DuplicateNotificationData>(
			"duplicate-detector-warning",
			(message, options, theme) => {
				const data = message.details || {
					content:
						typeof message.content === "string" ? message.content : undefined,
				};
				return new DuplicateNotificationComponent(
					data,
					options?.expanded ?? false,
					theme as ThemeLike,
				);
			},
		);

		pi.registerMessageRenderer<DuplicateNotificationData>(
			"duplicate-detector-report",
			(message, options, theme) => {
				const data = message.details || {
					content:
						typeof message.content === "string" ? message.content : undefined,
				};
				return new DuplicateNotificationComponent(
					data,
					options?.expanded ?? false,
					theme as ThemeLike,
				);
			},
		);

		pi.registerMessageRenderer<DuplicateStatusData>(
			"duplicate-detector-status",
			(message, _options, theme) => {
				const data = message.details || {
					content:
						typeof message.content === "string" ? message.content : undefined,
				};
				return new DuplicateStatusComponent(data, theme as ThemeLike);
			},
		);
	}
}
