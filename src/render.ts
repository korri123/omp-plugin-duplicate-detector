/**
 * Transcript card for the `duplicate-detector-warning` custom message.
 *
 * Built on omp's own warning notice shell (`MessageNoticeComponent`, the TTSR /
 * todo-reminder look): a plain terminal draws the warning-inverse box from
 * `render()`, a Tern native terminal gets a warning-toned `card` from
 * `describe()`. Both memoize (same rows per width, same node while unchanged).
 * All `@oh-my-pi/pi-tui` imports resolve to the host's modules at runtime.
 */
import * as path from "node:path";
import type { Component, NativeChild, Theme, TspSpan } from "@oh-my-pi/pi-tui";
import { md, span, Text, text } from "@oh-my-pi/pi-tui";
import type { MessageRenderer } from "@oh-my-pi/pi-tui/chat/extension-types";
import type { CustomMessageContent } from "@oh-my-pi/pi-tui/chat/messages";
import {
	MessageNoticeComponent,
	type MessageNoticeNativePresentation,
	type MessageNoticePresentation,
} from "@oh-my-pi/pi-tui/chrome/message-notice";
import {
	fileHyperlink,
	isNativeLinkEnabled,
	tryFileUri,
} from "@oh-my-pi/pi-tui/render/hyperlink";
import { expandKeyHint } from "@oh-my-pi/pi-tui/render/render-utils";
import type { CodeRegion, DuplicateMatch, WarningDetails } from "./types";

const TITLE = "Possible duplicate code";
const ROLE = "omp.notice.duplicate";
/** Legacy content lines shown while collapsed (plain) / before the native clamp. */
const LEGACY_PREVIEW_LINES = 4;

type Fields<T> = { readonly [K in keyof T]?: unknown };

function isLine(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRegion(value: unknown): value is CodeRegion {
	if (typeof value !== "object" || value === null) return false;
	const region = value as Fields<CodeRegion>;
	return (
		typeof region.file === "string" &&
		isLine(region.startLine) &&
		isLine(region.endLine)
	);
}

function isMatch(value: unknown): value is DuplicateMatch {
	if (typeof value !== "object" || value === null) return false;
	const match = value as Fields<DuplicateMatch>;
	return (
		isRegion(match.region) &&
		isRegion(match.other) &&
		typeof match.tokens === "number" &&
		typeof match.key === "string"
	);
}

/** True for the current `details` shape; old sessions persisted `{filePath, clones, content}` or nothing. */
function isWarningDetails(value: unknown): value is WarningDetails {
	if (typeof value !== "object" || value === null) return false;
	const details = value as Fields<WarningDetails>;
	return (
		typeof details.file === "string" &&
		Array.isArray(details.matches) &&
		details.matches.every(isMatch) &&
		isLine(details.omitted) &&
		(details.artifactId === undefined ||
			typeof details.artifactId === "string") &&
		(details.root === undefined || typeof details.root === "string")
	);
}

/** The message text; old sessions wrapped it in a `<system-reminder …>` block, which is dropped for display. */
function contentText(content: CustomMessageContent | undefined): string {
	let joined = "";
	if (typeof content === "string") joined = content;
	else if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const part of content) if (part.type === "text") parts.push(part.text);
		joined = parts.join("\n");
	}
	return joined
		.trim()
		.replace(/^<system-reminder\b[^>]*>\s*/, "")
		.replace(/\s*<\/system-reminder>$/, "");
}

function regionLabel(region: CodeRegion): string {
	return region.startLine === region.endLine
		? `${region.file}:${region.startLine}`
		: `${region.file}:${region.startLine}-${region.endLine}`;
}

/** `5 lines` / `5 lines · 120 tokens` for one match. */
function matchFacts(match: DuplicateMatch, withTokens: boolean): string {
	const count = match.region.endLine - match.region.startLine + 1;
	const lines = `${count} ${count === 1 ? "line" : "lines"}`;
	return withTokens
		? `${lines} · ${match.tokens} ${match.tokens === 1 ? "token" : "tokens"}`
		: lines;
}

/** A `path` span, linked (`file://`, plus the line for custom link handlers) when the root is known. */
function pathSpan(
	root: string | undefined,
	file: string,
	label: string,
	line?: number,
): TspSpan {
	const href =
		root && isNativeLinkEnabled()
			? tryFileUri(
					path.join(root, file),
					line === undefined ? undefined : { line },
				)
			: undefined;
	return href ? span(label, "path", { href }) : span(label, "path");
}

/** `label` as an OSC 8 file hyperlink when the root is known and the terminal takes them. */
function pathLink(
	root: string | undefined,
	file: string,
	label: string,
	line?: number,
): string {
	return root
		? fileHyperlink(
				path.join(root, file),
				label,
				line === undefined ? undefined : { line },
			)
		: label;
}

