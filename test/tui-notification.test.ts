import { describe, expect, it } from "bun:test";
import {
	DuplicateNotificationComponent,
	DuplicateStatusComponent,
	parseClonesFromText,
} from "../src/tui-notification";

describe("TUI Notification Component (TTSR Style)", () => {
	it("parses clones from system reminder text format", () => {
		const sampleReminder = `<system-reminder reason="code_duplication" file="src/foo.ts">
Warning: Duplicated code detected in 'src/foo.ts'.

### Duplicate #1 (12 lines, format: typescript)
- Current change: \`virtual:src/foo.ts:10-22\` (lines 10 to 22)
- Pre-existing copy: \`src/bar.ts:1-13\` (lines 1 to 13)

\`\`\`typescript
const a = 1;
const b = 2;
const c = 3;
\`\`\`

</system-reminder>`;

		const parsed = parseClonesFromText(sampleReminder);
		expect(parsed.filePath).toBe("src/foo.ts");
		expect(parsed.clones.length).toBe(1);
		expect(parsed.clones[0]?.duplicationA.sourceId).toBe("virtual:src/foo.ts");
		expect(parsed.clones[0]?.duplicationA.start.line).toBe(10);
		expect(parsed.clones[0]?.duplicationA.end.line).toBe(22);
		expect(parsed.clones[0]?.duplicationB.sourceId).toBe("src/bar.ts");
		expect(parsed.clones[0]?.duplicationB.start.line).toBe(1);
		expect(parsed.clones[0]?.duplicationB.end.line).toBe(13);
		expect(parsed.clones[0]?.duplicationA.fragment).toContain("const a = 1;");
	});

	it("renders single clone in collapsed TTSR style", () => {
		const comp = new DuplicateNotificationComponent(
			{
				filePath: "src/sample.ts",
				clones: [
					{
						format: "typescript",
						duplicationA: {
							sourceId: "src/sample.ts",
							start: { line: 1 },
							end: { line: 20 },
							fragment:
								"function test() {\n  console.log('hi');\n  return 42;\n}",
						},
						duplicationB: {
							sourceId: "src/original.ts",
							start: { line: 5 },
							end: { line: 25 },
						},
					},
				],
			},
			false,
		);

		const rendered = comp.render(80);
		expect(rendered.length).toBeGreaterThan(3);
		// Check for leading spacer
		expect(rendered[0]).toBe("");
		// Check that lines contain warning icon and expand hint
		const fullText = rendered.join("\n");
		expect(fullText).toContain("Duplicate detected");
		expect(fullText).toContain("src/sample.ts");
		expect(fullText).toContain("(ctrl+o to expand)");
	});

	it("renders single clone in expanded TTSR style", () => {
		const comp = new DuplicateNotificationComponent(
			{
				filePath: "src/sample.ts",
				clones: [
					{
						format: "typescript",
						duplicationA: {
							sourceId: "src/sample.ts",
							start: { line: 1 },
							end: { line: 20 },
							fragment:
								"function test() {\n  console.log('hi');\n  return 42;\n}",
						},
						duplicationB: {
							sourceId: "src/original.ts",
							start: { line: 5 },
							end: { line: 25 },
						},
					},
				],
			},
			true,
		);

		const rendered = comp.render(80);
		const fullText = rendered.join("\n");
		expect(fullText).toContain("console.log('hi')");
		expect(fullText).toContain("return 42;");
		expect(fullText).not.toContain("(ctrl+o to expand)");
	});
	it("expands raw tab characters into spaces to preserve uniform background painting", () => {
		const comp = new DuplicateNotificationComponent(
			{
				filePath: "src/tabbed.ts",
				clones: [
					{
						format: "typescript",
						duplicationA: {
							sourceId: "src/tabbed.ts",
							start: { line: 1 },
							end: { line: 5 },
							fragment:
								"export interface Foo {\n\ttransactionId: string;\n\tamount: number;\n}",
						},
						duplicationB: {
							sourceId: "src/original.ts",
							start: { line: 1 },
							end: { line: 5 },
						},
					},
				],
			},
			false,
		);

		const rendered = comp.render(80);
		for (const line of rendered) {
			expect(line).not.toContain("\t");
		}
		const fullText = rendered.join("\n");
		expect(fullText).toContain("transactionId: string;");
	});

	it("renders multi-clones properly in bullet format with line ranges", () => {
		const comp = new DuplicateNotificationComponent(
			{
				filePath: "src/multi.ts",
				clones: [
					{
						format: "typescript",
						duplicationA: {
							sourceId: "virtual:src/multi.ts",
							start: { line: 1 },
							end: { line: 10 },
						},
						duplicationB: {
							sourceId: "src/a.ts",
							start: { line: 1 },
							end: { line: 10 },
						},
					},
					{
						format: "typescript",
						duplicationA: {
							sourceId: "virtual:src/multi.ts",
							start: { line: 20 },
							end: { line: 30 },
						},
						duplicationB: {
							sourceId: "src/b.ts",
							start: { line: 1 },
							end: { line: 10 },
						},
					},
				],
			},
			false,
		);

		const rendered = comp.render(80);
		const fullText = rendered.join("\n");
		expect(fullText).toContain("2 duplicate blocks detected");
		expect(fullText).toContain(
			"• src/multi.ts:1-10 ↔ src/a.ts:1-10 (10 lines)",
		);
		expect(fullText).toContain(
			"• src/multi.ts:20-30 ↔ src/b.ts:1-10 (11 lines)",
		);
		expect(fullText).not.toContain("virtual:");
	});

	it("handles partial theme object lacking icon dictionary without throwing", () => {
		const partialTheme = {
			fg: (_color: string, t: string) => t,
			bg: (_color: string, t: string) => t,
			bold: (t: string) => `*${t}*`,
			italic: (t: string) => `_${t}_`,
			inverse: (t: string) => `[inv]${t}[/inv]`,
			icon: undefined as unknown as Record<string, string>,
		};

		const comp = new DuplicateNotificationComponent(
			{
				filePath: "src/sample.ts",
				clones: [
					{
						format: "typescript",
						duplicationA: {
							sourceId: "src/sample.ts",
							start: { line: 1 },
							end: { line: 5 },
						},
						duplicationB: {
							sourceId: "src/other.ts",
							start: { line: 10 },
							end: { line: 15 },
						},
					},
				],
			},
			false,
			partialTheme,
		);

		expect(() => comp.render(80)).not.toThrow();
		const rendered = comp.render(80).join("\n");
		expect(rendered).toContain("Duplicate detected");
	});

	it("renders DuplicateStatusComponent with clean status text", () => {
		const statusComp = new DuplicateStatusComponent({
			status: "complete",
			count: 42,
			content: "Duplicate detector: Ready (42 Git files indexed)",
		});

		const lines = statusComp.render(80);
		expect(lines.length).toBe(1);
		expect(lines[0]).toContain(
			"Duplicate detector: Ready (42 Git files indexed)",
		);
	});

	it("renders DuplicateStatusComponent with warning prefix when capped", () => {
		const statusComp = new DuplicateStatusComponent({
			status: "capped_file_count",
			count: 2500,
			content:
				"Duplicate detector: Ready (2,500 files indexed, capped at 2,500 file limit)",
		});

		const lines = statusComp.render(80);
		expect(lines.length).toBe(1);
		expect(lines[0]).toContain(
			"[!] Duplicate detector: Ready (2,500 files indexed, capped at 2,500 file limit)",
		);
	});
});
