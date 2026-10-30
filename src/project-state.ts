/**
 * `/duplicates on|off` persistence: one JSON file shared by every repo,
 * `<cache>/omp/duplicate-detector/projects.json`, keyed by repository
 * identity (git common dir; see {@link resolveProjectIdentity}), canonical
 * cwd outside git. Writes are atomic (temp file + rename); a
 * corrupt file is reported, read as empty, and moved aside (never silently
 * clobbered) before the next write.
 */
import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

interface ProjectStateEntry {
	enabled: boolean;
	updatedAt?: string;
	displayPath?: string;
}

interface ProjectsStateFile {
	version: 1;
	projects: Record<string, ProjectStateEntry>;
}

interface ProjectStateLogger {
	warn(message: string, context?: Record<string, unknown>): void;
}

export interface ProjectStateOptions {
	/** Defaults to {@link getCacheDir}. */
	cacheDir?: string;
	logger?: ProjectStateLogger;
}

const PROJECTS_FILE = "projects.json";
const GIT_TIMEOUT_MS = 5_000;

/** `$XDG_CACHE_HOME/omp/duplicate-detector`, else `~/.cache/omp/duplicate-detector` (`%LOCALAPPDATA%` on Windows). */
function getCacheDir(): string {
	if (process.platform === "win32") {
		const base =
			process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
		return path.join(base, "omp", "duplicate-detector");
	}
	const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
	return path.join(base, "omp", "duplicate-detector");
}

async function realpathOr(target: string): Promise<string> {
	try {
		return await fs.realpath(target);
	} catch {
		return path.resolve(target);
	}
}

interface ProjectIdentity {
	/**
	 * Repository identity: canonical git common dir, so linked worktrees share
	 * it and omp task isolations map back to their source repo; canonical cwd
	 * outside git.
	 */
	key: string;
	/** Key written by plugin versions ≤ 0.3 (hash of the object dir / directory), read for migration. */
	legacyKey: string;
	/** Canonical git toplevel of `cwd` (canonical cwd outside git). */
	root: string;
}

async function git(cwd: string, args: string[]): Promise<string | undefined> {
	try {
		const proc = Bun.spawn(["git", ...args], {
			cwd,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "ignore",
			timeout: GIT_TIMEOUT_MS,
		});
		const [stdout, code] = await Promise.all([
			new Response(proc.stdout).text(),
			proc.exited,
		]);
		return code === 0 ? stdout : undefined;
	} catch {
		return undefined;
	}
}

/**
 * omp task isolation (CoW/rcopy copy + `detachGitDir`) leaves a standalone
 * repo whose `objects/info/alternates` starts with the source repo's
 * `<common-dir>/objects`. Returns that source common dir, if this repo is one.
 */
async function alternateSourceCommonDir(
	commonDir: string,
): Promise<string | undefined> {
	const objectsDir = path.join(commonDir, "objects");
	let text: string;
	try {
		text = await fs.readFile(
			path.join(objectsDir, "info", "alternates"),
			"utf8",
		);
	} catch {
		return undefined;
	}
	const first = text
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !line.startsWith("#"));
	if (!first) return undefined;
	const alternate = await realpathOr(path.resolve(objectsDir, first));
	if (path.basename(alternate) !== "objects") return undefined;
	const sourceCommonDir = path.dirname(alternate);
	// Only a real repository's object store (not a bare object cache) names a source repo.
	try {
		await fs.access(path.join(sourceCommonDir, "HEAD"));
	} catch {
		return undefined;
	}
	return sourceCommonDir === commonDir ? undefined : sourceCommonDir;
}

async function resolveProjectIdentity(cwd: string): Promise<ProjectIdentity> {
	const canonicalCwd = await realpathOr(cwd);
	const stdout = await git(canonicalCwd, [
		"rev-parse",
		"--path-format=absolute",
		"--show-toplevel",
		"--git-dir",
		"--git-common-dir",
	]);
	const [toplevel, gitDir, commonDir] = (stdout ?? "")
		.split("\n")
		.map((line) => line.trim());
	if (!toplevel || !gitDir || !commonDir) {
		return {
			key: canonicalCwd,
			legacyKey: sha16(`directory\0${canonicalCwd}`),
			root: canonicalCwd,
		};
	}
	const [root, canonicalGitDir, canonicalCommonDir] = await Promise.all([
		realpathOr(toplevel),
		realpathOr(gitDir),
		realpathOr(commonDir),
	]);
	// Linked worktrees already resolve to the shared common dir; only standalone repos can be isolation copies.
	const source =
		canonicalGitDir === canonicalCommonDir
			? await alternateSourceCommonDir(canonicalCommonDir)
			: undefined;
	const key = source ?? canonicalCommonDir;
	return {
		key,
		legacyKey: sha16(`git-object-dir\0${path.join(key, "objects")}`),
		root,
	};
}

