/**
 * Format detection and tokenization into a compact, typed-array token stream.
 * Worker-only: loads the jscpd tokenizer.
 */
import * as path from "node:path";
import type { IToken } from "@jscpd/core";
import {
	EXT_TO_FORMAT,
	FORMATS,
	tokenize as jscpdTokenize,
	Tokenizer,
} from "@jscpd/tokenizer";

export interface TokenStream {
	/** 32-bit hash per significant token (comments/whitespace excluded, jscpd "mild" semantics). */
	hashes: Uint32Array;
	/** 1-based start/end line per token. */
	startLines: Uint32Array;
	endLines: Uint32Array;
}

/**
 * Hash value reserved for stream separators (boundaries between independently
 * tokenized blocks). Real token hashes are never 0; the clone index never lets
 * a match cross a separator.
 */
export const SEPARATOR_HASH = 0;

/** Non-code data, documentation, and metadata formats excluded unless opted in via formatsExts. */
const NON_CODE_FORMATS: ReadonlySet<string> = new Set([
	"abnf",
	"apacheconf",
	"arff",
	"asciidoc",
	"bnf",
	"comments",
	"csp",
	"csv",
	"diff",
	"dns-zone-file",
	"dot",
	"ebnf",
	"editorconfig",
	"excel-formula",
	"gedcom",
	"gettext",
	"git",
	"hpkp",
	"hsts",
	"http",
	"ignore",
	"ini",
	"json",
	"json5",
	"keymap",
	"latex",
	"log",
	"markdown",
	"mermaid",
	"nginx",
	"plant-uml",
	"properties",
	"regex",
	"rest",
	"roboconf",
	"shell-session",
	"sparql",
	"tap",
	"textile",
	"toml",
	"turtle",
	"txt",
	"uri",
	"url",
	"wiki",
	"yaml",
]);

/** Markup extensions that are data, not code. */
const NON_CODE_MARKUP_EXTS: ReadonlySet<string> = new Set([
	"svg",
	"xml",
	"xsl",
	"xslt",
]);

/** Formats jscpd tokenizes block-wise (one token map per embedded language). */
const BLOCK_FORMATS: ReadonlySet<string> = new Set([
	"vue",
	"astro",
	"svelte",
	"markdown",
]);

/**
 * jscpd format for a repo-relative path, or undefined when not a supported code
 * format. Extensions listed in `formatsExts` map to their format first and are
 * opted in even when the format is non-code by default; every other extension
 * uses jscpd's default mapping with non-code formats (data, docs, plain markup
 * data files such as .svg/.xml) excluded.
 */
export function detectFormat(
	relPath: string,
	formatsExts?: Record<string, string[]>,
): string | undefined {
	const ext = path.extname(relPath).slice(1);
	if (!ext) return undefined;
	const lowerExt = ext.toLowerCase();
	if (formatsExts) {
		for (const [format, exts] of Object.entries(formatsExts)) {
			if (format in FORMATS && (exts.includes(ext) || exts.includes(lowerExt)))
				return format;
		}
	}
	const format = EXT_TO_FORMAT.get(ext) ?? EXT_TO_FORMAT.get(lowerExt);
	if (!format || !(format in FORMATS)) return undefined;
	if (NON_CODE_FORMATS.has(format)) return undefined;
	if (format === "markup" && NON_CODE_MARKUP_EXTS.has(lowerExt))
		return undefined;
	return format;
}

/**
 * Significant-token filter: jscpd "mild" (drops ignored regions, whitespace,
 * newlines) plus comments and whitespace-only values, so copies that differ only
 * in layout or comments tokenize identically.
 */
function isSignificant(token: IToken): boolean {
	const { type } = token;
	return (
		type !== "ignore" &&
		type !== "empty" &&
		type !== "new_line" &&
		type !== "comment" &&
		type !== "block-comment" &&
		token.format !== "comment" &&
		token.value.trim().length > 0
	);
}

