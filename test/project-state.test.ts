import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	getProjectsStateFilePath,
	isProjectEnabled,
	loadProjectsState,
	normalizeProjectPath,
	saveProjectsState,
	setProjectEnabled,
} from "../src/project-state";

describe("Project State & Persistence", () => {
	let tempCacheDir: string;

	beforeEach(async () => {
		tempCacheDir = path.join(
			os.tmpdir(),
			`omp-dup-test-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await fs.mkdir(tempCacheDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(tempCacheDir, { recursive: true, force: true });
		} catch {}
	});

	describe("normalizeProjectPath", () => {
		it("normalizes relative paths and trailing slashes", () => {
			const p1 = normalizeProjectPath("./src/../src");
			const p2 = normalizeProjectPath("./src");
			expect(p1).toBe(p2);
		});

		it("returns canonical absolute path", () => {
			const cwd = process.cwd();
			expect(normalizeProjectPath(cwd)).toBe(path.resolve(cwd));
		});
	});

	describe("getProjectsStateFilePath", () => {
		it("returns projects.json in specified cache dir", () => {
			const filePath = getProjectsStateFilePath(tempCacheDir);
			expect(filePath).toBe(path.join(tempCacheDir, "projects.json"));
		});
	});

	describe("loadProjectsState and saveProjectsState", () => {
		it("returns empty default state when file does not exist", async () => {
			const state = await loadProjectsState(tempCacheDir);
			expect(state.version).toBe(1);
			expect(state.projects).toEqual({});
		});

		it("returns empty default state when file is corrupted JSON", async () => {
			const filePath = getProjectsStateFilePath(tempCacheDir);
			await Bun.write(filePath, "INVALID_JSON{{{{");
			const state = await loadProjectsState(tempCacheDir);
			expect(state.version).toBe(1);
			expect(state.projects).toEqual({});
		});

		it("returns empty default state when projects property is null or an array", async () => {
			const filePath = getProjectsStateFilePath(tempCacheDir);
			await Bun.write(filePath, JSON.stringify({ version: 1, projects: null }));
			let state = await loadProjectsState(tempCacheDir);
			expect(state.projects).toEqual({});

			await Bun.write(
				filePath,
				JSON.stringify({ version: 1, projects: ["/workspace/proj"] }),
			);
			state = await loadProjectsState(tempCacheDir);
			expect(state.projects).toEqual({});
		});
		it("saves and reloads project states accurately", async () => {
			const initialState = {
				version: 1,
				projects: {
					"/workspace/project-a": {
						enabled: false,
						updatedAt: "2026-08-24T00:00:00.000Z",
					},
					"/workspace/project-b": {
						enabled: true,
						updatedAt: "2026-08-24T01:00:00.000Z",
					},
				},
			};

			await saveProjectsState(initialState, tempCacheDir);
			const loaded = await loadProjectsState(tempCacheDir);

			expect(loaded.projects["/workspace/project-a"]?.enabled).toBe(false);
			expect(loaded.projects["/workspace/project-b"]?.enabled).toBe(true);
		});
	});

	describe("isProjectEnabled and setProjectEnabled", () => {
		it("defaults to true for unknown projects", async () => {
			const enabled = await isProjectEnabled(
				"/workspace/unknown-project",
				tempCacheDir,
			);
			expect(enabled).toBe(true);
		});

		it("toggles project to disabled and persists across reads", async () => {
			const projectDir = "/workspace/my-cool-project";
			await setProjectEnabled(projectDir, false, tempCacheDir);

			const isNowEnabled = await isProjectEnabled(projectDir, tempCacheDir);
			expect(isNowEnabled).toBe(false);

			// Verify file content on disk
			const state = await loadProjectsState(tempCacheDir);
			const normalized = normalizeProjectPath(projectDir);
			expect(state.projects[normalized]?.enabled).toBe(false);
			expect(state.projects[normalized]?.updatedAt).toBeDefined();
		});

		it("toggles project back to enabled", async () => {
			const projectDir = "/workspace/my-cool-project";
			await setProjectEnabled(projectDir, false, tempCacheDir);
			expect(await isProjectEnabled(projectDir, tempCacheDir)).toBe(false);

			await setProjectEnabled(projectDir, true, tempCacheDir);
			expect(await isProjectEnabled(projectDir, tempCacheDir)).toBe(true);
		});

		it("maintains independent state per project without cross-contamination", async () => {
			const proj1 = "/workspace/project-one";
			const proj2 = "/workspace/project-two";

			await setProjectEnabled(proj1, false, tempCacheDir);
			await setProjectEnabled(proj2, true, tempCacheDir);

			expect(await isProjectEnabled(proj1, tempCacheDir)).toBe(false);
			expect(await isProjectEnabled(proj2, tempCacheDir)).toBe(true);
		});
	});
});