function warningPresentation(
	details: WarningDetails,
	root: string | undefined,
	theme: Theme,
	expanded: boolean,
): MessageNoticePresentation {
	// Inside the inverse warning box fg colors clash, so emphasis is bold/italic only.
	const header = `${TITLE} · ${theme.bold(pathLink(root, details.file, details.file))}`;
	const rows: string[] = details.matches.map((match) => {
		const region = pathLink(
			root,
			match.region.file,
			regionLabel(match.region),
			match.region.startLine,
		);
		const other = pathLink(
			root,
			match.other.file,
			regionLabel(match.other),
			match.other.startLine,
		);
		return `${region} ↔ ${other} ${theme.italic(`(${matchFacts(match, expanded)})`)}`;
	});
	if (details.omitted > 0)
		rows.push(theme.italic(`… +${details.omitted} more`));
	if (details.artifactId)
		rows.push(theme.italic(`Full report: artifact://${details.artifactId}`));
	const body: Component[] = rows.map((row) => new Text(row, 0, 0));
	return { icon: theme.icon.warning, header, body };
}

function warningNativePresentation(
	details: WarningDetails,
	root: string | undefined,
): MessageNoticeNativePresentation {
	const head = [
		span(TITLE, "strong"),
		span(" · ", "muted"),
		pathSpan(root, details.file, details.file),
	];
	const body: NativeChild[] = details.matches.map((match, index) =>
		text(
			[
				pathSpan(
					root,
					match.region.file,
					regionLabel(match.region),
					match.region.startLine,
				),
				span(" ↔ ", "muted"),
				pathSpan(
					root,
					match.other.file,
					regionLabel(match.other),
					match.other.startLine,
				),
				span(` · ${matchFacts(match, true)}`, "muted"),
			],
			{ wrap: "word", key: `m${index}` },
		),
	);
	if (details.omitted > 0)
		body.push(
			text([span(`+${details.omitted} more`, "muted")], { key: "omitted" }),
		);
	if (details.artifactId) {
		body.push(
			text(
				[
					span("Full report: ", "muted"),
					span(`artifact://${details.artifactId}`, "mono"),
				],
				{
					wrap: "word",
					key: "artifact",
				},
			),
		);
	}
	return { head, body };
}

function legacyPresentation(
	file: string | undefined,
	content: string,
	theme: Theme,
	expanded: boolean,
): MessageNoticePresentation {
	const header = file ? `${TITLE} · ${theme.bold(file)}` : TITLE;
	if (!content) return { icon: theme.icon.warning, header };
	const lines = content.split("\n");
	const clamped = !expanded && lines.length > LEGACY_PREVIEW_LINES;
	const shown = clamped
		? `${lines.slice(0, LEGACY_PREVIEW_LINES).join("\n")}…`
		: content;
	const body: Component[] = [new Text(theme.italic(shown), 0, 0)];
	if (clamped)
		body.push(new Text(theme.italic(`(${expandKeyHint()} to expand)`), 0, 0));
	return { icon: theme.icon.warning, header, body };
}

function legacyNativePresentation(
	file: string | undefined,
	content: string,
): MessageNoticeNativePresentation {
	const head = file
		? [span(TITLE, "strong"), span(" · ", "muted"), span(file, "path")]
		: [span(TITLE, "strong")];
	if (!content) return { head };
	return {
		head,
		body: [md(content, { key: "content" })],
		// Long legacy reports clamp natively; the terminal owns the collapse.
		preview:
			content.split("\n").length > LEGACY_PREVIEW_LINES
				? { lines: LEGACY_PREVIEW_LINES }
				: undefined,
	};
}

/**
 * Renderer for `WARNING_MESSAGE_TYPE`. Current details draw one row per match
 * (edited region ↔ existing code) plus the omitted count and report artifact;
 * anything else (legacy sessions) draws the message text in the same card.
 */
export function createWarningRenderer(): MessageRenderer<WarningDetails> {
	return (message, options, theme) => {
		const details: unknown = message.details;
		const background = (line: string) =>
			theme.inverse(theme.fg("warning", line));
		let notice: MessageNoticeComponent;
		if (isWarningDetails(details)) {
			const root =
				details.root && path.isAbsolute(details.root)
					? details.root
					: undefined;
			notice = new MessageNoticeComponent({
				role: ROLE,
				severity: "warning",
				background,
				presentation: (context) =>
					warningPresentation(details, root, theme, context.expanded),
				nativePresentation: () => warningNativePresentation(details, root),
			});
		} else {
			const legacy = details as { filePath?: unknown } | undefined;
			const file =
				typeof legacy?.filePath === "string" && legacy.filePath
					? legacy.filePath
					: undefined;
			const content = contentText(message.content);
			notice = new MessageNoticeComponent({
				role: ROLE,
				severity: "warning",
				background,
				presentation: (context) =>
					legacyPresentation(file, content, theme, context.expanded),
				nativePresentation: () => legacyNativePresentation(file, content),
			});
		}
		notice.setExpanded(options.expanded);
		return notice;
	};
}
