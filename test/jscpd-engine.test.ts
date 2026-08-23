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
	});

	it("does not report duplicates for unique code snippets", async () => {
		const fileA = path.join(tempDir, "constants.ts");
		await Bun.write(fileA, `export const PI = 3.14159;\nexport const E = 2.71828;\nexport const G = 9.81;\n`);

		await manager.initialize(tempDir);

		const uniqueSnippet = `export function computeCircleArea(r: number): number { return Math.PI * r * r; }\n`;
		const clones = await manager.checkSnippet(path.join(tempDir, "math.ts"), uniqueSnippet);

		expect(clones.length).toBe(0);
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
