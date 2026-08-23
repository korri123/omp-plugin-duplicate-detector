/**
 * TUI notification component for duplicate detector warnings and reports.
 * Styled to visually match the TTSR (Time-Traveling Stream Rules) notification in oh-my-pi.
 */

export interface CloneDuplicationSpan {
	sourceId: string;
	start: { line: number; column?: number };
	end: { line: number; column?: number };
	fragment?: string;
}

export interface CloneItem {
	duplicationA: CloneDuplicationSpan;
	duplicationB: CloneDuplicationSpan;
	format?: string;
}

export interface DuplicateNotificationData {
	filePath?: string;
	clones?: CloneItem[];
	content?: string;
	title?: string;
}

export interface ThemeColors {
	warning: string;
	[key: string]: string;
}

export interface ThemeIcons {
	warning?: string;
	rewind?: string;
	package?: string;
	[key: string]: string | undefined;
}

export interface ThemeLike {
	fg(color: string, text: string): string;
	bg(color: string, text: string): string;
	bold(text: string): string;
	italic(text: string): string;
	inverse(text: string): string;
	icon: ThemeIcons;
}

const MAX_COLLAPSED_CLONES = 4;

/**
 * Parse structured clone info from system reminder XML or raw duplicate text if data object is absent.
 */
export function parseClonesFromText(text: string): { filePath: string; clones: CloneItem[] } {
	let filePath = "";
	const fileMatch = text.match(/file="([^"]+)"/) || text.match(/in '([^']+)'/);
	if (fileMatch) {
		filePath = fileMatch[1] ?? "";
	}

	const clones: CloneItem[] = [];
	const duplicateRegex =
		/### Duplicate #\d+ \((\d+) lines, format: ([^\)]+)\)[\s\S]*?- Current change: `([^`]+?):(\d+)-(\d+)`[\s\S]*?- Pre-existing copy: `([^`]+?):(\d+)-(\d+)`([\s\S]*?)(?=(?:### Duplicate #|<\/system-reminder>|$))/g;
	let match: RegExpExecArray | null;
	while ((match = duplicateRegex.exec(text)) !== null) {
		const [, _lines, format, fileA, startA, endA, fileB, startB, endB, rawSnippet] = match;
		let snippet = "";
		if (rawSnippet) {
			const codeBlockMatch = rawSnippet.match(/```[a-z0-9_-]*\n([\s\S]*?)```/i);
			snippet = codeBlockMatch ? (codeBlockMatch[1] ?? "").trim() : rawSnippet.trim();
		}

		const startLineA = Number.parseInt(startA || "1", 10) || 1;
		const endLineA = Number.parseInt(endA || "1", 10) || startLineA;
		const startLineB = Number.parseInt(startB || "1", 10) || 1;
		const endLineB = Number.parseInt(endB || "1", 10) || startLineB;

		clones.push({
			format: format?.trim() || "text",
			duplicationA: {
				sourceId: fileA?.trim() || filePath,
				start: { line: startLineA },
				end: { line: endLineA },
				fragment: snippet,
			},
			duplicationB: {
				sourceId: fileB?.trim() || "",
				start: { line: startLineB },
				end: { line: endLineB },
			},
		});
	}

	return { filePath, clones };
}

/**
 * Strips ANSI escape sequences for length calculation.
 */
function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Pad a line to the target width taking into account existing visual width.
 */
function padLine(text: string, width: number): string {
	const visibleLen = stripAnsi(text).length;
	if (visibleLen >= width) return text;
	return text + " ".repeat(width - visibleLen);
}
/**
 * TUI Component that renders duplicate detection notifications in TTSR style.
 */
export class DuplicateNotificationComponent {
	readonly #data: DuplicateNotificationData;
	#expanded = false;
	readonly #theme: ThemeLike;

