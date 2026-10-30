import { describe, expect, test } from "bun:test";
import { CloneIndex } from "../src/engine/clone-index";
import {
	detectFormat,
	type TokenStream,
	tokenize,
} from "../src/engine/tokenize";

const OPTIONS = { minTokens: 50, minLines: 5 };

const ts = (lines: string[]): TokenStream =>
	tokenize(lines.join("\n"), "typescript");

const SUMMARIZE = [
	"export function summarizeOrders(orders: Order[], options: SummaryOptions): OrderSummary {",
	"\tconst totals = new Map<string, number>();",
	"\tlet largest: Order | undefined;",
	"\tlet refunded = 0;",
	"\tfor (const order of orders) {",
	'\t\tif (order.status === "refunded") {',
	"\t\t\trefunded += order.amount;",
	"\t\t\tcontinue;",
	"\t\t}",
	'\t\tconst key = options.groupBy === "customer" ? order.customerId : order.region;',
	"\t\tconst current = totals.get(key) ?? 0;",
	"\t\ttotals.set(key, current + order.amount * (1 - order.discount));",
	"\t\tif (!largest || order.amount > largest.amount) {",
	"\t\t\tlargest = order;",
	"\t\t}",
	"\t}",
	"\tconst groups = [...totals.entries()]",
	"\t\t.map(([group, total]) => ({ group, total: Math.round(total * 100) / 100 }))",
	"\t\t.sort((a, b) => b.total - a.total)",
	"\t\t.slice(0, options.limit);",
	"\treturn {",
	"\t\tgroups,",
	"\t\tlargestOrderId: largest?.id,",
	"\t\trefunded,",
	"\t\tgeneratedAt: options.now.toISOString(),",
	"\t};",
	"}",
];

const PARSE_CONFIG = [
	"export async function loadSettings(path: string): Promise<Settings> {",
	'\tconst raw = await readFile(path, "utf8");',
	"\tconst parsed = JSON.parse(raw) as Partial<Settings>;",
	"\tif (typeof parsed.port !== 'number' || parsed.port < 1) {",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text, not a template
	"\t\tthrow new Error(`invalid port in ${path}`);",
	"\t}",
	"\treturn { host: parsed.host ?? 'localhost', port: parsed.port, tls: Boolean(parsed.tls) };",
	"}",
];

const RENDER_ROW = [
	"export function renderRow(cells: Cell[], width: number): string {",
	"\tlet line = '';",
	"\tfor (const cell of cells) {",
	"\t\tconst text = cell.label.padEnd(cell.width).slice(0, cell.width);",
	"\t\tline += cell.align === 'right' ? text.padStart(width) : text;",
	"\t}",
	"\treturn line.trimEnd();",
	"}",
];

const RETRY = [
	"export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {",
	"\tlet lastError: unknown;",
	"\tfor (let i = 0; i < attempts; i++) {",
	"\t\ttry {",
	"\t\t\treturn await fn();",
	"\t\t} catch (error) {",
	"\t\t\tlastError = error;",
	"\t\t\tawait sleep(2 ** i * 50);",
	"\t\t}",
	"\t}",
	"\tthrow lastError;",
	"}",
];

/** a.ts: VERSION constant, then SUMMARIZE at lines 3..29, then PARSE_CONFIG. */
const A = ["const VERSION = 3;", "", ...SUMMARIZE, "", ...PARSE_CONFIG];
const A_SUMMARIZE_START = 3;
const A_SUMMARIZE_END = A_SUMMARIZE_START + SUMMARIZE.length - 1;

function indexWith(files: Record<string, string[]>): CloneIndex {
	const index = new CloneIndex(OPTIONS);
	for (const [file, lines] of Object.entries(files)) index.set(file, ts(lines));
	return index;
}

