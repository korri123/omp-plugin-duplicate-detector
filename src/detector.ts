import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
	DuplicateCloneBlock,
	DuplicateDetectionOptions,
	DuplicateDetectionResult,
	DuplicateMatch,
} from "./types";

interface NormalizedLine {
	raw: string;
	normalized: string;
	originalLineNumber: number; // 1-indexed
	tokens: number;
}

interface FileLines {
	filePath: string;
	lines: NormalizedLine[];
	rawText: string;
	rawLines: string[];
}

const DEFAULT_EXTENSIONS: Record<string, true> = {
	".ts": true,
	".tsx": true,
	".js": true,
	".jsx": true,
	".mjs": true,
	".cjs": true,
	".py": true,
	".rs": true,
	".go": true,
	".java": true,
	".c": true,
	".cpp": true,
	".h": true,
	".hpp": true,
	".cs": true,
	".php": true,
	".rb": true,
	".swift": true,
	".kt": true,
	".scala": true,
	".vue": true,
	".svelte": true,
};

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

/**
 * Simple token counter based on identifier, symbol, and keyword splits.
 */
function estimateTokens(line: string): number {
	const words = line.match(/[A-Za-z0-9_$]+|[^\s\w]/g);
	return words ? words.length : 0;
}

/**
 * Normalizes a single source code line.
 */
function normalizeLine(line: string, normalizeIdentifiers = false): string {
	let trimmed = line.trim();
	// Strip single line comments
	if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("--")) {
		return "";
	}
	// Strip inline block comments if whole line
	if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
		return "";
	}

	if (normalizeIdentifiers) {
		// Replace string literals
		trimmed = trimmed.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "$STR$");
		// Replace number literals
		trimmed = trimmed.replace(/\b\d+(?:\.\d+)?\b/g, "$NUM$");
	}

	// Normalize spaces
	return trimmed.replace(/\s+/g, " ");
}

/**
 * Check if a relative path matches any ignore pattern.
 */
function shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
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

/**
 * Recursively collect eligible files from a directory.
 */
async function collectFiles(
	dir: string,
	baseDir: string,
	ignorePatterns: string[],
	allowedExtensions: Record<string, true>,
): Promise<string[]> {
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

		if (shouldIgnore(relPath, ignorePatterns)) {
			continue;
		}

		if (entry.isDirectory()) {
			const subFiles = await collectFiles(fullPath, baseDir, ignorePatterns, allowedExtensions);
			results.push(...subFiles);
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if (allowedExtensions[ext]) {
				results.push(fullPath);
			}
		}
	}

	return results;
}

/**
 * Parse and normalize files into indexed lines.
 */
async function processFile(filePath: string, normalizeIdentifiers: boolean): Promise<FileLines | null> {
	try {
		const rawText = await Bun.file(filePath).text();
		const rawLines = rawText.split(/\r?\n/);
		const lines: NormalizedLine[] = [];

		for (let i = 0; i < rawLines.length; i++) {
			const raw = rawLines[i]!;
			const normalized = normalizeLine(raw, normalizeIdentifiers);
			if (normalized.length > 0) {
				lines.push({
					raw,
					normalized,
					originalLineNumber: i + 1,
					tokens: estimateTokens(normalized),
				});
			}
		}

		return {
			filePath,
			lines,
			rawText,
			rawLines,
		};
	} catch {
		return null;
	}
}

/**
 * Hash a sequence of normalized lines.
 */
function hashLineWindow(lines: NormalizedLine[], start: number, count: number): string {
	let combined = "";
	for (let i = 0; i < count; i++) {
		combined += lines[start + i]!.normalized + "\n";
	}
	return Bun.hash(combined).toString(16);
}

/**
 * Detect code duplicates across a list of files or within a directory.
 */
