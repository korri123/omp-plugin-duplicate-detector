import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	findProjectJscpdConfig,
	normalizeJscpdConfig,
	parseJsonConfig,
	parseYamlConfig,
} from "../src/config-loader";

describe("config-loader", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jscpd-config-test-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe("parseJsonConfig", () => {
		it("parses JSON with comments and trailing commas", () => {
			const json = `
			{
				// Settings
				"minLines": 7,
				"minTokens": 45, // inline
				"ignore": [
					"dist",
					"build",
				],
			}
			`;
			const parsed = parseJsonConfig(json) as Record<string, unknown>;
			expect(parsed).toBeDefined();
			expect(parsed.minLines).toBe(7);
			expect(parsed.minTokens).toBe(45);
			expect(parsed.ignore).toEqual(["dist", "build"]);
		});

		it("returns null for empty content", () => {
			expect(parseJsonConfig("   ")).toBeNull();
		});
	});

	describe("parseYamlConfig", () => {
		it("parses key-value pairs, comments, lists, and numbers", () => {
			const yaml = `
# jscpd configuration
min-lines: 7
min-tokens: 45
threshold: 2.5
ignore:
  - "**/dist/**"
  - "**/test/**"
formatsExts:
  typescript:
    - ts
    - tsx
`;
			const parsed = parseYamlConfig(yaml) as Record<string, unknown>;
			expect(parsed).toBeDefined();
			expect(parsed["min-lines"]).toBe(7);
			expect(parsed["min-tokens"]).toBe(45);
			expect(parsed.threshold).toBe(2.5);
			expect(Array.isArray(parsed.ignore)).toBe(true);
			expect((parsed.ignore as string[])[0]).toBe("**/dist/**");
			expect((parsed.ignore as string[])[1]).toBe("**/test/**");
			expect(parsed.formatsExts).toBeDefined();
			const formats = parsed.formatsExts as Record<string, string[]>;
			expect(formats.typescript).toEqual(["ts", "tsx"]);
		});

		it("parses inline array syntax", () => {
			const yaml = `
minLines: 8
ignore: ["dist", "build", "coverage"]
`;
			const parsed = parseYamlConfig(yaml) as Record<string, unknown>;
			expect(parsed.minLines).toBe(8);
			expect(parsed.ignore).toEqual(["dist", "build", "coverage"]);
		});
	});

	describe("normalizeJscpdConfig", () => {
		it("normalizes kebab-case and camelCase keys", () => {
			const normalized = normalizeJscpdConfig({
				"min-lines": 12,
				"min-tokens": 55,
				"max-lines": 400,
				"ignore-patterns": ["vendor/**", "build/**"],
				"formats-exts": {
					csharp: [".cs", ".csx"],
				},
				"cross-formats": true,
			});

			expect(normalized.minLines).toBe(12);
			expect(normalized.minTokens).toBe(55);
			expect(normalized.maxLines).toBe(400);
			expect(normalized.ignore).toEqual(["vendor/**", "build/**"]);
			expect(normalized.formatsExts).toEqual({ csharp: ["cs", "csx"] });
			expect(normalized.crossFormats).toBe(true);
		});

		it("handles comma-separated string ignore patterns", () => {
			const normalized = normalizeJscpdConfig({
				ignore: "dist/**, build/**, .cache/**",
			});
			expect(normalized.ignore).toEqual(["dist/**", "build/**", ".cache/**"]);
		});

		it("filters null and undefined items from sparse arrays without coercing to string 'null'", () => {
			const normalized = normalizeJscpdConfig({
				ignore: [
					"dist/**",
					null as unknown as string,
					undefined as unknown as string,
					"build/**",
				],
				formatsExts: {
					typescript: ["ts", null as unknown as string, "tsx"],
				},
			});
			expect(normalized.ignore).toEqual(["dist/**", "build/**"]);
			expect(normalized.formatsExts?.typescript).toEqual(["ts", "tsx"]);
		});
	});

	describe("findProjectJscpdConfig", () => {
		it("loads .jscpd.json from workspace root", async () => {
			const configContent = `{
				// Custom project clone settings
				"minLines": 15,
				"minTokens": 60,
				"ignore": ["**/generated/**"],
			}`;
			await Bun.write(path.join(tempDir, ".jscpd.json"), configContent);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).not.toBeNull();
			expect(config?.minLines).toBe(15);
			expect(config?.minTokens).toBe(60);
			expect(config?.ignore).toEqual(["**/generated/**"]);
			expect(config?.sourcePath).toBe(path.join(tempDir, ".jscpd.json"));
			expect(config?.sourceType).toBe("file");
		});

		it("loads package.json with jscpd field when .jscpd.json is absent", async () => {
			const pkgContent = JSON.stringify({
				name: "my-app",
				version: "1.0.0",
				jscpd: {
					minLines: 9,
					minTokens: 42,
					ignore: ["test/**"],
				},
			});
			await Bun.write(path.join(tempDir, "package.json"), pkgContent);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).not.toBeNull();
			expect(config?.minLines).toBe(9);
			expect(config?.minTokens).toBe(42);
			expect(config?.ignore).toEqual(["test/**"]);
			expect(config?.sourceType).toBe("package.json");
		});

		it("ignores package.json if jscpd field is an array or primitive", async () => {
			const pkgContent = JSON.stringify({
				name: "my-app",
				version: "1.0.0",
				jscpd: ["invalid", "array"],
			});
			await Bun.write(path.join(tempDir, "package.json"), pkgContent);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).toBeNull();
		});

		it("prefers .jscpd.json over package.json jscpd field", async () => {
			await Bun.write(
				path.join(tempDir, ".jscpd.json"),
				JSON.stringify({ minLines: 20, minTokens: 80 }),
			);
			await Bun.write(
				path.join(tempDir, "package.json"),
				JSON.stringify({ jscpd: { minLines: 5, minTokens: 30 } }),
			);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config?.minLines).toBe(20);
			expect(config?.minTokens).toBe(80);
			expect(config?.sourcePath).toBe(path.join(tempDir, ".jscpd.json"));
		});

		it("loads .jscpd.yaml configuration", async () => {
			const yamlContent = `
min-lines: 14
min-tokens: 70
ignore:
  - "generated/**"
  - "docs/**"
formatsExts:
  typescript:
    - tsx
    - ts
`;
			await Bun.write(path.join(tempDir, ".jscpd.yaml"), yamlContent);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).not.toBeNull();
			expect(config?.minLines).toBe(14);
			expect(config?.minTokens).toBe(70);
			expect(config?.ignore).toEqual(["generated/**", "docs/**"]);
			expect(config?.formatsExts).toEqual({ typescript: ["tsx", "ts"] });
		});

		it("loads .jscpd.rc.yaml configuration", async () => {
			const yamlContent = `
minLines: 18
minTokens: 85
`;
			await Bun.write(path.join(tempDir, ".jscpd.rc.yaml"), yamlContent);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).not.toBeNull();
			expect(config?.minLines).toBe(18);
			expect(config?.minTokens).toBe(85);
		});

		it("loads .config/.jscpd.json in subfolder", async () => {
			const configDir = path.join(tempDir, ".config");
			await fs.mkdir(configDir, { recursive: true });
			await Bun.write(
				path.join(configDir, ".jscpd.json"),
				JSON.stringify({ minLines: 11 }),
			);

			const config = await findProjectJscpdConfig(tempDir);
			expect(config).not.toBeNull();
			expect(config?.minLines).toBe(11);
		});

		it("returns null gracefully if no jscpd configuration exists", async () => {
			await Bun.write(
				path.join(tempDir, "package.json"),
				JSON.stringify({ name: "plain" }),
			);
			const config = await findProjectJscpdConfig(tempDir);
			expect(config).toBeNull();
		});

		it("tolerates corrupt configuration files gracefully without crashing", async () => {
			await Bun.write(
				path.join(tempDir, ".jscpd.json"),
				"{ invalid JSON content !!!",
			);
			const config = await findProjectJscpdConfig(tempDir);
			expect(config).toBeNull();
		});
	});
});
