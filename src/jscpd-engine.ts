import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { Detector, type IClone, type IMapFrame, type IOptions, type IStore, MemoryStore } from "@jscpd/core";
import { getFormatByFile, Tokenizer } from "@jscpd/tokenizer";
import { cloneIdentity } from "./duplicate-ledger";

const execFileAsync = promisify(execFile);

export interface JscpdEngineOptions {
	minTokens?: number;
	minLines?: number;
	maxLines?: number;
	ignorePatterns?: string[];
	formatsExts?: Record<string, string[]>;
	crossFormats?: boolean;
}

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB limit to avoid freezing on bundles

/** Standard VCS metadata directories to always exclude from file discovery */
const VCS_DIRS: Record<string, true> = {
	".git": true,
	".hg": true,
	".svn": true,
};

/** Common lockfile basenames that should not be tokenized for duplicate logic */
const LOCKFILE_NAMES: Record<string, true> = {
	"package-lock.json": true,
	"pnpm-lock.yaml": true,
	"yarn.lock": true,
	"bun.lock": true,
	"bun.lockb": true,
	"composer.lock": true,
	"cargo.lock": true,
	"gemfile.lock": true,
	"poetry.lock": true,
	"flake.lock": true,
	"mix.lock": true,
	"packages.lock.json": true,
};

interface CompiledPattern {
	raw: string;
	isNegative: boolean;
	isDirOnly: boolean;
	isRooted: boolean;
	regex: RegExp;
}

/**
 * Compile a glob/path pattern into a compiled regex matcher supporting standard wildcard rules.
 */
function compilePattern(pattern: string, subDirPrefix = ""): CompiledPattern {
	let p = pattern.trim().replace(/\\/g, "/");
	const isNegative = p.startsWith("!");
	if (isNegative) p = p.slice(1).trim();

	let isDirOnly = false;
	if (p.endsWith("/")) {
		isDirOnly = true;
		p = p.slice(0, -1);
	}

	const isRooted = p.startsWith("/") || p.includes("/");
	if (p.startsWith("/")) p = p.slice(1);

	// If from a nested .gitignore and the pattern is rooted or contains slashes, scope it to the subdirectory
	if (subDirPrefix && isRooted) {
		const cleanPrefix = subDirPrefix.replace(/^\/+|\/+$/g, "");
		if (cleanPrefix) {
			p = `${cleanPrefix}/${p}`;
		}
	}

	let regexStr = "";
	for (let i = 0; i < p.length; i++) {
		const c = p[i];
		if (c === "*" && p[i + 1] === "*") {
			if (p[i + 2] === "/") {
				regexStr += "(?:.*/)?";
				i += 2;
			} else {
				regexStr += ".*";
				i += 1;
			}
		} else if (c === "*") {
			regexStr += "[^/]*";
		} else if (c === "?") {
			regexStr += "[^/]";
		} else if ("[].+^${}()|\\".includes(c!)) {
			regexStr += "\\" + c;
		} else {
			regexStr += c;
		}
	}

	const regex = new RegExp("^" + regexStr + "$");
	return { raw: p, isNegative, isDirOnly, isRooted, regex };
}

/**
 * Check if a file is a lockfile, minified bundle, source map, or configuration dotfile.
 */
function isNoiseOrLockfile(fileName: string): boolean {
	const lower = fileName.toLowerCase();
	if (lower.startsWith(".") && !lower.endsWith(".ts") && !lower.endsWith(".js") && !lower.endsWith(".py")) {
		return true;
	}
	if (LOCKFILE_NAMES[lower]) {
		return true;
	}
	if (lower.endsWith(".min.js") || lower.endsWith(".min.css") || lower.endsWith(".map") || lower.endsWith(".bundle.js")) {
		return true;
	}
	return false;
}
/**
 * Isolated overlay store for running non-mutating snippet queries.
 * Prevents virtual query frames from polluting the persistent MemoryStore.
 */
export class IsolatedMemoryStore implements IStore<IMapFrame> {
	#namespace = "";
	readonly #baseValues: Record<string, Record<string, IMapFrame>>;
	readonly #overlayValues: Record<string, Record<string, IMapFrame>> = {};

	constructor(baseValues: Record<string, Record<string, IMapFrame>>) {
		this.#baseValues = baseValues;
	}

	namespace(ns: string): void {
		this.#namespace = ns;
		this.#overlayValues[ns] = this.#overlayValues[ns] || {};
	}

