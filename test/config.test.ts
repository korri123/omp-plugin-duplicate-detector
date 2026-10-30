import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import ignore from "ignore";
import {
	type ConfigLogger,
	resolveConfig,
	splitPatternList,
} from "../src/config";

function recordingLogger(): ConfigLogger & {
	warnings: Array<{ message: string; context?: Record<string, unknown> }>;
} {
	const warnings: Array<{
		message: string;
		context?: Record<string, unknown>;
	}> = [];
	return {
		warnings,
		warn: (message, context) => warnings.push({ message, context }),
	};
}

describe("resolveConfig", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "dd-config-"));
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("uses defaults without any config source", async () => {
		const logger = recordingLogger();
		const config = await resolveConfig({
			cwd: dir,
			root: dir,
			pluginSettings: {},
			logger,
		});
		expect(config.options).toEqual({
			minTokens: 40,
			minLines: 5,
			ignorePatterns: [],
			ignoreTests: true,
			customTestPatterns: [],
			excludeTestPatterns: [],
			maxIndexedFiles: 10_000,
		});
		expect(config.settings.reminderMode).toBe("steer");
		expect(logger.warnings).toEqual([]);
	});

	it("applies defaults < jscpd file < plugin settings, unioning ignore patterns", async () => {
		await Bun.write(
			path.join(dir, ".jscpd.json"),
			JSON.stringify({
				minLines: 9,
				minTokens: 70,
				ignore: ["**/gen/**"],
				ignoreTests: false,
			}),
		);
		const config = await resolveConfig({
			cwd: dir,
			root: dir,
			pluginSettings: {
				minTokens: 120,
				ignorePatterns: "legacy/**",
				reminderMode: "in-band",
			},
			logger: recordingLogger(),
		});
		expect(config.options.minLines).toBe(9);
		expect(config.options.minTokens).toBe(120);
		expect(config.options.ignoreTests).toBe(false);
		expect(config.options.ignorePatterns).toEqual(["**/gen/**", "legacy/**"]);
		expect(config.settings.reminderMode).toBe("in-band");
		expect(config.jscpdConfigPath).toBe(path.join(dir, ".jscpd.json"));
	});

	it("reads package.json#jscpd and YAML configs, searching from cwd up to root", async () => {
		const sub = path.join(dir, "packages", "a");
		await fs.mkdir(sub, { recursive: true });
		await Bun.write(
			path.join(dir, ".jscpd.yml"),
			"minLines: 12\nignore:\n  - vendor/**\n",
		);
		let config = await resolveConfig({
			cwd: sub,
			root: dir,
			pluginSettings: {},
			logger: recordingLogger(),
		});
		expect(config.options.minLines).toBe(12);
		expect(config.options.ignorePatterns).toEqual(["vendor/**"]);

		await Bun.write(
			path.join(sub, "package.json"),
			JSON.stringify({ name: "a", jscpd: { minLines: 7 } }),
		);
		config = await resolveConfig({
			cwd: sub,
			root: dir,
			pluginSettings: {},
			logger: recordingLogger(),
		});
		expect(config.options.minLines).toBe(7);
	});

	it("rebases a nested config's patterns onto its directory", async () => {
		const sub = path.join(dir, "packages", "a");
		await Bun.write(
			path.join(sub, ".jscpd.json"),
			JSON.stringify({
				ignore: ["src/generated/**", "*.gen.ts", "!keep.gen.ts"],
				testPatterns: ["fixtures/**"],
			}),
		);
		const config = await resolveConfig({
			cwd: sub,
			root: dir,
			pluginSettings: {},
			logger: recordingLogger(),
		});
		const ignored = ignore().add(config.options.ignorePatterns);
		expect(ignored.ignores("packages/a/src/generated/x.ts")).toBe(true);
		expect(ignored.ignores("src/generated/x.ts")).toBe(false);
		expect(ignored.ignores("packages/a/lib/deep/y.gen.ts")).toBe(true);
		expect(ignored.ignores("other/y.gen.ts")).toBe(false);
		expect(ignored.ignores("packages/a/keep.gen.ts")).toBe(false);
		const tests = ignore().add(config.options.customTestPatterns);
		expect(tests.ignores("packages/a/fixtures/f.ts")).toBe(true);
		expect(tests.ignores("fixtures/f.ts")).toBe(false);
	});

	it("keeps brace-glob commas when splitting string patterns", async () => {
		const config = await resolveConfig({
			cwd: dir,
			root: dir,
			pluginSettings: {
				ignorePatterns: "src/**/*.{ts,tsx}, docs/** ,,fixtures/{a,b{c,d}}/**",
			},
			logger: recordingLogger(),
		});
		expect(config.options.ignorePatterns).toEqual([
			"src/**/*.{ts,tsx}",
			"docs/**",
			"fixtures/{a,b{c,d}}/**",
		]);
		expect(splitPatternList("a,{b,c}")).toEqual(["a", "{b,c}"]);
	});

	it("clamps out-of-range numbers and warns about invalid values", async () => {
		const logger = recordingLogger();
		const config = await resolveConfig({
			cwd: dir,
			root: dir,
			pluginSettings: {
				minTokens: 1,
				minLines: "0",
				maxIndexedFiles: 1e12,
				ignoreTests: "maybe",
				reminderMode: "none",
			},
			logger,
		});
		expect(config.options.minTokens).toBe(10);
		expect(config.options.minLines).toBe(1);
		expect(config.options.maxIndexedFiles).toBe(1_000_000);
		expect(config.options.ignoreTests).toBe(true);
		expect(config.settings.reminderMode).toBe("steer");
		expect(logger.warnings.map((w) => w.context?.key).sort()).toEqual([
			"ignoreTests",
			"reminderMode",
		]);
	});

	it("falls back to defaults and warns when the jscpd file is malformed", async () => {
		const file = path.join(dir, ".jscpd.json");
		await Bun.write(file, "{ minLines: 9,, ");
		const logger = recordingLogger();
		const config = await resolveConfig({
			cwd: dir,
			root: dir,
			pluginSettings: {},
			logger,
		});
		expect(config.options.minLines).toBe(5);
		expect(config.jscpdConfigPath).toBeUndefined();
		expect(logger.warnings).toHaveLength(1);
		expect(logger.warnings[0]?.context?.path).toBe(file);
	});
});
