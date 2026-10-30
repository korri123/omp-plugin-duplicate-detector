import type { DuplicateMatch } from "./types";

/**
 * Per-session record of duplicates already reported to the model, so a
 * re-edit that keeps the same copy does not warn again. Cleared when the
 * conversation history the warnings lived in changes (session switch, branch,
 * tree navigation).
 */
export class WarningLedger {
	readonly #seen = new Set<string>();

	/** Returns the matches not reported before (deduped by key) and records them as reported. */
	filterNew(matches: readonly DuplicateMatch[]): DuplicateMatch[] {
		const fresh: DuplicateMatch[] = [];
		for (const match of matches) {
			if (this.#seen.has(match.key)) continue;
			this.#seen.add(match.key);
			fresh.push(match);
		}
		return fresh;
	}

	clear(): void {
		this.#seen.clear();
	}
}