/** FNV-1a over `type`, a 0xff delimiter, and the trimmed `value`, finalized with murmur3 fmix32. Never 0. */
function hashToken(type: string, value: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < type.length; i++) {
		h = Math.imul(h ^ type.charCodeAt(i), 0x01000193);
	}
	h = Math.imul(h ^ 0xff, 0x01000193);
	let start = 0;
	let end = value.length;
	while (start < end && value.charCodeAt(start) <= 32) start++;
	while (end > start && value.charCodeAt(end - 1) <= 32) end--;
	for (let i = start; i < end; i++) {
		h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	h >>>= 0;
	return h === SEPARATOR_HASH ? 1 : h;
}

/** Growable typed-array builder; the result is copied to exact size. */
class StreamBuilder {
	#hashes: Uint32Array;
	#start: Uint32Array;
	#end: Uint32Array;
	#length = 0;

	constructor(capacity: number) {
		const size = Math.max(16, capacity);
		this.#hashes = new Uint32Array(size);
		this.#start = new Uint32Array(size);
		this.#end = new Uint32Array(size);
	}

	get length(): number {
		return this.#length;
	}

	push(hash: number, startLine: number, endLine: number): void {
		if (this.#length === this.#hashes.length) this.#grow();
		const i = this.#length++;
		this.#hashes[i] = hash;
		this.#start[i] = startLine;
		this.#end[i] = endLine;
	}

	/** Separator between independent blocks; carries the previous token's end line. */
	pushSeparator(): void {
		const n = this.#length;
		if (n === 0 || this.#hashes[n - 1] === SEPARATOR_HASH) return;
		const line = this.#end[n - 1];
		this.push(SEPARATOR_HASH, line, line);
	}

	pushTokens(tokens: readonly IToken[]): void {
		for (const token of tokens) {
			if (!isSignificant(token)) continue;
			const startLine = token.loc?.start.line ?? 1;
			const endLine = token.loc?.end.line ?? startLine;
			this.push(hashToken(token.type, token.value), startLine, endLine);
		}
	}

	finish(): TokenStream {
		let n = this.#length;
		if (n > 0 && this.#hashes[n - 1] === SEPARATOR_HASH) n--;
		return {
			hashes: this.#hashes.slice(0, n),
			startLines: this.#start.slice(0, n),
			endLines: this.#end.slice(0, n),
		};
	}

	#grow(): void {
		const size = this.#hashes.length * 2;
		const hashes = new Uint32Array(size);
		hashes.set(this.#hashes);
		const start = new Uint32Array(size);
		start.set(this.#start);
		const end = new Uint32Array(size);
		end.set(this.#end);
		this.#hashes = hashes;
		this.#start = start;
		this.#end = end;
	}
}

let blockTokenizer: Tokenizer | undefined;

const BLOCK_OPTIONS = {
	mode: isSignificant,
	// The per-map frame hashes jscpd builds are unused; keep them trivially cheap.
	hashFunction: () => "",
};

/**
 * Tokenizes `content` as `format` into significant-token hashes and lines.
 * Block formats (vue, svelte, astro, markdown) yield one jscpd map per embedded
 * language; maps are concatenated with separators so no match spans two maps.
 * Tokenizer failures yield an empty stream.
 */
export function tokenize(content: string, format: string): TokenStream {
	const builder = new StreamBuilder(content.length >>> 3);
	try {
		if (BLOCK_FORMATS.has(format)) {
			blockTokenizer ??= new Tokenizer();
			const maps = blockTokenizer.generateMaps(
				"source",
				content,
				format,
				BLOCK_OPTIONS,
			);
			for (const map of maps) {
				// jscpd's TokensMap keeps its tokens in a field its typings mark private.
				if (!("tokens" in map) || !Array.isArray(map.tokens)) continue;
				builder.pushSeparator();
				builder.pushTokens(map.tokens);
			}
		} else {
			builder.pushTokens(jscpdTokenize(content, format));
		}
	} catch {
		return new StreamBuilder(0).finish();
	}
	return builder.finish();
}
