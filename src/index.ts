import * as path from "node:path";
import type { ExtensionAPI, ToolContentItem, ToolResultEventResult } from "@oh-my-pi/pi-coding-agent";
import { DuplicateLedger } from "./duplicate-ledger";
import { JscpdIndexManager } from "./jscpd-engine";
import { DuplicateNotificationComponent, type DuplicateNotificationData, type ThemeLike } from "./tui-notification";

export * from "./duplicate-ledger";
export * from "./jscpd-engine";
export * from "./tui-notification";
export * from "./types";

export interface DuplicateDetectorConfig {
	minLines: number;
	minTokens: number;
	checkOnMutation: boolean;
	reminderMode: "in-band" | "steer" | "none";
	ignorePatterns: string[];
}

const DEFAULT_CONFIG: DuplicateDetectorConfig = {
	minLines: 5,
	minTokens: 40,
	checkOnMutation: true,
	reminderMode: "steer",
	ignorePatterns: [],
};

/**
 * Resolves user settings from configuration context with fallback to defaults.
 */
export function resolveConfig(rawSettings?: Record<string, unknown>): DuplicateDetectorConfig {
	if (!rawSettings) return { ...DEFAULT_CONFIG };

	const minLines = typeof rawSettings.minLines === "number" ? Math.max(3, rawSettings.minLines) : DEFAULT_CONFIG.minLines;
	const minTokens = typeof rawSettings.minTokens === "number" ? Math.max(10, rawSettings.minTokens) : DEFAULT_CONFIG.minTokens;
	const checkOnMutation = typeof rawSettings.checkOnMutation === "boolean" ? rawSettings.checkOnMutation : DEFAULT_CONFIG.checkOnMutation;

	const reminderMode = rawSettings.reminderMode === "steer" || rawSettings.reminderMode === "none" || rawSettings.reminderMode === "in-band"
		? rawSettings.reminderMode
		: DEFAULT_CONFIG.reminderMode;

	let ignorePatterns: string[] = [];
	if (typeof rawSettings.ignorePatterns === "string") {
		ignorePatterns = rawSettings.ignorePatterns
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	} else if (Array.isArray(rawSettings.ignorePatterns)) {
		ignorePatterns = rawSettings.ignorePatterns.map(String);
	}

	return {
		minLines,
		minTokens,
		checkOnMutation,
		reminderMode,
		ignorePatterns,
	};
}

/**
 * Main extension factory for oh-my-pi duplicate detector plugin powered by jscpd.
 */
export default function duplicateDetectorExtension(pi: ExtensionAPI): void {
	const z = pi.zod;

	pi.setLabel("Duplicate Detector");

	let config: DuplicateDetectorConfig = { ...DEFAULT_CONFIG };

	let engine = new JscpdIndexManager({
		minTokens: config.minTokens,
		minLines: config.minLines,
	});

	const ledger = new DuplicateLedger();

	// Session lifecycle: reset on switch and branch
	pi.on("session_switch", async (_event, ctx) => {
		ledger.clear();
		engine.reset();

		let settingsObj: Record<string, unknown> | undefined;
		if (_event && typeof _event === "object" && "settings" in _event && _event.settings && typeof _event.settings === "object") {
			settingsObj = _event.settings as Record<string, unknown>;
		} else if (ctx && typeof ctx === "object" && "settings" in ctx && ctx.settings && typeof ctx.settings === "object") {
			settingsObj = ctx.settings as Record<string, unknown>;
		}
		if (settingsObj) {
			config = resolveConfig(settingsObj);
		}

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
	pi.on("session_start", async (_event, ctx) => {
		pi.logger.debug("Duplicate detector initializing workspace index", { cwd: ctx.cwd });

		let settingsObj: Record<string, unknown> | undefined;
		if (_event && typeof _event === "object" && "settings" in _event && _event.settings && typeof _event.settings === "object") {
			settingsObj = _event.settings as Record<string, unknown>;
		} else if (ctx && typeof ctx === "object" && "settings" in ctx && ctx.settings && typeof ctx.settings === "object") {
			settingsObj = ctx.settings as Record<string, unknown>;
		}
		config = resolveConfig(settingsObj);
		engine = new JscpdIndexManager({
			minTokens: config.minTokens,
			minLines: config.minLines,
		});

		try {
			const count = await engine.initialize(ctx.cwd, config.ignorePatterns);
			pi.logger.info("Duplicate detector index ready", { filesIndexed: count });
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

		try {
			const file = Bun.file(fullPath);
			if (!(await file.exists())) return;

			const content = await file.text();

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

			const minLines = typeof params.minLines === "number" ? Math.max(3, params.minLines) : config.minLines;
			const minTokens = typeof params.minTokens === "number" ? Math.max(10, params.minTokens) : config.minTokens;

			try {
				const scanEngine = new JscpdIndexManager({
					minLines,
					minTokens,
				});

				await scanEngine.initialize(scanPath, config.ignorePatterns, signal);

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

			let minLines = config.minLines;
			let minTokens = config.minTokens;
			let targetPath = ctx.cwd;

			const parts = args.trim().split(/\s+/).filter(Boolean);
			for (const part of parts) {
				if (part.startsWith("--min-lines=")) {
					const val = Number.parseInt(part.slice("--min-lines=".length), 10);
					if (!Number.isNaN(val)) minLines = Math.max(3, val);
				} else if (part.startsWith("--min-tokens=")) {
					const val = Number.parseInt(part.slice("--min-tokens=".length), 10);
					if (!Number.isNaN(val)) minTokens = Math.max(10, val);
				} else if (part.startsWith("--path=")) {
					targetPath = path.resolve(ctx.cwd, part.slice("--path=".length));
				} else if (!part.startsWith("-")) {
					targetPath = path.resolve(ctx.cwd, part);
				}
			}

			try {
				const scanEngine = new JscpdIndexManager({ minLines, minTokens });
				const count = await scanEngine.initialize(targetPath, config.ignorePatterns);
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
