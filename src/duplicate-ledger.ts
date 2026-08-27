import type { IClone } from "@jscpd/core";
import { toDisplayPath } from "./tui-notification";

/**
 * Unique identifier for a duplicate match.
 */
export function cloneIdentity(clone: IClone): string {
	const a = clone.duplicationA;
	const b = clone.duplicationB;
	// Use source file + line coordinates + length
	const len = a.end.line - a.start.line + 1;
	return `${b.sourceId}:${b.start.line}-${b.end.line}::${a.sourceId}::${len}`;
}

/**
 * Extract source code lines between start and end lines (1-indexed).
 */
function extractLineRange(
	content: string,
	startLine: number,
	endLine: number,
): string {
	const lines = content.split(/\r?\n/);
	const start = Math.max(0, startLine - 1);
	const end = Math.min(lines.length, endLine);
	return lines.slice(start, end).join("\n");
}

/**
 * Tracks surfaced duplicates per file to prevent repetitive warnings across multi-step edits.
 */
export class DuplicateLedger {
	readonly #seen = new Map<string, Set<string>>();

	/**
	 * Filter a list of clones, returning only those not yet seen for the target file.
	 * Updates the ledger with newly seen identities.
	 */
	filterFreshClones(filePath: string, clones: IClone[]): IClone[] {
		const previous = this.#seen.get(filePath);
		const fresh: IClone[] = [];
		const currentIdentities = new Set<string>();

		for (const clone of clones) {
			const id = cloneIdentity(clone);
			if (!currentIdentities.has(id)) {
				currentIdentities.add(id);
				if (!previous?.has(id)) {
					fresh.push(clone);
				}
			}
		}

		if (currentIdentities.size === 0) {
			this.#seen.delete(filePath);
		} else {
			this.#seen.set(filePath, currentIdentities);
		}

		return fresh;
	}

	/**
	 * Format an in-band <system-reminder> XML block for detected clones.
	 */
	formatReminder(
		clones: IClone[],
		filePath: string,
		targetFileContent?: string,
		basePath?: string,
		options?: {
			maxClones?: number;
			maxSnippetLines?: number;
			artifactId?: string;
		},
	): string {
		if (clones.length === 0) return "";
		const displayTargetFile = toDisplayPath(filePath, basePath);
		let reminder = `<system-reminder reason="code_duplication" file="${displayTargetFile}">\n`;
		reminder += `Warning: Duplicated code detected in '${displayTargetFile}'. Consider refactoring into a shared helper or reusing existing logic.\n\n`;

		const maxClones = options?.maxClones ?? 4;
		const count =
			typeof maxClones === "number" && maxClones > 0
				? Math.min(clones.length, maxClones)
				: clones.length;

		const maxSnippetLines = options?.maxSnippetLines ?? 8;

		for (let i = 0; i < count; i++) {
			const clone = clones[i]!;
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const linesCount = a.end.line - a.start.line + 1;
			const srcA = toDisplayPath(a.sourceId, basePath);
			const srcB = toDisplayPath(b.sourceId, basePath);

			reminder += `### Duplicate #${i + 1} (${linesCount} lines, format: ${clone.format})\n`;
			reminder += `- Current change: \`${srcA}:${a.start.line}-${a.end.line}\` (lines ${a.start.line} to ${a.end.line})\n`;
			reminder += `- Pre-existing copy: \`${srcB}:${b.start.line}-${b.end.line}\` (lines ${b.start.line} to ${b.end.line})\n`;
			const rawSnippet =
				a.fragment ||
				(targetFileContent
					? extractLineRange(targetFileContent, a.start.line, a.end.line)
					: "");
			const snippet = rawSnippet.trim();
			if (snippet) {
				let displaySnippet = snippet;
				if (typeof maxSnippetLines === "number" && maxSnippetLines > 0) {
					const lines = snippet.split(/\r?\n/);
					if (lines.length > maxSnippetLines) {
						displaySnippet = `${lines.slice(0, maxSnippetLines).join("\n")}\n// ... +${lines.length - maxSnippetLines} more duplicate lines`;
					}
				}
				reminder += `\n\`\`\`${clone.format}\n${displaySnippet}\n\`\`\`\n`;
			}
			reminder += `\n`;
		}

		const omittedCount = clones.length - count;
		if (omittedCount > 0 || options?.artifactId) {
			if (omittedCount > 0) {
				reminder += `*... and ${omittedCount} more duplicate block${omittedCount === 1 ? "" : "s"} in this file.*\n`;
			}
			if (options?.artifactId) {
				reminder += `*Read \`artifact://${options.artifactId}\` for complete duplicate report with all ${clones.length} duplicate blocks.*\n`;
				reminder += `\n[raw output: artifact://${options.artifactId}]\n`;
			}
			reminder += "\n";
		}

		reminder += `</system-reminder>\n`;
		return reminder;
	}

	/**
	 * Reset ledger tracking for a specific file or the entire session.
	 */
	clear(filePath?: string): void {
		if (filePath) {
			this.#seen.delete(filePath);
		} else {
			this.#seen.clear();
		}
	}
}