describe("CloneIndex.findNewDuplicates", () => {
	test("new file copying a function reports exactly one match with both sides' lines", () => {
		const index = indexWith({ "a.ts": A, "r.ts": RENDER_ROW });
		const b = [
			...SUMMARIZE,
			"",
			"const report = summarizeOrders([], defaults);",
		];
		const matches = index.findNewDuplicates("b.ts", ts(b), undefined);
		expect(matches).toHaveLength(1);
		const [match] = matches;
		expect(match.region).toEqual({
			file: "b.ts",
			startLine: 1,
			endLine: SUMMARIZE.length,
		});
		expect(match.other).toEqual({
			file: "a.ts",
			startLine: A_SUMMARIZE_START,
			endLine: A_SUMMARIZE_END,
		});
		expect(match.tokens).toBeGreaterThanOrEqual(OPTIONS.minTokens);
	});

	test("inserting a copied block into an existing file covers the inserted lines", () => {
		const c = [...RENDER_ROW, "", ...RETRY];
		const index = indexWith({ "a.ts": A, "c.ts": c });
		const insertAt = RENDER_ROW.length + 1; // after the blank line, before RETRY
		const edited = [
			...c.slice(0, insertAt),
			...SUMMARIZE,
			"",
			...c.slice(insertAt),
		];
		const matches = index.findNewDuplicates(
			"c.ts",
			ts(edited),
			index.get("c.ts"),
		);
		expect(matches).toHaveLength(1);
		const [match] = matches;
		expect(match.region.startLine).toBeLessThanOrEqual(insertAt + 1);
		expect(match.region.endLine).toBeGreaterThanOrEqual(
			insertAt + SUMMARIZE.length,
		);
		expect(match.other.file).toBe("a.ts");
		expect(match.other.startLine).toBe(A_SUMMARIZE_START);
	});

	test("editing an unrelated function of a file that already duplicates another reports nothing", () => {
		const d = [...RETRY, "", ...SUMMARIZE, "", ...RENDER_ROW];
		const index = indexWith({ "a.ts": A, "d.ts": d });
		const edited = d.map((line) =>
			line.replace("line.trimEnd()", "line.trim()"),
		);
		expect(edited).not.toEqual(d);
		expect(
			index.findNewDuplicates("d.ts", ts(edited), index.get("d.ts")),
		).toEqual([]);
	});

	test("editing one line inside an already-duplicated block reports nothing", () => {
		const d = [...RETRY, "", ...SUMMARIZE, "", ...RENDER_ROW];
		const index = indexWith({ "a.ts": A, "d.ts": d });
		const edited = d.map((line) =>
			line === "\tlet refunded = 0;"
				? "\tlet refunded = Number(options.initialRefund ?? 0);"
				: line,
		);
		expect(edited).not.toEqual(d);
		expect(
			index.findNewDuplicates("d.ts", ts(edited), index.get("d.ts")),
		).toEqual([]);
	});

	test("re-converging a diverged copy reports nothing new", () => {
		const diverged = SUMMARIZE.map((line) =>
			line === "\t\t\tlargest = order;"
				? "\t\t\tlargest = { ...order };"
				: line,
		);
		const d = [...RETRY, "", ...diverged];
		const index = indexWith({ "a.ts": A, "d.ts": d });
		const edited = [...RETRY, "", ...SUMMARIZE];
		expect(
			index.findNewDuplicates("d.ts", ts(edited), index.get("d.ts")),
		).toEqual([]);
	});

	test("intra-file copy of an existing function is reported against the same file", () => {
		const e = [...SUMMARIZE, "", ...RENDER_ROW];
		const index = indexWith({ "e.ts": e });
		const copy = SUMMARIZE.map((line) =>
			line.replace(
				"function summarizeOrders(",
				"function summarizeOrdersAgain(",
			),
		);
		const edited = [...e, "", ...copy];
		const copyStart = e.length + 2;
		const matches = index.findNewDuplicates(
			"e.ts",
			ts(edited),
			index.get("e.ts"),
		);
		expect(matches).toHaveLength(1);
		const [match] = matches;
		expect(match.region).toEqual({
			file: "e.ts",
			startLine: copyStart,
			endLine: copyStart + SUMMARIZE.length - 1,
		});
		expect(match.other).toEqual({
			file: "e.ts",
			startLine: 1,
			endLine: SUMMARIZE.length,
		});
	});

	test("an existing intra-file duplicate is not reported again after an unrelated edit", () => {
		const copy = SUMMARIZE.map((line) =>
			line.replace(
				"function summarizeOrders(",
				"function summarizeOrdersAgain(",
			),
		);
		const e = [...SUMMARIZE, "", ...RENDER_ROW, "", ...copy];
		const index = indexWith({ "e.ts": e });
		const edited = [
			...RETRY,
			"",
			...e.map((line) => line.replace("line.trimEnd()", "line")),
		];
		expect(
			index.findNewDuplicates("e.ts", ts(edited), index.get("e.ts")),
		).toEqual([]);
	});

	test("copies below minTokens or below minLines are not reported", () => {
		const clamp = [
			"export function clamp(value: number, low: number, high: number): number {",
			"\tif (value < low) return low;",
			"\tif (value > high) return high;",
			"\treturn value;",
			"}",
		];
		const index = indexWith({ "a.ts": A, "k.ts": clamp });
		expect(ts(clamp).hashes.length).toBeLessThan(OPTIONS.minTokens);
		expect(
			index.findNewDuplicates(
				"s.ts",
				ts(["const x = 1;", ...clamp]),
				undefined,
			),
		).toEqual([]);
		// SUMMARIZE collapsed onto one line: same tokens, one line.
		const oneLine = SUMMARIZE.map((line) => line.trim()).join(" ");
		expect(
			index.findNewDuplicates("s.ts", ts(["const x = 1;", oneLine]), undefined),
		).toEqual([]);
	});

	test("a copy differing only in whitespace and comments still matches", () => {
		const index = indexWith({ "a.ts": A });
		const reformatted = SUMMARIZE.flatMap((line, i) => {
			const spaced = line
				.replace(/^\t+/, (tabs) => "  ".repeat(tabs.length))
				.replace(/ = /g, "   =   ");
			return i % 5 === 2
				? ["  // explain the next statement", `${spaced} /* inline */`]
				: [spaced];
		});
		const matches = index.findNewDuplicates(
			"f.ts",
			ts(["let y = 2;", ...reformatted]),
			undefined,
		);
		expect(matches).toHaveLength(1);
		expect(matches[0].other).toEqual({
			file: "a.ts",
			startLine: A_SUMMARIZE_START,
			endLine: A_SUMMARIZE_END,
		});
	});

	test("deletion-only edit reports nothing", () => {
		const d = [...RETRY, "", ...SUMMARIZE, "", ...RENDER_ROW];
		const index = indexWith({ "a.ts": A, "d.ts": d });
		const edited = d
			.slice(0, RETRY.length)
			.concat(d.slice(RETRY.length + 1 + 10));
		expect(
			index.findNewDuplicates("d.ts", ts(edited), index.get("d.ts")),
		).toEqual([]);
	});

	test("re-editing a file that keeps the same copy yields the same key", () => {
		const index = indexWith({ "a.ts": A });
		const base = [...RETRY];
		const first = index.findNewDuplicates(
			"g.ts",
			ts([...base, "", ...SUMMARIZE]),
			ts(base),
		);
		const second = index.findNewDuplicates(
			"g.ts",
			ts([...base, "", ...SUMMARIZE, "", ...RENDER_ROW]),
			ts([...base, "", ...RENDER_ROW]),
		);
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
		expect(second[0].key).toBe(first[0].key);
		const elsewhere = index.findNewDuplicates(
			"h.ts",
			ts([...base, "", ...SUMMARIZE]),
			ts(base),
		);
		expect(elsewhere[0].key).not.toBe(first[0].key);
	});

	test("after delete()/set() churn, results match a freshly built index", () => {
		const index = new CloneIndex(OPTIONS);
		const bodies = [
			A,
			RENDER_ROW,
			RETRY,
			PARSE_CONFIG,
			[...RETRY, "", ...SUMMARIZE],
		];
		const current = new Map<string, string[]>();
		for (let round = 0; round < 5; round++) {
			for (let i = 0; i < 40; i++) {
				const file = `src/f${i}.ts`;
				if ((i + round) % 3 === 0) {
					index.delete(file);
					current.delete(file);
				} else {
					const lines = bodies[(i + round) % bodies.length];
					index.set(file, ts(lines));
					current.set(file, lines);
				}
			}
		}
		const fresh = indexWith(Object.fromEntries(current));
		const probe = ts([...SUMMARIZE, "", ...RETRY, "", ...RENDER_ROW]);
		const churned = index.findNewDuplicates("new.ts", probe, undefined);
		expect(churned.length).toBeGreaterThan(0);
		expect(churned).toEqual(
			fresh.findNewDuplicates("new.ts", probe, undefined),
		);

		for (const file of current.keys()) index.delete(file);
		expect(index.findNewDuplicates("new.ts", probe, undefined)).toEqual([]);
		index.set("back.ts", ts(A));
		expect(
			index.findNewDuplicates("new.ts", ts(SUMMARIZE), undefined),
		).toHaveLength(1);
	});

	describe("rewrites beyond the token diff's edit-distance cap", () => {
		const DECLARATIONS = 150;
		const declarations = (side: string, rewritten: boolean): string[] =>
			Array.from({ length: DECLARATIONS }, (_, i) =>
				rewritten
					? `let ${side}Label${i}: string = "${side}-${i}";`
					: `const ${side}Count${i} = ${i};`,
			);
		const copy = SUMMARIZE.map((line) =>
			line.replace(
				"function summarizeOrders(",
				"function summarizeOrdersAgain(",
			),
		);
		const pair = [...SUMMARIZE, "", ...RENDER_ROW, "", ...copy];
		const surround = (rewritten: boolean, middle: string[]): string[] => [
			...declarations("top", rewritten),
			"",
			...middle,
			"",
			...declarations("bottom", rewritten),
		];

		test("an unchanged intra-file pair is not reported", () => {
			const before = surround(false, pair);
			const index = indexWith({ "e.ts": before });
			expect(
				index.findNewDuplicates(
					"e.ts",
					ts(surround(true, pair)),
					index.get("e.ts"),
				),
			).toEqual([]);
		});

		test("a new intra-file pair is still reported", () => {
			const before = surround(false, pair);
			const index = indexWith({ "e.ts": before });
			const retryCopy = RETRY.map((line) =>
				line.replace("withRetry", "withRetryAgain"),
			);
			const matches = index.findNewDuplicates(
				"e.ts",
				ts(surround(true, [...pair, "", ...RETRY, "", ...retryCopy])),
				index.get("e.ts"),
			);
			expect(matches).toHaveLength(1);
			expect(matches[0].other.file).toBe("e.ts");
			const retryStart = DECLARATIONS + 2 + pair.length + 1;
			expect(matches[0].other.startLine).toBeGreaterThanOrEqual(retryStart);
			expect(matches[0].region.startLine).toBeGreaterThan(
				matches[0].other.startLine,
			);
		});
	});
});

describe("tokenize / detectFormat", () => {
	test("detectFormat excludes non-code formats unless opted in", () => {
		expect(detectFormat("src/a.ts")).toBe("typescript");
		expect(detectFormat("src/a.tsx")).toBe("tsx");
		expect(detectFormat("data/x.json")).toBeUndefined();
		expect(detectFormat("docs/readme.md")).toBeUndefined();
		expect(detectFormat("icons/logo.svg")).toBeUndefined();
		expect(detectFormat("Makefile")).toBeUndefined();
		expect(detectFormat("data/x.json", { json: ["json"] })).toBe("json");
		expect(detectFormat("src/a.ts", { json: ["json"] })).toBe("typescript");
	});

	test("comments and layout do not change the token stream", () => {
		const plain = tokenize("const a = f(b, c);\nreturn a;", "typescript");
		const noisy = tokenize(
			"const  a=f( b,c ); // why\n\n/* note */ return a ;",
			"typescript",
		);
		expect([...noisy.hashes]).toEqual([...plain.hashes]);
		expect(noisy.startLines[noisy.startLines.length - 1]).toBe(3);
	});
});
