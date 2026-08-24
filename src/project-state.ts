import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDefaultCacheDir } from "./disk-cache";

interface ProjectStateEntry {
	enabled: boolean;
	updatedAt?: string;
}

export interface ProjectsStateFile {
	version: number;
	projects: Record<string, ProjectStateEntry>;
}
/**
 * Normalizes a workspace project directory path to a canonical absolute path.
 */
export function normalizeProjectPath(projectDir: string): string {
	const resolved = path.resolve(projectDir);
	try {
		if (fsSync.existsSync(resolved)) {
			return fsSync.realpathSync(resolved);
		}
	} catch {
		// Fall back to resolved path
	}
	return resolved;
}

/**
 * Resolves the path to the persistent projects state JSON file.
 */
export function getProjectsStateFilePath(customCacheDir?: string): string {
	const baseDir = customCacheDir ?? getDefaultCacheDir();
	return path.join(baseDir, "projects.json");
}

/**
 * Loads the persistent projects state file from disk.
 * Returns default empty state if file does not exist or is corrupted.
 */
export async function loadProjectsState(
	customCacheDir?: string,
): Promise<ProjectsStateFile> {
	const filePath = getProjectsStateFilePath(customCacheDir);
	try {
		const file = Bun.file(filePath);
		if (!(await file.exists())) {
			return { version: 1, projects: {} };
		}
		const content = await file.text();
		const parsed = JSON.parse(content);
		if (
			parsed &&
			typeof parsed === "object" &&
			parsed.projects !== null &&
			typeof parsed.projects === "object" &&
			!Array.isArray(parsed.projects)
		) {
			return {
				version: typeof parsed.version === "number" ? parsed.version : 1,
				projects: parsed.projects,
			};
		}
		return { version: 1, projects: {} };
	} catch {
		return { version: 1, projects: {} };
	}
}

/**
 * Persists the projects state to disk atomically.
 */
export async function saveProjectsState(
	state: ProjectsStateFile,
	customCacheDir?: string,
): Promise<void> {
	const filePath = getProjectsStateFilePath(customCacheDir);
	const cacheDir = path.dirname(filePath);

	try {
		await fs.mkdir(cacheDir, { recursive: true });
		const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
		const payload = JSON.stringify(state, null, 2);
		await Bun.write(tempPath, payload);
		await fs.rename(tempPath, filePath);
	} catch {
		// Fallback direct write if atomic rename fails
		try {
			await Bun.write(filePath, JSON.stringify(state, null, 2));
		} catch {
			// Fail open
		}
	}
}

/**
 * Checks whether duplicate detection is enabled for a given project directory.
 * Defaults to true if no explicit setting has been configured for the project.
 */
export async function isProjectEnabled(
	projectDir: string,
	customCacheDir?: string,
): Promise<boolean> {
	const normalized = normalizeProjectPath(projectDir);
	const state = await loadProjectsState(customCacheDir);
	const entry = state.projects[normalized];
	if (entry && typeof entry.enabled === "boolean") {
		return entry.enabled;
	}
	return true;
}

/**
 * Sets whether duplicate detection is enabled or disabled for a given project directory.
 */
export async function setProjectEnabled(
	projectDir: string,
	enabled: boolean,
	customCacheDir?: string,
): Promise<void> {
	const normalized = normalizeProjectPath(projectDir);
	const state = await loadProjectsState(customCacheDir);
	state.projects[normalized] = {
		enabled,
		updatedAt: new Date().toISOString(),
	};
	await saveProjectsState(state, customCacheDir);
}
