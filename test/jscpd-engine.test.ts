import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { JscpdIndexManager } from "../src/jscpd-engine";

describe("JscpdIndexManager", () => {
	let tempDir: string;
	let manager: JscpdIndexManager;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jscpd-engine-test-"));
		manager = new JscpdIndexManager({
			minTokens: 20,
			minLines: 4,
		});
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("indexes repository files and detects code clones in newly checked snippets", async () => {
		const utilCode = `
export function formatUserProfile(user: { id: string; name: string; email: string }): string {
	const header = "User Profile: " + user.name;
	const body = "Email: " + user.email + " (ID: " + user.id + ")";
	console.log("Formatting user profile", header);
	return header + "\\n" + body;
}
`;

		const fileA = path.join(tempDir, "user-service.ts");
		await Bun.write(fileA, `import { db } from "./db";\n${utilCode}\nexport const a = 1;\n`);

		const indexedCount = await manager.initialize(tempDir);
		expect(indexedCount).toBe(1);
		expect(manager.isInitialized).toBe(true);

		// Now check a duplicate snippet
		const targetFile = path.join(tempDir, "auth-service.ts");
		const newSnippet = `import { auth } from "./auth";\n${utilCode}\nexport const b = 2;\n`;

		const clones = await manager.checkSnippet(targetFile, newSnippet);
		expect(clones.length).toBeGreaterThanOrEqual(1);

		const clone = clones[0]!;
		expect(clone.duplicationA.sourceId).toContain("auth-service.ts");
		expect(clone.duplicationB.sourceId).toContain("user-service.ts");
		expect(clone.format).toBe("typescript");

		// Verify that checkSnippet did NOT pollute the persistent store with virtual frames
		expect(manager.indexedCount).toBe(1);
	});

	it("accumulates discovered clones during initialize and generates Markdown report", async () => {
		const sharedLogic = `
export function computeTotalInvoice(items: Array<{ price: number; qty: number }>): number {
	let sum = 0;
	for (const item of items) {
		sum += item.price * item.qty;
	}
	return sum;
}
`;
		const fileA = path.join(tempDir, "billing.ts");
		const fileB = path.join(tempDir, "checkout.ts");

		await Bun.write(fileA, `// Billing\n${sharedLogic}\nexport const A = 1;\n`);
		await Bun.write(fileB, `// Checkout\n${sharedLogic}\nexport const B = 2;\n`);

		await manager.initialize(tempDir);

		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);
		const report = manager.formatReport();

		expect(report).toContain("# Duplicate Code Report");
		expect(report).toContain("Detected Clones");
		expect(report).toContain("billing.ts");
		expect(report).toContain("checkout.ts");
	});

	it("respects .gitignore patterns when indexing files", async () => {
		await Bun.write(path.join(tempDir, ".gitignore"), "ignored-dir/\n*.secret.ts\n");

		const ignoredDir = path.join(tempDir, "ignored-dir");
		await fs.mkdir(ignoredDir, { recursive: true });

		const dupCode = `export function duplicateDummyFunction() { const x = 1; const y = 2; return x + y; }\n`;
		await Bun.write(path.join(ignoredDir, "file1.ts"), dupCode);
		await Bun.write(path.join(tempDir, "file2.secret.ts"), dupCode);
		await Bun.write(path.join(tempDir, "normal.ts"), `export const ok = true;\n`);

		const count = await manager.initialize(tempDir);
		expect(count).toBe(1);
	});

	it("updates index when updateFile is called", async () => {
		await manager.initialize(tempDir);
		expect(manager.indexedCount).toBe(0);

		const filePath = path.join(tempDir, "logger.ts");
		const code = `
export function logEvent(name: string, payload: Record<string, unknown>): void {
	const timestamp = new Date().toISOString();
	const formattedPayload = JSON.stringify(payload, null, 2);
	console.log("[" + timestamp + "] " + name + ": " + formattedPayload);
	return;
}
`;
		await manager.updateFile(filePath, code);
		expect(manager.indexedCount).toBe(1);

		// Another file with same code should now match
		const clones = await manager.checkSnippet(path.join(tempDir, "analytics.ts"), code);
		expect(clones.length).toBe(1);
	});
});
