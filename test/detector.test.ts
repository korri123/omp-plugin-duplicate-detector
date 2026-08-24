import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExtensionAPI,
	RegisteredCommand,
	ToolDefinition,
} from "@oh-my-pi/pi-coding-agent";
import duplicateDetectorExtension from "../src/index";
import { JscpdIndexManager } from "../src/jscpd-engine";

async function setupGitRepo(dir: string): Promise<void> {
	const init = Bun.spawn(["git", "init", "-b", "main"], { cwd: dir });
	await init.exited;
	const name = Bun.spawn(["git", "config", "user.name", "Test User"], {
		cwd: dir,
	});
	await name.exited;
	const email = Bun.spawn(["git", "config", "user.email", "test@example.com"], {
		cwd: dir,
	});
	await email.exited;
}

async function gitTrack(dir: string, files: string[] = ["."]): Promise<void> {
	const add = Bun.spawn(["git", "add", ...files], { cwd: dir });
	await add.exited;
}

describe("duplicate detector", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-dup-test-"));
		await setupGitRepo(tempDir);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("detects exact duplicated code blocks across two files", async () => {
		const sharedCode = `
export function calculateTax(amount: number): number {
	const vatRate = 0.20;
	const surcharge = amount > 1000 ? 50 : 0;
	const baseTax = amount * vatRate;
	console.log("Calculated tax for", amount, baseTax + surcharge);
	return baseTax + surcharge;
}
`;

		const fileA = path.join(tempDir, "fileA.ts");
		const fileB = path.join(tempDir, "fileB.ts");

		await Bun.write(
			fileA,
			`// File A header\nimport { foo } from "./foo";\n${sharedCode}\nconsole.log("done A");\n`,
		);
		await Bun.write(
			fileB,
			`// File B header\nimport { bar } from "./bar";\n${sharedCode}\nconsole.log("done B");\n`,
		);
		await gitTrack(tempDir);

		const manager = new JscpdIndexManager({
			minLines: 5,
			minTokens: 20,
		});

		const count = await manager.initialize(tempDir);
		expect(count).toBe(2);
		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);

		const clone = manager.discoveredClones[0]!;
		expect(clone.duplicationA.sourceId).toContain("file");
		expect(clone.duplicationB.sourceId).toContain("file");
		expect(clone.format).toBe("typescript");
	});

	it("returns empty matches when no duplicate exceeds the line threshold", async () => {
		const fileA = path.join(tempDir, "alpha.ts");
		const fileB = path.join(tempDir, "beta.ts");

		await Bun.write(
			fileA,
			"export const x = 1;\nexport const y = 2;\nexport const z = 3;\n",
		);
		await Bun.write(
			fileB,
			"export const a = 'different';\nexport const b = 'code';\nexport const c = 'here';\n",
		);
		await gitTrack(tempDir);

		const manager = new JscpdIndexManager({
			minLines: 5,
			minTokens: 20,
		});

		const count = await manager.initialize(tempDir);
		expect(count).toBe(2);
		expect(manager.discoveredClones.length).toBe(0);
	});

	it("registers tool and slash command with ExtensionAPI mock", () => {
		const registeredTools: ToolDefinition[] = [];
		const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};
		const registeredRenderers: Record<string, unknown> = {};

		const mockZod = {
			object: (shape: unknown) => ({
				shape,
				parse: (v: unknown) => v,
				safeParse: (v: unknown) => ({ success: true, data: v }),
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

		const mockPi: ExtensionAPI = {
			zod: mockZod as unknown as ExtensionAPI["zod"],
			setLabel: () => {},
			logger: {
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
			} as unknown as ExtensionAPI["logger"],
			on: () => {},
			registerTool: (tool: ToolDefinition) => {
				registeredTools.push(tool);
			},
			registerCommand: (name: string, opts: Partial<RegisteredCommand>) => {
				registeredCommands[name] = opts;
			},
			registerMessageRenderer: (type: string, renderer: unknown) => {
				registeredRenderers[type] = renderer;
			},
			sendMessage: () => {},
		} as unknown as ExtensionAPI;

		duplicateDetectorExtension(mockPi);

		expect(registeredTools.length).toBe(0);
		expect(registeredCommands["duplicates"]).toBeDefined();
		expect(registeredRenderers["duplicate-detector-warning"]).toBeDefined();
		expect(registeredRenderers["duplicate-detector-report"]).toBeDefined();
	});
});
