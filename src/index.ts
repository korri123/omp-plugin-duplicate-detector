import * as path from "node:path";
import type { IClone } from "@jscpd/core";
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
	isGeneratedContent,
	JscpdIndexManager,
	MAX_INDEXED_FILES,
} from "./jscpd-engine";
import {
	DuplicateNotificationComponent,
	type DuplicateNotificationData,
	DuplicateStatusComponent,
	type DuplicateStatusData,
	type ThemeLike,
} from "./tui-notification";

export * from "./config-loader";
export * from "./coordinator";
export * from "./disk-cache";
export * from "./duplicate-ledger";
export * from "./jscpd-engine";
export * from "./source-aware-index";
export * from "./tui-notification";
export * from "./types";
export * from "./worker-protocol";

export interface DuplicateDetectorConfig {
	minLines: number;
	minTokens: number;
	maxLines?: number;
	maxIndexedFiles?: number;
	checkOnMutation: boolean;
	reminderMode: "in-band" | "steer" | "none";
	ignorePatterns: string[];
	formatsExts?: Record<string, string[]>;
	configSource?: string;
}

const DEFAULT_CONFIG: DuplicateDetectorConfig = {
	minLines: 5,
	minTokens: 40,
	checkOnMutation: true,
	reminderMode: "steer",
	ignorePatterns: [],
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
		formatsExts: baseFormatsExts,
		configSource,
	};
}

/**
 * Creates a configured JscpdIndexManager from a DuplicateDetectorConfig.
 */
export function createEngineFromConfig(
	config: DuplicateDetectorConfig,
	overrides: {
		minLines?: number;
		minTokens?: number;
		maxIndexedFiles?: number;
	} = {},
): JscpdIndexManager {
	return new JscpdIndexManager({
		minLines: overrides.minLines ?? config.minLines,
		minTokens: overrides.minTokens ?? config.minTokens,
		maxLines: config.maxLines,
		formatsExts: config.formatsExts,
		maxIndexedFiles: overrides.maxIndexedFiles ?? config.maxIndexedFiles,
	});
}

/**
 * Formats discovered clone clusters into a Markdown report.
 */
