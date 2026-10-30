import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	RegisteredCommand,
} from "@oh-my-pi/pi-coding-agent";
import { detectorServiceStats } from "../src/detector/service";
import { createDuplicateDetector } from "../src/index";
import { WARNING_MESSAGE_TYPE, type WarningDetails } from "../src/types";

interface SentMessage {
	message: {
		customType?: string;
		content?: string;
		display?: boolean;
		details?: WarningDetails;
	};
	options?: { deliverAs?: string; triggerTurn?: boolean };
}

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

const EXISTING = `export function summarizeOrders(orders: Array<{ id: string; total: number; status: string }>) {
	let paid = 0;
	let pending = 0;
	const ids: string[] = [];
	for (const order of orders) {
		if (order.status === "paid") {
			paid += order.total;
		} else if (order.status === "pending") {
			pending += order.total;
		}
		ids.push(order.id.trim().toLowerCase());
	}
	const average = orders.length > 0 ? (paid + pending) / orders.length : 0;
	return { paid, pending, ids, average: Math.round(average * 100) / 100 };
}
`;

const COPY = `// copied helper
export function totalsForReport(orders: Array<{ id: string; total: number; status: string }>) {
	let paid = 0;
	let pending = 0;
	const ids: string[] = [];
	for (const order of orders) {
		if (order.status === "paid") {
			paid += order.total;
		} else if (order.status === "pending") {
			pending += order.total;
		}
		ids.push(order.id.trim().toLowerCase());
	}
	const average = orders.length > 0 ? (paid + pending) / orders.length : 0;
	return { paid, pending, ids, average: Math.round(average * 100) / 100 };
}
`;

async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeoutMs = 10_000,
): Promise<void> {
	const start = Date.now();
	while (!(await condition())) {
		if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
		await Bun.sleep(10);
	}
}

function createHarness(
	cwd: string,
	cacheDir: string,
	pluginSettings: Record<string, unknown> = {},
	/** `true`: the tool_result check budget (the only `ctx.setTimeout` user) expires at once. */
	expireBudget = false,
) {
	const handlers: Record<string, Handler[]> = {};
	const commands: Record<string, Omit<RegisteredCommand, "name">> = {};
	const sent: SentMessage[] = [];
	const notifications: Array<{ message: string; type?: string }> = [];
	const pi = {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		on: (event: string, handler: Handler) => {
			(handlers[event] ??= []).push(handler);
		},
		registerCommand: (
			name: string,
			options: Omit<RegisteredCommand, "name">,
		) => {
			commands[name] = options;
		},
		registerMessageRenderer: () => {},
		sendMessage: (
			message: SentMessage["message"],
			options?: SentMessage["options"],
		) => {
			sent.push({ message, options });
		},
	} as unknown as ExtensionAPI;
	const ctx = {
		cwd,
		hasUI: true,
		agent: { kind: "main", id: "Main", name: "Main", depth: 0 },
		isIdle: () => false,
		ui: {
			notify: (message: string, type?: string) =>
				notifications.push({ message, type }),
			setStatus: () => {},
		},
		sessionManager: { saveArtifact: async () => "1" },
		setTimeout: (callback: () => void, ms?: number) => {
			if (!expireBudget) return setTimeout(callback, ms);
			// Expiring synchronously guarantees every check (a worker round-trip) misses the budget.
			callback();
			return setTimeout(() => {}, 0);
		},
		clearTimer: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
	} as unknown as ExtensionContext;

	createDuplicateDetector({
		loadPluginSettings: async () => pluginSettings,
		cacheDir,
	})(pi);

	const emit = async (
		event: string,
		payload: Record<string, unknown> = {},
	): Promise<unknown[]> => {
		const results: unknown[] = [];
		for (const handler of handlers[event] ?? [])
			results.push(await handler({ type: event, ...payload }, ctx));
		return results;
	};
	const command = (args: string) =>
		commands.duplicates!.handler(args, ctx as never);
	let callId = 0;
	/** Runs tool_call → write to disk → tool_result for a `write` and returns the tool_result handler results. */
	const write = async (
		relPath: string,
		content: string,
	): Promise<unknown[]> => {
		const toolCallId = `call-${++callId}`;
		const input = { path: relPath, content };
		await emit("tool_call", { toolName: "write", toolCallId, input });
		await Bun.write(path.join(cwd, relPath), content);
		return emit("tool_result", {
			toolName: "write",
			toolCallId,
			input,
			content: [],
			isError: false,
			details: { resolvedPath: path.join(cwd, relPath) },
		});
	};
	/** Emits an `edit` tool_result with the given details (disk changes are the caller's). */
	const edit = (details: Record<string, unknown>): Promise<unknown[]> =>
		emit("tool_result", {
			toolName: "edit",
			toolCallId: `call-${++callId}`,
			input: {},
			content: [],
			isError: false,
			details,
		});
	const waitReady = () =>
		waitFor(async () => {
			notifications.length = 0;
			await command("status");
			return notifications.some((n) => n.message.includes("(ready,"));
		});
	const warnings = () =>
		sent.filter((s) => s.message.customType === WARNING_MESSAGE_TYPE);
	return { emit, command, write, edit, waitReady, warnings, notifications };
}

