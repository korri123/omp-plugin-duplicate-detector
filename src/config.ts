/**
 * Effective configuration for one session: detector options (shared with the
 * worker) plus extension-only settings. Sources, lowest → highest precedence:
 * built-in defaults, the project's jscpd config, omp plugin settings
 * (`~/.omp/plugins/omp-plugins.lock.json` merged with project
 * `plugin-overrides.json`). Pattern lists are unioned across sources; every
 * value is validated and clamped here and nowhere else.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import JSON5 from "json5";
import YAML from "yaml";
import type { DetectorOptions } from "./types";

export const PLUGIN_NAME = "omp-plugin-duplicate-detector";

type ReminderMode = "steer" | "in-band";

interface ExtensionSettings {
	/** `steer`: warning card + model message; `in-band`: `additionalContext` on the tool result. */
	reminderMode: ReminderMode;
}

export interface ResolvedConfig {
	options: DetectorOptions;
	settings: ExtensionSettings;
	/** jscpd config file that contributed, when one was found. */
	jscpdConfigPath?: string;
}

export interface ConfigLogger {
	warn(message: string, context?: Record<string, unknown>): void;
}

const DEFAULT_OPTIONS: Readonly<DetectorOptions> = Object.freeze({
	minTokens: 40,
	minLines: 5,
	ignorePatterns: [],
	ignoreTests: true,
	customTestPatterns: [],
	excludeTestPatterns: [],
	maxIndexedFiles: 10_000,
});

const DEFAULT_SETTINGS: Readonly<ExtensionSettings> = Object.freeze({
	reminderMode: "steer",
});

const LIMITS = {
	minTokens: { min: 10, max: 10_000 },
	minLines: { min: 1, max: 1_000 },
	maxIndexedFiles: { min: 1, max: 1_000_000 },
} as const;

/** jscpd config candidates in jscpd's lookup order. */
const JSCPD_CONFIG_CANDIDATES = [
	".jscpd.json",
	".jscpd.rc.json",
	".jscpd.rc",
	".jscpd.rc.yaml",
	".jscpd.rc.yml",
	".jscpd.yaml",
	".jscpd.yml",
	path.join(".config", ".jscpd.json"),
	path.join(".config", "jscpd.json"),
	"package.json",
];

/** One config source, after per-key parsing but before merging/clamping. */
interface ConfigLayer {
	minTokens?: number;
	minLines?: number;
	maxIndexedFiles?: number;
	ignoreTests?: boolean;
	ignorePatterns?: string[];
	customTestPatterns?: string[];
	excludeTestPatterns?: string[];
	formatsExts?: Record<string, string[]>;
	reminderMode?: ReminderMode;
}

type Raw = Record<string, unknown>;

/**
 * Splits a comma-separated pattern list, keeping commas inside `{…}` brace
 * groups (`src/**\/*.{ts,tsx}` stays one pattern).
 */
export function splitPatternList(value: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (ch === "{") depth++;
		else if (ch === "}" && depth > 0) depth--;
		else if (ch === "," && depth === 0) {
			out.push(value.slice(start, i));
			start = i + 1;
		}
	}
	out.push(value.slice(start));
	return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function pick(raw: Raw, keys: readonly string[]): unknown {
	for (const key of keys) {
		if (raw[key] !== undefined && raw[key] !== null) return raw[key];
	}
	return undefined;
}

class LayerReader {
	constructor(
		readonly raw: Raw,
		readonly source: string,
		readonly logger: ConfigLogger,
	) {}

	#invalid(key: string, value: unknown, expected: string): undefined {
		this.logger.warn("duplicate-detector: ignoring invalid config value", {
			source: this.source,
			key,
			value: String(value),
			expected,
		});
		return undefined;
	}

	number(keys: readonly string[]): number | undefined {
		const value = pick(this.raw, keys);
		if (value === undefined) return undefined;
		const n =
			typeof value === "number"
				? value
				: typeof value === "string"
					? Number(value.trim())
					: Number.NaN;
		if (
			!Number.isFinite(n) ||
			(typeof value === "string" && value.trim() === "")
		) {
			return this.#invalid(keys[0] as string, value, "number");
		}
		return Math.floor(n);
	}

	boolean(keys: readonly string[]): boolean | undefined {
		const value = pick(this.raw, keys);
		if (value === undefined) return undefined;
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const lowered = value.trim().toLowerCase();
			if (lowered === "true") return true;
			if (lowered === "false") return false;
		}
		return this.#invalid(keys[0] as string, value, "boolean");
	}

	patterns(keys: readonly string[]): string[] | undefined {
		const value = pick(this.raw, keys);
		if (value === undefined) return undefined;
		if (typeof value === "string") return splitPatternList(value);
		if (Array.isArray(value)) {
			const out: string[] = [];
			for (const item of value) {
				if (typeof item !== "string") {
					this.#invalid(keys[0] as string, item, "string pattern");
					continue;
				}
				const trimmed = item.trim();
				if (trimmed) out.push(trimmed);
			}
			return out;
		}
		return this.#invalid(keys[0] as string, value, "string or string[]");
	}

	formatsExts(keys: readonly string[]): Record<string, string[]> | undefined {
		const value = pick(this.raw, keys);
		if (value === undefined) return undefined;
		if (typeof value !== "object" || Array.isArray(value)) {
			return this.#invalid(
				keys[0] as string,
				value,
				"object of format → extensions",
			);
		}
		const out: Record<string, string[]> = {};
		for (const [format, exts] of Object.entries(value as Raw)) {
			const list =
				typeof exts === "string"
					? exts.split(",")
					: Array.isArray(exts)
						? exts
						: undefined;
			if (!list) {
				this.#invalid(`${keys[0]}.${format}`, exts, "string or string[]");
				continue;
			}
			const cleaned = list
				.filter((e): e is string => typeof e === "string")
				.map((e) => e.trim().replace(/^\./, ""))
				.filter(Boolean);
			if (cleaned.length > 0) out[format] = cleaned;
		}
		return Object.keys(out).length > 0 ? out : undefined;
	}

	reminderMode(keys: readonly string[]): ReminderMode | undefined {
		const value = pick(this.raw, keys);
		if (value === undefined) return undefined;
		if (value === "steer" || value === "in-band") return value;
		return this.#invalid(keys[0] as string, value, `"steer" | "in-band"`);
	}
}