	constructor(data: DuplicateNotificationData, expanded = false, theme?: ThemeLike) {
		this.#data = data;
		this.#expanded = expanded;
		this.#theme = {
			fg: typeof theme?.fg === "function" ? theme.fg.bind(theme) : (_color, t) => t,
			bg: typeof theme?.bg === "function" ? theme.bg.bind(theme) : (_color, t) => t,
			bold: typeof theme?.bold === "function" ? theme.bold.bind(theme) : (t) => `\x1b[1m${t}\x1b[22m`,
			italic: typeof theme?.italic === "function" ? theme.italic.bind(theme) : (t) => `\x1b[3m${t}\x1b[23m`,
			inverse: typeof theme?.inverse === "function" ? theme.inverse.bind(theme) : (t) => `\x1b[7m${t}\x1b[27m`,
			icon: {
				warning: theme?.icon?.warning ?? "⚠️",
				rewind: theme?.icon?.rewind ?? "⤺",
				...(theme?.icon ?? {}),
			},
		};
	}
	setExpanded(expanded: boolean): void {
		this.#expanded = expanded;
	}

	isExpanded(): boolean {
		return this.#expanded;
	}

	render(width = 80): readonly string[] {
		const targetWidth = typeof width === "number" && !Number.isNaN(width) ? Math.max(30, width - 4) : 76;
		const theme = this.#theme;
		const lines: string[] = [];

		const warnIcon = theme.icon?.warning ?? "⚠️";
		const rewindIcon = theme.icon?.rewind ?? "⤺";

		let filePath = this.#data.filePath || "";
		let clones = this.#data.clones || [];

		if ((!filePath || clones.length === 0) && this.#data.content) {
			const parsed = parseClonesFromText(this.#data.content);
			if (!filePath) filePath = parsed.filePath;
			if (clones.length === 0) clones = parsed.clones;
		}

		// Header
		let header: string;
		if (clones.length <= 1) {
			const target = filePath ? theme.bold(filePath) : "Code Duplication";
			header = `${warnIcon} Duplicate detected: ${target}  ${rewindIcon}`;
		} else {
			const target = filePath ? theme.bold(filePath) : "workspace";
			header = `${warnIcon} ${clones.length} duplicate blocks detected: ${target}  ${rewindIcon}`;
		}

		lines.push(header);
		lines.push(""); // Inner spacer

		// Content
		if (clones.length === 0) {
			const rawDesc = (this.#data.content || "Duplicated code found in recent changes.").trim();
			const snippetLines = rawDesc.split("\n");
			if (!this.#expanded && snippetLines.length > 2) {
				lines.push(theme.italic(`${snippetLines.slice(0, 2).join(" ")}…`));
				lines.push(theme.italic(" (ctrl+o to expand)"));
			} else {
				lines.push(theme.italic(rawDesc));
			}
		} else if (clones.length === 1) {
			const clone = clones[0]!;
			const a = clone.duplicationA;
			const b = clone.duplicationB;
			const linesCount = a.end.line - a.start.line + 1;
			const srcA = a.sourceId.replace(/^virtual:/, "");
			const srcB = b.sourceId.replace(/^virtual:/, "");
			const location = `• ${srcA}:${a.start.line}-${a.end.line} ↔ ${srcB}:${b.start.line}-${b.end.line} (${linesCount} lines)`;
			lines.push(location);

			const snippet = a.fragment?.trim();
			if (snippet) {
				const snippetLines = snippet.split(/\r?\n/);
				if (!this.#expanded) {
					for (const sLine of snippetLines.slice(0, 2)) {
						lines.push(theme.italic(`  ${sLine}`));
					}
					if (snippetLines.length > 2) {
						lines.push(theme.italic("  … (ctrl+o to expand)"));
					}
				} else {
					lines.push("");
					for (const sLine of snippetLines) {
						lines.push(theme.italic(`  ${sLine}`));
					}
				}
			}
		} else {
			// Multi-clone display
			const visible = this.#expanded ? clones : clones.slice(0, MAX_COLLAPSED_CLONES);
			for (let i = 0; i < visible.length; i++) {
				const clone = visible[i]!;
				const a = clone.duplicationA;
				const b = clone.duplicationB;
				const linesCount = a.end.line - a.start.line + 1;
				const srcA = a.sourceId.replace(/^virtual:/, "");
				const srcB = b.sourceId.replace(/^virtual:/, "");
				const loc = `• ${srcA}:${a.start.line}-${a.end.line} ↔ ${srcB}:${b.start.line}-${b.end.line} (${linesCount} lines)`;
				lines.push(loc);

				if (this.#expanded && a.fragment?.trim()) {
					const snippetLines = a.fragment.trim().split(/\r?\n/);
					for (const sLine of snippetLines.slice(0, 5)) {
						lines.push(theme.italic(`    ${sLine}`));
					}
					if (snippetLines.length > 5) {
						lines.push(theme.italic(`    … +${snippetLines.length - 5} lines`));
					}
				}
			}

			const hidden = clones.length - visible.length;
			if (hidden > 0) {
				lines.push(theme.italic(`… +${hidden} more (ctrl+o to expand)`));
			} else if (!this.#expanded && clones.length > 0) {
				lines.push(theme.italic(" (ctrl+o to expand)"));
			}
		}
		// Defensive flattening: ensure no element in lines contains embedded newlines or raw tabs
		const flatLines: string[] = [];
		for (const line of lines) {
			const sanitized = line.replace(/\t/g, "  ");
			if (sanitized.includes("\n")) {
				flatLines.push(...sanitized.split(/\r?\n/));
			} else {
				flatLines.push(sanitized);
			}
		}
		const paddedLines = flatLines.map((line) => {
			const contentWithPadding = ` ${line}`;
			const padded = padLine(contentWithPadding, targetWidth);
			return theme.inverse(theme.fg("warning", padded));
		});

		// Add top/bottom empty line with inverse warning background for box effect
		const emptyBoxLine = theme.inverse(theme.fg("warning", " ".repeat(targetWidth)));
		const boxed = [emptyBoxLine, ...paddedLines, emptyBoxLine];

		// Leading spacer line above the box (matching TtsrNotificationComponent Spacer(1))
		return ["", ...boxed];
	}
}
