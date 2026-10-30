import { describe, expect, it } from "bun:test";
import { WarningLedger } from "../src/ledger";
import type { DuplicateMatch } from "../src/types";

function match(key: string, line = 1): DuplicateMatch {
	return {
		key,
		tokens: 60,
		region: { file: "src/a.ts", startLine: line, endLine: line + 6 },
		other: { file: "src/b.ts", startLine: 1, endLine: 7 },
	};
}

describe("WarningLedger", () => {
	it("never re-reports a key after intervening calls with other keys", () => {
		const ledger = new WarningLedger();
		expect(ledger.filterNew([match("k1")]).map((m) => m.key)).toEqual(["k1"]);
		expect(ledger.filterNew([match("k2")]).map((m) => m.key)).toEqual(["k2"]);
		expect(ledger.filterNew([match("k3")]).map((m) => m.key)).toEqual(["k3"]);
		// Same copy at different lines (re-edit) still dedupes by key.
		expect(
			ledger.filterNew([match("k1", 40), match("k4")]).map((m) => m.key),
		).toEqual(["k4"]);
	});

	it("dedupes repeated keys within one call", () => {
		const ledger = new WarningLedger();
		expect(ledger.filterNew([match("k1"), match("k1", 20)])).toHaveLength(1);
	});

	it("reports keys again after clear()", () => {
		const ledger = new WarningLedger();
		ledger.filterNew([match("k1")]);
		ledger.clear();
		expect(ledger.filterNew([match("k1")]).map((m) => m.key)).toEqual(["k1"]);
	});
});
