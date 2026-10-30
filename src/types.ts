/**
 * Types shared between the extension (main thread), the detector service, the
 * worker, and the transcript renderer. Keep this module dependency-free: the
 * main thread must never load the tokenizer.
 */

/** Effective detection settings for one workspace (after merging every config source). */
export interface DetectorOptions {
	/** Minimum duplicated tokens for a report. */
	minTokens: number;
	/** Minimum duplicated lines (in the edited file) for a report. */
	minLines: number;
	/** Extra gitignore-style patterns, matched against repo-relative POSIX paths. */
	ignorePatterns: string[];
	/** Skip test files, test directories, mocks, fixtures, snapshots. */
	ignoreTests: boolean;
	/** Extra patterns treated as tests (when `ignoreTests`). */
	customTestPatterns: string[];
	/** Patterns that are never treated as tests. */
	excludeTestPatterns: string[];
	/** jscpd-style format → extensions map; listed formats are opted in even when non-code by default. */
	formatsExts?: Record<string, string[]>;
	/** Cap on files held in the index. */
	maxIndexedFiles: number;
}

/** A region in a file: repo-relative POSIX path, 1-based inclusive lines. */
export interface CodeRegion {
	file: string;
	startLine: number;
	endLine: number;
}

/** One newly introduced duplicate found in an edited file. */
export interface DuplicateMatch {
	/** The duplicated region in the edited file. */
	region: CodeRegion;
	/** The existing code it duplicates (may be in the same file). */
	other: CodeRegion;
	/** Duplicated token count. */
	tokens: number;
	/**
	 * Stable identity across repeated edits of the same file: derived from the
	 * edited file path, the counterpart file path, and the duplicated token
	 * content (not line numbers), so a re-edit that keeps the same copy dedupes.
	 */
	key: string;
}

type WorkspaceState =
	/** Baseline scan running; checks queue until it finishes. */
	| "indexing"
	| "ready"
	/** No baseline possible (e.g. not a git repository); checks are skipped. */
	| "unavailable"
	| "failed";

export interface WorkspaceStatus {
	state: WorkspaceState;
	/** Files currently held in the index. */
	indexedFiles: number;
	/** Candidate files found by the scan (after filters), when known. */
	candidateFiles?: number;
	/** True when `maxIndexedFiles` cut the scan short. */
	capped?: boolean;
	/** Files skipped because reading or tokenizing them failed (last scan plus later checks). */
	failedFiles?: number;
	/** Human-readable reason for `unavailable` / `failed`. */
	message?: string;
}

/** One file mutation to check. Paths are absolute. */
export interface CheckRequest {
	path: string;
	/**
	 * Content before the mutation: a string, `null` when the file did not exist,
	 * or `undefined` when unknown (the service then uses the indexed version of
	 * `beforePath`, else of `path`, as it was when the check was queued).
	 */
	before?: string | null;
	/** Absolute path whose indexed version stands in for an unknown `before` (a move's source). */
	beforePath?: string;
	/** Content after the mutation; read from disk when omitted. */
	after?: string;
}

export type SkipReason =
	| "outside-workspace"
	| "ignored"
	| "unsupported-format"
	| "too-large"
	| "generated"
	| "deleted"
	| "unavailable";

export type CheckResult =
	| { status: "checked"; matches: DuplicateMatch[] }
	| { status: "skipped"; reason: SkipReason };

/** `details` payload of the `duplicate-detector-warning` custom message. */
export interface WarningDetails {
	/** Edited file, repo-relative POSIX path. */
	file: string;
	/** Matches shown in the card (already capped by the sender). */
	matches: DuplicateMatch[];
	/** Matches omitted from `matches` by the cap. */
	omitted: number;
	/** Session artifact id holding the full report, when it was offloaded. */
	artifactId?: string;
	/**
	 * Absolute workspace root (`WorkspaceHandle.root`) the paths are relative to.
	 * Lets the card link locations (`file://`); without it they show unlinked.
	 */
	root?: string;
}

export const WARNING_MESSAGE_TYPE = "duplicate-detector-warning";
