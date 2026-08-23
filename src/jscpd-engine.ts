import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Detector, type IClone, type IMapFrame, type IOptions, type IStore, MemoryStore } from "@jscpd/core";
import { getFormatByFile, Tokenizer } from "@jscpd/tokenizer";

export interface JscpdEngineOptions {
	minTokens?: number;
	minLines?: number;
	maxLines?: number;
	ignorePatterns?: string[];
	formatsExts?: Record<string, string[]>;
	crossFormats?: boolean;
}

const DEFAULT_IGNORE = [
	"node_modules",
	".git",
	"dist",
	"build",
	"coverage",
	".pi_config",
	".omp",
	".next",
	".turbo",
	"out",
	"target",
];

export class JscpdIndexManager {
	readonly #tokenizer: Tokenizer;
	readonly #store: IStore<IMapFrame>;
	readonly #options: IOptions;
	#detector: Detector;
	#indexedFiles = new Set<string>();
	#initialized = false;
	#rootDir = "";

	constructor(options: JscpdEngineOptions = {}) {
		this.#tokenizer = new Tokenizer();
		this.#store = new MemoryStore();
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

	/**
	 * Scan and index the workspace directory into the token store.
	 */
	async initialize(rootDir: string, ignorePatterns?: string[]): Promise<number> {
		this.#rootDir = path.resolve(rootDir);
		this.#indexedFiles.clear();

		const ignores = ignorePatterns && ignorePatterns.length > 0 ? ignorePatterns : DEFAULT_IGNORE;
		const files = await this.#collectFiles(this.#rootDir, this.#rootDir, ignores);

		for (const filePath of files) {
			const relPath = path.relative(this.#rootDir, filePath);
			const format = getFormatByFile(filePath, this.#options.formatsExts);
			if (!format) continue;

			try {
				const content = await Bun.file(filePath).text();
				await this.#detector.detect(relPath, content, format);
				this.#indexedFiles.add(relPath);
			} catch {
				// Skip unreadable files
			}
		}

		this.#initialized = true;
		return this.#indexedFiles.size;
	}

	/**
	 * Check a code snippet or modified file against the indexed repository.
	 * Returns clones where duplicationB is an existing repository file.
	 */
	async checkSnippet(targetPath: string, content: string): Promise<IClone[]> {
		const format = getFormatByFile(targetPath, this.#options.formatsExts);
		if (!format) return [];

		const relPath = path.isAbsolute(targetPath) && this.#rootDir
			? path.relative(this.#rootDir, targetPath)
			: targetPath;

		const virtualId = `virtual:${relPath}`;

		// Query detector
		const allClones = await this.#detector.detect(virtualId, content, format);

		// Filter clones: duplicationA must be the virtual query and duplicationB an existing file
		const externalClones = allClones.filter((clone) => {
			const isAQuery = clone.duplicationA.sourceId === virtualId;
			const isBQuery = clone.duplicationB.sourceId === virtualId;

			if (isAQuery && !isBQuery) {
				// Don't report self-match if snippet is comparing to identical location in same file
				if (clone.duplicationB.sourceId === relPath) {
					const rangeA = clone.duplicationA.range;
					const rangeB = clone.duplicationB.range;
					if (rangeA[0] === rangeB[0] && rangeA[1] === rangeB[1]) {
						return false;
					}
				}
				return true;
			}
			return false;
		});

		return externalClones;
	}

	/**
	 * Update the index when a file is written or edited.
	 */
	async updateFile(targetPath: string, content: string): Promise<void> {
		const format = getFormatByFile(targetPath, this.#options.formatsExts);
		if (!format) return;

		const relPath = path.isAbsolute(targetPath) && this.#rootDir
			? path.relative(this.#rootDir, targetPath)
			: targetPath;

		await this.#detector.detect(relPath, content, format);
		this.#indexedFiles.add(relPath);
	}

	async #collectFiles(dir: string, baseDir: string, ignorePatterns: string[]): Promise<string[]> {
		const results: string[] = [];
		let entries: Dirent[];

		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return results;
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relPath = path.relative(baseDir, fullPath);

			if (this.#shouldIgnore(relPath, ignorePatterns)) {
				continue;
			}

			if (entry.isDirectory()) {
				const subFiles = await this.#collectFiles(fullPath, baseDir, ignorePatterns);
				results.push(...subFiles);
			} else if (entry.isFile()) {
				const format = getFormatByFile(entry.name, this.#options.formatsExts);
				if (format) {
					results.push(fullPath);
				}
			}
		}

		return results;
	}

	#shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
		const normalized = relativePath.replace(/\\/g, "/");
		const segments = normalized.split("/");

		for (const pattern of ignorePatterns) {
			const cleanPattern = pattern.trim().replace(/\\/g, "/");
			if (!cleanPattern) continue;

			if (segments.some((seg) => seg === cleanPattern)) {
				return true;
			}

			if (cleanPattern.endsWith("/**")) {
				const prefix = cleanPattern.slice(0, -3);
				if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
					return true;
				}
			}

			if (normalized.includes(cleanPattern)) {
				return true;
			}
		}
		return false;
	}
}
