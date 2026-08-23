import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { isGeneratedContent, JscpdIndexManager } from "../src/jscpd-engine";

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
		await Bun.write(
			fileA,
			`import { db } from "./db";\n${utilCode}\nexport const a = 1;\n`,
		);

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
		await Bun.write(
			fileB,
			`// Checkout\n${sharedLogic}\nexport const B = 2;\n`,
		);

		await manager.initialize(tempDir);

		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);
		const report = manager.formatReport();

		expect(report).toContain("# Duplicate Code Report");
		expect(report).toContain("Detected Clones");
		expect(report).toContain("billing.ts");
		expect(report).toContain("checkout.ts");
	});

	it("respects .gitignore patterns when indexing files", async () => {
		await Bun.write(
			path.join(tempDir, ".gitignore"),
			"ignored-dir/\n*.secret.ts\n",
		);

		const ignoredDir = path.join(tempDir, "ignored-dir");
		await fs.mkdir(ignoredDir, { recursive: true });

		const dupCode = `export function duplicateDummyFunction() { const x = 1; const y = 2; return x + y; }\n`;
		await Bun.write(path.join(ignoredDir, "file1.ts"), dupCode);
		await Bun.write(path.join(tempDir, "file2.secret.ts"), dupCode);
		await Bun.write(
			path.join(tempDir, "normal.ts"),
			`export const ok = true;\n`,
		);

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
		const clones = await manager.checkSnippet(
			path.join(tempDir, "analytics.ts"),
			code,
		);
		expect(clones.length).toBe(1);
	});

	it("automatically detects diverse programming languages without manual extension list", async () => {
		const pyCode = `
def calculate_invoice_total(items, tax_rate, discount=0.0):
    subtotal = sum(item["price"] * item["quantity"] for item in items)
    discount_amount = subtotal * discount
    taxable_amount = subtotal - discount_amount
    total_tax = taxable_amount * tax_rate
    final_total = taxable_amount + total_tax
    return final_total
`;
		const rsCode = `
pub fn calculate_invoice_total(items: &[InvoiceItem], tax_rate: f64, discount: f64) -> f64 {
    let subtotal: f64 = items.iter().map(|item| item.price * item.quantity as f64).sum();
    let discount_amount = subtotal * discount;
    let taxable_amount = subtotal - discount_amount;
    let total_tax = taxable_amount * tax_rate;
    taxable_amount + total_tax
}
`;

		await Bun.write(path.join(tempDir, "tax.py"), pyCode);
		await Bun.write(path.join(tempDir, "tax.rs"), rsCode);

		const count = await manager.initialize(tempDir);
		expect(count).toBe(2);
		expect(manager.isInitialized).toBe(true);

		// Python clone detection
		const pyClones = await manager.checkSnippet(
			path.join(tempDir, "tax_v2.py"),
			pyCode,
		);
		expect(pyClones.length).toBe(1);
		expect(pyClones[0]!.format).toBe("python");

		// Rust clone detection
		const rsClones = await manager.checkSnippet(
			path.join(tempDir, "tax_v2.rs"),
			rsCode,
		);
		expect(rsClones.length).toBe(1);
		expect(rsClones[0]!.format).toBe("rust");
	});

	it("filters out lockfiles and minified files automatically", async () => {
		const dummyJson = `{"name": "test", "version": "1.0.0", "dependencies": {"foo": "1.0.0"}}`;
		const minCode = `function a(){console.log("minified");return 1;}`;

		await Bun.write(path.join(tempDir, "package-lock.json"), dummyJson);
		await Bun.write(path.join(tempDir, "bundle.min.js"), minCode);
		await Bun.write(
			path.join(tempDir, "main.ts"),
			`export const app = "ready";\n`,
		);

		const count = await manager.initialize(tempDir);
		// Only main.ts should be indexed
		expect(count).toBe(1);
	});

	it("supports .gitignore negation patterns", async () => {
		await Bun.write(
			path.join(tempDir, ".gitignore"),
			"generated/*\n!generated/keep.ts\n",
		);

		const genDir = path.join(tempDir, "generated");
		await fs.mkdir(genDir, { recursive: true });
		await Bun.write(
			path.join(genDir, "temp.ts"),
			"export const temp = true;\n",
		);
		await Bun.write(
			path.join(genDir, "keep.ts"),
			"export const keep = true;\n",
		);

		const count = await manager.initialize(tempDir);
		expect(count).toBe(1);
	});

	it("respects user-provided ignorePatterns option", async () => {
		await Bun.write(path.join(tempDir, "fileA.ts"), "export const a = 1;\n");
		await Bun.write(
			path.join(tempDir, "test.spec.ts"),
			"export const b = 2;\n",
		);

		const count = await manager.initialize(tempDir, ["*.spec.ts"]);
		expect(count).toBe(1);
	});

	it("excludes files when user provides directory ignore patterns without trailing wildcards", async () => {
		const distDir = path.join(tempDir, "dist");
		const srcDir = path.join(tempDir, "src");
		await fs.mkdir(distDir, { recursive: true });
		await fs.mkdir(srcDir, { recursive: true });

		await Bun.write(
			path.join(distDir, "bundle.ts"),
			"export const bundle = 1;\n",
		);
		await Bun.write(path.join(srcDir, "index.ts"), "export const app = 2;\n");

		const count = await manager.initialize(tempDir, ["dist"]);
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
	});

	it("scopes rooted and unrooted rules in nested subdirectories correctly", async () => {
		const pkgDir = path.join(tempDir, "packages", "core");
		const otherDir = path.join(tempDir, "packages", "other");
		await fs.mkdir(path.join(pkgDir, "build"), { recursive: true });
		await fs.mkdir(path.join(pkgDir, "src", "deep"), { recursive: true });
		await fs.mkdir(path.join(otherDir, "build"), { recursive: true });
		await fs.mkdir(path.join(otherDir, "src", "deep"), { recursive: true });

		// Nested .gitignore with rooted rule /build and unrooted rule *.temp.ts
		await Bun.write(path.join(pkgDir, ".gitignore"), "/build/\n*.temp.ts\n");
		await Bun.write(
			path.join(pkgDir, "build", "out.ts"),
			"export const out = 1;\n",
		);
		await Bun.write(
			path.join(pkgDir, "src", "deep", "app.temp.ts"),
			"export const temp = 1;\n",
		);
		await Bun.write(path.join(pkgDir, "index.ts"), "export const index = 1;\n");
		await Bun.write(
			path.join(otherDir, "build", "out.ts"),
			"export const other = 1;\n",
		);
		await Bun.write(
			path.join(otherDir, "src", "deep", "app.temp.ts"),
			"export const otherTemp = 1;\n",
		);

		const count = await manager.initialize(tempDir);
		// Ignored: pkgDir/build/out.ts and pkgDir/src/deep/app.temp.ts
		// Kept: pkgDir/index.ts, otherDir/build/out.ts, and otherDir/src/deep/app.temp.ts
		expect(count).toBe(3);
	});

	it("correctly identifies generated file comment markers via isGeneratedContent", () => {
		expect(
			isGeneratedContent(
				"// Code generated by protoc-gen-go. DO NOT EDIT.\npackage pb\n",
			),
		).toBe(true);
		expect(
			isGeneratedContent(
				"/* @generated SignedSource<<deadbeef>> */\nconst x = 1;\n",
			),
		).toBe(true);
		expect(
			isGeneratedContent(
				"// <auto-generated>\n// This code was generated by a tool.\n// </auto-generated>\n",
			),
		).toBe(true);
		expect(
			isGeneratedContent("<!-- <autogenerated /> -->\n<root></root>\n"),
		).toBe(true);
		expect(isGeneratedContent("// <autogenerated>\nconst cs = 1;\n")).toBe(
			true,
		);
		expect(
			isGeneratedContent(
				"// This file was automatically generated by ANTLR\nclass Parser {}\n",
			),
		).toBe(true);

		// Normal code containing the word generate or edit in identifier names must NOT be flagged
		expect(
			isGeneratedContent(
				"export function generateRandomId(): string {\n  return Math.random().toString(36);\n}\n",
			),
		).toBe(false);
		expect(
			isGeneratedContent(
				"export function editUserProfile(userId: string): void {\n  console.log(userId);\n}\n",
			),
		).toBe(false);
	});

	it("skips indexing files with code-generation markers in repository", async () => {
		const genCode = `// Code generated by openapi-generator. DO NOT EDIT.
export interface UserDto {
	id: string;
	name: string;
	email: string;
}
`;
		const normalCode = `
export function calculateTax(price: number): number {
	return price * 0.2;
}
`;
		await Bun.write(path.join(tempDir, "api-client.ts"), genCode);
		await Bun.write(path.join(tempDir, "tax.ts"), normalCode);

		const count = await manager.initialize(tempDir);
		// api-client.ts should be skipped due to DO NOT EDIT header
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
	});

	it("filters out lockfiles from various package managers", async () => {
		await Bun.write(
			path.join(tempDir, "Cargo.lock"),
			"# This file is automatically `@generated` by Cargo.\nversion = 3\n",
		);
		await Bun.write(
			path.join(tempDir, "poetry.lock"),
			"# This file is automatically generated by Poetry.\n",
		);
		await Bun.write(
			path.join(tempDir, "composer.lock"),
			`{"_readme": ["This file locks the dependencies."]}\n`,
		);
		await Bun.write(
			path.join(tempDir, "pnpm-lock.yaml"),
			"lockfileVersion: '9.0'\n",
		);
		await Bun.write(
			path.join(tempDir, "index.ts"),
			"export const ready = true;\n",
		);

		const count = await manager.initialize(tempDir);
		expect(count).toBe(1);
	});

	it("detects code duplication across Go and SQL files", async () => {
		const goCode = `
func ProcessOrderBatch(orders []Order, taxRate float64) float64 {
	var totalTax float64 = 0.0
	for _, o := range orders {
		totalTax += float64(o.Subtotal) * taxRate
	}
	return totalTax
}
`;
		await Bun.write(path.join(tempDir, "order_v1.go"), goCode);
		await Bun.write(path.join(tempDir, "order_v2.go"), goCode);

		const goCount = await manager.initialize(tempDir);
		expect(goCount).toBe(2);
		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);
		expect(manager.discoveredClones[0]!.format).toBe("go");
	});
});