describe("duplicate detector extension", () => {
	let dir: string;
	let repo: string;
	let cacheDir: string;
	let savedXdg: string | undefined;

	beforeEach(async () => {
		dir = await fs.realpath(
			await fs.mkdtemp(path.join(os.tmpdir(), "dd-ext-")),
		);
		repo = path.join(dir, "repo");
		cacheDir = path.join(dir, "cache");
		savedXdg = process.env.XDG_CACHE_HOME;
		process.env.XDG_CACHE_HOME = path.join(dir, "xdg");
		await Bun.write(path.join(repo, "src", "orders.ts"), EXISTING);
		for (const args of [
			["init", "-q"],
			["add", "."],
		]) {
			expect(
				await Bun.spawn(["git", ...args], {
					cwd: repo,
					stdout: "ignore",
					stderr: "ignore",
				}).exited,
			).toBe(0);
		}
	});

	afterEach(async () => {
		if (savedXdg === undefined) delete process.env.XDG_CACHE_HOME;
		else process.env.XDG_CACHE_HOME = savedXdg;
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("warns once via a message for a copied function, then not again", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		// Once indexed, checks finish inside the tool_result budget: delivery is synchronous.
		await h.waitReady();
		await h.write("src/report.ts", COPY);
		expect(h.warnings()).toHaveLength(1);

		const [warning] = h.warnings();
		expect(warning!.options?.deliverAs).toBe("aside");
		expect(warning!.message.display).toBe(true);
		const details = warning!.message.details!;
		expect(details.file).toBe("src/report.ts");
		expect(details.omitted).toBe(0);
		expect(details.matches.length).toBeGreaterThan(0);
		expect(details.matches[0]!.other.file).toBe("src/orders.ts");
		expect(warning!.message.content).toContain("src/orders.ts");

		// Re-create the same copy from scratch: same duplicate, already reported.
		await fs.rm(path.join(repo, "src", "report.ts"));
		await h.write("src/report.ts", COPY);
		expect(h.warnings()).toHaveLength(1);

		await h.emit("session_shutdown");
		expect(detectorServiceStats()).toEqual({
			workerRunning: false,
			workspaces: 0,
		});
	});

	it("returns additionalContext in in-band mode", async () => {
		const h = createHarness(repo, cacheDir, { reminderMode: "in-band" });
		await h.emit("session_start");
		await h.waitReady();
		const results = await h.write("src/report.ts", COPY);
		const result = results.find((r) => r !== undefined) as
			| { additionalContext?: string }
			| undefined;
		expect(result?.additionalContext).toContain("src/orders.ts");
		expect(h.warnings()).toHaveLength(0);
		await h.emit("session_shutdown");
	});

	it("/duplicates off stops checking and releases the workspace; it persists across sessions", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		expect(detectorServiceStats().workspaces).toBe(1);
		await h.command("off");
		expect(detectorServiceStats()).toEqual({
			workerRunning: false,
			workspaces: 0,
		});

		// Detection is off: no workspace, so nothing is checked or queued.
		await h.write("src/report.ts", COPY);
		expect(h.warnings()).toHaveLength(0);
		await h.emit("session_shutdown");

		const next = createHarness(repo, cacheDir);
		await next.emit("session_start");
		expect(detectorServiceStats().workspaces).toBe(0);
		await next.command("on");
		expect(detectorServiceStats().workspaces).toBe(1);
		await next.emit("session_shutdown");
		expect(detectorServiceStats()).toEqual({
			workerRunning: false,
			workspaces: 0,
		});
	});

	it("edit: reports every file of a multi-file edit", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		const a = path.join(repo, "src", "a.ts");
		const b = path.join(repo, "src", "b.ts");
		await Bun.write(a, COPY);
		await Bun.write(b, COPY);
		await h.edit({
			diff: "",
			perFileResults: [
				{ path: a, diff: "", op: "create", newText: COPY },
				{ path: b, diff: "", op: "create", newText: COPY },
			],
		});
		expect(
			h
				.warnings()
				.map((w) => w.message.details!.file)
				.sort(),
		).toEqual(["src/a.ts", "src/b.ts"]);
		await h.emit("session_shutdown");
	});

	it("edit: pruned snapshots fall back to the file on disk", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		const target = path.join(repo, "src", "orders.ts");
		await Bun.write(target, `${EXISTING}\n${COPY}`);
		await h.edit({ diff: "", snapshotsPruned: true, path: target });
		expect(h.warnings()).toHaveLength(1);
		expect(h.warnings()[0]!.message.details!.file).toBe("src/orders.ts");
		await h.emit("session_shutdown");
	});

	it("edit: moving a file with pruned snapshots does not report its pre-existing duplicates", async () => {
		const source = path.join(repo, "src", "copy.ts");
		await Bun.write(source, COPY);
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		const target = path.join(repo, "src", "moved.ts");
		await fs.rename(source, target);
		await h.edit({
			diff: "",
			path: target,
			sourcePath: source,
			snapshotsPruned: true,
		});
		expect(h.warnings()).toHaveLength(0);

		// The source is gone from the index: a new copy matches only the remaining files.
		await h.write("src/report.ts", COPY);
		const files = h
			.warnings()
			.flatMap((w) => w.message.details!.matches.map((m) => m.other.file));
		expect(files).not.toContain("src/copy.ts");
		await h.emit("session_shutdown");
	});

	it("edit: a deleted file no longer counts as an original", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		const orders = path.join(repo, "src", "orders.ts");
		await fs.rm(orders);
		await h.edit({ diff: "", path: orders, op: "delete", oldText: EXISTING });
		await h.write("src/report.ts", COPY);
		expect(h.warnings()).toHaveLength(0);
		await h.emit("session_shutdown");
	});

	it("delivers a warning by message when the check outlasts the budget", async () => {
		const h = createHarness(repo, cacheDir, { reminderMode: "in-band" }, true);
		await h.emit("session_start");
		await h.waitReady();
		const results = await h.write("src/report.ts", COPY);
		expect(results.every((r) => r === undefined)).toBe(true);
		await waitFor(() => h.warnings().length === 1);
		await h.emit("session_shutdown");
	});

	it("drops a late warning once the session shut down", async () => {
		const h = createHarness(repo, cacheDir, {}, true);
		await h.emit("session_start");
		await h.waitReady();
		await h.write("src/report.ts", COPY);
		await h.emit("session_shutdown");
		// The dropped delivery has no signal to await; give the worker time to answer.
		await Bun.sleep(300);
		expect(h.warnings()).toHaveLength(0);
	});

	it("drops a late warning once the session switched", async () => {
		const h = createHarness(repo, cacheDir, {}, true);
		await h.emit("session_start");
		await h.waitReady();
		await h.write("src/report.ts", COPY);
		await h.emit("session_switch");
		// The dropped delivery has no signal to await; give the worker time to answer.
		await Bun.sleep(300);
		expect(h.warnings()).toHaveLength(0);
		await h.emit("session_shutdown");
	});

	it("keeps the workspace warm across session_switch", async () => {
		const h = createHarness(repo, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		const stats = detectorServiceStats();
		let workerStopped = false;
		const monitor = setInterval(() => {
			if (!detectorServiceStats().workerRunning) workerStopped = true;
		}, 1);
		await h.emit("session_switch");
		clearInterval(monitor);
		expect(workerStopped).toBe(false);
		expect(detectorServiceStats()).toEqual(stats);
		// Still indexed: no re-baseline.
		h.notifications.length = 0;
		await h.command("status");
		expect(h.notifications.some((n) => n.message.includes("(ready,"))).toBe(
			true,
		);
		await h.emit("session_shutdown");
	});

	it("applies a nested jscpd config's ignore patterns relative to its directory", async () => {
		const app = path.join(repo, "packages", "app");
		await Bun.write(
			path.join(app, ".jscpd.json"),
			JSON.stringify({ ignore: ["src/generated/**"] }),
		);
		const h = createHarness(app, cacheDir);
		await h.emit("session_start");
		await h.waitReady();
		await h.write("src/generated/report.ts", COPY);
		expect(h.warnings()).toHaveLength(0);
		await h.write("src/report.ts", COPY);
		expect(h.warnings()).toHaveLength(1);
		await h.emit("session_shutdown");
	});
});
