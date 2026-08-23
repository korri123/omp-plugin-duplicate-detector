/**
 * Types and interfaces for the Duplicate Detector plugin.
 */

export interface DuplicateCloneBlock {
	/** Relative or absolute file path containing the clone */
	filePath: string;
	/** 1-indexed starting line of the duplicate block */
	startLine: number;
	/** 1-indexed ending line of the duplicate block */
	endLine: number;
	/** Total number of lines spanned by this block */
	lineCount: number;
	/** Estimated token count */
	tokenCount: number;
	/** Code fragment content */
	fragment: string;
}

export interface DuplicateMatch {
	/** Unique match identifier */
	id: string;
	/** All duplicate occurrences of this code block */
	instances: DuplicateCloneBlock[];
	/** Line count of each instance */
	lineCount: number;
	/** Token count of each instance */
	tokenCount: number;
	/** Representative snippet preview */
	fragment: string;
}

export interface DuplicateDetectionOptions {
	/** Root directory to scan (defaults to process cwd) */
	rootPath?: string;
	/** Glob patterns to include (e.g. `["src/**\/*.ts", "src/**\/*.js"]`) */
	patterns?: string[];
	/** Glob patterns to ignore (e.g. `["node_modules/**", "dist/**"]`) */
	ignorePatterns?: string[];
	/** Minimum consecutive matching lines to trigger a clone report (default: 6) */
	minLines?: number;
	/** Minimum token count threshold (default: 30) */
	minTokens?: number;
	/** Normalize variable and function identifiers for Type-2/Type-3 clone detection */
	normalizeIdentifiers?: boolean;
}

export interface DuplicateDetectionResult {
	/** Discovered duplicate clusters */
	matches: DuplicateMatch[];
	/** Total files scanned */
	scannedFilesCount: number;
	/** Total lines scanned across all eligible files */
	scannedLinesCount: number;
	/** Total duplicated lines */
	totalDuplicatedLines: number;
	/** Estimated duplication ratio as a percentage (0 - 100) */
	duplicationPercentage: number;
	/** Markdown formatted summary report */
	summary: string;
}
