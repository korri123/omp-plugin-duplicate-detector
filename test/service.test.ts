import { afterAll, afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	acquireWorkspace,
	detectorServiceStats,
	type WorkspaceHandle,
} from "../src/detector/service";
import type { DetectorOptions, WorkspaceStatus } from "../src/types";

const options: DetectorOptions = {
	minTokens: 30,
	minLines: 4,
	ignorePatterns: [],
	ignoreTests: true,
	customTestPatterns: [],
	excludeTestPatterns: [],
	maxIndexedFiles: 10_000,
};

const tempDirs: string[] = [];
const handles: WorkspaceHandle[] = [];

afterEach(async () => {
	await Promise.all(handles.splice(0).map((handle) => handle.release()));
});

afterAll(async () => {
	await Promise.all(
		tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
	);
});

/** A function whose tokens are unique to `n`, so distinct files never match. */
function source(n: number): string {
	const lines = [`export function compute${n}(input: number[]): number {`];
	lines.push(`\tlet total${n} = ${n};`);
	for (let i = 0; i < 12; i++) {
		lines.push(
			`\tif (input[${i}] > ${n * 31 + i}) total${n} += input[${i}] * ${n * 7 + i};`,
		);
	}
	lines.push(`\treturn total${n};`, "}");
	return `${lines.join("\n")}\n`;
}

async function put(root: string, rel: string, content: string): Promise<void> {
	const abs = path.join(root, rel);
	await fs.mkdir(path.dirname(abs), { recursive: true });
	await fs.writeFile(abs, content);
}

async function tempDir(prefix: string): Promise<string> {
	const dir = await fs.realpath(
		await fs.mkdtemp(path.join(os.tmpdir(), prefix)),
	);
	tempDirs.push(dir);
	return dir;
}

/** Temp git repo with `count` source files `src/f<i>.ts` plus non-candidates. */
async function makeRepo(count: number): Promise<string> {
	const root = await tempDir("dd-service-");
	const init = Bun.spawnSync(["git", "init", "-q"], { cwd: root });
	expect(init.exitCode).toBe(0);
	await put(root, "README.md", "# repo\n");
	await put(root, "src/f0.test.ts", source(999_999));
	for (let i = 0; i < count; i += 200) {
		await Promise.all(
			Array.from({ length: Math.min(200, count - i) }, (_, j) =>
				put(root, `src/f${i + j}.ts`, source(i + j)),
			),
		);
	}
	return root;
}

async function acquire(cwd: string): Promise<WorkspaceHandle> {
	const handle = await acquireWorkspace(cwd, options);
	handles.push(handle);
	return handle;
}

function nextStatus(
	handle: WorkspaceHandle,
	predicate: (status: WorkspaceStatus) => boolean,
): Promise<WorkspaceStatus> {
	const { promise, resolve } = Promise.withResolvers<WorkspaceStatus>();
	const off = handle.onStatus((status) => {
		if (predicate(status)) {
			off();
			resolve(status);
		}
	});
	return promise;
}

async function ready(handle: WorkspaceHandle): Promise<WorkspaceStatus> {
	const status = handle.status();
	if (status.state !== "indexing") return status;
	return nextStatus(handle, (s) => s.state !== "indexing");
}

/** Refresh and wait for the rescan's final status. */
async function rescan(handle: WorkspaceHandle): Promise<WorkspaceStatus> {
	const done = nextStatus(handle, (s) => s.state === "ready");
	handle.refresh();
	return done;
}

