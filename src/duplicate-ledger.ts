import type { IClone } from "@jscpd/core";
import { toDisplayPath } from "./tui-notification";

export interface LineRange {
	start: number;
	end: number;
}

/**
 * Computes 1-indexed changed/added line ranges in newText relative to oldText.
 * If oldText is null or undefined (e.g. newly created file), returns the full range of newText.
 */
export function computeChangedLineRanges(
	oldText: string | null | undefined,
	newText: string,
): LineRange[] {
	if (oldText == null) {
		const lines = newText.split(/\r?\n/);
		return [{ start: 1, end: Math.max(1, lines.length) }];
	}
	if (oldText === newText || newText.length === 0) {
		return [];
	}

	const oldLines = oldText.split(/\r?\n/);
	const newLines = newText.split(/\r?\n/);

	if (oldLines.length === 0) {
		return [{ start: 1, end: Math.max(1, newLines.length) }];
	}
	if (newLines.length === 0) {
		return [];
	}

	// Trim common prefix
	let prefix = 0;
	while (
		prefix < oldLines.length &&
		prefix < newLines.length &&
		oldLines[prefix] === newLines[prefix]
	) {
		prefix++;
	}

	// Trim common suffix
	let oldSuffix = oldLines.length - 1;
	let newSuffix = newLines.length - 1;
	while (
		oldSuffix >= prefix &&
		newSuffix >= prefix &&
		oldLines[oldSuffix] === newLines[newSuffix]
	) {
		oldSuffix--;
		newSuffix--;
	}

	const oldTrimmed = oldLines.slice(prefix, oldSuffix + 1);
	const newTrimmed = newLines.slice(prefix, newSuffix + 1);

	// Pure deletions: lines were removed, but no new lines were introduced
	if (newTrimmed.length === 0) {
		return [];
	}

	// Compute LCS on the trimmed core if reasonably bounded (up to 500k cells)
	if (
		oldTrimmed.length > 0 &&
		newTrimmed.length > 0 &&
		oldTrimmed.length * newTrimmed.length <= 500000
	) {
		const m = oldTrimmed.length;
		const n = newTrimmed.length;
		const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (oldTrimmed[i - 1] === newTrimmed[j - 1]) {
					dp[i]![j] = dp[i - 1]![j - 1]! + 1;
				} else {
					dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
				}
			}
		}

		const matchedInNew = new Uint8Array(n);
		let i = m;
		let j = n;
		while (i > 0 && j > 0) {
			if (oldTrimmed[i - 1] === newTrimmed[j - 1]) {
				matchedInNew[j - 1] = 1;
				i--;
				j--;
			} else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
				i--;
			} else {
				j--;
			}
		}

		const ranges: LineRange[] = [];
		let rangeStart = -1;
		for (let idx = 0; idx < n; idx++) {
			if (!matchedInNew[idx]) {
				if (rangeStart === -1) rangeStart = prefix + idx + 1;
			} else {
				if (rangeStart !== -1) {
					ranges.push({ start: rangeStart, end: prefix + idx });
					rangeStart = -1;
				}
			}
		}
		if (rangeStart !== -1) {
			ranges.push({ start: rangeStart, end: prefix + n });
		}

		return ranges;
	}

	if (prefix <= newSuffix) {
		return [{ start: prefix + 1, end: newSuffix + 1 }];
	}
	return [];
}

/**
 * Checks whether a clone's target mutation span intersects any of the changed line ranges.
 */
export function cloneIntersectsRanges(
	clone: IClone,
	ranges: LineRange[],
	side: "duplicationA" | "duplicationB" = "duplicationA",
): boolean {
	if (ranges.length === 0) return false;
	const span =
		side === "duplicationB" ? clone.duplicationB : clone.duplicationA;
	const start = span.start.line;
	const end = span.end.line;
	return ranges.some(
		(range) => Math.max(start, range.start) <= Math.min(end, range.end),
	);
}

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
	readonly #baseline = new Map<string, Set<string>>();

	#addBaseline(key: string, id: string): void {
		if (!key) return;
		let set = this.#baseline.get(key);
		if (!set) {
			set = new Set<string>();
			this.#baseline.set(key, set);
		}
		set.add(id);
	}

	/**
	 * Seed pre-existing baseline clones from workspace indexing so that legacy repository
	 * duplications are treated as pre-existing and not flagged as newly introduced duplicates.
	 */
	seedBaseline(clones: IClone[], basePath?: string): void {
		for (const clone of clones) {
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const lenA = a.end.line - a.start.line + 1;
			const lenB = b.end.line - b.start.line + 1;

			const relA = toDisplayPath(a.sourceId, basePath);
			const relB = toDisplayPath(b.sourceId, basePath);

			const idA_raw = `${b.sourceId}:${b.start.line}-${b.end.line}::${a.sourceId}::${lenA}`;
			const idA_rel = `${relB}:${b.start.line}-${b.end.line}::${relA}::${lenA}`;

			const idB_raw = `${a.sourceId}:${a.start.line}-${a.end.line}::${b.sourceId}::${lenB}`;
			const idB_rel = `${relA}:${a.start.line}-${a.end.line}::${relB}::${lenB}`;

			// Register bidirectional identities under both files' raw and display keys
			const allIds = [idA_raw, idA_rel, idB_raw, idB_rel];
			const allKeys = [relA, a.sourceId, relB, b.sourceId];

			for (const key of allKeys) {
				for (const id of allIds) {
					this.#addBaseline(key, id);
				}
			}
		}
	}

	/**
	 * Filter a list of clones, returning only those not yet seen for the target file.
	 * Updates the ledger with newly seen identities.
	 */
	filterFreshClones(
		filePath: string,
		clones: IClone[],
		basePath?: string,
	): IClone[] {
		const displayPath = toDisplayPath(filePath, basePath);
		const previous = this.#seen.get(filePath);
		const prevDisplay = this.#seen.get(displayPath);
		const baseline = this.#baseline.get(filePath);
		const baseDisplay = this.#baseline.get(displayPath);
		const fresh: IClone[] = [];
		const currentIdentities = new Set<string>();

		for (const clone of clones) {
			const id = cloneIdentity(clone);
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const len = a.end.line - a.start.line + 1;
			const relId = `${toDisplayPath(b.sourceId, basePath)}:${b.start.line}-${b.end.line}::${toDisplayPath(a.sourceId, basePath)}::${len}`;

			if (!currentIdentities.has(id)) {
				currentIdentities.add(id);
				currentIdentities.add(relId);
				const isBaseline =
					baseline?.has(id) ||
					baseline?.has(relId) ||
					baseDisplay?.has(id) ||
					baseDisplay?.has(relId);
				const isPrevious =
					previous?.has(id) ||
					previous?.has(relId) ||
					prevDisplay?.has(id) ||
					prevDisplay?.has(relId);
				if (!isBaseline && !isPrevious) {
					fresh.push(clone);
				}
			}
		}

		if (currentIdentities.size === 0) {
			this.#seen.delete(filePath);
			this.#seen.delete(displayPath);
		} else {
			this.#seen.set(filePath, currentIdentities);
			this.#seen.set(displayPath, currentIdentities);
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
			this.#baseline.delete(filePath);
		} else {
			this.#seen.clear();
			this.#baseline.clear();
		}
	}
}
