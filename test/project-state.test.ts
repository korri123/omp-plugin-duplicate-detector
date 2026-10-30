import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	isProjectEnabled,
	removeLegacyCacheFiles,
	resolveProjectRoot,
	setProjectEnabled,
} from "../src/project-state";

async function git(cwd: string, ...args: string[]): Promise<void> {
	const proc = Bun.spawn(["git", ...args], {
		cwd,
		stdout: "ignore",
		stderr: "ignore",
	});
	expect(await proc.exited).toBe(0);
}

describe("project state", () => {
	let dir: string;
	let cacheDir: string;
	let repo: string;
	const warnings: string[] = [];
	const logger = { warn: (message: string) => void warnings.push(message) };

	beforeEach(async () => {
		dir = await fs.realpath(
			await fs.mkdtemp(path.join(os.tmpdir(), "dd-state-")),
		);
		cacheDir = path.join(dir, "cache");
		repo = path.join(dir, "repo");
		await fs.mkdir(path.join(repo, "src"), { recursive: true });
		await git(repo, "init", "-q");
		warnings.length = 0;
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("defaults to enabled and persists per repository", async () => {
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(true);
		await setProjectEnabled(path.join(repo, "src"), false, {
			cacheDir,
			logger,
		});
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(false);

		const other = path.join(dir, "other");
		await fs.mkdir(other);
		expect(await isProjectEnabled(other, { cacheDir, logger })).toBe(true);

		const saved = JSON.parse(
			await fs.readFile(path.join(cacheDir, "projects.json"), "utf8"),
		);
		expect(saved.projects[path.join(repo, ".git")]).toMatchObject({
			enabled: false,
			displayPath: repo,
		});
		expect(
			(await fs.readdir(cacheDir)).filter((name) => name.endsWith(".tmp")),
		).toEqual([]);
	});

	it("shares the state with linked worktrees", async () => {
		await git(
			repo,
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"commit",
			"-q",
			"--allow-empty",
			"-m",
			"init",
		);
		const linked = path.join(dir, "linked");
		await git(repo, "worktree", "add", "-q", "--detach", linked);
		expect(await resolveProjectRoot(linked)).toBe(linked);

		await setProjectEnabled(linked, false, { cacheDir, logger });
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(false);
		await setProjectEnabled(repo, true, { cacheDir, logger });
		expect(await isProjectEnabled(linked, { cacheDir, logger })).toBe(true);
	});

	it("maps an omp task isolation (detached copy borrowing objects via alternates) to its source repo", async () => {
		// What omp's detachGitDir leaves behind: a fresh repo whose alternates name the source object store.
		const isolation = path.join(dir, "wt", "t1234", "m");
		await fs.mkdir(path.join(isolation, "src"), { recursive: true });
		await git(isolation, "init", "-q");
		await Bun.write(
			path.join(isolation, ".git", "objects", "info", "alternates"),
			`${path.join(repo, ".git", "objects")}\n`,
		);

		await setProjectEnabled(repo, false, { cacheDir, logger });
		expect(
			await isProjectEnabled(path.join(isolation, "src"), { cacheDir, logger }),
		).toBe(false);
		expect(await resolveProjectRoot(isolation)).toBe(isolation);
	});

	it("honors and migrates entries keyed by the legacy repository hash", async () => {
		const legacyKey = createHash("sha256")
			.update(`git-object-dir\0${path.join(repo, ".git", "objects")}`)
			.digest("hex")
			.slice(0, 16);
		const file = path.join(cacheDir, "projects.json");
		await Bun.write(
			file,
			JSON.stringify({
				version: 1,
				projects: { [legacyKey]: { enabled: false } },
			}),
		);
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(false);

		await setProjectEnabled(repo, false, { cacheDir, logger });
		const saved = JSON.parse(await fs.readFile(file, "utf8"));
		expect(Object.keys(saved.projects)).toEqual([path.join(repo, ".git")]);
	});

	it("keeps other projects' entries when writing", async () => {
		await Bun.write(
			path.join(cacheDir, "projects.json"),
			JSON.stringify({
				version: 1,
				projects: { "/elsewhere": { enabled: false } },
			}),
		);
		await setProjectEnabled(repo, false, { cacheDir, logger });
		expect(await isProjectEnabled("/elsewhere", { cacheDir, logger })).toBe(
			false,
		);
	});

	it("reads a corrupt file as empty without rewriting it, and moves it aside before writing", async () => {
		const file = path.join(cacheDir, "projects.json");
		await Bun.write(file, "{not json");
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(true);
		expect(await fs.readFile(file, "utf8")).toBe("{not json");
		expect(warnings.length).toBeGreaterThan(0);

		await setProjectEnabled(repo, false, { cacheDir, logger });
		const names = await fs.readdir(cacheDir);
		const backup = names.find((name) =>
			name.startsWith("projects.json.corrupt-"),
		);
		expect(backup).toBeDefined();
		expect(await fs.readFile(path.join(cacheDir, backup!), "utf8")).toBe(
			"{not json",
		);
		expect(await isProjectEnabled(repo, { cacheDir, logger })).toBe(false);
	});

	it("removes legacy caches (sqlite files, shard dirs) but keeps everything else", async () => {
		await fs.mkdir(cacheDir, { recursive: true });
		const shard = "0123456789abcdef_fedcba9876543210";
		for (const name of [
			"a_v3.sqlite",
			"a_v3.sqlite-wal",
			"a_v3.sqlite-shm",
			`${shard}/k1.bin`,
			`${shard}/k2.json`,
			"projects.json",
			"notes.txt",
			"keep_dir/x.bin",
		]) {
			await Bun.write(path.join(cacheDir, name), "x");
		}
		await removeLegacyCacheFiles(cacheDir);
		expect((await fs.readdir(cacheDir)).sort()).toEqual([
			"keep_dir",
			"notes.txt",
			"projects.json",
		]);
	});
});
