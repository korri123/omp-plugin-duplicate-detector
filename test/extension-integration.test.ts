import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	RegisteredCommand,
	ToolDefinition,
	ToolResultEventResult,
} from "@oh-my-pi/pi-coding-agent";
import duplicateDetectorExtension from "../src/index";

interface ToolTextContent {
	type: "text";
	text: string;
}

export interface MockSentMessage {
	msg: {
		customType?: string;
		content?: string;
		display?: boolean;
		attribution?: string;
		details?: Record<string, unknown>;
	};
	opts?: {
		deliverAs?: string;
		triggerTurn?: boolean;
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
		await new Promise((resolve) => setTimeout(resolve, 5));
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
		);
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

describe("duplicateDetectorExtension integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-ext-integration-"));
		await setupGitRepo(tempDir);
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
		await Bun.write(
			path.join(tempDir, "transaction-validator.ts"),
			existingCode,
		);
		await gitTrack(tempDir);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);
		// Write new duplicate file
		await Bun.write(path.join(tempDir, "order-validator.ts"), existingCode);
		await gitTrack(tempDir);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		expect(toolResultHandlers.length).toBe(1);

		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_123",
			input: { path: "order-validator.ts", content: existingCode },
			content: [
				{ type: "text", text: "Successfully wrote order-validator.ts" },
			],
			isError: false,
		};

		const result = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as
			| ToolResultEventResult
			| undefined;
		expect(result).toBeUndefined();

		// Check steer message
		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(1);
		const sent = warnings[0]!;
		expect(sent.opts?.deliverAs).toBe("steer");
		expect(sent.msg.customType).toBe("duplicate-detector-warning");
		// Deduplication check
		const secondResult = (await toolResultHandlers[0]!(
			toolResultEvent,
			mockCtx,
		)) as ToolResultEventResult | undefined;
		expect(secondResult).toBeUndefined();
		expect(harness.registeredTools.length).toBe(0);
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
		await gitTrack(tempDir);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir, {
			reminderMode: "in-band",
			minTokens: 20,
		});

		await Bun.write(path.join(tempDir, "receipt-taxes.ts"), existingCode);
		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		const toolResultEvent = {
			type: "tool_result",
			toolName: "write",
			toolCallId: "call_test_steer",
			input: { path: "receipt-taxes.ts", content: existingCode },
			content: [{ type: "text", text: "File written successfully" }],
		};

		const result = (await toolResultHandlers[0]!(toolResultEvent, mockCtx)) as
			| ToolResultEventResult
			| undefined;
		expect(result).toBeDefined();
		expect(result?.content?.length).toBe(2);

		const textItem = result?.content?.[0] as ToolTextContent;
		expect(textItem.text).toContain(
			'<system-reminder reason="code_duplication" file="receipt-taxes.ts">',
		);
		expect(textItem.text).toContain("invoice-taxes.ts");
		expect(textItem.text).toContain("computeInvoiceTaxes");
		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(0);
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
		await Bun.write(
			path.join(tempDir, ".jscpd.json"),
			JSON.stringify(jscpdConfig, null, 2),
		);

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
		await gitTrack(tempDir);

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

		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(1);
		const messageContent = warnings[0]?.msg.content ?? "";
		expect(messageContent).toContain("order-b.customts");
		expect(messageContent).toContain("order-a.customts");
		expect(messageContent).not.toContain("old-order.customts");
	});

	it("skips checking ignored and generated files on tool_result mutation", async () => {
		const jscpdConfig = {
			minLines: 4,
			minTokens: 20,
			ignore: ["ignored-folder/**"],
		};
		await Bun.write(
			path.join(tempDir, ".jscpd.json"),
			JSON.stringify(jscpdConfig),
		);

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

		await toolResultHandlers[0]!(
			{
				type: "tool_result",
				toolName: "write",
				toolCallId: "call_ignored",
				input: { path: "ignored-folder/copy.ts", content: code },
				content: [{ type: "text", text: "ok" }],
				isError: false,
			},
			mockCtx,
		);

		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(0);
		// 2. Mutate a generated file: should be skipped
		const genCode = `// @generated DO NOT EDIT\n${code}`;
		await Bun.write(path.join(tempDir, "generated-copy.ts"), genCode);

		await toolResultHandlers[0]!(
			{
				type: "tool_result",
				toolName: "write",
				toolCallId: "call_gen",
				input: { path: "generated-copy.ts", content: genCode },
				content: [{ type: "text", text: "ok" }],
				isError: false,
			},
			mockCtx,
		);
		const warnings2 = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings2.length).toBe(0);
	});

	it("gracefully handles tool_result mutations for files outside the workspace root", async () => {
		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);

		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		expect(toolResultHandlers.length).toBeGreaterThanOrEqual(1);

		const code = `
export function testMutation(): void {
	console.log("some code");
}
`;
		// 1. External path starting with `../`
		await expect(
			toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_external_rel",
					input: {
						path: "../Users/kormakurgunnlaugsson/Downloads/innova-order-2580739/execution/variant-update.graphql",
						content: code,
					},
					content: [{ type: "text", text: "ok" }],
					isError: false,
				},
				mockCtx,
			),
		).resolves.toBeUndefined();

		// 2. Absolute external path
		await expect(
			toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "edit",
					toolCallId: "call_external_abs",
					input: {
						path: "/tmp/innova-order-2580739/execution/variant-update.graphql",
						content: code,
					},
					content: [{ type: "text", text: "ok" }],
					isError: false,
				},
				mockCtx,
			),
		).resolves.toBeUndefined();

		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(0);
	});

	it("toggles duplicate detector on and off per project via /duplicates command", async () => {
		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(tempDir);

		const cmd = harness.registeredCommands["duplicates"];
		expect(cmd).toBeDefined();

		// Check initial status
		await cmd.handler?.("status", mockCtx as never);
		const initialNotifs = harness.uiNotifications.filter((n) =>
			n.message.includes("currently enabled"),
		);
		expect(initialNotifs.length).toBe(1);

		// Turn off
		await cmd.handler?.("off", mockCtx as never);
		const offNotifs = harness.uiNotifications.filter(
			(n) => n.message === "Duplicate detector disabled for this project.",
		);
		expect(offNotifs.length).toBe(1);

		// Check status after turning off
		await cmd.handler?.("", mockCtx as never);
		const disabledNotifs = harness.uiNotifications.filter((n) =>
			n.message.includes("currently disabled"),
		);
		expect(disabledNotifs.length).toBe(1);

		// Turn back on
		await cmd.handler?.("on", mockCtx as never);
		const onNotifs = harness.uiNotifications.filter(
			(n) => n.message === "Duplicate detector enabled for this project.",
		);
		expect(onNotifs.length).toBe(1);
	});

	it("suppresses indexing and mutation warnings when project is disabled persistently", async () => {
		const disabledDir = path.join(tempDir, "disabled-project");
		await fs.mkdir(disabledDir, { recursive: true });

		const code = `
export function orderTaxProcessor(items: Array<{ price: number; tax: number }>): number {
	let sum = 0;
	for (const item of items) {
		sum += item.price * item.tax;
	}
	return sum;
}
`;
		await Bun.write(path.join(disabledDir, "tax1.ts"), code);
		await gitTrack(disabledDir);

		// Disable the project persistently first
		const { setProjectEnabled } = await import("../src/project-state");
		await setProjectEnabled(disabledDir, false);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		const mockCtx = await harness.startSession(disabledDir);

		// Verify disabled status was sent
		const statusMessages = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-status",
		);
		expect(
			statusMessages.some((m) =>
				String(m.msg.content).includes("Disabled for this project"),
			),
		).toBe(true);

		// Write duplicate file
		await Bun.write(path.join(disabledDir, "tax2.ts"), code);
		const toolResultHandlers = harness.eventHandlers["tool_result"] || [];
		await toolResultHandlers[0]!(
			{
				type: "tool_result",
				toolName: "write",
				toolCallId: "call_write_disabled",
				input: { path: "tax2.ts" },
				content: [{ type: "text", text: "written" }],
				isError: false,
			},
			mockCtx,
		);

		// Verify NO warning was generated
		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBe(0);

		// Re-enable via command
		const cmd = harness.registeredCommands["duplicates"]!;
		await cmd.handler?.("on", mockCtx as never);

		// Clean up persistent state
		await setProjectEnabled(disabledDir, true);
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

	it("works in non-git workspaces via hot-index mutation checks", async () => {
		const nonGitDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "omp-nongit-integration-"),
		);
		try {
			const code = `
export function calculateShippingQuote(weight: number, distance: number, express: boolean): number {
	const baseRate = weight * 1.5;
	const distanceMultiplier = distance > 500 ? 1.25 : 1.0;
	const expressFee = express ? 25.0 : 0.0;
	const total = (baseRate * distanceMultiplier) + expressFee;
	console.log("Calculated shipping quote:", total);
	return total;
}
`;
			const harness = createMockHarness();
			duplicateDetectorExtension(harness.api);
			const mockCtx = await harness.startSession(nonGitDir);
			const toolResultHandlers = harness.eventHandlers["tool_result"] || [];

			// First write in non-git workspace
			await Bun.write(path.join(nonGitDir, "moduleA.ts"), code);
			await toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_m1",
					input: { path: "moduleA.ts", content: code },
					content: [{ type: "text", text: "ok" }],
					isError: false,
				},
				mockCtx,
			);

			// Second write with duplicate code should trigger warning via hot index
			await Bun.write(path.join(nonGitDir, "moduleB.ts"), code);
			await toolResultHandlers[0]!(
				{
					type: "tool_result",
					toolName: "write",
					toolCallId: "call_m2",
					input: { path: "moduleB.ts", content: code },
					content: [{ type: "text", text: "ok" }],
					isError: false,
				},
				mockCtx,
			);

			const warnings = harness.sentMessages.filter(
				(m) => m.msg.customType === "duplicate-detector-warning",
			);
			expect(warnings.length).toBe(1);
			const sent = warnings[0]!;
			expect(sent.msg.content ?? "").toContain("moduleB.ts");
			expect(sent.msg.content ?? "").toContain("moduleA.ts");

			// Verify status message in transcript
			const statusMsgs = harness.sentMessages.filter(
				(m) => m.msg.customType === "duplicate-detector-status",
			);
			expect(statusMsgs.length).toBe(1);
			expect(statusMsgs[0]?.msg.content).toContain(
				"Baseline skipped (not a Git repository",
			);
			// Verify UI notification for non-git workspace baseline skip
			const skipNotification = harness.uiNotifications.find((n) =>
				n.message.includes("Baseline skipped (not a Git repository"),
			);
			expect(skipNotification).toBeDefined();
			expect(skipNotification?.type).toBe("info");
		} finally {
			await fs.rm(nonGitDir, { recursive: true, force: true });
		}
	});

	it("notifies user with indexed file count and cache state when starting in a Git repository", async () => {
		await Bun.write(path.join(tempDir, "file1.ts"), "export const a = 1;\n");
		await Bun.write(path.join(tempDir, "file2.ts"), "export const b = 2;\n");
		await gitTrack(tempDir);

		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);
		await harness.startSession(tempDir);

		const readyNotification = harness.uiNotifications.find((n) =>
			n.message.includes("Ready (2 Git files indexed, uncached)"),
		);
		expect(readyNotification).toBeDefined();
		expect(readyNotification?.type).toBe("info");

		// Verify status message in transcript
		const statusMsg = harness.sentMessages.find(
			(m) => m.msg.customType === "duplicate-detector-status",
		);
		expect(statusMsg).toBeDefined();
		expect(statusMsg?.msg.content).toContain(
			"Ready (2 Git files indexed, uncached)",
		);
		expect(statusMsg?.opts?.triggerTurn).toBe(false);
	});

	it("indicates cached status on subsequent session startup in the same repository", async () => {
		await Bun.write(path.join(tempDir, "file1.ts"), "export const a = 1;\n");
		await Bun.write(path.join(tempDir, "file2.ts"), "export const b = 2;\n");
		await gitTrack(tempDir);

		// First session populates disk cache
		const harness1 = createMockHarness();
		duplicateDetectorExtension(harness1.api);
		await harness1.startSession(tempDir);

		// Second session hydrates shards from disk cache
		const harness2 = createMockHarness();
		duplicateDetectorExtension(harness2.api);
		await harness2.startSession(tempDir);

		const readyNotification = harness2.uiNotifications.find((n) =>
			n.message.includes("Ready (2 Git files indexed, cached)"),
		);
		expect(readyNotification).toBeDefined();
		expect(readyNotification?.type).toBe("info");

		const statusMsg = harness2.sentMessages.find(
			(m) => m.msg.customType === "duplicate-detector-status",
		);
		expect(statusMsg).toBeDefined();
		expect(statusMsg?.msg.content).toContain(
			"Ready (2 Git files indexed, cached)",
		);
	});
});
