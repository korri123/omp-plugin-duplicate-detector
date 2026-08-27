import { describe, expect, it } from "bun:test";
import type { IClone } from "@jscpd/core";
import { cloneIdentity, DuplicateLedger } from "../src/duplicate-ledger";

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
});
