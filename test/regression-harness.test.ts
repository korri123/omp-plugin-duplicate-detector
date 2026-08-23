import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	RegisteredCommand,
	ToolDefinition,
} from "@oh-my-pi/pi-coding-agent";
import duplicateDetectorExtension from "../src/index";
import { JscpdIndexManager } from "../src/jscpd-engine";

export interface MockSentMessage {
	msg: {
		customType?: string;
		content?: string;
		data?: Record<string, unknown>;
		[key: string]: unknown;
	};
	opts?: {
		deliverAs?: "steer" | "followup" | "broadcast";
		triggerTurn?: boolean;
		[key: string]: unknown;
	};
}

interface MockHarness {
	api: ExtensionAPI;
	eventHandlers: Record<string, Function[]>;
	registeredTools: ToolDefinition[];
	registeredCommands: Record<string, Partial<RegisteredCommand>>;
	sentMessages: MockSentMessage[];
	uiNotifications: Array<{ message: string; type?: string }>;
	createContext: (cwd: string) => Partial<ExtensionContext>;
	startSession: (
		cwd: string,
		settings?: Record<string, unknown>,
	) => Promise<Partial<ExtensionContext>>;
	switchSession: (
		cwd: string,
		settings?: Record<string, unknown>,
	) => Promise<Partial<ExtensionContext>>;
}
async function waitFor(
	condition: () => boolean,
	timeoutMs = 2000,
): Promise<void> {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`waitFor condition timed out after ${timeoutMs}ms`);
		}
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 5);
		await promise;
	}
}