/** jscpd project config keys (camelCase, kebab-case, snake_case). */
function readJscpdLayer(
	raw: Raw,
	source: string,
	logger: ConfigLogger,
): ConfigLayer {
	const r = new LayerReader(raw, source, logger);
	return {
		minLines: r.number(["minLines", "min-lines", "min_lines"]),
		minTokens: r.number(["minTokens", "min-tokens", "min_tokens"]),
		maxIndexedFiles: r.number([
			"maxIndexedFiles",
			"max-indexed-files",
			"max_indexed_files",
		]),
		ignorePatterns: r.patterns([
			"ignore",
			"ignorePatterns",
			"ignore-patterns",
			"ignore-pattern",
		]),
		formatsExts: r.formatsExts(["formatsExts", "formats-exts", "formats_exts"]),
		ignoreTests: r.boolean(["ignoreTests", "ignore-tests", "ignore_tests"]),
		customTestPatterns: r.patterns([
			"customTestPatterns",
			"custom-test-patterns",
			"custom_test_patterns",
			"testPatterns",
			"test-patterns",
			"test_patterns",
		]),
		excludeTestPatterns: r.patterns([
			"excludeTestPatterns",
			"exclude-test-patterns",
			"exclude_test_patterns",
		]),
	};
}

/** omp plugin settings (keys from package.json `omp.settings`). */
function readPluginLayer(raw: Raw, logger: ConfigLogger): ConfigLayer {
	const r = new LayerReader(raw, "plugin settings", logger);
	return {
		minLines: r.number(["minLines"]),
		minTokens: r.number(["minTokens"]),
		maxIndexedFiles: r.number(["maxIndexedFiles"]),
		ignorePatterns: r.patterns(["ignorePatterns"]),
		ignoreTests: r.boolean(["ignoreTests"]),
		customTestPatterns: r.patterns(["customTestPatterns"]),
		excludeTestPatterns: r.patterns(["excludeTestPatterns"]),
		reminderMode: r.reminderMode(["reminderMode"]),
	};
}

