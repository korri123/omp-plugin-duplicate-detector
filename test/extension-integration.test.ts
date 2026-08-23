import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import duplicateDetectorExtension from "../src/index";
import type { ExtensionAPI, ExtensionContext, ToolDefinition, RegisteredCommand, ToolResultEventResult, ToolTextContent } from "@oh-my-pi/pi-coding-agent";

describe("duplicateDetectorExtension integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-ext-integration-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("intercepts write tool_result and sends live steer custom message by default", async () => {
		// 1. Set up an existing source file in workspace with sufficient tokens
		const existingCode = `
export function validateTransactionPayload(tx: { id: string; amount: number; sender: string; recipient: string }): boolean {
	if (!tx.id || typeof tx.id !== "string") return false;
	if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
	if (!tx.sender || typeof tx.sender !== "string") return false;
	if (!tx.recipient || typeof tx.recipient !== "string") return false;
	return true;
}
`;
		const fileA = path.join(tempDir, "transaction-validator.ts");
		await Bun.write(fileA, existingCode);

		// 2. Set up mock ExtensionAPI
		const eventHandlers: Record<string, Function[]> = {};
		const registeredTools: ToolDefinition[] = [];
		const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};
		const sentMessages: Array<{ msg: unknown; opts: unknown }> = [];

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
		const mockPi = {
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
				sentMessages.push({ msg, opts });
			},
		} as unknown as ExtensionAPI;
		// 3. Register extension
		duplicateDetectorExtension(mockPi);

		const mockCtx: Partial<ExtensionContext> = {
			cwd: tempDir,
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
		};

		// 4. Fire session_start handler
		const sessionStartHandlers = eventHandlers["session_start"] || [];
		for (const h of sessionStartHandlers) {
			await h({ type: "session_start" }, mockCtx);
		}

		// 5. Simulate write tool writing a new file containing the same logic
		const fileB = path.join(tempDir, "order-validator.ts");
		await Bun.write(fileB, existingCode);

		const toolResultHandlers = eventHandlers["tool_result"] || [];
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

		// Default steer mode returns void so tool_result content is untouched
		expect(result).toBeUndefined();

		// Default steer mode sends live steer message
		expect(sentMessages.length).toBe(1);
		const sent = sentMessages[0]!;
		const sentOpts = sent.opts;
		const sentMsg = sent.msg;
		if (sentOpts && typeof sentOpts === "object" && "deliverAs" in sentOpts) {
			expect(sentOpts.deliverAs).toBe("steer");
		} else {
			expect(false).toBe(true);
		}
		if (sentMsg && typeof sentMsg === "object" && "customType" in sentMsg) {
			expect(sentMsg.customType).toBe("duplicate-detector-warning");
		} else {
			expect(false).toBe(true);
		}
		// 6. Test deduplication: subsequent edit with same duplicate should not warn again
		const secondResult = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as ToolResultEventResult | undefined;
		expect(secondResult).toBeUndefined();
		// 7. Test detect_duplicates tool execute
		expect(registeredTools.length).toBe(1);
		const detectTool = registeredTools[0]!;
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
		const fileA = path.join(tempDir, "invoice-taxes.ts");
		await Bun.write(fileA, existingCode);

		const eventHandlers: Record<string, Function[]> = {};
		const sentMessages: Array<{ msg: unknown; opts: unknown }> = [];

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

		const mockPi = {
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
			registerTool: () => {},
			registerCommand: () => {},
			registerMessageRenderer: () => {},
			sendMessage: (msg: unknown, opts: unknown) => {
				sentMessages.push({ msg, opts });
			},
		} as unknown as ExtensionAPI;

		duplicateDetectorExtension(mockPi);

		const mockCtx: Partial<ExtensionContext> = {
			cwd: tempDir,
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
		};
		const sessionStartHandlers = eventHandlers["session_start"] || [];
		for (const h of sessionStartHandlers) {
			await h({ type: "session_start", settings: { reminderMode: "in-band", minTokens: 20 } }, mockCtx);
		}

		const fileB = path.join(tempDir, "receipt-taxes.ts");
		await Bun.write(fileB, existingCode);

		const toolResultHandlers = eventHandlers["tool_result"] || [];
		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_test_steer",
			input: { path: "receipt-taxes.ts", content: existingCode },
			content: [{ type: "text", text: "File written successfully" }],
		};

		const result = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as ToolResultEventResult | undefined;
		expect(result).toBeDefined();
		expect(result?.content).toBeDefined();
		expect(result?.content?.length).toBe(2);

		const firstItem = result?.content?.[0];
		expect(firstItem?.type).toBe("text");
		const textItem = firstItem as ToolTextContent;
		expect(textItem.text).toContain('<system-reminder reason="code_duplication" file="receipt-taxes.ts">');
		expect(textItem.text).toContain("invoice-taxes.ts");
		expect(textItem.text).toContain("computeInvoiceTaxes");

		// In in-band mode, sendMessage is not called
		expect(sentMessages.length).toBe(0);
	});
});
