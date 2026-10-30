import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { buildReminder } from "../src/reminder";
import type { DuplicateMatch } from "../src/types";

function match(i: number, otherFile = "src/existing.ts"): DuplicateMatch {
	return {
		key: `k${i}`,
		tokens: 80,
		region: { file: "src/new.ts", startLine: 10 * i + 1, endLine: 10 * i + 12 },
		other: { file: otherFile, startLine: 3, endLine: 14 },
	};
}

describe("buildReminder", () => {
	let root: string;

	beforeEach(async () => {
		root = await fs.mkdtemp(path.join(os.tmpdir(), "dd-reminder-"));
		const lines = Array.from(
			{ length: 20 },
			(_, i) => `const line${i + 1} = ${i + 1};`,
		);
		await Bun.write(path.join(root, "src", "existing.ts"), lines.join("\n"));
	});

	afterEach(async () => {
		await fs.rm(root, { recursive: true, force: true });
	});

	it("lists both locations with an excerpt of at most 8 counterpart lines", async () => {
		const reminder = await buildReminder({
			root,
			file: "src/new.ts",
			matches: [match(0)],
		});
		expect(reminder.text).toContain("src/new.ts:1-12");
		expect(reminder.text).toContain("src/existing.ts:3-14");
		expect(reminder.text).toContain("const line3 = 3;");
		expect(reminder.text).toContain("const line10 = 10;");
		expect(reminder.text).not.toContain("const line11 = 11;");
		expect(reminder.details).toEqual({
			file: "src/new.ts",
			root,
			matches: [match(0)],
			omitted: 0,
		});
	});

	it("tolerates a missing counterpart file", async () => {
		const reminder = await buildReminder({
			root,
			file: "src/new.ts",
			matches: [match(0, "src/gone.ts")],
		});
		expect(reminder.text).toContain("src/gone.ts:3-14");
	});

	it("caps inline matches and offloads the full report to an artifact", async () => {
		const saved: string[] = [];
		const matches = Array.from({ length: 6 }, (_, i) => match(i));
		const reminder = await buildReminder({
			root,
			file: "src/new.ts",
			matches,
			saveArtifact: async (content) => {
				saved.push(content);
				return "7";
			},
		});
		expect(reminder.details.matches).toHaveLength(4);
		expect(reminder.details.omitted).toBe(2);
		expect(reminder.details.artifactId).toBe("7");
		expect(reminder.text).toContain("omitted");
		expect(reminder.text).toContain("artifact://7");
		expect(saved).toHaveLength(1);
		expect(saved[0]).toContain("src/new.ts:51-62");
	});
});
