import * as path from "node:path";
import type { ExtensionAPI, ToolContentItem, ToolResultEventResult } from "@oh-my-pi/pi-coding-agent";
import { findProjectJscpdConfig, type JscpdProjectConfig } from "./config-loader";
import { DuplicateLedger } from "./duplicate-ledger";
import { createIgnoreFilter, isGeneratedContent, JscpdIndexManager } from "./jscpd-engine";
import { DuplicateNotificationComponent, type DuplicateNotificationData, type ThemeLike } from "./tui-notification";

export * from "./config-loader";
export * from "./duplicate-ledger";
export * from "./jscpd-engine";
export * from "./tui-notification";
export * from "./types";

export interface DuplicateDetectorConfig {
	minLines: number;
	minTokens: number;
	maxLines?: number;
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
	const baseFormatsExts = projectConfig?.formatsExts;
	const projectIgnores = projectConfig?.ignore ?? [];

	let configSource: string | undefined;
	if (projectConfig?.sourcePath) {
		configSource = projectConfig.sourceType === "package.json"
			? `${projectConfig.sourcePath}#jscpd`
			: projectConfig.sourcePath;
	}

	if (!rawSettings) {
		return {
			minLines: baseMinLines,
			minTokens: baseMinTokens,
			maxLines: baseMaxLines,
			checkOnMutation: DEFAULT_CONFIG.checkOnMutation,
			reminderMode: DEFAULT_CONFIG.reminderMode,
			ignorePatterns: projectIgnores,
			formatsExts: baseFormatsExts,
			configSource,
		};
	}

	const minLines = typeof rawSettings.minLines === "number" ? Math.max(3, rawSettings.minLines) : baseMinLines;
	const minTokens = typeof rawSettings.minTokens === "number" ? Math.max(10, rawSettings.minTokens) : baseMinTokens;
	const checkOnMutation = typeof rawSettings.checkOnMutation === "boolean" ? rawSettings.checkOnMutation : DEFAULT_CONFIG.checkOnMutation;

	const reminderMode = rawSettings.reminderMode === "steer" || rawSettings.reminderMode === "none" || rawSettings.reminderMode === "in-band"
		? rawSettings.reminderMode
		: DEFAULT_CONFIG.reminderMode;

	let userIgnores: string[] = [];
	if (typeof rawSettings.ignorePatterns === "string") {
		userIgnores = rawSettings.ignorePatterns
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	} else if (Array.isArray(rawSettings.ignorePatterns)) {
		userIgnores = rawSettings.ignorePatterns.map(String).map((p) => p.trim()).filter(Boolean);
	}

	const mergedIgnores = Array.from(new Set([...projectIgnores, ...userIgnores]));

