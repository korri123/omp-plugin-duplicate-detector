import * as path from "node:path";
import JSON5 from "json5";
import YAML from "yaml";

export interface JscpdProjectConfig {
	sourcePath?: string;
	sourceType?: "file" | "package.json";
	minLines?: number;
	maxLines?: number;
	minTokens?: number;
	threshold?: number;
	ignore?: string[];
	formatsExts?: Record<string, string[]>;
	format?: string[];
	mode?: string;
	crossFormats?: boolean;
	gitignore?: boolean;
	maxIndexedFiles?: number;
	raw?: Record<string, unknown>;
}

/** Standard configuration file candidates in priority order */
export const JSCPD_CONFIG_CANDIDATES = [
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

/**
 * Parses JSON5 (supporting comments, trailing commas, unquoted keys).
 */
export function parseJsonConfig(content: string): unknown {
	const trimmed = content.trim();
	if (!trimmed) return null;
	return JSON5.parse(trimmed);
}

/**
 * Parses YAML using the standard yaml library.
 */
export function parseYamlConfig(content: string): unknown {
	const trimmed = content.trim();
	if (!trimmed) return null;
	return YAML.parse(trimmed);
}

/**
 * Normalizes raw configuration dictionary (camelCase, kebab-case, or alternative jscpd keys)
 * into a typed JscpdProjectConfig object.
 */
export function normalizeJscpdConfig(
	raw: Record<string, unknown>,
	sourcePath?: string,
	sourceType: "file" | "package.json" = "file",
): JscpdProjectConfig {
	const config: JscpdProjectConfig = {
		sourcePath,
		sourceType,
		raw,
	};

	// minLines / min-lines / min_lines
	const rawMinLines = raw.minLines ?? raw["min-lines"] ?? raw.min_lines;
	if (typeof rawMinLines === "number" && !Number.isNaN(rawMinLines)) {
		config.minLines = Math.max(1, Math.floor(rawMinLines));
	} else if (typeof rawMinLines === "string") {
		const parsed = Number.parseInt(rawMinLines, 10);
		if (!Number.isNaN(parsed)) config.minLines = Math.max(1, parsed);
	}

	// maxLines / max-lines / max_lines
	const rawMaxLines = raw.maxLines ?? raw["max-lines"] ?? raw.max_lines;
	if (typeof rawMaxLines === "number" && !Number.isNaN(rawMaxLines)) {
		config.maxLines = Math.max(1, Math.floor(rawMaxLines));
	} else if (typeof rawMaxLines === "string") {
		const parsed = Number.parseInt(rawMaxLines, 10);
		if (!Number.isNaN(parsed)) config.maxLines = Math.max(1, parsed);
	}

	// minTokens / min-tokens / min_tokens / tokens
	const rawMinTokens =
		raw.minTokens ?? raw["min-tokens"] ?? raw.min_tokens ?? raw.tokens;
	if (typeof rawMinTokens === "number" && !Number.isNaN(rawMinTokens)) {
		config.minTokens = Math.max(1, Math.floor(rawMinTokens));
	} else if (typeof rawMinTokens === "string") {
		const parsed = Number.parseInt(rawMinTokens, 10);
		if (!Number.isNaN(parsed)) config.minTokens = Math.max(1, parsed);
	}

	// maxIndexedFiles / max-indexed-files / max_indexed_files
	const rawMaxIndexedFiles =
		raw.maxIndexedFiles ?? raw["max-indexed-files"] ?? raw.max_indexed_files;
	if (
		typeof rawMaxIndexedFiles === "number" &&
		!Number.isNaN(rawMaxIndexedFiles)
	) {
		config.maxIndexedFiles = Math.max(1, Math.floor(rawMaxIndexedFiles));
	} else if (typeof rawMaxIndexedFiles === "string") {
		const parsed = Number.parseInt(rawMaxIndexedFiles, 10);
		if (!Number.isNaN(parsed)) config.maxIndexedFiles = Math.max(1, parsed);
	}

	// threshold
	const rawThreshold = raw.threshold;
	if (typeof rawThreshold === "number" && !Number.isNaN(rawThreshold)) {
		config.threshold = rawThreshold;
	} else if (typeof rawThreshold === "string") {
		const parsed = Number.parseFloat(rawThreshold);
		if (!Number.isNaN(parsed)) config.threshold = parsed;
	}

	// ignore / ignorePatterns / ignore-patterns / ignore-pattern
	const rawIgnore =
		raw.ignore ??
		raw.ignorePatterns ??
		raw["ignore-patterns"] ??
		raw["ignore-pattern"];
	if (Array.isArray(rawIgnore)) {
		config.ignore = rawIgnore
			.filter(
				(item): item is string | number => item !== null && item !== undefined,
			)
			.map(String)
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s !== "null" && s !== "undefined");
	} else if (typeof rawIgnore === "string") {
		config.ignore = rawIgnore
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	// formatsExts / formats-exts / formats_exts
	const rawFormatsExts =
		raw.formatsExts ?? raw["formats-exts"] ?? raw.formats_exts;
	if (
		rawFormatsExts &&
		typeof rawFormatsExts === "object" &&
		!Array.isArray(rawFormatsExts)
	) {
		const formatted: Record<string, string[]> = {};
		for (const [fmt, exts] of Object.entries(rawFormatsExts)) {
			if (Array.isArray(exts)) {
				formatted[fmt] = exts
					.filter((e): e is string | number => e !== null && e !== undefined)
					.map(String)
					.map((e) => e.replace(/^\./, ""));
			} else if (typeof exts === "string") {
				formatted[fmt] = exts
					.split(",")
					.map((e) => e.trim().replace(/^\./, ""))
					.filter(Boolean);
			}
		}
		if (Object.keys(formatted).length > 0) {
			config.formatsExts = formatted;
		}
	}

	// format / formats
	const rawFormat = raw.format ?? raw.formats;
	if (Array.isArray(rawFormat)) {
		config.format = rawFormat.filter(Boolean).map(String).filter(Boolean);
	} else if (typeof rawFormat === "string") {
		config.format = rawFormat
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	// mode
	if (typeof raw.mode === "string") {
		config.mode = raw.mode;
	}

	// crossFormats / cross-formats / cross_formats
	const rawCross =
		raw.crossFormats ?? raw["cross-formats"] ?? raw.cross_formats;
	if (typeof rawCross === "boolean") {
		config.crossFormats = rawCross;
	}

	// gitignore
	const rawGitignore = raw.gitignore;
	if (typeof rawGitignore === "boolean") {
		config.gitignore = rawGitignore;
	}

	return config;
}

/**
 * Asynchronously locates and loads the jscpd configuration from a target project root.
 * Searches candidate config files in standard precedence order.
 * Returns normalized JscpdProjectConfig or null if no config found.
 */
export async function findProjectJscpdConfig(
	rootDir: string,
): Promise<JscpdProjectConfig | null> {
	for (const candidate of JSCPD_CONFIG_CANDIDATES) {
		const fullPath = path.isAbsolute(candidate)
			? candidate
			: path.join(rootDir, candidate);

		try {
			const file = Bun.file(fullPath);
			if (!(await file.exists())) continue;

			const content = await file.text();
			const basename = path.basename(fullPath);

			if (basename === "package.json") {
				const pkg = JSON5.parse(content) as Record<string, unknown>;
				if (
					pkg &&
					typeof pkg === "object" &&
					!Array.isArray(pkg) &&
					"jscpd" in pkg &&
					pkg.jscpd &&
					typeof pkg.jscpd === "object" &&
					!Array.isArray(pkg.jscpd)
				) {
					return normalizeJscpdConfig(
						pkg.jscpd as Record<string, unknown>,
						fullPath,
						"package.json",
					);
				}
				continue;
			}

			if (basename.endsWith(".yaml") || basename.endsWith(".yml")) {
				const parsed = YAML.parse(content);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					return normalizeJscpdConfig(
						parsed as Record<string, unknown>,
						fullPath,
						"file",
					);
				}
				continue;
			}

			// JSON or .jscpd.rc (try JSON5 first, fallback to YAML)
			try {
				const parsed = JSON5.parse(content);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					return normalizeJscpdConfig(
						parsed as Record<string, unknown>,
						fullPath,
						"file",
					);
				}
			} catch {
				const yamlParsed = YAML.parse(content);
				if (
					yamlParsed &&
					typeof yamlParsed === "object" &&
					!Array.isArray(yamlParsed)
				) {
					return normalizeJscpdConfig(
						yamlParsed as Record<string, unknown>,
						fullPath,
						"file",
					);
				}
			}
		} catch {
			// Ignore corrupt or unreadable candidate, continue probing
		}
	}

	return null;
}