	get(key: string): Promise<IMapFrame> {
		const overlay = this.#overlayValues[this.#namespace];
		if (overlay && key in overlay) {
			return Promise.resolve(overlay[key]!);
		}
		const base = this.#baseValues[this.#namespace];
		if (base && key in base) {
			return Promise.resolve(base[key]!);
		}
		return Promise.reject(new Error("not found"));
	}

	set(key: string, value: IMapFrame): Promise<IMapFrame> {
		if (!this.#overlayValues[this.#namespace]) {
			this.#overlayValues[this.#namespace] = {};
		}
		this.#overlayValues[this.#namespace]![key] = value;
		return Promise.resolve(value);
	}

	close(): void {
		// No-op for isolated overlay
	}
}

/**
 * Subclass of MemoryStore that allows extracting the underlying namespace map
 * and evicting all frames for a given source file.
 */
class ExportableMemoryStore extends MemoryStore<IMapFrame> {
	getNamespaceValues(): Record<string, Record<string, IMapFrame>> {
		return this.values;
	}

	deleteBySourceId(sourceId: string): void {
		for (const ns of Object.keys(this.values)) {
			const nsMap = this.values[ns];
			if (!nsMap) continue;
			for (const key of Object.keys(nsMap)) {
				const frame = nsMap[key];
				if (frame && frame.sourceId === sourceId) {
					delete nsMap[key];
				}
			}
		}
	}
}

export class JscpdIndexManager {
	readonly #tokenizer: Tokenizer;
	readonly #store: ExportableMemoryStore;
	readonly #options: IOptions;
	#detector: Detector;
	#indexedFiles = new Set<string>();
	#discoveredClones: IClone[] = [];
	#initialized = false;
	#initPromise: Promise<number> | null = null;
	#mutationQueue: Promise<void> = Promise.resolve();
	#rootDir = "";

