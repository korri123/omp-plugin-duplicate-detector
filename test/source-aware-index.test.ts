import { describe, expect, it } from "bun:test";
import {
	fastTokenHash,
	reconstructFramesFromTokens,
	SourceAwareCloneIndex,
	tokenizeSource,
} from "../src/source-aware-index";

describe("SourceAwareCloneIndex with Native Bun.hash & Fast-Path", () => {
	const sampleCodeA = `
export function processOrder(order: { id: string; amount: number; taxRate: number }): number {
	const subtotal = order.amount;
	const tax = subtotal * order.taxRate;
	const total = subtotal + tax;
	console.log("Processed order " + order.id + " with total: " + total);
	return total;
}
`;

	const sampleCodeB = `
export function processInvoice(invoice: { id: string; amount: number; taxRate: number }): number {
	const subtotal = invoice.amount;
	const tax = subtotal * invoice.taxRate;
	const total = subtotal + tax;
	console.log("Processed order " + invoice.id + " with total: " + total);
	return total;
}
`;

	const uniqueCode = `
export function generateRandomString(length: number): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
`;

	describe("fastTokenHash", () => {
		it("generates deterministic 20-character padded hex string using Bun.hash", () => {
			const hash1 = fastTokenHash("function test()");
			const hash2 = fastTokenHash("function test()");
			const hash3 = fastTokenHash("function other()");

			expect(hash1).toBe(hash2);
			expect(hash1).not.toBe(hash3);
			expect(hash1.length).toBe(20);
			expect(typeof hash1).toBe("string");
			expect(hash1).toMatch(/^[0-9a-f]{20}$/);
		});

		it("matches Bun.hash native output padded to 20 hex digits", () => {
			const input = "some_token_value_12345";
			const expected = Bun.hash(input).toString(16).padStart(20, "0");
			expect(fastTokenHash(input)).toBe(expected);
		});
	});

	describe("SourceAwareCloneIndex options & custom hashFunction", () => {
		it("defaults to fastTokenHash when hashFunction is not provided", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 10, minLines: 2 });
			expect(index.hashFunction).toBe(fastTokenHash);
		});

		it("accepts and uses a custom hashFunction in options", () => {
			let callCount = 0;
			const customHash = (val: string): string => {
				callCount++;
				return Bun.hash(`${val}_custom`).toString(16).padStart(20, "0");
			};

			const index = new SourceAwareCloneIndex({
				minTokens: 10,
				minLines: 2,
				hashFunction: customHash,
			});

			expect(index.hashFunction).toBe(customHash);
			index.addSource("test.ts", sampleCodeA);
			expect(callCount).toBeGreaterThan(0);
		});
	});

	describe("Clone Detection & Fast-Path Bypass", () => {
		it("detects clones between duplicate code segments while fast-pathing unique files", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 15, minLines: 3 });

			// Index unique file first (exercises fast-path bypass where matchedFrames.length === 0 && activeClones.size === 0)
			const clones0 = index.addSource("unique.ts", uniqueCode);
			expect(clones0.length).toBe(0);

			// Index first copy of sample code
			const clones1 = index.addSource("fileA.ts", sampleCodeA);
			expect(clones1.length).toBe(0);

			// Index second copy (should detect clone with fileA.ts)
			const clones2 = index.addSource("fileB.ts", sampleCodeB);
			expect(clones2.length).toBeGreaterThanOrEqual(1);

			const clone = clones2[0]!;
			expect(clone.duplicationA.sourceId).toBe("fileB.ts");
			expect(clone.duplicationB.sourceId).toBe("fileA.ts");
		});

		it("correctly checks snippets against the index without mutating state", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 15, minLines: 3 });
			index.addSource("billing.ts", sampleCodeA);

			const clones = index.checkSnippet("temp-check.ts", sampleCodeB);
			expect(clones.length).toBeGreaterThanOrEqual(1);
			expect(clones[0]!.duplicationA.sourceId).toBe("temp-check.ts");
			expect(clones[0]!.duplicationB.sourceId).toBe("billing.ts");

			// Index state remains untouched
			expect(index.hasSource("temp-check.ts")).toBe(false);
			expect(index.sources.size).toBe(1);
		});

		it("handles source deletion and hot index replacement cleanly", () => {
			const index = new SourceAwareCloneIndex({ minTokens: 15, minLines: 3 });
			index.addSource("fileA.ts", sampleCodeA);
			index.addSource("fileB.ts", sampleCodeB);
			expect(index.clones.length).toBeGreaterThanOrEqual(1);

			// Remove fileA
			index.removeSource("fileA.ts");
			expect(index.hasSource("fileA.ts")).toBe(false);
			expect(index.hasSource("fileB.ts")).toBe(true);
			expect(index.clones.length).toBe(0);

			// Check snippet against remaining fileB
			const clones = index.checkSnippet("snippet.ts", sampleCodeA);
			expect(clones.length).toBeGreaterThanOrEqual(1);
			expect(clones[0]!.duplicationB.sourceId).toBe("fileB.ts");
		});
	});

	describe("Concurrent Tokenization & Shard Hydration", () => {
		it("tokenizes sources concurrently and hydrates shards with 100% clone detection parity", () => {
			const indexA = new SourceAwareCloneIndex({ minTokens: 15, minLines: 3 });
			const indexB = new SourceAwareCloneIndex({ minTokens: 15, minLines: 3 });

			// Direct addSource on Index A
			indexA.addSource("fileA.ts", sampleCodeA);
			const clonesA = indexA.addSource("fileB.ts", sampleCodeB);

			// Concurrent tokenization and hydration on Index B
			const shardA = indexB.tokenizeSource("fileA.ts", sampleCodeA, "hashA");
			const shardB = indexB.tokenizeSource("fileB.ts", sampleCodeB, "hashB");

			expect(shardA).not.toBeNull();
			expect(shardB).not.toBeNull();

			indexB.hydrateSourceShard(shardA!);
			const clonesB = indexB.hydrateSourceShard(shardB!);

			expect(clonesB.length).toBe(clonesA.length);
			expect(clonesB[0]!.duplicationA.sourceId).toBe(
				clonesA[0]!.duplicationA.sourceId,
			);
			expect(clonesB[0]!.duplicationB.sourceId).toBe(
				clonesA[0]!.duplicationB.sourceId,
			);
		});

		it("reconstructs frames from serialized tokens with identical frame hashes", () => {
			const shard = tokenizeSource("test.ts", sampleCodeA, "hash", {
				minTokens: 15,
				minLines: 3,
			})!;

			expect(shard).not.toBeNull();
			expect(shard.tokens).toBeDefined();
			expect(shard.tokens!.length).toBeGreaterThan(0);

			const reconstructed = reconstructFramesFromTokens(
				shard.tokens!,
				"test.ts",
				15,
				fastTokenHash,
			);

			expect(reconstructed.length).toBe(shard.frames.length);
			for (let i = 0; i < reconstructed.length; i++) {
				expect(reconstructed[i]!.id).toBe(shard.frames[i]!.id);
			}
		});
	});
});
