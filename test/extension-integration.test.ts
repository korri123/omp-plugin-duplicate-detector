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

	it("intercepts write tool_result and injects system reminder with code preview", async () => {
		// 1. Set up an existing source file in workspace with sufficient tokens
		const existingCode = `
export function validateTransactionPayload(tx: { id: string; amount: number; sender: string; recipient: string; currency: string }): boolean {
	if (!tx.id || tx.id.length < 5) return false;
	if (tx.amount <= 0 || !Number.isFinite(tx.amount)) return false;
	if (!tx.sender || tx.sender.length < 3) return false;
	if (!tx.recipient || tx.recipient.length < 3) return false;
	if (tx.currency !== "USD" && tx.currency !== "EUR" && tx.currency !== "GBP") return false;
	console.log("Validated transaction successfully:", tx.id, tx.amount, tx.currency);
	return true;
}
`;
		const fileA = path.join(tempDir, "transaction-validator.ts");
		await Bun.write(fileA, existingCode);

		// 2. Set up mock ExtensionAPI
		const eventHandlers: Record<string, Function[]> = {};
		const registeredTools: ToolDefinition[] = [];
		const registeredCommands: Record<string, Partial<RegisteredCommand>> = {};

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

		expect(result).toBeDefined();
		expect(result?.content).toBeDefined();
		expect(result?.content?.length).toBe(2);

		const firstItem = result?.content?.[0];
		expect(firstItem?.type).toBe("text");
		const textItem = firstItem as ToolTextContent;
		expect(textItem.text).toContain('<system-reminder reason="code_duplication" file="order-validator.ts">');
		expect(textItem.text).toContain("transaction-validator.ts");
		expect(textItem.text).toContain("validateTransactionPayload");

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
});
