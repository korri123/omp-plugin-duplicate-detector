import { describe, expect, it } from "bun:test";
import type { IClone } from "@jscpd/core";
import type {
	ExtensionAPI,
	RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { DuplicateLedger } from "../src/duplicate-ledger";
import duplicateDetectorExtension from "../src/index";
import { formatReport } from "../src/jscpd-engine";
import {
	DuplicateNotificationComponent,
	parseClonesFromText,
} from "../src/tui-notification";

function createMockClone(
	index: number,
	linesCount = 10,
	fragment = "console.log('duplicate line');",
): IClone {
	return {
		format: "typescript",
		duplicationA: {
			sourceId: `src/fileA_${index}.ts`,
			start: { line: 10, column: 1 },
			end: { line: 10 + linesCount - 1, column: 20 },
			fragment,
		},
		duplicationB: {
			sourceId: `src/fileB_${index}.ts`,
			start: { line: 100, column: 1 },
			end: { line: 100 + linesCount - 1, column: 20 },
			fragment,
		},
	} as IClone;
}

describe("Artifact & Truncation System", () => {
	describe("formatReport truncation and artifact links", () => {
		it("formats full report when clone count is below maxClones", () => {
			const clones = [createMockClone(1), createMockClone(2)];
			const report = formatReport(clones, "src/", {
				maxClones: 10,
			});

			expect(report).toContain("# Duplicate Code Report");
			expect(report).toContain("- **Duplicate Clusters Found**: 2");
			expect(report).toContain("### Clone #1");
			expect(report).toContain("### Clone #2");
			expect(report).not.toContain("omitted from inline context");
			expect(report).not.toContain("[raw output: artifact://");
		});

		it("caps output at maxClones and appends omission notice and artifact footer", () => {
			const clones: IClone[] = [];
			for (let i = 1; i <= 25; i++) {
				clones.push(createMockClone(i));
			}

			const report = formatReport(clones, "src/", {
				maxClones: 5,
				artifactId: "42",
			});
			expect(report).toContain("- **Duplicate Clusters Found**: 25");
			expect(report).toContain("### Clone #1");
			expect(report).toContain("### Clone #5");
			expect(report).not.toContain("### Clone #6");
			expect(report).toContain(
				"*Showing top 5 of 25 duplicate clusters (20 additional clusters omitted from inline context).*",
			);
			expect(report).toContain(
				"*Read `artifact://42` for the complete report with all 25 duplicate clusters.*",
			);
			expect(report).toContain("[raw output: artifact://42]");
		});

		it("caps by maxBytes when snippets exceed byte limits", () => {
			const longFragment = "x".repeat(2000);
			const clones: IClone[] = [];
			for (let i = 1; i <= 10; i++) {
				clones.push(createMockClone(i, 50, longFragment));
			}

			const report = formatReport(clones, "src/", {
				maxBytes: 3000,
				artifactId: "99",
			});
			expect(report).toContain("- **Duplicate Clusters Found**: 10");
			expect(report).toContain("[raw output: artifact://99]");
			expect(report).toContain("omitted from inline context");
		});
	});

	describe("DuplicateLedger.formatReminder capping", () => {
		it("caps duplicate blocks in system reminder when clone count is high", () => {
			const ledger = new DuplicateLedger();
			const clones: IClone[] = [];
			for (let i = 1; i <= 15; i++) {
				clones.push(createMockClone(i));
			}

			const reminder = ledger.formatReminder(
				clones,
				"src/large.ts",
				undefined,
				undefined,
				{
					maxClones: 3,
				},
			);

			expect(reminder).toContain("### Duplicate #3");
			expect(reminder).not.toContain("### Duplicate #4");
			expect(reminder).toContain(
				"*... and 12 more duplicate blocks in this file.*",
			);
		});

		it("caps long snippet lines and includes artifact footer when provided", () => {
			const ledger = new DuplicateLedger();
			const longSnippet = Array.from(
				{ length: 30 },
				(_, i) => `line_${i + 1}();`,
			).join("\n");
			const clone = createMockClone(1, 30, longSnippet);

			const reminder = ledger.formatReminder(
				[clone],
				"src/long.ts",
				undefined,
				undefined,
				{
					maxSnippetLines: 5,
					artifactId: "55",
				},
			);

			expect(reminder).toContain("line_1();");
			expect(reminder).toContain("line_5();");
			expect(reminder).not.toContain("line_6();");
			expect(reminder).toContain("// ... +25 more duplicate lines");
			expect(reminder).toContain(
				"Read `artifact://55` for complete duplicate report",
			);
			expect(reminder).toContain("[raw output: artifact://55]");
		});
	});

	describe("TUI Notification Component artifact rendering", () => {
		it("extracts artifactId from text in parseClonesFromText", () => {
			const textWithArtifact = `# Duplicate Code Report\n\n- Duplicate Clusters Found: 50\n\n[raw output: artifact://77]\n`;
			const parsed = parseClonesFromText(textWithArtifact);
			expect(parsed.artifactId).toBe("77");
		});

		it("renders artifact reference in notification component", () => {
			const clones = [
				createMockClone(1),
				createMockClone(2),
				createMockClone(3),
				createMockClone(4),
				createMockClone(5),
				createMockClone(6),
			];
			const comp = new DuplicateNotificationComponent(
				{
					filePath: "src/sample.ts",
					clones,
					artifactId: "123",
				},
				false,
			);

			const renderedCollapsed = comp.render(80).join("\n");
			expect(renderedCollapsed).toContain("artifact://123");

			comp.setExpanded(true);
			const renderedExpanded = comp.render(80).join("\n");
			expect(renderedExpanded).toContain("Full report: artifact://123");
		});
	});

	describe("Extension integration with artifact saving", () => {
		it("registers duplicates command and provides on/off argument completions", () => {
			const registeredCommands: Record<string, RegisteredCommand> = {};

			const mockPi = {
				logger: {
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				},
				setLabel: () => {},
				registerTool: () => {},
				registerCommand: (name: string, def: RegisteredCommand) => {
					registeredCommands[name] = def;
				},
				sendMessage: () => {},
				on: () => {},
			} as unknown as ExtensionAPI;
			duplicateDetectorExtension(mockPi);

			const cmd = registeredCommands["duplicates"];
			expect(cmd).toBeDefined();
			expect(cmd.description).toContain("Toggle duplicate detector");
			const completions = cmd.getArgumentCompletions?.("o") ?? [];
			expect(completions.some((c) => c.value === "on")).toBe(true);
			expect(completions.some((c) => c.value === "off")).toBe(true);
		});
		it("registers tool_result event handler for mutation checking", () => {
			const eventHandlers: Record<
				string,
				(event: unknown, ctx: unknown) => void
			> = {};

			const mockPi = {
				logger: {
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				},
				setLabel: () => {},
				registerTool: () => {},
				registerCommand: () => {},
				sendMessage: () => {},
				on: (
					event: string,
					handler: (event: unknown, ctx: unknown) => void,
				) => {
					eventHandlers[event] = handler;
				},
			} as unknown as ExtensionAPI;

			duplicateDetectorExtension(mockPi);

			const toolResultHandler = eventHandlers["tool_result"];
			expect(toolResultHandler).toBeDefined();
		});
	});
});