	constructor(options: JscpdEngineOptions = {}) {
		this.#tokenizer = new Tokenizer();
		this.#store = new ExportableMemoryStore();
		this.#options = {
			minTokens: options.minTokens ?? 40,
			minLines: options.minLines ?? 5,
			maxLines: options.maxLines ?? 500,
			formatsExts: options.formatsExts,
		};
		this.#detector = new Detector(this.#tokenizer, this.#store, [], this.#options);
	}

	get isInitialized(): boolean {
		return this.#initialized;
	}

	get indexedCount(): number {
		return this.#indexedFiles.size;
	}

	get rootDir(): string {
		return this.#rootDir;
	}

	get discoveredClones(): IClone[] {
		return this.#discoveredClones.slice();
	}

	/**
	 * Reset all store contents and index state.
	 */
	reset(): void {
		this.#store.close();
		this.#indexedFiles.clear();
		this.#discoveredClones = [];
		this.#initialized = false;
		this.#initPromise = null;
		this.#detector = new Detector(this.#tokenizer, this.#store, [], this.#options);
	}

	/**
	 * Scan and index the workspace directory into the token store.
	 * Coalesces concurrent initialization requests.
	 */
	async initialize(rootDir: string, ignorePatterns?: string[], signal?: AbortSignal): Promise<number> {
		if (this.#initPromise) {
			return this.#initPromise;
		}

		this.#initPromise = this.#runInitialize(rootDir, ignorePatterns, signal).finally(() => {
			this.#initPromise = null;
		});

		return this.#initPromise;
	}

	async #runInitialize(rootDir: string, ignorePatterns?: string[], signal?: AbortSignal): Promise<number> {
		this.#rootDir = path.resolve(rootDir);
		this.reset();

		const userIgnores = ignorePatterns && ignorePatterns.length > 0 ? ignorePatterns : [];
		const files = await this.#discoverFiles(this.#rootDir, userIgnores, signal);
		const seenCloneIds = new Set<string>();
		for (const filePath of files) {
			if (signal?.aborted) break;

			const relPath = path.relative(this.#rootDir, filePath).replace(/\\/g, "/");
			const format = getFormatByFile(filePath, this.#options.formatsExts);
			if (!format) continue;

			try {
				const file = Bun.file(filePath);
				if (file.size > MAX_FILE_SIZE_BYTES) continue;

				const content = await file.text();
				const clones = await this.#detector.detect(relPath, content, format);

				this.#indexedFiles.add(relPath);

				for (const clone of clones) {
					const id = cloneIdentity(clone);
					if (!seenCloneIds.has(id)) {
						seenCloneIds.add(id);
						this.#discoveredClones.push(clone);
					}
				}
			} catch {
				// Skip unreadable files
			}
		}

		this.#initialized = !signal?.aborted;
		return this.#indexedFiles.size;
	}

	/**
	 * Check a code snippet or modified file against the indexed repository without polluting the persistent store.
	 * Returns clones matching against existing repository files or intra-file duplicates.
	 */
	async checkSnippet(targetPath: string, content: string): Promise<IClone[]> {
		if (this.#initPromise) {
			await this.#initPromise;
		}

		const format = getFormatByFile(targetPath, this.#options.formatsExts);
		if (!format) return [];

		const relPath = (path.isAbsolute(targetPath) && this.#rootDir
			? path.relative(this.#rootDir, targetPath)
			: targetPath).replace(/\\/g, "/");

		const virtualId = `virtual:${relPath}`;

		// Use an isolated overlay store to avoid polluting the persistent MemoryStore with virtual frames
		const overlayStore = new IsolatedMemoryStore(this.#store.getNamespaceValues());
		const queryDetector = new Detector(this.#tokenizer, overlayStore, [], this.#options);

		const allClones = await queryDetector.detect(virtualId, content, format);

		// Filter clones:
		const relevantClones: IClone[] = [];
		for (const clone of allClones) {
			const isAQuery = clone.duplicationA.sourceId === virtualId;
			const isBQuery = clone.duplicationB.sourceId === virtualId;

			if (isAQuery && !isBQuery) {
				if (clone.duplicationB.sourceId !== relPath) {
					relevantClones.push(clone);
				}
			} else if (!isAQuery && isBQuery) {
				if (clone.duplicationA.sourceId !== relPath) {
					relevantClones.push({
						...clone,
						duplicationA: clone.duplicationB,
						duplicationB: clone.duplicationA,
					});
				}
			} else if (isAQuery && isBQuery) {
				relevantClones.push(clone);
			}
		}

		return relevantClones;
	}

	/**
	 * Update the index when a file is written or edited.
	 * Serialized through a promise queue to prevent namespace race conditions.
	 * Evicts stale token frames for the file before re-indexing.
	 */
	async updateFile(targetPath: string, content: string): Promise<void> {
		if (this.#initPromise) {
			await this.#initPromise;
		}

		const mutation = async () => {
			const format = getFormatByFile(targetPath, this.#options.formatsExts);
			if (!format) return;

			const relPath = (path.isAbsolute(targetPath) && this.#rootDir
				? path.relative(this.#rootDir, targetPath)
				: targetPath).replace(/\\/g, "/");

			// Evict old frames for this source file
			this.#store.deleteBySourceId(relPath);

			// Re-detect and index new frames
			await this.#detector.detect(relPath, content, format);
			this.#indexedFiles.add(relPath);
		};

		this.#mutationQueue = this.#mutationQueue.then(mutation, mutation);
		return this.#mutationQueue;
	}

	/**
	 * Format discovered clones into a Markdown report.
	 */
	formatReport(clones: IClone[] = this.#discoveredClones, scanPath = this.#rootDir): string {
		let report = `# Duplicate Code Report\n\n`;
		report += `- **Indexed Files**: ${this.#indexedFiles.size}\n`;
		report += `- **Scan Target**: \`${scanPath || "."}\`\n`;
		report += `- **Duplicate Clusters Found**: ${clones.length}\n\n`;

		if (clones.length === 0) {
			report += `No duplicate code blocks found matching threshold (minLines: ${this.#options.minLines}, minTokens: ${this.#options.minTokens}).\n`;
			return report;
		}

		report += `## Detected Clones\n\n`;
		for (let i = 0; i < clones.length; i++) {
			const clone = clones[i]!;
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const linesCount = a.end.line - a.start.line + 1;

			report += `### Clone #${i + 1} (${linesCount} lines, format: ${clone.format})\n`;
			report += `- **Location A**: \`${a.sourceId}:${a.start.line}-${a.end.line}\`\n`;
			report += `- **Location B**: \`${b.sourceId}:${b.start.line}-${b.end.line}\`\n`;

			if (a.fragment) {
				report += `\n\`\`\`${clone.format}\n${a.fragment.trim()}\n\`\`\`\n`;
			}
			report += `\n`;
		}

		return report;
	}

	/**
	 * Discover eligible source files using Git's native ignore engine (git ls-files)
	 * with automatic fallback to hierarchical .gitignore traversal.
	 */
	async #discoverFiles(
		rootDir: string,
		userIgnorePatterns: string[] = [],
		signal?: AbortSignal,
	): Promise<string[]> {
		const userRules = userIgnorePatterns
			.map((p) => p.trim())
			.filter((p) => p.length > 0)
			.map((p) => compilePattern(p));

		// Primary: Git-backed file discovery
		const gitFiles = await this.#collectFilesViaGit(rootDir, signal);
		if (gitFiles !== null) {
			const results: string[] = [];
			for (const fullPath of gitFiles) {
				if (signal?.aborted) break;
				const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
				const fileName = path.basename(fullPath);

				if (isNoiseOrLockfile(fileName)) continue;
				if (this.#isMatchRules(relPath, fileName, false, userRules)) continue;

				results.push(fullPath);
			}
			return results;
		}

		// Fallback: Filesystem traversal respecting .gitignore rules
		const fallbackFiles = await this.#collectFilesFallback(
			rootDir,
			rootDir,
			[],
			userRules,
			signal,
		);
		return fallbackFiles;
	}

	async #collectFilesViaGit(rootDir: string, signal?: AbortSignal): Promise<string[] | null> {
		try {
			const { stdout } = await execFileAsync(
				"git",
				["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
				{
					cwd: rootDir,
					signal,
					maxBuffer: 32 * 1024 * 1024,
					windowsHide: true,
				},
			);

			const entries = stdout.split("\0");
			const results: string[] = [];
			for (const entry of entries) {
				const trimmed = entry.trim();
				if (!trimmed) continue;
				results.push(path.resolve(rootDir, trimmed));
			}
			return results;
		} catch {
			return null;
		}
	}

	async #collectFilesFallback(
		dir: string,
		baseDir: string,
		parentGitignoreRules: CompiledPattern[],
		userRules: CompiledPattern[],
		signal?: AbortSignal,
	): Promise<string[]> {
		const results: string[] = [];
		if (signal?.aborted) return results;

		let entries: Dirent[];
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return results;
		}

		const currentRules = [...parentGitignoreRules];
		const gitignoreEntry = entries.find((e) => e.isFile() && e.name === ".gitignore");
		if (gitignoreEntry) {
			try {
				const content = await Bun.file(path.join(dir, ".gitignore")).text();
				const relDir = path.relative(baseDir, dir).replace(/\\/g, "/");
				for (const line of content.split(/\r?\n/)) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith("#")) continue;
					currentRules.push(compilePattern(trimmed, relDir));
				}
			} catch {
				// Ignore unreadable .gitignore
			}
		}

		for (const entry of entries) {
			if (signal?.aborted) break;
			if (VCS_DIRS[entry.name]) continue;

			const fullPath = path.join(dir, entry.name);
			const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
			const isDir = entry.isDirectory();

			if (this.#isMatchRules(relPath, entry.name, isDir, currentRules)) continue;
			if (this.#isMatchRules(relPath, entry.name, isDir, userRules)) continue;

			if (isDir) {
				const subFiles = await this.#collectFilesFallback(
					fullPath,
					baseDir,
					currentRules,
					userRules,
					signal,
				);
				results.push(...subFiles);
			} else if (entry.isFile()) {
				if (!isNoiseOrLockfile(entry.name)) {
					results.push(fullPath);
				}
			}
		}

		return results;
	}

	#isMatchRules(
		relPath: string,
		fileName: string,
		isDir: boolean,
		rules: CompiledPattern[],
	): boolean {
		let ignored = false;
		const normalizedPath = relPath.replace(/\\/g, "/");
		const segments = normalizedPath.split("/");

		for (const rule of rules) {
			let matches = false;

			if (rule.isRooted) {
				if (rule.regex.test(normalizedPath)) {
					matches = true;
				} else if (normalizedPath.startsWith(rule.raw + "/") || normalizedPath === rule.raw) {
					matches = true;
				}
			} else {
				if (rule.isDirOnly && !isDir) {
					if (segments.some((seg) => rule.regex.test(seg))) {
						matches = true;
					}
				} else if (rule.regex.test(fileName) || rule.regex.test(normalizedPath)) {
					matches = true;
				} else if (segments.some((seg) => rule.regex.test(seg))) {
					matches = true;
				}
			}

			if (matches) {
				ignored = !rule.isNegative;
			}
		}
		return ignored;
	}
}
