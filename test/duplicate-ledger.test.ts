import { describe, expect, it } from "bun:test";
import type { IClone } from "@jscpd/core";
import {
	cloneIdentity,
	cloneIntersectsRanges,
	computeChangedLineRanges,
	DuplicateLedger,
} from "../src/duplicate-ledger";

describe("DuplicateLedger", () => {
	const mockCloneA: IClone = {
		format: "typescript",
		duplicationA: {
			sourceId: "virtual:src/auth.ts",
			start: { line: 10, column: 1 },
			end: { line: 20, column: 1 },
			range: [100, 300],
			fragment: "function authenticate() { ... }",
		},
		duplicationB: {
			sourceId: "src/user.ts",
			start: { line: 5, column: 1 },
			end: { line: 15, column: 1 },
			range: [50, 250],
			fragment: "function authenticate() { ... }",
		},
	};

	it("computes deterministic identity for a clone", () => {
		const id = cloneIdentity(mockCloneA);
		expect(id).toBe("src/user.ts:5-15::virtual:src/auth.ts::11");
	});

	it("filters fresh clones and deduplicates repeated occurrences", () => {
		const ledger = new DuplicateLedger();

		const firstPass = ledger.filterFreshClones("src/auth.ts", [mockCloneA]);
		expect(firstPass.length).toBe(1);

		// Consecutive edit with same clone should be deduplicated
		const secondPass = ledger.filterFreshClones("src/auth.ts", [mockCloneA]);
		expect(secondPass.length).toBe(0);

		// Clearing ledger allows it to surface again
		ledger.clear("src/auth.ts");
		const thirdPass = ledger.filterFreshClones("src/auth.ts", [mockCloneA]);
		expect(thirdPass.length).toBe(1);
	});

	it("deduplicates identical clones occurring within the same batch", () => {
		const ledger = new DuplicateLedger();

		// Pass identical clone instances in the same batch
		const batch = [
			mockCloneA,
			mockCloneA,
			{ ...mockCloneA },
			{ ...mockCloneA },
		];
		const fresh = ledger.filterFreshClones("src/auth.ts", batch);

		// Should only return 1 instance
		expect(fresh.length).toBe(1);
	});

	it("formats an XML in-band system reminder block with line ranges", () => {
		const ledger = new DuplicateLedger();
		const reminder = ledger.formatReminder([mockCloneA], "src/auth.ts");

		expect(reminder).toContain(
			'<system-reminder reason="code_duplication" file="src/auth.ts">',
		);
		expect(reminder).toContain("Warning: Duplicated code detected");
		expect(reminder).toContain("src/user.ts:5-15");
		expect(reminder).toContain("function authenticate() { ... }");
		expect(reminder).toContain("</system-reminder>");
	});

	it("seeds baseline clones so pre-existing duplicates are not flagged as fresh", () => {
		const ledger = new DuplicateLedger();
		ledger.seedBaseline([mockCloneA]);

		// Seeded clone should not be fresh
		const fresh = ledger.filterFreshClones("src/auth.ts", [mockCloneA]);
		expect(fresh.length).toBe(0);

		// A different newly introduced clone should still be fresh
		const newClone: IClone = {
			...mockCloneA,
			duplicationB: {
				...mockCloneA.duplicationB,
				sourceId: "src/new-target.ts",
			},
		};
		const freshNew = ledger.filterFreshClones("src/auth.ts", [newClone]);
		expect(freshNew.length).toBe(1);

		// Verify reverse direction with different line lengths (lenA !== lenB)
		const asymClone: IClone = {
			format: "typescript",
			duplicationA: {
				sourceId: "src/fileA.ts",
				start: { line: 10, column: 1 },
				end: { line: 20, column: 1 }, // 11 lines
			},
			duplicationB: {
				sourceId: "src/fileB.ts",
				start: { line: 30, column: 1 },
				end: { line: 45, column: 1 }, // 16 lines
			},
		};
		ledger.seedBaseline([asymClone]);

		// When file B is later mutated, file B is duplicationA (len 16) and file A is duplicationB
		const reverseClone: IClone = {
			format: "typescript",
			duplicationA: { ...asymClone.duplicationB },
			duplicationB: { ...asymClone.duplicationA },
		};
		const freshReverse = ledger.filterFreshClones("src/fileB.ts", [
			reverseClone,
		]);
		expect(freshReverse.length).toBe(0);
	});

	it("computes changed line ranges accurately across diff scenarios", () => {
		// 1. New file (oldText is null or undefined)
		expect(computeChangedLineRanges(null, "a\nb\nc")).toEqual([
			{ start: 1, end: 3 },
		]);
		expect(computeChangedLineRanges(undefined, "hello")).toEqual([
			{ start: 1, end: 1 },
		]);

		// 2. Identical text
		expect(computeChangedLineRanges("a\nb\nc", "a\nb\nc")).toEqual([]);

		// 3. Middle line modification
		const oldMid = "line1\nline2\nline3\nline4";
		const newMid = "line1\nline2_MOD\nline3\nline4";
		expect(computeChangedLineRanges(oldMid, newMid)).toEqual([
			{ start: 2, end: 2 },
		]);

		// 4. Multi-hunk modifications
		const oldMulti = "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8";
		const newMulti = "l1_MOD\nl2\nl3\nl4\nl5\nl6\nl7_MOD\nl8";
		expect(computeChangedLineRanges(oldMulti, newMulti)).toEqual([
			{ start: 1, end: 1 },
			{ start: 7, end: 7 },
		]);

		// 5. Lines appended
		expect(computeChangedLineRanges("l1\nl2", "l1\nl2\nl3\nl4")).toEqual([
			{ start: 3, end: 4 },
		]);

		// 6. Lines prepended
		expect(computeChangedLineRanges("l3\nl4", "l1\nl2\nl3\nl4")).toEqual([
			{ start: 1, end: 2 },
		]);

		// 7. Pure deletions (lines removed, none added/modified in newText)
		expect(computeChangedLineRanges("l1\nl2\nl3\nl4", "l1\nl4")).toEqual([]);
		expect(computeChangedLineRanges("l1\nl2", "")).toEqual([]);
	});

	it("checks intersection between clones and changed line ranges", () => {
		// mockCloneA is lines 10-20
		// 1. Intersects at the start
		expect(cloneIntersectsRanges(mockCloneA, [{ start: 5, end: 12 }])).toBe(
			true,
		);

		// 2. Intersects inside
		expect(cloneIntersectsRanges(mockCloneA, [{ start: 12, end: 15 }])).toBe(
			true,
		);

		// 3. Intersects at the end
		expect(cloneIntersectsRanges(mockCloneA, [{ start: 18, end: 25 }])).toBe(
			true,
		);

		// 4. Completely before clone: should NOT intersect
		expect(cloneIntersectsRanges(mockCloneA, [{ start: 1, end: 5 }])).toBe(
			false,
		);

		// 5. Completely after clone: should NOT intersect
		expect(cloneIntersectsRanges(mockCloneA, [{ start: 30, end: 40 }])).toBe(
			false,
		);

		// 6. Empty ranges: should NOT intersect
		expect(cloneIntersectsRanges(mockCloneA, [])).toBe(false);

		// 7. Test duplicationB side intersection
		// mockCloneA duplicationB is lines 5-15
		expect(
			cloneIntersectsRanges(mockCloneA, [{ start: 4, end: 6 }], "duplicationB"),
		).toBe(true);
		expect(
			cloneIntersectsRanges(
				mockCloneA,
				[{ start: 20, end: 30 }],
				"duplicationB",
			),
		).toBe(false);
	});
});
