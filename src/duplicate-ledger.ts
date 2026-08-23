import type { IClone } from "@jscpd/core";

/**
 * Unique identifier for a duplicate match.
 */
export function cloneIdentity(clone: IClone): string {
	const a = clone.duplicationA;
	const b = clone.duplicationB;
	return `${b.sourceId}:${b.start.line}-${b.end.line}:${a.start.line}-${a.end.line}`;
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
			currentIdentities.add(id);
			if (!previous?.has(id)) {
				fresh.push(clone);
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
	formatReminder(clones: IClone[], filePath: string): string {
		if (clones.length === 0) return "";

		let reminder = `<system-reminder reason="code_duplication" file="${filePath}">\n`;
		reminder += `Warning: Duplicated code detected in '${filePath}'. Consider refactoring into a shared helper or reusing existing logic.\n\n`;

		for (let i = 0; i < clones.length; i++) {
			const clone = clones[i]!;
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const linesCount = a.end.line - a.start.line + 1;

			reminder += `### Duplicate #${i + 1} (${linesCount} lines, format: ${clone.format})\n`;
			reminder += `- Current change: \`${a.sourceId}:${a.start.line}-${a.end.line}\` (lines ${a.start.line} to ${a.end.line})\n`;
			reminder += `- Pre-existing copy: \`${b.sourceId}:${b.start.line}-${b.end.line}\` (lines ${b.start.line} to ${b.end.line})\n`;
			if (clone.duplicationA.fragment) {
				reminder += `\n\`\`\`${clone.format}\n${clone.duplicationA.fragment.trim()}\n\`\`\`\n`;
			}
			reminder += `\n`;
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
