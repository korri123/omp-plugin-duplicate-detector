import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { detectDuplicates } from "./detector";
import type { DuplicateDetectionOptions, DuplicateDetectionResult } from "./types";

export * from "./detector";
export * from "./types";

/**
 * Main extension factory for oh-my-pi duplicate detector plugin.
 */
export default function duplicateDetectorExtension(pi: ExtensionAPI): void {
	const z = pi.zod;

	pi.setLabel("Duplicate Detector");

	// Notify on session start
	pi.on("session_start", async (_event, ctx) => {
		pi.logger.debug("Duplicate detector extension initialized", { cwd: ctx.cwd });
	});

	// Register LLM-callable tool
	pi.registerTool({
		name: "detect_duplicates",
		label: "Detect Duplicates",
		description:
			"Scan the codebase or a target directory for duplicate code blocks, copy-pasted logic, and structural code clones.",
		parameters: z.object({
			path: z
				.string()
				.optional()
				.describe("Root directory or path to scan (defaults to project workspace root)"),
			minLines: z
				.number()
				.optional()
				.describe("Minimum number of consecutive matching lines to report (default: 6, min: 3)"),
			minTokens: z
				.number()
				.optional()
				.describe("Minimum token count threshold for a clone block (default: 30, min: 10)"),
			normalizeIdentifiers: z
				.boolean()
				.optional()
				.describe(
					"Normalize literals and variable identifiers to detect Type-2/Type-3 parameterized clones (default: false)",
				),
		}),
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Duplicate detection scan cancelled." }],
					details: null,
				};
			}

			onUpdate?.({
				content: [{ type: "text", text: "Scanning codebase for duplicate code blocks..." }],
			});

			const scanPath = params.path ? (params.path.startsWith("/") ? params.path : `${ctx.cwd}/${params.path}`) : ctx.cwd;

			const result = await detectDuplicates({
				rootPath: scanPath,
				minLines: params.minLines,
				minTokens: params.minTokens,
				normalizeIdentifiers: params.normalizeIdentifiers,
			});

			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	});

	// Register /duplicates slash command
	pi.registerCommand("duplicates", {
		description: "Scan workspace for duplicate and clone code blocks",
		getArgumentCompletions: (prefix) => {
			const options = ["--min-lines=6", "--min-tokens=30", "--normalize", "--path="];
			return options
				.filter((opt) => opt.startsWith(prefix))
				.map((label) => ({ value: label, label, description: `Option: ${label}` }));
		},
		handler: async (args, ctx) => {
			ctx.ui.notify("Scanning workspace for duplicate code...", "info");

			let minLines: number | undefined;
			let minTokens: number | undefined;
			let normalizeIdentifiers = false;
			let targetPath = ctx.cwd;

			const parts = args.trim().split(/\s+/).filter(Boolean);
			for (const part of parts) {
				if (part.startsWith("--min-lines=")) {
					const val = Number.parseInt(part.slice("--min-lines=".length), 10);
					if (!Number.isNaN(val)) minLines = val;
				} else if (part.startsWith("--min-tokens=")) {
					const val = Number.parseInt(part.slice("--min-tokens=".length), 10);
					if (!Number.isNaN(val)) minTokens = val;
				} else if (part === "--normalize") {
					normalizeIdentifiers = true;
				} else if (part.startsWith("--path=")) {
					targetPath = part.slice("--path=".length);
				} else if (!part.startsWith("-")) {
					targetPath = part;
				}
			}

			try {
				const result = await detectDuplicates({
					rootPath: targetPath,
					minLines,
					minTokens,
					normalizeIdentifiers,
				});

				pi.sendMessage(
					{
						customType: "duplicate-detector-report",
						content: result.summary,
						display: true,
						attribution: "user",
					},
					{ triggerTurn: false },
				);

				ctx.ui.notify(
					`Duplicate scan finished: ${result.matches.length} clone clusters found (${result.duplicationPercentage}% duplication).`,
					result.matches.length > 0 ? "warning" : "info",
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Duplicate scan failed: ${message}`, "error");
			}
		},
	});
}
