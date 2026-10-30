import { beforeAll, describe, expect, it } from "bun:test";
import {
	type Component,
	type DescribeContext,
	getThemeByName,
	type NativeNode,
	type Theme,
	type TspSpan,
	visibleWidth,
} from "@oh-my-pi/pi-tui";
import type { CustomMessage } from "@oh-my-pi/pi-tui/chat/messages";
import { applyHyperlinkSetting } from "@oh-my-pi/pi-tui/render/hyperlink";
import { createWarningRenderer } from "../src/render";
import { WARNING_MESSAGE_TYPE, type WarningDetails } from "../src/types";

let theme: Theme;

beforeAll(async () => {
	const loaded = await getThemeByName("dark");
	if (!loaded) throw new Error("dark theme missing");
	theme = loaded;
});

const cx: DescribeContext = {
	cols: 80,
	reduceMotion: false,
	dark: true,
	supports: () => true,
	feature: () => false,
};

const details: WarningDetails = {
	file: "src/feature/new-widget.ts",
	matches: [
		{
			region: { file: "src/feature/new-widget.ts", startLine: 12, endLine: 40 },
			other: {
				file: "src/legacy/old-widget-implementation.ts",
				startLine: 101,
				endLine: 129,
			},
			tokens: 214,
			key: "k1",
		},
		{
			region: { file: "src/feature/new-widget.ts", startLine: 60, endLine: 72 },
			other: { file: "src/feature/new-widget.ts", startLine: 3, endLine: 15 },
			tokens: 88,
			key: "k2",
		},
	],
	omitted: 3,
	artifactId: "17",
};

function message(
	payload: unknown,
	content: CustomMessage["content"] = "reminder text",
): CustomMessage<WarningDetails> {
	return {
		role: "custom",
		customType: WARNING_MESSAGE_TYPE,
		content,
		display: true,
		details: payload as WarningDetails,
		timestamp: 1,
	};
}

function build(
	payload: unknown,
	content?: CustomMessage["content"],
): Component {
	const component = createWarningRenderer()(
		message(payload, content),
		{ expanded: false },
		theme,
	);
	if (!component) throw new Error("renderer returned nothing");
	return component;
}

function toSpans(value: string | readonly TspSpan[]): readonly TspSpan[] {
	return typeof value === "string" ? [{ t: value }] : value;
}

/** Every span a described tree shows (card heads, text and span runs), in tree order. */
function allSpans(root: NativeNode): TspSpan[] {
	const out: TspSpan[] = [];
	const visit = (n: NativeNode) => {
		const p = n.p;
		if (p && "head" in p && p.head !== undefined) out.push(...toSpans(p.head));
		if (p && "text" in p && typeof p.text === "string") out.push({ t: p.text });
		if (p && "spans" in p && p.spans !== undefined) out.push(...p.spans);
		for (const child of n.c ?? []) if ("k" in child) visit(child);
	};
	visit(root);
	return out;
}

function nodeText(root: NativeNode): string {
	return allSpans(root)
		.map((s) => s.t)
		.join("\n");
}

function warningCard(component: Component): NativeNode {
	const node = component.describe?.(cx);
	if (node?.k !== "card") throw new Error(`expected a card, got ${node?.k}`);
	expect(node.p?.tone).toBe("warning");
	return node;
}

function plain(lines: readonly string[]): string {
	return lines
		.map((line) =>
			line.replace(/\x1b\[[0-9;]*m|\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g, ""),
		)
		.join("\n");
}

describe("warning card, native", () => {
	it("describes a warning-toned card with both locations of every match and the omitted count", () => {
		const texts = nodeText(warningCard(build(details)));
		expect(texts).toContain("Possible duplicate code");
		expect(texts).toContain("src/feature/new-widget.ts:12-40");
		expect(texts).toContain("src/legacy/old-widget-implementation.ts:101-129");
		expect(texts).toContain("src/feature/new-widget.ts:60-72");
		expect(texts).toContain("src/feature/new-widget.ts:3-15");
		expect(texts).toContain("+3 more");
		expect(texts).toContain("artifact://17");
	});

	it("returns the same node object on repeated calls", () => {
		const component = build(details);
		const first = component.describe?.(cx);
		expect(first).toBeTruthy();
		expect(component.describe?.(cx)).toBe(first);
	});

	it("links locations with file:// hrefs when the root is known", () => {
		const node = warningCard(build({ ...details, root: "/repo" }));
		const hrefs = allSpans(node).flatMap((s) => (s.href ? [s.href] : []));
		expect(hrefs).toContain(
			"file:///repo/src/legacy/old-widget-implementation.ts",
		);
	});
});

describe("warning card, plain terminal", () => {
	it("renders both locations within the width, memoized per width", () => {
		const component = build(details);
		const lines = component.render(80);
		const text = plain(lines);
		expect(text).toContain("Possible duplicate code");
		expect(text).toContain("src/feature/new-widget.ts:12-40");
		expect(text).toContain("src/legacy/old-widget-implementation.ts:101-129");
		expect(text).toContain("src/feature/new-widget.ts:3-15");
		expect(text).toContain("+3 more");
		for (const line of lines)
			expect(visibleWidth(line)).toBeLessThanOrEqual(80);
		expect(component.render(80)).toBe(lines);
		const narrow = component.render(40);
		for (const line of narrow)
			expect(visibleWidth(line)).toBeLessThanOrEqual(40);
		expect(plain(narrow).replace(/\s+/g, "")).toContain(
			"src/legacy/old-widget-implementation.ts:101-129",
		);
	});

	it("keeps OSC 8 file links within the width", () => {
		applyHyperlinkSetting("always");
		try {
			const lines = build({ ...details, root: "/repo" }).render(40);
			expect(lines.join("")).toContain(
				"/repo/src/legacy/old-widget-implementation.ts",
			);
			for (const line of lines)
				expect(visibleWidth(line)).toBeLessThanOrEqual(40);
		} finally {
			applyHyperlinkSetting("auto");
		}
	});
});

describe("legacy details", () => {
	const legacy = {
		filePath: "src/a.ts",
		clones: [{ duplicationA: {}, duplicationB: {} }],
		content: "old",
	};
	const content =
		'<system-reminder reason="code_duplication" file="src/a.ts">\nDuplicate code detected in src/a.ts\nsrc/a.ts:1-9 ↔ src/b.ts:4-12\n</system-reminder>\n';

	it("renders message content in plain mode", () => {
		for (const payload of [legacy, undefined, { file: "x.ts" }]) {
			const lines = build(payload, content).render(80);
			const text = plain(lines);
			expect(text).toContain("Possible duplicate code");
			expect(text).toContain("src/a.ts:1-9 ↔ src/b.ts:4-12");
			expect(text).not.toContain("system-reminder");
			for (const line of lines)
				expect(visibleWidth(line)).toBeLessThanOrEqual(80);
		}
	});

	it("renders message content natively, from text parts too", () => {
		const parts: CustomMessage["content"] = [{ type: "text", text: content }];
		for (const payload of [legacy, undefined]) {
			expect(nodeText(warningCard(build(payload, parts)))).toContain(
				"src/a.ts:1-9 ↔ src/b.ts:4-12",
			);
		}
	});
});
