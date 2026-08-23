import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import duplicateDetectorExtension from "../src/index";
import type { ExtensionAPI, ExtensionContext, ToolDefinition, RegisteredCommand, ToolResultEventResult, ToolTextContent } from "@oh-my-pi/pi-coding-agent";

interface MockHarness {
	api: ExtensionAPI;
	eventHandlers: Record<string, Function[]>;
	registeredTools: ToolDefinition[];
	registeredCommands: Record<string, Partial<RegisteredCommand>>;
	sentMessages: Array<{ msg: unknown; opts: unknown }>;
	createContext: (cwd: string) => Partial<ExtensionContext>;
	startSession: (cwd: string, settings?: Record<string, unknown>) => Promise<Partial<ExtensionContext>>;
}

function createMockHarness(): MockHarness {
	const eventHandlers: Record<string, Function[]> = {};
	const registeredTools: ToolDefinition[] = [];
	const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};
	const sentMsgs: Array<{ msg: unknown; opts: unknown }> = [];

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
			sentMsgs.push({ msg, opts });
		},
	} as unknown as ExtensionAPI;

	const createContext = (cwd: string): Partial<ExtensionContext> => ({
		cwd,
		hasUI: true,
		ui: {
			notify: () => {},
			confirm: async () => true,
			input: async () => "",
			select: async () => "",
			setStatus: () => {},
			setWorkingMessage: () => {},
			setTitle: () => {},
		},
	});

	const startSession = async (cwd: string, settings?: Record<string, unknown>): Promise<Partial<ExtensionContext>> => {
		const ctx = createContext(cwd);
		for (const handler of eventHandlers["session_start"] || []) {
			await handler({ type: "session_start", settings }, ctx);
		}
		return ctx;
	};

	return {
		api,
		eventHandlers,
		registeredTools,
		registeredCommands,
		sentMessages: sentMsgs,
		createContext,
		startSession,
	};
}