export async function detectDuplicates(
	options: DuplicateDetectionOptions = {},
): Promise<DuplicateDetectionResult> {
	const rootPath = path.resolve(options.rootPath ?? process.cwd());
	const minLines = Math.max(3, options.minLines ?? 6);
	const minTokens = Math.max(10, options.minTokens ?? 30);
	const normalizeIdentifiers = options.normalizeIdentifiers ?? false;

	const ignorePatterns = options.ignorePatterns && options.ignorePatterns.length > 0
		? options.ignorePatterns
		: DEFAULT_IGNORE;

	const filePaths = await collectFiles(rootPath, rootPath, ignorePatterns, DEFAULT_EXTENSIONS);
	const processedFiles: FileLines[] = [];
	let totalLines = 0;

	for (const filePath of filePaths) {
		const processed = await processFile(filePath, normalizeIdentifiers);
		if (processed && processed.lines.length >= minLines) {
			processedFiles.push(processed);
			totalLines += processed.rawLines.length;
		}
	}

	// Map from window hash -> list of occurrences: { fileIndex, lineIndex }
	interface Occurrence {
		fileIndex: number;
		lineIndex: number;
	}

	const windowHashMap = new Map<string, Occurrence[]>();

	// Index all windows of size minLines
	for (let fIdx = 0; fIdx < processedFiles.length; fIdx++) {
		const file = processedFiles[fIdx]!;
		const numWindows = file.lines.length - minLines + 1;

		for (let lIdx = 0; lIdx < numWindows; lIdx++) {
			const hash = hashLineWindow(file.lines, lIdx, minLines);
			let list = windowHashMap.get(hash);
			if (!list) {
				list = [];
				windowHashMap.set(hash, list);
			}
			list.push({ fileIndex: fIdx, lineIndex: lIdx });
		}
	}

	interface CandidatePair {
		fileA: number;
		startA: number;
		fileB: number;
		startB: number;
		length: number;
	}

	const foundPairs: CandidatePair[] = [];

	// Extend matches to maximal length
	for (const occurrences of windowHashMap.values()) {
		if (occurrences.length < 2) continue;

		for (let i = 0; i < occurrences.length; i++) {
			for (let j = i + 1; j < occurrences.length; j++) {
				const occA = occurrences[i]!;
				const occB = occurrences[j]!;

				// Disallow overlapping segments in same file
				if (occA.fileIndex === occB.fileIndex && Math.abs(occA.lineIndex - occB.lineIndex) < minLines) {
					continue;
				}

				// Verify previous line does not match to avoid non-maximal extension
				if (
					occA.lineIndex > 0 &&
					occB.lineIndex > 0 &&
					processedFiles[occA.fileIndex]!.lines[occA.lineIndex - 1]!.normalized ===
						processedFiles[occB.fileIndex]!.lines[occB.lineIndex - 1]!.normalized
				) {
					continue;
				}

				// Extend forward as far as lines match
				const fileA = processedFiles[occA.fileIndex]!;
				const fileB = processedFiles[occB.fileIndex]!;
				let len = minLines;

				while (
					occA.lineIndex + len < fileA.lines.length &&
					occB.lineIndex + len < fileB.lines.length &&
					fileA.lines[occA.lineIndex + len]!.normalized === fileB.lines[occB.lineIndex + len]!.normalized
				) {
					len++;
				}

				// Calculate total tokens in match
				let tokenCount = 0;
				for (let k = 0; k < len; k++) {
					tokenCount += fileA.lines[occA.lineIndex + k]!.tokens;
				}

				if (tokenCount >= minTokens) {
					foundPairs.push({
						fileA: occA.fileIndex,
						startA: occA.lineIndex,
						fileB: occB.fileIndex,
						startB: occB.lineIndex,
						length: len,
					});
				}
			}
		}
	}

	// Cluster pairs into duplicate groups
	interface RawInstance {
		fileIndex: number;
		startIdx: number;
		length: number;
	}

	const groups: RawInstance[][] = [];

	for (const pair of foundPairs) {
		const instA: RawInstance = { fileIndex: pair.fileA, startIdx: pair.startA, length: pair.length };
		const instB: RawInstance = { fileIndex: pair.fileB, startIdx: pair.startB, length: pair.length };

		let placed = false;
		for (const group of groups) {
			const hasA = group.some((inst) => inst.fileIndex === instA.fileIndex && inst.startIdx === instA.startIdx && inst.length === instA.length);
			const hasB = group.some((inst) => inst.fileIndex === instB.fileIndex && inst.startIdx === instB.startIdx && inst.length === instB.length);

			if (hasA && !hasB) {
				group.push(instB);
				placed = true;
				break;
			} else if (hasB && !hasA) {
				group.push(instA);
				placed = true;
				break;
			} else if (hasA && hasB) {
				placed = true;
				break;
			}
		}

		if (!placed) {
			groups.push([instA, instB]);
		}
	}

	// Convert raw groups to DuplicateMatch objects
	const matches: DuplicateMatch[] = [];
	let matchCounter = 1;
	let totalDuplicatedLines = 0;

	for (const group of groups) {
		if (group.length < 2) continue;

		const firstInst = group[0]!;
		const file = processedFiles[firstInst.fileIndex]!;
		const startNormLine = file.lines[firstInst.startIdx]!;
		const endNormLine = file.lines[firstInst.startIdx + firstInst.length - 1]!;

		const originalStartLine = startNormLine.originalLineNumber;
		const originalEndLine = endNormLine.originalLineNumber;
		const lineCount = originalEndLine - originalStartLine + 1;

		let tokenCount = 0;
		for (let k = 0; k < firstInst.length; k++) {
			tokenCount += file.lines[firstInst.startIdx + k]!.tokens;
		}

		const fragmentLines = file.rawLines.slice(originalStartLine - 1, originalEndLine);
		const fragment = fragmentLines.join("\n");

		const instances: DuplicateCloneBlock[] = [];
		for (const inst of group) {
			const instFile = processedFiles[inst.fileIndex]!;
			const instStartNorm = instFile.lines[inst.startIdx]!;
			const instEndNorm = instFile.lines[inst.startIdx + inst.length - 1]!;
			const instStartLine = instStartNorm.originalLineNumber;
			const instEndLine = instEndNorm.originalLineNumber;

			const instFrag = instFile.rawLines.slice(instStartLine - 1, instEndLine).join("\n");

			instances.push({
				filePath: path.relative(rootPath, instFile.filePath) || instFile.filePath,
				startLine: instStartLine,
				endLine: instEndLine,
				lineCount: instEndLine - instStartLine + 1,
				tokenCount,
				fragment: instFrag,
			});
		}

		totalDuplicatedLines += lineCount * (instances.length - 1);

		matches.push({
			id: `clone-${matchCounter++}`,
			instances,
			lineCount,
			tokenCount,
			fragment,
		});
	}

	// Sort matches by duplication impact (lines * instances) descending
	matches.sort((a, b) => b.lineCount * b.instances.length - a.lineCount * a.instances.length);

	const duplicationPercentage = totalLines > 0
		? Number(((totalDuplicatedLines / totalLines) * 100).toFixed(2))
		: 0;

	// Build summary
	let summary = `# Duplicate Code Report\n\n`;
	summary += `- **Scanned Files**: ${processedFiles.length}\n`;
	summary += `- **Total Lines Scanned**: ${totalLines}\n`;
	summary += `- **Duplicate Clusters Found**: ${matches.length}\n`;
	summary += `- **Total Duplicated Lines**: ${totalDuplicatedLines}\n`;
	summary += `- **Duplication Rate**: ${duplicationPercentage}%\n\n`;

	if (matches.length === 0) {
		summary += `No duplicate code blocks found matching threshold (minLines: ${minLines}, minTokens: ${minTokens}).\n`;
	} else {
		summary += `## Detected Clones\n\n`;
		for (const match of matches) {
			summary += `### Match ${match.id} (${match.lineCount} lines, ~${match.tokenCount} tokens, ${match.instances.length} occurrences)\n\n`;
			summary += `**Occurrences:**\n`;
			for (const inst of match.instances) {
				summary += `- \`${inst.filePath}:${inst.startLine}-${inst.endLine}\`\n`;
			}
			summary += `\n\`\`\`\n`;
			const preview = match.fragment.split("\n").slice(0, 10).join("\n");
			summary += preview;
			if (match.fragment.split("\n").length > 10) {
				summary += `\n... (${match.fragment.split("\n").length - 10} more lines elided)`;
			}
			summary += `\n\`\`\`\n\n`;
		}
	}

	return {
		matches,
		scannedFilesCount: processedFiles.length,
		scannedLinesCount: totalLines,
		totalDuplicatedLines,
		duplicationPercentage,
		summary,
	};
}