function sha16(input: string): string {
	return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/** Canonical git toplevel containing `cwd`, or canonical `cwd` outside git. */
export async function resolveProjectRoot(cwd: string): Promise<string> {
	return (await resolveProjectIdentity(cwd)).root;
}

type LoadResult = { state: ProjectsStateFile; corrupt: boolean };

function parseState(text: string): ProjectsStateFile | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null || !("projects" in parsed))
		return undefined;
	const projects = parsed.projects;
	if (
		typeof projects !== "object" ||
		projects === null ||
		Array.isArray(projects)
	)
		return undefined;
	const out: Record<string, ProjectStateEntry> = {};
	for (const [key, entry] of Object.entries(projects)) {
		if (
			typeof entry === "object" &&
			entry !== null &&
			typeof entry.enabled === "boolean"
		) {
			out[key] = entry as ProjectStateEntry;
		}
	}
	return { version: 1, projects: out };
}

async function loadState(
	filePath: string,
	logger: ProjectStateLogger | undefined,
): Promise<LoadResult> {
	let text: string;
	try {
		text = await fs.readFile(filePath, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			logger?.warn(
				"duplicate-detector: cannot read project state, treating as empty",
				{
					path: filePath,
					error: err instanceof Error ? err.message : String(err),
				},
			);
		}
		return { state: { version: 1, projects: {} }, corrupt: false };
	}
	const state = parseState(text);
	if (state) return { state, corrupt: false };
	logger?.warn(
		"duplicate-detector: project state file is corrupt, treating as empty",
		{ path: filePath },
	);
	return { state: { version: 1, projects: {} }, corrupt: true };
}

async function writeStateAtomic(
	filePath: string,
	state: ProjectsStateFile,
): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	try {
		await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
		await fs.rename(tempPath, filePath);
	} catch (err) {
		await fs.rm(tempPath, { force: true }).catch(() => {});
		throw err;
	}
}

/** Whether detection is enabled for the project containing `cwd`. Unknown projects default to enabled. */
export async function isProjectEnabled(
	cwd: string,
	options: ProjectStateOptions = {},
): Promise<boolean> {
	const filePath = path.join(options.cacheDir ?? getCacheDir(), PROJECTS_FILE);
	const [identity, { state }] = await Promise.all([
		resolveProjectIdentity(cwd),
		loadState(filePath, options.logger),
	]);
	const entry =
		state.projects[identity.key] ?? state.projects[identity.legacyKey];
	return entry?.enabled ?? true;
}

/**
 * Persists the enabled flag for the project containing `cwd`. A corrupt state
 * file is renamed to `projects.json.corrupt-<timestamp>` first. Throws when
 * the file cannot be written.
 */
export async function setProjectEnabled(
	cwd: string,
	enabled: boolean,
	options: ProjectStateOptions = {},
): Promise<void> {
	const filePath = path.join(options.cacheDir ?? getCacheDir(), PROJECTS_FILE);
	const identity = await resolveProjectIdentity(cwd);
	const { state, corrupt } = await loadState(filePath, options.logger);
	if (corrupt) {
		const backup = `${filePath}.corrupt-${Date.now()}`;
		await fs.rename(filePath, backup);
		options.logger?.warn(
			"duplicate-detector: moved corrupt project state aside",
			{ path: backup },
		);
	}
	delete state.projects[identity.legacyKey];
	state.projects[identity.key] = {
		enabled,
		updatedAt: new Date().toISOString(),
		displayPath: identity.root,
	};
	await writeStateAtomic(filePath, state);
}

/** SQLite token caches written by plugin 0.2–0.3 (`<repo>_<fp>_v<n>.sqlite` plus WAL/SHM). */
const LEGACY_CACHE_FILE = /\.(sqlite|sqlite-wal|sqlite-shm)$/;
/** Pre-SQLite shard directories (`<workspaceHash>_<configFingerprint>/`, 16 hex digits each). */
const LEGACY_SHARD_DIR = /^[0-9a-f]{16}_[0-9a-f]{16}$/;

/**
 * Deletes token caches left by plugin versions ≤ 0.3 from the cache dir:
 * `*.sqlite*` files and `<hash>_<fingerprint>/` shard directories. Never
 * touches `projects.json` or anything else. Errors are ignored.
 */
export async function removeLegacyCacheFiles(
	cacheDir: string = getCacheDir(),
): Promise<void> {
	let entries: Dirent[];
	try {
		entries = await fs.readdir(cacheDir, { withFileTypes: true });
	} catch {
		return;
	}
	await Promise.all(
		entries
			.filter((entry) =>
				entry.isDirectory()
					? LEGACY_SHARD_DIR.test(entry.name)
					: entry.isFile() && LEGACY_CACHE_FILE.test(entry.name),
			)
			.map((entry) =>
				fs
					.rm(path.join(cacheDir, entry.name), { recursive: true, force: true })
					.catch(() => {}),
			),
	);
}