	return {
		minLines,
		minTokens,
		maxLines: baseMaxLines,
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
export function createEngineFromConfig(config: DuplicateDetectorConfig, overrides: { minLines?: number; minTokens?: number } = {}): JscpdIndexManager {
	return new JscpdIndexManager({
		minLines: overrides.minLines ?? config.minLines,
		minTokens: overrides.minTokens ?? config.minTokens,
		maxLines: config.maxLines,
		formatsExts: config.formatsExts,
	});
}

function extractSettingsObject(event: unknown, ctx: unknown): Record<string, unknown> | undefined {
	if (event && typeof event === "object" && "settings" in event && event.settings && typeof event.settings === "object") {
		return event.settings as Record<string, unknown>;
	}
	if (ctx && typeof ctx === "object" && "settings" in ctx && ctx.settings && typeof ctx.settings === "object") {
		return ctx.settings as Record<string, unknown>;
	}
	return undefined;
}

/**
 * Main extension factory for oh-my-pi duplicate detector plugin powered by jscpd.
 */
export default function duplicateDetectorExtension(pi: ExtensionAPI): void {
	const z = pi.zod;

	pi.setLabel("Duplicate Detector");

	let activeRawSettings: Record<string, unknown> | undefined;
	let config: DuplicateDetectorConfig = { ...DEFAULT_CONFIG };
	let engine = createEngineFromConfig(config);
	const ledger = new DuplicateLedger();

	// Session lifecycle: reset on switch and branch
	pi.on("session_switch", async (event, ctx) => {
		ledger.clear();
		engine.reset();

		activeRawSettings = extractSettingsObject(event, ctx);
		const projectConfig = ctx?.cwd ? await findProjectJscpdConfig(ctx.cwd) : null;
		config = resolveConfig(activeRawSettings, projectConfig);
		engine = createEngineFromConfig(config);

		if (ctx?.cwd) {
			try {
				await engine.initialize(ctx.cwd, config.ignorePatterns);
			} catch {
				// Ignore background errors
			}
		}
	});

	pi.on("session_branch", async () => {
		ledger.clear();
	});

	// Initialize repository index in background on session start
	pi.on("session_start", async (event, ctx) => {
		pi.logger.debug("Duplicate detector initializing workspace index", { cwd: ctx.cwd });

		activeRawSettings = extractSettingsObject(event, ctx);
		const projectConfig = await findProjectJscpdConfig(ctx.cwd);
		config = resolveConfig(activeRawSettings, projectConfig);
		engine = createEngineFromConfig(config);

		if (config.configSource) {
			pi.logger.info("Duplicate detector loaded project configuration", {
				source: config.configSource,
				minLines: config.minLines,
				minTokens: config.minTokens,
				ignoreCount: config.ignorePatterns.length,
			});
		}

		try {
			const count = await engine.initialize(ctx.cwd, config.ignorePatterns);
			pi.logger.info("Duplicate detector index ready", {
				filesIndexed: count,
				configSource: config.configSource ?? "default",
			});
		} catch (err) {
			pi.logger.warn("Duplicate detector background indexing failed", {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	});

	// Intercept write and edit tool executions to detect clones in newly added/modified code
	pi.on("tool_result", async (event, ctx): Promise<ToolResultEventResult | void> => {
		if (event.isError) return;
		if (!config.checkOnMutation) return;
		if (config.reminderMode === "none") return;
		if (event.toolName !== "write" && event.toolName !== "edit") return;

		const input = event.input as { path?: string };
		const rawPath = input?.path;
		if (!rawPath || typeof rawPath !== "string") return;

		// Skip internal protocol URLs (e.g. xd://, local://)
		if (rawPath.includes("://")) return;

		const fullPath = path.isAbsolute(rawPath) ? rawPath : path.join(ctx.cwd, rawPath);
		const relPath = path.relative(ctx.cwd, fullPath) || rawPath;

		// Skip ignored files (matching ignore patterns or noise files)
		const ignoreFilter = createIgnoreFilter(config.ignorePatterns);
		if (ignoreFilter(relPath)) return;

		try {
			const file = Bun.file(fullPath);
			if (!(await file.exists())) return;

			const content = await file.text();

			// Skip generated files
			if (isGeneratedContent(content)) return;

			// If engine is not yet initialized for this workspace, initialize it now
			if (!engine.isInitialized) {
				await engine.initialize(ctx.cwd, config.ignorePatterns);
			}

			// Check snippet against existing indexed codebase
			const clones = await engine.checkSnippet(fullPath, content);
			const freshClones = ledger.filterFreshClones(relPath, clones);

			// Update engine index with the new file content for subsequent calls
			await engine.updateFile(fullPath, content);

			if (freshClones.length > 0) {
				const reminder = ledger.formatReminder(freshClones, relPath, content);

				pi.logger.info("Duplicates detected on file mutation", {
					file: relPath,
					count: freshClones.length,
				});

				if (config.reminderMode === "steer") {
					pi.sendMessage(
						{
							customType: "duplicate-detector-warning",
							content: reminder,
							display: true,
							attribution: "user",
							data: {
								filePath: relPath,
								clones: freshClones,
								content,
							},
						},
						{ deliverAs: "steer" },
					);
				}

				if (config.reminderMode === "steer") {
					return;
				}

				// In-band TTSR-style injection: prepend <system-reminder> to tool result content
				const originalContent: ToolContentItem[] = Array.isArray(event.content)
					? (event.content as ToolContentItem[])
					: [{ type: "text", text: String(event.content ?? "") }];

				const modifiedContent: ToolContentItem[] = [
					{ type: "text", text: reminder },
					...originalContent,
				];

				return {
					content: modifiedContent,
				};
			}
		} catch (err) {
			pi.logger.warn("Failed checking duplicates for mutated file", {
				file: relPath,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	});

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
				.describe("Root directory or path to scan (defaults to project workspace root)"),
			minLines: z
				.number()
				.optional()
				.describe("Minimum number of consecutive matching lines to report (default: 5)"),
			minTokens: z
				.number()
				.optional()
				.describe("Minimum token count threshold for a clone block (default: 40)"),
		}),
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Duplicate detection scan cancelled." }],
					details: null,
				};
			}

			onUpdate?.({
				content: [{ type: "text", text: "Scanning codebase for duplicate code blocks via jscpd..." }],
			});

			const scanPath = params.path
				? (path.isAbsolute(params.path) ? params.path : path.join(ctx.cwd, params.path))
				: ctx.cwd;

			const projectConfig = params.path ? await findProjectJscpdConfig(scanPath) : null;
			const effectiveConfig = projectConfig ? resolveConfig(activeRawSettings, projectConfig) : config;

			const minLines = typeof params.minLines === "number"
				? Math.max(3, params.minLines)
				: effectiveConfig.minLines;

			const minTokens = typeof params.minTokens === "number"
				? Math.max(10, params.minTokens)
				: effectiveConfig.minTokens;

			const combinedIgnores = Array.from(new Set([
				...config.ignorePatterns,
				...(effectiveConfig.ignorePatterns || []),
			]));

			try {
				const scanEngine = createEngineFromConfig(effectiveConfig, { minLines, minTokens });
				await scanEngine.initialize(scanPath, combinedIgnores, signal);

				if (signal?.aborted) {
					return {
						content: [{ type: "text", text: "Duplicate detection scan cancelled." }],
						details: null,
					};
				}

				const report = scanEngine.formatReport(scanEngine.discoveredClones, scanPath);

				return {
					content: [
						{
							type: "text",
							text: report,
						},
					],
					details: {
						clones: scanEngine.discoveredClones,
						filesIndexed: scanEngine.indexedCount,
						scanPath,
						configSource: effectiveConfig.configSource ?? null,
					},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					content: [{ type: "text", text: `Duplicate detection failed: ${message}` }],
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
				.map((label) => ({ value: label, label, description: `Option: ${label}` }));
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

			const projectConfig = targetPath !== ctx.cwd ? await findProjectJscpdConfig(targetPath) : null;
			const effectiveConfig = projectConfig ? resolveConfig(activeRawSettings, projectConfig) : config;

			const minLines = cliMinLines ?? effectiveConfig.minLines;
			const minTokens = cliMinTokens ?? effectiveConfig.minTokens;
			const combinedIgnores = Array.from(new Set([
				...config.ignorePatterns,
				...(effectiveConfig.ignorePatterns || []),
			]));

			try {
				const scanEngine = createEngineFromConfig(effectiveConfig, { minLines, minTokens });
				const count = await scanEngine.initialize(targetPath, combinedIgnores);
				const report = scanEngine.formatReport(scanEngine.discoveredClones, targetPath);

				pi.sendMessage(
					{
						customType: "duplicate-detector-report",
						content: report,
						display: true,
						attribution: "user",
						data: {
							filePath: targetPath,
							clones: scanEngine.discoveredClones,
							content: report,
						},
					},
					{ triggerTurn: false },
				);
				ctx.ui.notify(
					`Duplicate scan finished: ${count} files indexed, ${scanEngine.discoveredClones.length} duplicate clusters found.`,
					scanEngine.discoveredClones.length > 0 ? "warning" : "info",
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Duplicate scan failed: ${message}`, "error");
			}
		},
	});

	// Register TTSR-styled message renderers for duplicate alerts and reports
	if (typeof pi.registerMessageRenderer === "function") {
		pi.registerMessageRenderer<DuplicateNotificationData>("duplicate-detector-warning", (message, options, theme) => {
			const data = message.data || {
				content: typeof message.content === "string" ? message.content : undefined,
			};
			return new DuplicateNotificationComponent(data, options?.expanded ?? false, theme as ThemeLike);
		});

		pi.registerMessageRenderer<DuplicateNotificationData>("duplicate-detector-report", (message, options, theme) => {
			const data = message.data || {
				content: typeof message.content === "string" ? message.content : undefined,
			};
			return new DuplicateNotificationComponent(data, options?.expanded ?? false, theme as ThemeLike);
		});
	}
}
