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
import { DuplicateDetectorCoordinator } from "../src/coordinator";
import duplicateDetectorExtension from "../src/index";
import { execGit } from "../src/jscpd-engine";

interface MockSentMessage {
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
		const startHandlers = eventHandlers.session_start || [];
		for (const h of startHandlers) {
			await h({ settings }, ctx);
		}
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

async function waitFor(
	condition: () => boolean,
	timeoutMs = 5000,
): Promise<void> {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`waitFor condition timed out after ${timeoutMs}ms`);
		}
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 10);
		await promise;
	}
}

describe("Phase 2: Progressive Scheduling and Session Reuse", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "phase2-progressive-test-"),
		);
		await execGit(["init"], tempDir);
		await execGit(["config", "user.name", "Test Agent"], tempDir);
		await execGit(["config", "user.email", "agent@test.com"], tempDir);
	});

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	it("Test 1: Priority mutation check responds while baseline indexing is in progress without blocking", async () => {
		// Populate git repository with 30 files
		for (let i = 0; i < 30; i++) {
			const fileName = `service_module_${String(i).padStart(2, "0")}.ts`;
			await fs.writeFile(
				path.join(tempDir, fileName),
				`
export function computeMetrics_${i}(data: number[]): number {
    let accumulator = ${i * 10};
    for (const item of data) {
        accumulator += item * ${i + 1};
    }
    return accumulator > 1000 ? accumulator / 2 : accumulator * 2;
}
`,
			);
		}

		await execGit(["add", "."], tempDir);
		await execGit(["commit", "-m", "initial baseline files"], tempDir);

		const coordinator = new DuplicateDetectorCoordinator();
		let baselineCompleted = false;

		coordinator.on("complete", () => {
			baselineCompleted = true;
		});

		// Open workspace non-blocking
		await coordinator.openWorkspace(tempDir, {
			minLines: 3,
			minTokens: 10,
		});

		// Immediately issue priority mutation check while baseline indexing is in progress
		const sampleCode = `
export function computeMetrics_fast(data: number[]): number {
    let accumulator = 100;
    for (const item of data) {
        accumulator += item * 10;
    }
    return accumulator > 1000 ? accumulator / 2 : accumulator * 2;
}
`;
		const startMs = Date.now();
		const result = await coordinator.checkAndUpdate(
			path.join(tempDir, "priority_mutated.ts"),
			sampleCode,
			1,
		);
		const durationMs = Date.now() - startMs;

		// Assert that priority check returned promptly without waiting for all 30 baseline files to complete
		expect(result).toBeDefined();
		expect(Array.isArray(result.clones)).toBe(true);
		expect(durationMs).toBeLessThan(1500);

		// Await baseline completion cleanly
		await waitFor(() => baselineCompleted, 5000);
		expect(baselineCompleted).toBe(true);

		await coordinator.dispose();
	});

	it("Test 2: Late finding event emitted when remaining baseline files match a previously mutated file", async () => {
		// Shared duplicate algorithm
		const duplicateAlgorithm = `
export function processTransactionBatch(records: Array<{ id: string; amount: number; fee: number }>): number {
    let netTotal = 0;
    for (const record of records) {
        const taxable = Math.max(0, record.amount - record.fee);
        netTotal += taxable * 0.85;
    }
    return Math.round(netTotal * 100) / 100;
}
`;

		// Create files file_00.ts to file_15.ts
		// Put duplicateAlgorithm in file_15.ts (alphabetically last file to be indexed)
		for (let i = 0; i < 15; i++) {
			const fileName = `file_${String(i).padStart(2, "0")}.ts`;
			await fs.writeFile(
				path.join(tempDir, fileName),
				`
export function uniqueHelper_${i}(value: number): number {
    const seed = ${i * 42 + 7};
    return (value + seed) ^ 0x5a;
}
`,
			);
		}

		await fs.writeFile(path.join(tempDir, "file_15.ts"), duplicateAlgorithm);

		await execGit(["add", "."], tempDir);
		await execGit(["commit", "-m", "commit with late duplicate file"], tempDir);

		const coordinator = new DuplicateDetectorCoordinator();
		const lateFindings: unknown[] = [];

		coordinator.on("lateFinding", (payload) => {
			lateFindings.push(payload);
		});

		// Open workspace
		await coordinator.openWorkspace(tempDir, {
			minLines: 3,
			minTokens: 10,
		});

		// Immediately mutate a watched file with the same duplicate algorithm
		const watchedFilePath = path.join(tempDir, "watched_transaction.ts");
		const checkResult = await coordinator.checkAndUpdate(
			watchedFilePath,
			duplicateAlgorithm,
			1,
		);
		expect(checkResult).toBeDefined();

		// As baseline scheduler proceeds through file_00 ... file_15,
		// when it indexes file_15.ts it will discover a clone with watched_transaction.ts and emit a late finding
		await waitFor(() => lateFindings.length > 0, 5000);

		expect(lateFindings.length).toBeGreaterThan(0);
		const firstFinding = lateFindings[0] as {
			clone: {
				duplicationA: { sourceId: string };
				duplicationB: { sourceId: string };
			};
		};
		expect(firstFinding.clone).toBeDefined();

		const involvedFiles = [
			firstFinding.clone.duplicationA.sourceId,
			firstFinding.clone.duplicationB.sourceId,
		].map((p) => path.resolve(p));

		expect(involvedFiles).toContain(path.resolve(watchedFilePath));
		expect(involvedFiles).toContain(
			path.resolve(path.join(tempDir, "file_15.ts")),
		);

		await coordinator.dispose();
	});

	it("Test 3: Session switch with identical cwd and config reuses the existing index", async () => {
		// Populate initial repository files
		const sharedCode = `
export function sharedUtilitiesHelper(input: string): string[] {
    const tokens = input.trim().split(/\\s+/);
    const sanitized = tokens.filter((t) => t.length > 2);
    return sanitized.map((t) => t.toLowerCase());
}
`;
		await fs.writeFile(path.join(tempDir, "utils_a.ts"), sharedCode);
		await fs.writeFile(path.join(tempDir, "utils_b.ts"), sharedCode);
		await execGit(["add", "."], tempDir);
		await execGit(["commit", "-m", "initial utils"], tempDir);

		const coordinator = new DuplicateDetectorCoordinator();
		const config = {
			minLines: 3,
			minTokens: 10,
		};

		let baselineDone = false;
		coordinator.on("complete", () => {
			baselineDone = true;
		});

		// Initial workspace open
		await coordinator.openWorkspace(tempDir, config);
		await waitFor(() => baselineDone, 5000);

		const initialEpoch = coordinator.epoch;
		const initialRootDir = coordinator.activeRootDir;
		const initialConfigHash = coordinator.activeConfigHash;

		expect(initialRootDir).toBe(tempDir);
		expect(initialConfigHash).not.toBeNull();

		// Check snippet against existing index
		const clonesBefore = await coordinator.checkSnippet(
			path.join(tempDir, "query.ts"),
			sharedCode,
		);
		expect(clonesBefore.length).toBeGreaterThan(0);

		// Session switch with identical cwd and config
		await coordinator.openWorkspace(tempDir, config);

		// Verify coordinator state was reused without re-spawning or bumping epoch
		expect(coordinator.epoch).toBe(initialEpoch);
		expect(coordinator.activeRootDir).toBe(initialRootDir);
		expect(coordinator.activeConfigHash).toBe(initialConfigHash);

		// Verify index still retains files and clone detection works immediately
		const clonesAfter = await coordinator.checkSnippet(
			path.join(tempDir, "query2.ts"),
			sharedCode,
		);
		expect(clonesAfter.length).toBeGreaterThan(0);

		await coordinator.dispose();

		// Also test full extension-level session switch integration
		const harness = createMockHarness();
		duplicateDetectorExtension(harness.api);

		const sessionCtx = await harness.startSession(tempDir, {
			minLines: 3,
			minTokens: 10,
			reminderMode: "steer",
		});

		// Wait for initial baseline indexing to complete in the extension session
		await waitFor(
			() =>
				harness.sentMessages.some(
					(m) => m.msg.customType === "duplicate-detector-status",
				),
			5000,
		);
		// Simulate tool_result file write
		const toolHandlers = harness.eventHandlers.tool_result || [];
		const testFilePath = path.join(tempDir, "mutated_test.ts");
		await fs.writeFile(testFilePath, sharedCode);

		for (const handler of toolHandlers) {
			await handler(
				{
					toolName: "write",
					input: { path: "mutated_test.ts" },
					isError: false,
					content: "File written",
				},
				sessionCtx,
			);
		}

		// Trigger session_switch with identical cwd
		const switchHandlers = harness.eventHandlers.session_switch || [];
		for (const handler of switchHandlers) {
			await handler({ settings: { minLines: 3, minTokens: 10 } }, sessionCtx);
		}

		// Verify that after session_switch, duplicate detector remains active and responsive
		expect(harness.sentMessages.length).toBeGreaterThanOrEqual(1);

		// Trigger another tool_result write after switch
		const testFilePath2 = path.join(tempDir, "mutated_test_2.ts");
		await fs.writeFile(testFilePath2, sharedCode);

		for (const handler of toolHandlers) {
			await handler(
				{
					toolName: "write",
					input: { path: "mutated_test_2.ts" },
					isError: false,
					content: "File written",
				},
				sessionCtx,
			);
		}

		// Should receive another duplicate detector warning
		const warnings = harness.sentMessages.filter(
			(m) => m.msg.customType === "duplicate-detector-warning",
		);
		expect(warnings.length).toBeGreaterThanOrEqual(2);

		// Shutdown cleanly
		const shutdownHandlers = harness.eventHandlers.session_shutdown || [];
		for (const handler of shutdownHandlers) {
			await handler({}, sessionCtx);
		}
	});
});
