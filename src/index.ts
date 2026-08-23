import * as path from "node:path";
import type { ExtensionAPI, ToolContentItem, ToolResultEventResult } from "@oh-my-pi/pi-coding-agent";
import { DuplicateLedger } from "./duplicate-ledger";
import { JscpdIndexManager } from "./jscpd-engine";

export * from "./duplicate-ledger";
export * from "./jscpd-engine";
export * from "./types";

/**
 * Main extension factory for oh-my-pi duplicate detector plugin powered by jscpd.
 */
export default function duplicateDetectorExtension(pi: ExtensionAPI): void {
	const z = pi.zod;

	pi.setLabel("Duplicate Detector");

	const engine = new JscpdIndexManager({
		minTokens: 40,
		minLines: 5,
	});

	const ledger = new DuplicateLedger();

	// Initialize repository index in background on session start
	pi.on("session_start", async (_event, ctx) => {
		pi.logger.debug("Duplicate detector initializing workspace index", { cwd: ctx.cwd });
		try {
			const count = await engine.initialize(ctx.cwd);
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
				await engine.initialize(ctx.cwd);
			}

			// Check snippet against existing indexed codebase
			const clones = await engine.checkSnippet(fullPath, content);
			const freshClones = ledger.filterFreshClones(relPath, clones);

			// Update engine index with the new file content for subsequent calls
			await engine.updateFile(fullPath, content);

			if (freshClones.length > 0) {
				const reminder = ledger.formatReminder(freshClones, relPath);

				pi.logger.info("Duplicates detected on file mutation", {
					file: relPath,
					count: freshClones.length,
				});

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

			const scanEngine = new JscpdIndexManager({
				minLines: params.minLines ?? 5,
				minTokens: params.minTokens ?? 40,
			});

			const filesIndexed = await scanEngine.initialize(scanPath);

			return {
				content: [
					{
						type: "text",
						text: `Scanned ${filesIndexed} files in ${path.relative(ctx.cwd, scanPath) || "."}. Jscpd duplicate index ready.`,
					},
				],
				details: {
					filesIndexed,
					scanPath,
				},
			};
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

			let minLines = 5;
			let minTokens = 40;
			let targetPath = ctx.cwd;

			const parts = args.trim().split(/\s+/).filter(Boolean);
			for (const part of parts) {
				if (part.startsWith("--min-lines=")) {
					const val = Number.parseInt(part.slice("--min-lines=".length), 10);
					if (!Number.isNaN(val)) minLines = val;
				} else if (part.startsWith("--min-tokens=")) {
					const val = Number.parseInt(part.slice("--min-tokens=".length), 10);
					if (!Number.isNaN(val)) minTokens = val;
				} else if (part.startsWith("--path=")) {
					targetPath = path.resolve(ctx.cwd, part.slice("--path=".length));
				} else if (!part.startsWith("-")) {
					targetPath = path.resolve(ctx.cwd, part);
				}
			}

			try {
				const scanEngine = new JscpdIndexManager({ minLines, minTokens });
				const count = await scanEngine.initialize(targetPath);

				ctx.ui.notify(
					`Duplicate scan finished: ${count} files indexed in ${path.relative(ctx.cwd, targetPath) || "."}.`,
					"info",
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Duplicate scan failed: ${message}`, "error");
			}
		},
	});
}