describe("duplicateDetectorExtension integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-ext-integration-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("intercepts write tool_result and sends live steer custom message by default", async () => {
		const existingCode = `
export function validateTransactionPayload(tx: { id: string; amount: number; sender: string; recipient: string }): boolean {
	if (!tx.id || typeof tx.id !== "string") return false;
	if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
	if (!tx.sender || typeof tx.sender !== "string") return false;
	if (!tx.recipient || typeof tx.recipient !== "string") return false;
	return true;
}
`;
		await Bun.write(path.join(tempDir, "transaction-validator.ts"), existingCode);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);

		// Write new duplicate file
		await Bun.write(path.join(tempDir, "order-validator.ts"), existingCode);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		expect(toolResultHandlers.length).toBe(1);

		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_123",
			input: { path: "order-validator.ts", content: existingCode },
			content: [{ type: "text", text: "Successfully wrote order-validator.ts" }],
			isError: false,
		};

		const result = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as ToolResultEventResult | undefined;
		expect(result).toBeUndefined();

		// Check steer message
		expect(harness.sentMessages.length).toBe(1);
		const sent = harness.sentMessages[0]!;
		const sentOpts = sent.opts as { deliverAs?: string };
		const sentMsg = sent.msg as { customType?: string };
		expect(sentOpts.deliverAs).toBe("steer");
		expect(sentMsg.customType).toBe("duplicate-detector-warning");

		// Deduplication check
		const secondResult = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as ToolResultEventResult | undefined;
		expect(secondResult).toBeUndefined();

		// Detect tool execute
		expect(harness.registeredTools.length).toBe(1);
		const detectTool = harness.registeredTools[0]!;
		const toolOutcome = await detectTool.execute("call_tool_1", {}, undefined, undefined, mockCtx as ExtensionContext);

		expect(toolOutcome.content.length).toBe(1);
		const firstToolItem = toolOutcome.content[0] as ToolTextContent;
		expect(firstToolItem.type).toBe("text");
		expect(firstToolItem.text).toContain("# Duplicate Code Report");
		expect(firstToolItem.text).toContain("order-validator.ts");
		expect(firstToolItem.text).toContain("transaction-validator.ts");
	});

	it("injects system reminder into tool_result in in-band mode", async () => {
		const existingCode = `
export function computeInvoiceTaxes(items: Array<{ price: number; taxRate: number; exempt?: boolean; category?: string }>): number {
	let totalTax = 0;
	for (const item of items) {
		if (item.exempt) continue;
		const basePrice = Math.max(0, item.price);
		const tax = basePrice * item.taxRate;
		totalTax += tax;
	}
	return totalTax;
}
`;
		await Bun.write(path.join(tempDir, "invoice-taxes.ts"), existingCode);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir, { reminderMode: "in-band", minTokens: 20 });

		await Bun.write(path.join(tempDir, "receipt-taxes.ts"), existingCode);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_test_steer",
			input: { path: "receipt-taxes.ts", content: existingCode },
			content: [{ type: "text", text: "File written successfully" }],
		};

		const result = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as ToolResultEventResult | undefined;
		expect(result).toBeDefined();
		expect(result?.content?.length).toBe(2);

		const textItem = result?.content?.[0] as ToolTextContent;
		expect(textItem.text).toContain('<system-reminder reason="code_duplication" file="receipt-taxes.ts">');
		expect(textItem.text).toContain("invoice-taxes.ts");
		expect(textItem.text).toContain("computeInvoiceTaxes");
		expect(harness.sentMessages.length).toBe(0);
	});

	it("loads and applies .jscpd.json project configuration on session_start", async () => {
		const jscpdConfig = {
			"min-lines": 5,
			"min-tokens": 25,
			ignore: ["legacy/**"],
			formatsExts: {
				typescript: ["customts"],
			},
		};
		await Bun.write(path.join(tempDir, ".jscpd.json"), JSON.stringify(jscpdConfig, null, 2));

		const code = `
export function processCustomOrder(order: { id: string; amount: number; user: string; active: boolean }): boolean {
	if (!order.id || typeof order.id !== "string") return false;
	if (typeof order.amount !== "number" || order.amount <= 0) return false;
	if (!order.user || typeof order.user !== "string") return false;
	console.log("Processing order for user", order.user, order.amount);
	return true;
}
`;

		// File in ignored folder
		const legacyDir = path.join(tempDir, "legacy");
		await fs.mkdir(legacyDir, { recursive: true });
		await Bun.write(path.join(legacyDir, "old-order.customts"), code);

		// Main active file with custom extension
		await Bun.write(path.join(tempDir, "order-a.customts"), code);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);

		await Bun.write(path.join(tempDir, "order-b.customts"), code);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_custom_ext",
			input: { path: "order-b.customts", content: code },
			content: [{ type: "text", text: "Successfully wrote order-b.customts" }],
			isError: false,
		};

		await toolResultHandlers[0]!(toolResultEvent, mockCtx);

		expect(harness.sentMessages.length).toBe(1);
		const message = harness.sentMessages[0]!.msg as { content?: string };
		expect(message.content).toContain("order-b.customts");
		expect(message.content).toContain("order-a.customts");
		expect(message.content).not.toContain("old-order.customts");
	});

	it("skips checking ignored and generated files on tool_result mutation", async () => {
		const jscpdConfig = {
			minLines: 4,
			minTokens: 20,
			ignore: ["ignored-folder/**"],
		};
		await Bun.write(path.join(tempDir, ".jscpd.json"), JSON.stringify(jscpdConfig));

		const code = `
export function computeMetrics(data: number[]): { sum: number; avg: number } {
	const sum = data.reduce((a, b) => a + b, 0);
	const avg = data.length > 0 ? sum / data.length : 0;
	return { sum, avg };
}
`;
		await Bun.write(path.join(tempDir, "source-a.ts"), code);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];

		// 1. Mutate a file in ignored folder: should be skipped
		const ignoredDir = path.join(tempDir, "ignored-folder");
		await fs.mkdir(ignoredDir, { recursive: true });
		await Bun.write(path.join(ignoredDir, "copy.ts"), code);

		await toolResultHandlers[0]!({
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_ignored",
			input: { path: "ignored-folder/copy.ts", content: code },
			content: [{ type: "text", text: "ok" }],
			isError: false,
		}, mockCtx);

		expect(harness.sentMessages.length).toBe(0);

		// 2. Mutate a generated file: should be skipped
		const genCode = `// @generated DO NOT EDIT\n${code}`;
		await Bun.write(path.join(tempDir, "generated-copy.ts"), genCode);

		await toolResultHandlers[0]!({
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_gen",
			input: { path: "generated-copy.ts", content: genCode },
			content: [{ type: "text", text: "ok" }],
			isError: false,
		}, mockCtx);

		expect(harness.sentMessages.length).toBe(0);
	});

	it("preserves active OMP settings as overrides when detect_duplicates scans a subproject", async () => {
		const subprojectDir = path.join(tempDir, "subproject");
		await fs.mkdir(subprojectDir, { recursive: true });

		await Bun.write(
			path.join(subprojectDir, ".jscpd.json"),
			JSON.stringify({ minLines: 20, minTokens: 100 }),
		);

		const code = `
export function simpleHelperFunction(x: number, y: number, z: number): number {
	const val1 = x * 2;
	const val2 = y * 3;
	const val3 = z * 4;
	return val1 + val2 + val3;
}
`;
		await Bun.write(path.join(subprojectDir, "a.ts"), code);
		await Bun.write(path.join(subprojectDir, "b.ts"), code);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir, { minLines: 4, minTokens: 15 });

		const detectTool = harness.registeredTools[0]!;
		const outcome = await detectTool.execute("call_subproject", { path: "subproject" }, undefined, undefined, mockCtx as ExtensionContext);

		const textItem = outcome.content[0] as ToolTextContent;
		expect(textItem.text).toContain("Detected Clones");
		expect(textItem.text).toContain("a.ts");
		expect(textItem.text).toContain("b.ts");
	});

	it("reloads project configuration on session_switch", async () => {
		const session1Dir = path.join(tempDir, "session-1");
		const session2Dir = path.join(tempDir, "session-2");
		await fs.mkdir(session1Dir, { recursive: true });
		await fs.mkdir(session2Dir, { recursive: true });

		await Bun.write(
			path.join(session2Dir, ".jscpd.json"),
			JSON.stringify({ minLines: 4, minTokens: 20, ignore: ["ignore-me/**"] }),
		);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);

		await harness.startSession(session1Dir);
		const mockCtx2 = harness.createContext(session2Dir);

		for (const h of harness.eventHandlers["session_switch"] || []) {
			await h({ type: "session_switch" }, mockCtx2);
		}
	});
});