describe("detector service", () => {
	it("indexes the repository baseline", async () => {
		const root = await makeRepo(5);
		const handle = await acquire(path.join(root, "src"));
		expect(handle.root).toBe(root);
		const status = await ready(handle);
		expect(status.state).toBe("ready");
		expect(status.indexedFiles).toBe(5);
		expect(status.candidateFiles).toBe(5);
	});

	it("reports a new file that copies an existing function", async () => {
		const root = await makeRepo(5);
		const handle = await acquire(root);
		await ready(handle);
		await put(root, "src/copy.ts", source(3));
		const result = await handle.check({
			path: path.join(root, "src/copy.ts"),
			before: null,
		});
		expect(result.status).toBe("checked");
		if (result.status !== "checked") return;
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]!.region.file).toBe("src/copy.ts");
		expect(result.matches[0]!.other.file).toBe("src/f3.ts");
	});

	it("queues checks behind a running baseline", async () => {
		const root = await makeRepo(400);
		const handle = await acquire(root);
		expect(handle.status().state).toBe("indexing");
		const result = await handle.check({
			path: path.join(root, "src/late.ts"),
			before: null,
			after: source(399),
		});
		expect(handle.status().state).toBe("ready");
		expect(result.status).toBe("checked");
		if (result.status !== "checked") return;
		expect(result.matches.map((m) => m.other.file)).toEqual(["src/f399.ts"]);
	});

	it("reports a copy written during the baseline when the pre-image is unknown", async () => {
		const root = await makeRepo(1500);
		const handle = await acquire(root);
		expect(handle.status().state).toBe("indexing");
		// The baseline reads the file after it was written, as for a pruned edit.
		await put(root, "src/zz.ts", `${source(1500)}\n${source(7)}`);
		const result = await handle.check({ path: path.join(root, "src/zz.ts") });
		expect(result.status).toBe("checked");
		if (result.status !== "checked") return;
		expect(result.matches.map((m) => m.other.file)).toEqual(["src/f7.ts"]);
	}, 60_000);

	it("uses the move source as the pre-image of a moved file", async () => {
		const root = await makeRepo(5);
		await put(root, "src/dup.ts", source(3));
		const handle = await acquire(root);
		await ready(handle);
		await fs.rename(
			path.join(root, "src/dup.ts"),
			path.join(root, "src/moved.ts"),
		);
		const moved = handle.check({
			path: path.join(root, "src/moved.ts"),
			beforePath: path.join(root, "src/dup.ts"),
		});
		const gone = handle.check({ path: path.join(root, "src/dup.ts") });
		expect(await moved).toEqual({ status: "checked", matches: [] });
		expect(await gone).toEqual({ status: "skipped", reason: "deleted" });
	});

	it("keeps a file a check stored while a rescan raced it", async () => {
		const root = await makeRepo(400);
		// Tracked, so the rescan lists the file even while it is deleted.
		const add = Bun.spawnSync(["git", "add", "-A"], { cwd: root });
		expect(add.exitCode).toBe(0);
		const commit = Bun.spawnSync(
			[
				"git",
				"-c",
				"user.name=t",
				"-c",
				"user.email=t@t",
				"commit",
				"-qm",
				"init",
			],
			{ cwd: root },
		);
		expect(commit.exitCode).toBe(0);
		const handle = await acquire(root);
		await ready(handle);
		const target = path.join(root, "src/f99.ts");
		await fs.rm(target);
		const scanned = rescan(handle);
		await fs.writeFile(target, source(4242));
		const checked = await handle.check({
			path: target,
			before: null,
			after: source(4242),
		});
		expect(checked).toEqual({ status: "checked", matches: [] });
		await scanned;
		const copy = await handle.check({
			path: path.join(root, "src/copy.ts"),
			before: null,
			after: source(4242),
		});
		expect(copy.status).toBe("checked");
		if (copy.status !== "checked") return;
		expect(copy.matches.map((m) => m.other.file)).toEqual(["src/f99.ts"]);
	});

	it("re-reads a file changed on disk after a check stored the tool's text", async () => {
		const root = await makeRepo(5);
		const handle = await acquire(root);
		await ready(handle);
		const target = path.join(root, "src/f1.ts");
		// A formatter rewrote the file between the edit and its check.
		await fs.writeFile(target, source(5150));
		await handle.check({ path: target, before: source(1), after: source(1) });
		await rescan(handle);
		const copy = await handle.check({
			path: path.join(root, "src/copy.ts"),
			before: null,
			after: source(5150),
		});
		expect(copy.status).toBe("checked");
		if (copy.status !== "checked") return;
		expect(copy.matches.map((m) => m.other.file)).toEqual(["src/f1.ts"]);
	});

	it("drops files deleted out of band on refresh", async () => {
		const root = await makeRepo(5);
		const handle = await acquire(root);
		await ready(handle);
		await fs.rm(path.join(root, "src/f2.ts"));
		const status = await rescan(handle);
		expect(status.indexedFiles).toBe(4);
		const result = await handle.check({
			path: path.join(root, "src/again.ts"),
			before: null,
			after: source(2),
		});
		expect(result).toEqual({ status: "checked", matches: [] });
	});

	it("never indexes an untracked build directory and rescans fast after it is removed", async () => {
		const root = await makeRepo(5);
		for (let i = 0; i < 3000; i += 250) {
			await Promise.all(
				Array.from({ length: 250 }, (_, j) =>
					put(root, `target/debug/deps/m${i + j}.rs`, `fn m${i + j}() {}\n`),
				),
			);
		}
		const handle = await acquire(root);
		const baseline = await ready(handle);
		expect(baseline.indexedFiles).toBe(5);

		await fs.rm(path.join(root, "target"), { recursive: true, force: true });
		const started = performance.now();
		const status = await rescan(handle);
		expect(performance.now() - started).toBeLessThan(2000);
		expect(status.indexedFiles).toBe(5);
	}, 60_000);

	it("shares one workspace between acquires of the same repository", async () => {
		const root = await makeRepo(3);
		const first = await acquire(root);
		const second = await acquire(path.join(root, "src"));
		expect(second.root).toBe(first.root);
		expect(detectorServiceStats().workspaces).toBe(1);
		await ready(first);
		const added = await first.check({
			path: path.join(root, "src/shared.ts"),
			before: null,
			after: source(77),
		});
		expect(added).toEqual({ status: "checked", matches: [] });
		const copy = await second.check({
			path: path.join(root, "src/shared-copy.ts"),
			before: null,
			after: source(77),
		});
		expect(copy.status).toBe("checked");
		if (copy.status !== "checked") return;
		expect(copy.matches.map((m) => m.other.file)).toEqual(["src/shared.ts"]);
	});

	it("terminates the worker when the last workspace is released", async () => {
		const root = await makeRepo(3);
		const first = await acquire(root);
		const second = await acquire(root);
		await ready(first);
		expect(detectorServiceStats().workerRunning).toBe(true);
		await first.release();
		expect(detectorServiceStats().workerRunning).toBe(true);
		await second.release();
		await second.release();
		expect(detectorServiceStats()).toEqual({
			workerRunning: false,
			workspaces: 0,
		});
		await expect(
			first.check({ path: path.join(root, "src/f1.ts") }),
		).rejects.toThrow("released");
	});

	it("skips checks outside a git repository", async () => {
		const dir = await tempDir("dd-service-nogit-");
		await put(dir, "a.ts", source(1));
		const handle = await acquire(dir);
		expect(handle.root).toBe(dir);
		expect(handle.status().state).toBe("unavailable");
		expect(
			await handle.check({ path: path.join(dir, "a.ts"), before: null }),
		).toEqual({ status: "skipped", reason: "unavailable" });
	});

	it("skips ignored, unsupported, outside, and missing paths", async () => {
		const root = await makeRepo(2);
		const handle = await acquire(root);
		await ready(handle);
		const check = (rel: string) =>
			handle.check({ path: path.join(root, rel), before: null });
		expect(await check("src/f0.test.ts")).toEqual({
			status: "skipped",
			reason: "ignored",
		});
		expect(await check("README.md")).toEqual({
			status: "skipped",
			reason: "unsupported-format",
		});
		expect(await check("../elsewhere.ts")).toEqual({
			status: "skipped",
			reason: "outside-workspace",
		});
		expect(await check("src/missing.ts")).toEqual({
			status: "skipped",
			reason: "deleted",
		});
	});

	it("fails workspaces when the worker dies and reopens them on refresh", async () => {
		const root = await makeRepo(3);
		const NativeWorker = globalThis.Worker;
		const spawned: Worker[] = [];
		globalThis.Worker = class extends NativeWorker {
			constructor(url: string | URL, init?: WorkerOptions) {
				super(url, init);
				spawned.push(this);
			}
		};
		try {
			const handle = await acquire(root);
			await ready(handle);
			expect(spawned).toHaveLength(1);

			const failed = nextStatus(handle, (s) => s.state === "failed");
			spawned[0]!.terminate();
			expect((await failed).message).toContain("worker");
			expect(
				await handle.check({ path: path.join(root, "src/f1.ts") }),
			).toEqual({ status: "skipped", reason: "unavailable" });

			const reopened = nextStatus(handle, (s) => s.state === "ready");
			handle.refresh();
			expect((await reopened).indexedFiles).toBe(3);
			expect(spawned).toHaveLength(2);
			const copy = await handle.check({
				path: path.join(root, "src/copy.ts"),
				before: null,
				after: source(1),
			});
			expect(copy.status).toBe("checked");
		} finally {
			globalThis.Worker = NativeWorker;
		}
	});
});
