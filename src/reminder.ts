/**
 * Model-facing duplicate reminder: what was copied from where, a short
 * excerpt of the existing code, and what to do about it. Large reports are
 * offloaded to a session artifact and referenced by id.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { DuplicateMatch, WarningDetails } from "./types";

/** Matches shown inline (and in the card); the rest are counted as omitted. */
const MAX_INLINE_MATCHES = 4;
/** Inline text budget; larger reports are offloaded to an artifact. */
const MAX_INLINE_BYTES = 8 * 1024;
const SNIPPET_LINES = 8;
const SNIPPET_LINE_CHARS = 200;
/** Counterpart files above this size get no excerpt. */
const SNIPPET_MAX_FILE_BYTES = 1024 * 1024;

export interface Reminder {
	/** Model-facing text (custom message content / `additionalContext`). */
	text: string;
	details: WarningDetails;
}

export interface BuildReminderInput {
	/** Workspace root the match paths are relative to. */
	root: string;
	/** Edited file, repo-relative POSIX path. */
	file: string;
	/** New, not yet reported matches (non-empty). */
	matches: readonly DuplicateMatch[];
	/** Stores the full report and returns its artifact id (`ctx.sessionManager.saveArtifact`). */
	saveArtifact?: (content: string) => Promise<string | undefined>;
}

function describeMatch(match: DuplicateMatch): string {
	const { region, other } = match;
	const lines = region.endLine - region.startLine + 1;
	return `${region.file}:${region.startLine}-${region.endLine} duplicates ${other.file}:${other.startLine}-${other.endLine} (${lines} lines)`;
}

/** First lines of the counterpart region, read from disk; undefined when unavailable. */
async function readExcerpt(
	root: string,
	match: DuplicateMatch,
): Promise<string | undefined> {
	const filePath = path.join(root, match.other.file);
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile() || stat.size > SNIPPET_MAX_FILE_BYTES) return undefined;
		const lines = (await fs.readFile(filePath, "utf8")).split(/\r?\n/);
		const start = match.other.startLine - 1;
		const end = Math.min(
			match.other.endLine,
			match.other.startLine + SNIPPET_LINES - 1,
		);
		const excerpt = lines
			.slice(start, end)
			.map((line) =>
				line.length > SNIPPET_LINE_CHARS
					? `${line.slice(0, SNIPPET_LINE_CHARS)}…`
					: line,
			);
		if (excerpt.length === 0) return undefined;
		const remaining = match.other.endLine - end;
		if (remaining > 0) excerpt.push(`… (${remaining} more lines)`);
		return excerpt.join("\n");
	} catch {
		return undefined;
	}
}

function fenced(body: string): string {
	const fence = body.includes("```") ? "~~~~" : "```";
	return `${fence}\n${body}\n${fence}`;
}

function renderEntries(
	matches: readonly DuplicateMatch[],
	excerpts: readonly (string | undefined)[],
): string[] {
	const out: string[] = [];
	for (let i = 0; i < matches.length; i++) {
		out.push(`- ${describeMatch(matches[i]!)}`);
		const excerpt = excerpts[i];
		if (excerpt !== undefined)
			out.push(
				`  Existing code in ${matches[i]!.other.file}:`,
				fenced(excerpt),
			);
	}
	return out;
}

const INSTRUCTION =
	"Reuse the existing code instead of copying it: import/call it, or extract the shared logic into one helper both places use. If the duplication is intentional, ignore this.";

function compose(
	file: string,
	entries: string[],
	omitted: number,
	artifactId: string | undefined,
): string {
	const lines = [
		`Your last change to ${file} duplicates existing code:`,
		...entries,
	];
	if (omitted > 0) {
		lines.push(
			artifactId !== undefined
				? `… ${omitted} more duplicate(s) omitted; full report: artifact://${artifactId}`
				: `… ${omitted} more duplicate(s) omitted.`,
		);
	} else if (artifactId !== undefined) {
		lines.push(`Full report with excerpts: artifact://${artifactId}`);
	}
	lines.push(INSTRUCTION);
	return lines.join("\n");
}

export async function buildReminder(
	input: BuildReminderInput,
): Promise<Reminder> {
	const { root, file, matches } = input;
	const shown = matches.slice(0, MAX_INLINE_MATCHES);
	const omitted = matches.length - shown.length;
	const excerpts = await Promise.all(
		matches.map((match) => readExcerpt(root, match)),
	);
	const inline = compose(
		file,
		renderEntries(shown, excerpts),
		omitted,
		undefined,
	);

	let artifactId: string | undefined;
	let text = inline;
	if (omitted > 0 || Buffer.byteLength(inline) > MAX_INLINE_BYTES) {
		const full = compose(file, renderEntries(matches, excerpts), 0, undefined);
		artifactId = await input.saveArtifact?.(full).catch(() => undefined);
		text = compose(file, renderEntries(shown, excerpts), omitted, artifactId);
		if (Buffer.byteLength(text) > MAX_INLINE_BYTES) {
			// Excerpts are what blows the budget; the artifact (when saved) keeps them.
			text = compose(file, renderEntries(shown, []), omitted, artifactId);
		}
	}
	const details: WarningDetails = { file, root, matches: shown, omitted };
	if (artifactId !== undefined) details.artifactId = artifactId;
	return { text, details };
}
