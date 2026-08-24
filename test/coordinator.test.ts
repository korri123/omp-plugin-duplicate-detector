import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { DuplicateDetectorCoordinator } from "../src/coordinator";

describe("DuplicateDetectorCoordinator & Worker Integration", () => {
	it("spawns worker and opens workspace non-blocking", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		expect(coordinator.isWorkerAlive).toBe(true);

		const rootDir = path.resolve(".");
		await coordinator.openWorkspace(rootDir, {
			minLines: 4,
			minTokens: 20,
		});

		expect(coordinator.epoch).toBe(1);
		await coordinator.dispose();
		expect(coordinator.isDisposed).toBe(true);
	});

	it("handles checkSnippet, updateFile, and checkAndUpdate", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		await coordinator.openWorkspace("/virtual", {
			minLines: 3,
			minTokens: 10,
		});

		const codeA = `
export function calculateTaxAmount(income: number, deduction: number, rate: number): number {
    const adjustedIncome = income - deduction;
    const taxableBase = Math.max(0, adjustedIncome);
    const totalTax = taxableBase * rate;
    const surcharge = totalTax > 1000 ? totalTax * 0.1 : 0;
    return totalTax + surcharge;
}
`;

		const codeB = `
export function calculateTaxAmount(income: number, deduction: number, rate: number): number {
    const adjustedIncome = income - deduction;
    const taxableBase = Math.max(0, adjustedIncome);
    const totalTax = taxableBase * rate;
    const surcharge = totalTax > 1000 ? totalTax * 0.1 : 0;
    return totalTax + surcharge;
}
`;

		// 2. Update file in index
		const updateRes = await coordinator.updateFile("/virtual/tax-a.ts", codeA);
		expect(updateRes).toBeDefined();

		// 3. Check snippet against indexed file -> clone detected!
		const foundClones = await coordinator.checkSnippet(
			"/virtual/tax-b.ts",
			codeB,
		);
		expect(foundClones.length).toBeGreaterThan(0);

		// 4. checkAndUpdate on new file
		const checkUpdateRes = await coordinator.checkAndUpdate(
			"/virtual/tax-b.ts",
			codeB,
		);
		expect(checkUpdateRes.clones.length).toBeGreaterThan(0);

		// 5. Remove file and verify clones are gone
		await coordinator.removeFile("/virtual/tax-a.ts");
		const afterRemovalClones = await coordinator.checkSnippet(
			"/virtual/tax-calc.ts",
			codeA,
		);
		// Only tax-b remains in index, checking codeA against tax-b detects clone
		expect(afterRemovalClones.length).toBeGreaterThan(0);

		await coordinator.removeFile("/virtual/tax-b.ts");
		const finalClones = await coordinator.checkSnippet(
			"/virtual/tax-calc.ts",
			codeA,
		);
		expect(finalClones.length).toBe(0);

		await coordinator.dispose();
	});

	it("propagates worker events cleanly", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		const { promise, resolve } = Promise.withResolvers<void>();

		coordinator.on("status", (payload) => {
			if (
				payload.status === "indexing" ||
				payload.status === "ready" ||
				payload.status === "idle"
			) {
				resolve();
			}
		});

		await coordinator.openWorkspace(path.resolve("."));
		await promise;

		await coordinator.dispose();
	});

	it("propagates mutation failures after disposal", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		await coordinator.dispose();

		const clones = await coordinator.checkSnippet("foo.ts", "some content");
		expect(clones).toEqual([]);

		await expect(
			coordinator.checkAndUpdate("foo.ts", "some content"),
		).rejects.toThrow("DuplicateDetectorCoordinator is disposed");
	});

	it("handles reconcile and scan requests", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		await coordinator.openWorkspace("/virtual", {
			minLines: 3,
			minTokens: 10,
		});

		const codeA = `
export function calculateTaxAmount(income: number, deduction: number, rate: number): number {
    const adjustedIncome = income - deduction;
    const taxableBase = Math.max(0, adjustedIncome);
    const totalTax = taxableBase * rate;
    const surcharge = totalTax > 1000 ? totalTax * 0.1 : 0;
    return totalTax + surcharge;
}
`;

		await coordinator.reconcile([
			{ filePath: "/virtual/file-1.ts", content: codeA },
			{ filePath: "/virtual/file-2.ts", content: codeA },
		]);

		const clones = await coordinator.scan();
		expect(clones.length).toBeGreaterThan(0);

		await coordinator.dispose();
	});

	it("increments epoch on successive openWorkspace calls", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		expect(coordinator.epoch).toBe(0);

		await coordinator.openWorkspace("/virtual/1");
		expect(coordinator.epoch).toBe(1);

		await coordinator.openWorkspace("/virtual/2");
		expect(coordinator.epoch).toBe(2);

		await coordinator.dispose();
	});

	it("handles multiple dispose calls idempotently", async () => {
		const coordinator = new DuplicateDetectorCoordinator();
		expect(coordinator.isWorkerAlive).toBe(true);
		await coordinator.dispose();
		expect(coordinator.isDisposed).toBe(true);
		expect(coordinator.isWorkerAlive).toBe(false);

		// Calling dispose again should be safe and no-op
		await coordinator.dispose();
		expect(coordinator.isDisposed).toBe(true);
	});

	it("unrefs worker and timers so process exits cleanly without hanging", async () => {
		const proc = Bun.spawn(
			[
				"bun",
				"-e",
				`
				import { DuplicateDetectorCoordinator } from "./src/coordinator.ts";
				const coordinator = new DuplicateDetectorCoordinator();
				console.log("INITIALIZED");
			`,
			],
			{
				cwd: path.resolve(__dirname, ".."),
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		expect(exitCode).toBe(0);
		expect(stdout).toContain("INITIALIZED");
	});

	it("allows clean process exit when extension factory initializes", async () => {
		const proc = Bun.spawn(
			[
				"bun",
				"-e",
				`
				import extFactory from "./src/index.ts";
				const mockPi = {
					setLabel: () => {},
					on: () => {},
					registerCommand: () => {},
					registerTool: () => {},
					sendMessage: () => {},
					logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} }
				};
				extFactory(mockPi);
				console.log("FACTORY_INITIALIZED");
			`,
			],
			{
				cwd: path.resolve(__dirname, ".."),
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		expect(exitCode).toBe(0);
		expect(stdout).toContain("FACTORY_INITIALIZED");
	});
});
