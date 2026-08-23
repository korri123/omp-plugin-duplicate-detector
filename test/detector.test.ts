import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { detectDuplicates } from "../src/detector";
import duplicateDetectorExtension from "../src/index";
import type { ExtensionAPI, ToolDefinition, RegisteredCommand } from "@oh-my-pi/pi-coding-agent";

describe("duplicate detector", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-dup-test-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("detects exact duplicated code blocks across two files", async () => {
		const sharedCode = `
export function calculateMetrics(data: number[]): { sum: number; avg: number } {
	let sum = 0;
	for (const n of data) {
		sum += n;
	}
	const avg = data.length > 0 ? sum / data.length : 0;
	return { sum, avg };
}
`;

		const fileA = path.join(tempDir, "fileA.ts");
		const fileB = path.join(tempDir, "fileB.ts");

		await Bun.write(fileA, `// File A header\nimport { foo } from "./foo";\n${sharedCode}\nconsole.log("done A");\n`);
		await Bun.write(fileB, `// File B header\nimport { bar } from "./bar";\n${sharedCode}\nconsole.log("done B");\n`);

		const result = await detectDuplicates({
			rootPath: tempDir,
			minLines: 5,
			minTokens: 20,
		});

		expect(result.matches.length).toBeGreaterThanOrEqual(1);
		const match = result.matches[0]!;
		expect(match.instances.length).toBe(2);
		expect(match.instances.some((inst) => inst.filePath.includes("fileA.ts"))).toBe(true);
		expect(match.instances.some((inst) => inst.filePath.includes("fileB.ts"))).toBe(true);
		expect(result.totalDuplicatedLines).toBeGreaterThanOrEqual(5);
	});

	it("returns empty matches when no duplicate exceeds the line threshold", async () => {
		const fileA = path.join(tempDir, "alpha.ts");
		const fileB = path.join(tempDir, "beta.ts");

		await Bun.write(fileA, `export const a = 1;\nexport const b = 2;\n`);
		await Bun.write(fileB, `export const x = 10;\nexport const y = 20;\n`);

		const result = await detectDuplicates({
			rootPath: tempDir,
			minLines: 4,
			minTokens: 20,
		});

		expect(result.matches.length).toBe(0);
		expect(result.totalDuplicatedLines).toBe(0);
	});

	it("registers tool and slash command with ExtensionAPI mock", () => {
		const registeredTools: unknown[] = [];
		const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};
		const registeredMessageRenderers: Record<string, Function> = {};
		const eventHandlers: Record<string, Function[]> = {};
		let label = "";

		const mockZod = {
			object: (schema: Record<string, unknown>) => ({
				_schema: schema,
				safeParse: () => ({ success: true }),
			}),
			string: () => ({
				optional: () => ({ describe: () => ({}) }),
				describe: () => ({}),
			}),
			number: () => ({
				optional: () => ({ describe: () => ({}) }),
				describe: () => ({}),
			}),
			boolean: () => ({
				optional: () => ({ describe: () => ({}) }),
				describe: () => ({}),
			}),
		};

		const mockPi = {
			zod: mockZod as unknown as ExtensionAPI["zod"],
			setLabel: (l: string) => {
				label = l;
			},
			logger: {
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
			} as unknown as ExtensionAPI["logger"],
			on: (event: string, handler: unknown) => {
				eventHandlers[event] = eventHandlers[event] || [];
				eventHandlers[event].push(handler as Function);
			},
			registerTool: (tool: unknown) => {
				registeredTools.push(tool);
			},
			registerCommand: (name: string, opts: Partial<RegisteredCommand>) => {
				registeredCommands[name] = opts;
			},
			registerMessageRenderer: (type: string, renderer: Function) => {
				registeredMessageRenderers[type] = renderer;
			},
		} as unknown as ExtensionAPI;

		duplicateDetectorExtension(mockPi);

		expect(label).toBe("Duplicate Detector");
		expect(registeredTools.length).toBe(1);
		const tool = registeredTools[0] as ToolDefinition;
		expect(tool.name).toBe("detect_duplicates");
		expect(registeredCommands["duplicates"]).toBeDefined();
		expect(registeredMessageRenderers["duplicate-detector-warning"]).toBeDefined();
		expect(registeredMessageRenderers["duplicate-detector-report"]).toBeDefined();
		expect(eventHandlers["session_start"]).toBeDefined();
	});
});