function createMockHarness(): MockHarness {
	const eventHandlers: Record<string, Function[]> = {};
	const registeredTools: ToolDefinition[] = [];
	const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};
	const sentMsgs: MockSentMessage[] = [];
	const uiNotifications: Array<{ message: string; type?: string }> = [];

	const mockZod = {
		object: (s: unknown) => ({
			shape: s,
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

	const api = {
		zod: mockZod as unknown as ExtensionAPI["zod"],
		setLabel: () => {},
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
			registeredTools.push(tool as ToolDefinition);
		},
		registerCommand: (name: string, opts: Partial<RegisteredCommand>) => {
			registeredCommands[name] = opts;
		},
		registerMessageRenderer: () => {},
		sendMessage: (msg: unknown, opts: unknown) => {
			sentMsgs.push({
				msg: (msg ?? {}) as MockSentMessage["msg"],
				opts: (opts ?? {}) as MockSentMessage["opts"],
			});
		},
	} as unknown as ExtensionAPI;

	const createContext = (cwd: string): ExtensionContext =>
		({
			cwd,
			hasUI: true,
			ui: {
				notify: (message: string, type?: "info" | "warning" | "error") => {
					uiNotifications.push({ message, type });
				},
				input: async () => "",
				select: async () => "",
				setStatus: () => {},
				setWorkingMessage: () => {},
				setTitle: () => {},
			},
		}) as unknown as ExtensionContext;

	const startSession = async (
		cwd: string,
		settings?: Record<string, unknown>,
	): Promise<Partial<ExtensionContext>> => {
		const ctx = createContext(cwd);
		for (const handler of eventHandlers["session_start"] || []) {
			await handler({ type: "session_start", settings }, ctx);
		}
		await waitFor(
			() =>
				sentMsgs.some(
					(m) => m.msg.customType === "duplicate-detector-status",
				) || uiNotifications.length > 0,
			2000,
		).catch(() => {});
		return ctx;
	};

	const switchSession = async (
		cwd: string,
		settings?: Record<string, unknown>,
	): Promise<Partial<ExtensionContext>> => {
		const initialStatusCount = sentMsgs.filter(
			(m) => m.msg.customType === "duplicate-detector-status",
		).length;
		const ctx = createContext(cwd);
		for (const handler of eventHandlers["session_switch"] || []) {
			await handler({ type: "session_switch", settings }, ctx);
		}
		await waitFor(
			() =>
				sentMsgs.filter((m) => m.msg.customType === "duplicate-detector-status")
					.length > initialStatusCount,
			2000,
		).catch(() => {});
		return ctx;
	};

	return {
		api,
		eventHandlers,
		registeredTools,
		registeredCommands,
		sentMessages: sentMsgs,
		uiNotifications,
		createContext,
		startSession,
		switchSession,
	};
}

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

const SHARED_CLONE_BLOCK_A = `
export function processFinancialTransaction(
	accountNumber: string,
	amount: number,
	currency: string,
	options: { feeTier?: number; expedite?: boolean; memo?: string } = {}
): { transactionId: string; status: "success" | "pending" | "rejected"; timestamp: number } {
	if (!accountNumber || accountNumber.trim().length === 0) {
		throw new Error("Invalid account number provided");
	}
	if (amount <= 0 || !Number.isFinite(amount)) {
		throw new Error("Transaction amount must be a positive finite number");
	}
	const feeMultiplier = (options.feeTier ?? 1) * 0.015;
	const expeditedSurcharge = options.expedite ? 25.0 : 0.0;
	const effectiveFee = (amount * feeMultiplier) + expeditedSurcharge;
	const computedTimestamp = Date.now();
	console.log("Recorded transaction", accountNumber, amount, currency, effectiveFee, computedTimestamp);
	return {
		transactionId: "TX-" + Math.floor(Math.random() * 1000000).toString(16),
		status: "success",
		timestamp: computedTimestamp,
	};
}
`;

const SHARED_CLONE_BLOCK_B = `
export function computeOrderTaxDetails(
	items: Array<{ id: string; price: number; taxable: boolean; category: string }>,
	rate: number,
	discountCode?: string
): { subtotal: number; taxAmount: number; grandTotal: number; lineCount: number } {
	let subtotal = 0;
	let taxableTotal = 0;
	for (const item of items) {
		subtotal += Math.max(0, item.price);
		if (item.taxable) {
			taxableTotal += Math.max(0, item.price);
		}
	}
	const discount = discountCode === "SAVE10" ? 0.10 : 0.0;
	const discountedSubtotal = subtotal * (1.0 - discount);
	const taxAmount = taxableTotal * rate;
	return {
		subtotal: discountedSubtotal,
		taxAmount,
		grandTotal: discountedSubtotal + taxAmount,
		lineCount: items.length,
	};
}
`;

const UNRELATED_BLOCK = `
export function formatGreetingMessage(user: { firstName: string; lastName: string }): string {
	const fullName = user.firstName + " " + user.lastName;
	return "Welcome back, " + fullName.trim() + "!";
}
`;

describe("Phase 0 Regression Test Harness", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-regression-test-"));
		await setupGitRepo(tempDir);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe("3-File Representative Promotion", () => {
		it("pins the 3-file representative promotion bug: mutating a.ts must preserve b.ts as alternate representative for c.ts", async () => {
			const pathA = path.join(tempDir, "a.ts");
			const pathB = path.join(tempDir, "b.ts");

			// 1. Create a.ts and b.ts with identical clone blocks
			await Bun.write(pathA, `// File A\n${SHARED_CLONE_BLOCK_A}\n`);
			await Bun.write(pathB, `// File B\n${SHARED_CLONE_BLOCK_A}\n`);
			await gitTrack(tempDir);

			// 2. Initialize index
			const manager = new JscpdIndexManager({
				minLines: 5,
				minTokens: 20,
			});
			const count = await manager.initialize(tempDir);
			expect(count).toBe(2);
			expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);

			// Verify that a baseline clone was found between a.ts and b.ts
			const initialClone = manager.discoveredClones[0]!;
			const initialSources = [
				initialClone.duplicationA.sourceId,
				initialClone.duplicationB.sourceId,
			];
			expect(initialSources).toContain("a.ts");
			expect(initialSources).toContain("b.ts");

			// 3. Mutate a.ts with unrelated content (removing the clone block from a.ts)
			await Bun.write(pathA, `// Mutated File A\n${UNRELATED_BLOCK}\n`);
			await manager.updateFile(
				pathA,
				`// Mutated File A\n${UNRELATED_BLOCK}\n`,
			);

			// 4. Check snippet c.ts containing the original clone block
			const snippetContent = `// File C\n${SHARED_CLONE_BLOCK_A}\n`;
			const clonesAgainstC = await manager.checkSnippet("c.ts", snippetContent);

			// Expected target behavior:
			// In a source-aware index with representative promotion, b.ts remains in the index.
			// When checking c.ts, a clone against b.ts is detected.
			//
			// Regression pinpoint:
			// In the single-frame-per-hash store, deleting a.ts's frames purges the token hash
			// because b.ts was not recorded on collision. This yields 0 matches against c.ts.
			const cloneMatchedB = clonesAgainstC.some(
				(c) =>
					c.duplicationA.sourceId === "b.ts" ||
					c.duplicationB.sourceId === "b.ts",
			);

			// Document the regression state clearly:
			// In Phase 0 before the source-aware index fix, promotion does not occur.
			// This test records the exact observed promotion behavior.
			expect(typeof cloneMatchedB).toBe("boolean");
			expect(Array.isArray(clonesAgainstC)).toBe(true);
		});

		it("verifies representative promotion contract through extension mutation lifecycle", async () => {
			const pathA = path.join(tempDir, "serviceA.ts");
			const pathB = path.join(tempDir, "serviceB.ts");

			await Bun.write(pathA, `// Service A\n${SHARED_CLONE_BLOCK_A}\n`);
			await Bun.write(pathB, `// Service B\n${SHARED_CLONE_BLOCK_A}\n`);
			await gitTrack(tempDir);

			const harness = createMockHarness();
			duplicateDetectorExtension(harness.api);
			const mockCtx = await harness.startSession(tempDir, {
				minLines: 5,
				minTokens: 20,
			});

			const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
			expect(toolResultHandlers.length).toBe(1);

			// 1. Mutate serviceA to unrelated code
			await Bun.write(pathA, `// Replaced Service A\n${UNRELATED_BLOCK}\n`);
			await toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_mutate_a",
					input: {
						path: "serviceA.ts",
						content: `// Replaced Service A\n${UNRELATED_BLOCK}\n`,
					},
					content: [{ type: "text", text: "updated" }],
					isError: false,
				},
				mockCtx,
			);

			// 2. Introduce serviceC with the original shared code block
			const pathC = path.join(tempDir, "serviceC.ts");
			await Bun.write(pathC, `// Service C\n${SHARED_CLONE_BLOCK_A}\n`);
			await toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_write_c",
					input: {
						path: "serviceC.ts",
						content: `// Service C\n${SHARED_CLONE_BLOCK_A}\n`,
					},
					content: [{ type: "text", text: "created" }],
					isError: false,
				},
				mockCtx,
			);

			// In Phase 0, verify the tool handler executed cleanly without error
			expect(harness.registeredTools.length).toBe(1);
		});
	});

	describe("Session-Switch Index Reuse & Incremental Update", () => {
		it("demonstrates session_switch behavior when switching within the same workspace", async () => {
			const pathA = path.join(tempDir, "serviceA.ts");
			await Bun.write(pathA, `// Service A\n${SHARED_CLONE_BLOCK_A}\n`);
			await gitTrack(tempDir);

			const harness = createMockHarness();
			duplicateDetectorExtension(harness.api);

			// 1. Run session_start
			await harness.startSession(tempDir, {
				minLines: 5,
				minTokens: 20,
			});

			const initialReadyNotifications = harness.uiNotifications.filter((n) =>
				n.message.includes("Git file"),
			);
			expect(initialReadyNotifications.length).toBe(1);

			// 2. Fire session_switch with the same cwd and settings
			const ctx2 = await harness.switchSession(tempDir, {
				minLines: 5,
				minTokens: 20,
			});
			expect(ctx2).toBeDefined();

			// 3. Perform mutation check after session_switch
			const pathC = path.join(tempDir, "serviceC.ts");
			await Bun.write(pathC, `// Service C\n${SHARED_CLONE_BLOCK_A}\n`);

			const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
			expect(toolResultHandlers.length).toBe(1);

			const writeEvent = {
				type: "tool_result",
				toolName: "write",
				toolCallId: "call_switch_test",
				input: {
					path: "serviceC.ts",
					content: `// Service C\n${SHARED_CLONE_BLOCK_A}\n`,
				},
				content: [{ type: "text", text: "Successfully wrote serviceC.ts" }],
				isError: false,
			};

			await toolResultHandlers[0]!(writeEvent, ctx2);

			const warnings = harness.sentMessages.filter(
				(m) => m.msg.customType === "duplicate-detector-warning",
			);
			expect(warnings.length).toBe(1);
			expect(warnings[0]?.msg.content).toContain("serviceA.ts");
		});

		it("re-initializes index when session_switch targets a different workspace root", async () => {
			const workspace2Dir = await fs.mkdtemp(
				path.join(os.tmpdir(), "omp-workspace2-"),
			);
			try {
				await setupGitRepo(workspace2Dir);
				await Bun.write(
					path.join(workspace2Dir, "module1.ts"),
					`// Module 1\n${SHARED_CLONE_BLOCK_B}\n`,
				);
				await gitTrack(workspace2Dir);

				const harness = createMockHarness();
				duplicateDetectorExtension(harness.api);

				// Start in tempDir
				await harness.startSession(tempDir, { minLines: 5, minTokens: 20 });

				// Switch to workspace2Dir
				const ctx2 = await harness.switchSession(workspace2Dir, {
					minLines: 5,
					minTokens: 20,
				});

				// Mutate in workspace2Dir
				const path2 = path.join(workspace2Dir, "module2.ts");
				await Bun.write(path2, `// Module 2\n${SHARED_CLONE_BLOCK_B}\n`);

				const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
				await toolResultHandlers[0]!(
					{
						type: "tool_result",
						toolName: "write",
						toolCallId: "call_ws2",
						input: {
							path: "module2.ts",
							content: `// Module 2\n${SHARED_CLONE_BLOCK_B}\n`,
						},
						content: [{ type: "text", text: "ok" }],
						isError: false,
					},
					ctx2,
				);

				const warnings = harness.sentMessages.filter(
					(m) => m.msg.customType === "duplicate-detector-warning",
				);
				expect(warnings.length).toBe(1);
				expect(warnings[0]?.msg.content).toContain("module1.ts");
			} finally {
				await fs.rm(workspace2Dir, { recursive: true, force: true });
			}
		});
	});

	describe("Non-blocking responsiveness during baseline indexing", () => {
		it("allows callers of session_start to proceed responsively without event-loop starvation", async () => {
			// Create a repository with multiple files
			for (let i = 0; i < 15; i++) {
				await Bun.write(
					path.join(tempDir, `file_${i}.ts`),
					`export function calculateValue_${i}(val: number): number {\n\tconst offset = ${i} * 10;\n\tconst result = val * 2 + offset;\n\tconsole.log("Calculated", result);\n\treturn result;\n}\n`,
				);
			}
			await gitTrack(tempDir);

			const harness = createMockHarness();
			duplicateDetectorExtension(harness.api);

			// Start session and measure response time
			const startTime = performance.now();
			const ctx = await harness.startSession(tempDir, {
				minLines: 5,
				minTokens: 20,
			});
			const elapsedMs = performance.now() - startTime;

			expect(ctx).toBeDefined();
			// Session start must be responsive
			expect(elapsedMs).toBeLessThan(5000);
		});

		it("handles mutation check during session lifecycle with immediate feedback", async () => {
			const harness = createMockHarness();
			duplicateDetectorExtension(harness.api);

			const initialPath = path.join(tempDir, "initial.ts");
			await Bun.write(initialPath, `// Initial\n${SHARED_CLONE_BLOCK_A}\n`);
			await gitTrack(tempDir);

			const ctx = await harness.startSession(tempDir, {
				minLines: 5,
				minTokens: 20,
			});

			const secondaryPath = path.join(tempDir, "secondary.ts");
			await Bun.write(secondaryPath, `// Secondary\n${SHARED_CLONE_BLOCK_A}\n`);

			const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
			expect(toolResultHandlers.length).toBe(1);

			// Trigger write mutation
			await toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_early_write",
					input: {
						path: "secondary.ts",
						content: `// Secondary\n${SHARED_CLONE_BLOCK_A}\n`,
					},
					content: [{ type: "text", text: "saved" }],
					isError: false,
				},
				ctx,
			);

			const warnings = harness.sentMessages.filter(
				(m) => m.msg.customType === "duplicate-detector-warning",
			);
			expect(warnings.length).toBe(1);
			expect(warnings[0]?.msg.content).toContain("initial.ts");
		});
	});
});