export function formatReport(
	clones: IClone[] = [],
	scanPath = ".",
	options?: {
		indexedCount?: number;
		baselineStatus?: BaselineStatus;
		minLines?: number;
		minTokens?: number;
	},
): string {
	let report = "# Duplicate Code Report\n\n";
	if (typeof options?.indexedCount === "number") {
		report += `- **Indexed Files**: ${options.indexedCount}\n`;
	}
	report += `- **Scan Target**: \`${scanPath || "."}\`\n`;
	report += `- **Duplicate Clusters Found**: ${clones.length}\n`;

	if (options?.baselineStatus === "skipped_not_git") {
		report +=
			"- **Baseline Status**: Skipped (Directory is not inside a Git working tree; automatic scan requires Git-tracked files)\n";
	} else if (options?.baselineStatus === "capped_file_count") {
		report += "- **Baseline Status**: Capped at 2,500 file limit\n";
	} else if (options?.baselineStatus === "capped_source_bytes") {
		report += "- **Baseline Status**: Capped at 64 MB limit\n";
	}

	report += "\n";

	if (clones.length === 0) {
		const minLines = options?.minLines ?? 5;
		const minTokens = options?.minTokens ?? 40;
		report += `No duplicate code blocks found matching threshold (minLines: ${minLines}, minTokens: ${minTokens}).\n`;
		return report;
	}

	report += "## Detected Clones\n\n";
	for (let i = 0; i < clones.length; i++) {
		const clone = clones[i]!;
		const a = clone.duplicationA;
		const b = clone.duplicationB;
		const linesCount = a.end.line - a.start.line + 1;

		report += `### Clone #${i + 1} (${linesCount} lines, format: ${clone.format})\n`;
		report += `- **Location A**: \`${a.sourceId}:${a.start.line}-${a.end.line}\`\n`;
		report += `- **Location B**: \`${b.sourceId}:${b.start.line}-${b.end.line}\`\n`;

		if (a.fragment) {
			report += `\n\`\`\`${clone.format}\n${a.fragment.trim()}\n\`\`\`\n`;
		}
		report += "\n";
	}

	return report;
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
	const z = pi.zod;

	pi.setLabel("Duplicate Detector");

	let activeRawSettings: Record<string, unknown> | undefined;
	let config: DuplicateDetectorConfig = { ...DEFAULT_CONFIG };
	let currentCwd: string = process.cwd();
	let lastCtx: ExtensionContext | undefined;
	const ledger = new DuplicateLedger();
	const fileRevisions = new Map<string, number>();
	const coordinator = new DuplicateDetectorCoordinator();

	let workerFailureNotified = false;
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
		if (ctx?.cwd) {
			currentCwd = ctx.cwd;
		}
		lastCtx = ctx as ExtensionContext;

		activeRawSettings = extractSettingsObject(event, ctx);
		const projectConfig = ctx?.cwd
			? await findProjectJscpdConfig(ctx.cwd)
			: null;
		config = resolveConfig(activeRawSettings, projectConfig);

		if (ctx?.cwd) {
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

	// Initialize repository index in background on session start (non-blocking)
	pi.on("session_start", async (event, ctx) => {
		currentCwd = ctx.cwd;
		lastCtx = ctx as ExtensionContext;
		fileRevisions.clear();
		workerFailureNotified = false;

		pi.logger.debug("Duplicate detector initializing workspace index", {
			cwd: ctx.cwd,
		});

		activeRawSettings = extractSettingsObject(event, ctx);
		const projectConfig = await findProjectJscpdConfig(ctx.cwd);
		config = resolveConfig(activeRawSettings, projectConfig);

		if (config.configSource) {
			pi.logger.info("Duplicate detector loaded project configuration", {
				source: config.configSource,
				minLines: config.minLines,
				minTokens: config.minTokens,
				ignoreCount: config.ignorePatterns.length,
			});
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
			if (!config.checkOnMutation) return;
			if (config.reminderMode === "none") return;
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
				// Skip ignored files (matching ignore patterns or noise files)
				const ignoreFilter = createIgnoreFilter(config.ignorePatterns);
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
					const reminder = ledger.formatReminder(
						freshClones,
						normalizedRelPath,
						content,
					);

					pi.logger.info("Duplicates detected on file mutation", {
						file: normalizedRelPath,
						count: freshClones.length,
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

	// Register LLM-callable tool
	async function executeScan(
		targetPath: string,
		options: { minLines?: number; minTokens?: number } = {},
	): Promise<{
		clones: IClone[];
		report: string;
		configSource: string | null;
	}> {
		const projectConfig =
			targetPath !== currentCwd
				? await findProjectJscpdConfig(targetPath)
				: null;
		const effectiveConfig = projectConfig
			? resolveConfig(activeRawSettings, projectConfig)
			: config;

		const minLines =
			typeof options.minLines === "number"
				? Math.max(3, options.minLines)
				: effectiveConfig.minLines;

		const minTokens =
			typeof options.minTokens === "number"
				? Math.max(10, options.minTokens)
				: effectiveConfig.minTokens;

		const combinedIgnores = Array.from(
			new Set([
				...config.ignorePatterns,
				...(effectiveConfig.ignorePatterns || []),
			]),
		);

		let clones: IClone[] = [];
		const isCustomScan =
			targetPath !== currentCwd ||
			minLines !== config.minLines ||
			minTokens !== config.minTokens ||
			combinedIgnores.length !== config.ignorePatterns.length;

		if (isCustomScan) {
			clones = await coordinator.scan({
				targetPath,
				options: {
					minLines,
					minTokens,
					maxLines: effectiveConfig.maxLines,
					ignorePatterns: combinedIgnores,
					formatsExts: effectiveConfig.formatsExts,
				},
			});
		} else {
			clones = await coordinator.scan();
		}

		const report = formatReport(clones, targetPath, {
			minLines,
			minTokens,
		});

		return {
			clones,
			report,
			configSource: effectiveConfig.configSource ?? null,
		};
	}

	// Register LLM-callable tool
	pi.registerTool({
		name: "detect_duplicates",
		label: "Detect Duplicates",
		description:
			"Scan the codebase or a target directory for duplicate code blocks, copy-pasted logic, and code clones using jscpd.",
		parameters: z.object({
			path: z
				.string()
				.optional()
				.describe(
					"Root directory or path to scan (defaults to project workspace root)",
				),
			minLines: z
				.number()
				.optional()
				.describe(
					"Minimum number of consecutive matching lines to report (default: 5)",
				),
			minTokens: z
				.number()
				.optional()
				.describe(
					"Minimum token count threshold for a clone block (default: 40)",
				),
		}),
		async execute(
			_toolCallId,
			params: { path?: string; minLines?: number; minTokens?: number },
			signal,
			onUpdate,
			ctx,
		) {
			if (signal?.aborted) {
				return {
					content: [
						{ type: "text", text: "Duplicate detection scan cancelled." },
					],
					details: null,
				};
			}

			onUpdate?.({
				content: [
					{
						type: "text",
						text: "Scanning codebase for duplicate code blocks via jscpd...",
					},
				],
			});

			const scanPath = params.path
				? path.isAbsolute(params.path)
					? params.path
					: path.join(ctx.cwd, params.path)
				: ctx.cwd;

			try {
				const { clones, report, configSource } = await executeScan(scanPath, {
					minLines: params.minLines,
					minTokens: params.minTokens,
				});

				if (signal?.aborted) {
					return {
						content: [
							{ type: "text", text: "Duplicate detection scan cancelled." },
						],
						details: null,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: report,
						},
					],
					details: {
						clones,
						scanPath,
						configSource,
					},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					content: [
						{ type: "text", text: `Duplicate detection failed: ${message}` },
					],
					details: null,
					isError: true,
				};
			}
		},
	});

	// Register /duplicates slash command
	pi.registerCommand("duplicates", {
		description: "Scan workspace for duplicate and clone code blocks",
		getArgumentCompletions: (prefix) => {
			const options = ["--min-lines=5", "--min-tokens=40", "--path="];
			return options
				.filter((opt) => opt.startsWith(prefix))
				.map((label) => ({
					value: label,
					label,
					description: `Option: ${label}`,
				}));
		},
		handler: async (args, ctx) => {
			ctx.ui.notify("Scanning workspace for duplicate code...", "info");

			let targetPath = ctx.cwd;
			let cliMinLines: number | undefined;
			let cliMinTokens: number | undefined;

			const parts = args.trim().split(/\s+/).filter(Boolean);
			for (const part of parts) {
				if (part.startsWith("--min-lines=")) {
					const val = Number.parseInt(part.slice("--min-lines=".length), 10);
					if (!Number.isNaN(val)) cliMinLines = Math.max(3, val);
				} else if (part.startsWith("--min-tokens=")) {
					const val = Number.parseInt(part.slice("--min-tokens=".length), 10);
					if (!Number.isNaN(val)) cliMinTokens = Math.max(10, val);
				} else if (part.startsWith("--path=")) {
					targetPath = path.resolve(ctx.cwd, part.slice("--path=".length));
				} else if (!part.startsWith("-")) {
					targetPath = path.resolve(ctx.cwd, part);
				}
			}

			try {
				const { clones, report } = await executeScan(targetPath, {
					minLines: cliMinLines,
					minTokens: cliMinTokens,
				});

				pi.sendMessage(
					{
						customType: "duplicate-detector-report",
						content: report,
						display: true,
						attribution: "user",
						details: {
							filePath: targetPath,
							clones,
							content: report,
						},
					},
					{ triggerTurn: false },
				);
				ctx.ui.notify(
					`Duplicate scan finished: ${clones.length} duplicate cluster${clones.length === 1 ? "" : "s"} found.`,
					clones.length > 0 ? "warning" : "info",
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Duplicate scan failed: ${message}`, "error");
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
