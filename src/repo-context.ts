import * as crypto from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execGit } from "./jscpd-engine";

export interface RepositoryContext {
	/** Canonical absolute workspace root (used for file enumeration and relative path calculation) */
	workspaceRoot: string;
	/** Whether the workspace is inside a Git repository */
	isGit: boolean;
	/** Canonical absolute .git directory */
	gitDir?: string;
	/** Canonical absolute common .git directory */
	commonGitDir?: string;
	/** Canonical absolute object directory defining the repository storage identity */
	repositoryObjectDir: string;
	/** 16-hex deterministic hash of the repository identity (used for cache DB & project state keying) */
	repositoryKey: string;
	/** Whether this workspace is an Oh My Pi isolated CoW worktree */
	isOmpIsolation: boolean;
}

/**
 * Normalizes a path by resolving symlinks if the target exists, falling back to path.resolve.
 */
export function canonicalizePath(targetPath: string): string {
	const resolved = path.resolve(targetPath);
	let current = resolved;
	let suffix = "";
	while (current && current !== path.dirname(current)) {
		try {
			if (fsSync.existsSync(current)) {
				const real = fsSync.realpathSync(current);
				return suffix ? path.join(real, suffix) : real;
			}
		} catch {
			// Fall back to walking up
		}
		suffix = suffix
			? path.join(path.basename(current), suffix)
			: path.basename(current);
		current = path.dirname(current);
	}
	return resolved;
}

/**
 * Checks if a path is located inside an Oh My Pi worktree hierarchy (~/.omp/wt/...).
 */
export function isOmpWorktreePath(targetPath: string): boolean {
	const normalized = targetPath.replace(/\\/g, "/");
	return (
		normalized.includes("/.omp/wt/") || normalized.includes("/.omp/worktrees/")
	);
}

/**
 * Resolves repository context for a workspace directory.
 * Separates workspaceRoot (file scanning and relative paths) from repositoryIdentity (cache DB keying).
 */
export async function resolveRepositoryContext(
	cwd: string,
	signal?: AbortSignal,
): Promise<RepositoryContext> {
	const canonicalCwd = canonicalizePath(cwd);

	try {
		// Query Git for toplevel, git-dir, and git-common-dir in a single batch
		const { stdout } = await execGit(
			[
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel",
				"--git-dir",
				"--git-common-dir",
			],
			canonicalCwd,
			{ signal },
		);

		const lines = stdout
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);

		const resolveEntry = (val?: string): string => {
			if (!val) return "";
			return path.isAbsolute(val) ? val : path.resolve(canonicalCwd, val);
		};

		const workspaceRoot = canonicalizePath(resolveEntry(lines[0]));
		const gitDir = canonicalizePath(
			resolveEntry(lines[1] || path.join(workspaceRoot, ".git")),
		);
		const commonGitDir = canonicalizePath(
			resolveEntry(lines[2] || lines[1] || path.join(workspaceRoot, ".git")),
		);

		let repositoryObjectDir = path.join(commonGitDir, "objects");
		const isOmpIsolation =
			isOmpWorktreePath(workspaceRoot) || isOmpWorktreePath(canonicalCwd);

		// Check for detached CoW worktrees (e.g. oh-my-pi pi-iso detachGitDir)
		// Only replace object store identity when positively identified as an Oh My Pi CoW worktree
		if (isOmpIsolation && gitDir === commonGitDir) {
			const alternatesFile = path.join(gitDir, "objects", "info", "alternates");
			try {
				if (fsSync.existsSync(alternatesFile)) {
					const content = await fs.readFile(alternatesFile, "utf-8");
					const altLines = content
						.split("\n")
						.map((l) => l.trim())
						.filter((l) => l && !l.startsWith("#"));

					for (const line of altLines) {
						// Git alternates paths are relative to the object directory ($GIT_DIR/objects)
						const resolvedAlt = path.isAbsolute(line)
							? line
							: path.resolve(path.join(gitDir, "objects"), line);

						const canonicalAlt = canonicalizePath(resolvedAlt);
						if (fsSync.existsSync(canonicalAlt)) {
							repositoryObjectDir = canonicalAlt;
							break;
						}
					}
				}
			} catch {
				// Fail open to standard commonGitDir objects
			}
		}

		repositoryObjectDir = canonicalizePath(repositoryObjectDir);
		const repositoryKey = crypto
			.createHash("sha256")
			.update(`git-object-dir\0${repositoryObjectDir}`)
			.digest("hex")
			.slice(0, 16);

		return {
			workspaceRoot,
			isGit: true,
			gitDir,
			commonGitDir,
			repositoryObjectDir,
			repositoryKey,
			isOmpIsolation,
		};
	} catch {
		// Non-Git directory fallback
		const repositoryObjectDir = path.join(canonicalCwd, ".non-git");
		const repositoryKey = crypto
			.createHash("sha256")
			.update(`directory\0${canonicalCwd}`)
			.digest("hex")
			.slice(0, 16);

		return {
			workspaceRoot: canonicalCwd,
			isGit: false,
			repositoryObjectDir,
			repositoryKey,
			isOmpIsolation: false,
		};
	}
}