function isRecord(value: unknown): value is Raw {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfigText(content: string, fileName: string): unknown {
	if (!content.trim()) return null;
	if (fileName.endsWith(".yaml") || fileName.endsWith(".yml"))
		return YAML.parse(content);
	if (fileName === ".jscpd.rc") {
		try {
			return JSON5.parse(content);
		} catch {
			return YAML.parse(content);
		}
	}
	return JSON5.parse(content);
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch (err) {
		if (
			(err as NodeJS.ErrnoException).code === "ENOENT" ||
			(err as NodeJS.ErrnoException).code === "ENOTDIR"
		) {
			return undefined;
		}
		throw err;
	}
}

/**
 * First jscpd config found in `dir` (jscpd lookup order). Malformed or
 * unreadable candidates are reported and skipped.
 */
async function findJscpdConfigIn(
	dir: string,
	logger: ConfigLogger,
): Promise<{ path: string; raw: Raw } | undefined> {
	for (const candidate of JSCPD_CONFIG_CANDIDATES) {
		const fullPath = path.join(dir, candidate);
		const fileName = path.basename(candidate);
		let content: string | undefined;
		let parsed: unknown;
		try {
			content = await readTextIfExists(fullPath);
			if (content === undefined) continue;
			parsed = parseConfigText(content, fileName);
		} catch (err) {
			logger.warn(
				"duplicate-detector: failed to read jscpd config, ignoring it",
				{
					path: fullPath,
					error: err instanceof Error ? err.message : String(err),
				},
			);
			continue;
		}
		if (fileName === "package.json") {
			if (isRecord(parsed) && parsed.jscpd !== undefined) {
				if (isRecord(parsed.jscpd))
					return { path: `${fullPath}#jscpd`, raw: parsed.jscpd };
				logger.warn(
					"duplicate-detector: package.json#jscpd is not an object, ignoring it",
					{ path: fullPath },
				);
			}
			continue;
		}
		if (isRecord(parsed)) return { path: fullPath, raw: parsed };
		if (parsed !== null) {
			logger.warn(
				"duplicate-detector: jscpd config is not an object, ignoring it",
				{ path: fullPath },
			);
		}
	}
	return undefined;
}

/** Looks for a jscpd config from `cwd` up to `root` (inclusive); first hit wins. */
async function findJscpdConfig(
	cwd: string,
	root: string,
	logger: ConfigLogger,
): Promise<{ path: string; raw: Raw; dir: string } | undefined> {
	const top = path.resolve(root);
	let dir = path.resolve(cwd);
	const rel = path.relative(top, dir);
	if (rel.startsWith("..") || path.isAbsolute(rel)) dir = top;
	for (;;) {
		const found = await findJscpdConfigIn(dir, logger);
		if (found) return { ...found, dir };
		if (dir === top) return undefined;
		const parent = path.dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

function clampInt(value: number, limits: { min: number; max: number }): number {
	return Math.min(limits.max, Math.max(limits.min, Math.floor(value)));
}

function unionInto(target: string[], values: string[] | undefined): void {
	if (!values) return;
	for (const value of values) if (!target.includes(value)) target.push(value);
}

/** Merges layers (lowest precedence first) over the defaults and clamps. */
function mergeLayers(layers: readonly ConfigLayer[]): {
	options: DetectorOptions;
	settings: ExtensionSettings;
} {
	const options: DetectorOptions = {
		...DEFAULT_OPTIONS,
		ignorePatterns: [],
		customTestPatterns: [],
		excludeTestPatterns: [],
	};
	const settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
	for (const layer of layers) {
		if (layer.minTokens !== undefined) options.minTokens = layer.minTokens;
		if (layer.minLines !== undefined) options.minLines = layer.minLines;
		if (layer.maxIndexedFiles !== undefined)
			options.maxIndexedFiles = layer.maxIndexedFiles;
		if (layer.ignoreTests !== undefined)
			options.ignoreTests = layer.ignoreTests;
		if (layer.formatsExts !== undefined)
			options.formatsExts = { ...options.formatsExts, ...layer.formatsExts };
		if (layer.reminderMode !== undefined)
			settings.reminderMode = layer.reminderMode;
		unionInto(options.ignorePatterns, layer.ignorePatterns);
		unionInto(options.customTestPatterns, layer.customTestPatterns);
		unionInto(options.excludeTestPatterns, layer.excludeTestPatterns);
	}
	options.minTokens = clampInt(options.minTokens, LIMITS.minTokens);
	options.minLines = clampInt(options.minLines, LIMITS.minLines);
	options.maxIndexedFiles = clampInt(
		options.maxIndexedFiles,
		LIMITS.maxIndexedFiles,
	);
	return { options, settings };
}

export interface ResolveConfigInput {
	/** Session cwd; jscpd config lookup starts here. */
	cwd: string;
	/** Workspace root (git toplevel, or cwd outside git); lookup stops here. */
	root: string;
	/** Merged omp plugin settings for this plugin (`getPluginSettings` from the omp plugin loader). */
	pluginSettings: Record<string, unknown>;
	logger: ConfigLogger;
}

/**
 * Rebases a gitignore-style pattern written relative to `prefix` (repo-relative
 * POSIX dir) onto the repo root: patterns with a non-trailing slash are anchored
 * to `prefix`; slash-free patterns match at any depth below it.
 */
function rebasePattern(pattern: string, prefix: string): string {
	if (pattern === "" || pattern.startsWith("#")) return pattern;
	if (pattern.startsWith("!"))
		return `!${rebasePattern(pattern.slice(1), prefix)}`;
	const body = pattern.replace(/\/+$/, "");
	if (body.includes("/")) return `${prefix}/${pattern.replace(/^\/+/, "")}`;
	return `${prefix}/**/${pattern}`;
}

function rebaseLayer(layer: ConfigLayer, prefix: string): ConfigLayer {
	const rebase = (patterns: string[] | undefined): string[] | undefined =>
		patterns?.map((pattern) => rebasePattern(pattern, prefix));
	return {
		...layer,
		ignorePatterns: rebase(layer.ignorePatterns),
		customTestPatterns: rebase(layer.customTestPatterns),
		excludeTestPatterns: rebase(layer.excludeTestPatterns),
	};
}

export async function resolveConfig(
	input: ResolveConfigInput,
): Promise<ResolvedConfig> {
	const jscpd = await findJscpdConfig(input.cwd, input.root, input.logger);
	const layers: ConfigLayer[] = [];
	if (jscpd) {
		const layer = readJscpdLayer(jscpd.raw, jscpd.path, input.logger);
		const prefix = path
			.relative(path.resolve(input.root), jscpd.dir)
			.split(path.sep)
			.join("/");
		layers.push(prefix ? rebaseLayer(layer, prefix) : layer);
	}
	layers.push(readPluginLayer(input.pluginSettings, input.logger));
	const merged = mergeLayers(layers);
	return jscpd ? { ...merged, jscpdConfigPath: jscpd.path } : merged;
}
