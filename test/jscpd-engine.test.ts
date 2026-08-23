import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	createIgnoreFilter,
	isGeneratedContent,
	JscpdIndexManager,
} from "../src/jscpd-engine";

async function setupGitRepo(dir: string): Promise<void> {
	const init = Bun.spawn(["git", "init", "-b", "main"], { cwd: dir });
	await init.exited;
	const name = Bun.spawn(["git", "config", "user.name", "Test User"], {
		cwd: dir,
	});
	await name.exited;
	const email = Bun.spawn(["git", "config", "user.email", "test@example.com"], {
		cwd: dir,
	});
	await email.exited;
}

async function gitTrack(dir: string, files: string[] = ["."]): Promise<void> {
	const add = Bun.spawn(["git", "add", ...files], { cwd: dir });
	await add.exited;
}

describe("JscpdIndexManager", () => {
	let tempDir: string;
	let manager: JscpdIndexManager;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jscpd-engine-test-"));
		await setupGitRepo(tempDir);
		manager = new JscpdIndexManager({
			minTokens: 20,
			minLines: 4,
		});
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("skips baseline indexing when directory is not a Git repository", async () => {
		const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "non-git-test-"));
		try {
			await Bun.write(
				path.join(nonGitDir, "code.ts"),
				"export function test() { return 42; }\n",
			);
			const count = await manager.initialize(nonGitDir);
			expect(count).toBe(0);
			expect(manager.isInitialized).toBe(true);
			expect(manager.baselineStatus).toBe("skipped_not_git");
			expect(manager.indexedCount).toBe(0);
		} finally {
			await fs.rm(nonGitDir, { recursive: true, force: true });
		}
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
		await gitTrack(tempDir);

		const indexedCount = await manager.initialize(tempDir);
		expect(indexedCount).toBe(1);
		expect(manager.isInitialized).toBe(true);
		expect(manager.baselineStatus).toBe("complete");

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
		await gitTrack(tempDir);

		await manager.initialize(tempDir);

		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);
		const report = manager.formatReport();

		expect(report).toContain("# Duplicate Code Report");
		expect(report).toContain("Detected Clones");
		expect(report).toContain("billing.ts");
		expect(report).toContain("checkout.ts");
	});

	it("only indexes Git-tracked files and ignores untracked files during baseline", async () => {
		await Bun.write(
			path.join(tempDir, "tracked.ts"),
			"export const tracked = true;\n",
		);
		await gitTrack(tempDir);

		// Write untracked file without adding to git
		await Bun.write(
			path.join(tempDir, "untracked.ts"),
			"export const untracked = true;\n",
		);

		const count = await manager.initialize(tempDir);
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
	});

	it("updates index when updateFile is called (Hot Index)", async () => {
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
		await gitTrack(tempDir);

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
		await gitTrack(tempDir);

		const count = await manager.initialize(tempDir);
		// Only main.ts should be indexed
		expect(count).toBe(1);
	});

	it("respects user-provided ignorePatterns option", async () => {
		await Bun.write(path.join(tempDir, "fileA.ts"), "export const a = 1;\n");
		await Bun.write(
			path.join(tempDir, "test.spec.ts"),
			"export const b = 2;\n",
		);
		await gitTrack(tempDir);

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
		await gitTrack(tempDir);

		const count = await manager.initialize(tempDir, ["dist"]);
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
	});

	it("scopes baseline indexing to subdirectories via `git ls-files --cached -z -- .`", async () => {
		const pkgDir = path.join(tempDir, "packages", "core");
		const otherDir = path.join(tempDir, "packages", "other");
		await fs.mkdir(pkgDir, { recursive: true });
		await fs.mkdir(otherDir, { recursive: true });

		await Bun.write(path.join(pkgDir, "core.ts"), "export const core = 1;\n");
		await Bun.write(
			path.join(otherDir, "other.ts"),
			"export const other = 1;\n",
		);
		await gitTrack(tempDir);

		// Initializing manager in pkgDir should only index pkgDir files
		const count = await manager.initialize(pkgDir);
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
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
		await gitTrack(tempDir);

		const count = await manager.initialize(tempDir);
		// api-client.ts should be skipped due to DO NOT EDIT header
		expect(count).toBe(1);
		expect(manager.indexedCount).toBe(1);
	});

	it("skips individual oversized files exceeding MAX_FILE_SIZE_BYTES", async () => {
		// File larger than 100 KiB (110 KiB)
		const largeContent = `const x = 1;\n${"console.log(1);\n".repeat(8000)}`;
		await Bun.write(path.join(tempDir, "large.ts"), largeContent);
		await Bun.write(
			path.join(tempDir, "normal.ts"),
			"export const ok = true;\n",
		);
		await gitTrack(tempDir);

		const count = await manager.initialize(tempDir);
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
		await gitTrack(tempDir);

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
		await gitTrack(tempDir);

		const goCount = await manager.initialize(tempDir);
		expect(goCount).toBe(2);
		expect(manager.discoveredClones.length).toBeGreaterThanOrEqual(1);
		expect(manager.discoveredClones[0]!.format).toBe("go");
	});
});

describe("createIgnoreFilter", () => {
	it("ignores default noise patterns such as node_modules, lockfiles, and minified bundles", () => {
		const filter = createIgnoreFilter();
		expect(filter("node_modules/pkg/index.js")).toBe(true);
		expect(filter("package-lock.json")).toBe(true);
		expect(filter("pnpm-lock.yaml")).toBe(true);
		expect(filter("dist/bundle.min.js")).toBe(true);
		expect(filter("src/index.ts")).toBe(false);
	});

	it("respects user ignore patterns", () => {
		const filter = createIgnoreFilter(["vendor/**", "generated/*"]);
		expect(filter("vendor/lib/code.ts")).toBe(true);
		expect(filter("generated/schema.graphql")).toBe(true);
		expect(filter("src/schema.graphql")).toBe(false);
	});

	it("safely handles external relative paths with leading `../` without throwing RangeError", () => {
		const filter = createIgnoreFilter(["*.graphql"]);
		// node-ignore throws RangeError on `../` paths; createIgnoreFilter must catch/guard safely
		expect(
			filter(
				"../Users/kormakurgunnlaugsson/Downloads/innova-order-2580739/execution/variant-update.graphql",
			),
		).toBe(false);
		expect(filter("../../external/file.ts")).toBe(false);
		expect(filter("../outside.js")).toBe(false);
	});

	it("safely handles absolute paths without throwing RangeError", () => {
		const filter = createIgnoreFilter(["dist/**"]);
		expect(
			filter(
				"/Users/kormakurgunnlaugsson/Downloads/innova-order-2580739/execution/variant-update.graphql",
			),
		).toBe(false);
		expect(filter("C:/Users/project/src/index.ts")).toBe(false);
	});

	it("handles edge cases such as empty string, dots, Windows backslashes, and leading `./`", () => {
		const filter = createIgnoreFilter(["dist/**"]);
		expect(filter("")).toBe(false);
		expect(filter("   ")).toBe(false);
		expect(filter(".")).toBe(false);
		expect(filter("..")).toBe(false);
		expect(filter("./src/index.ts")).toBe(false);
		expect(filter("./dist/bundle.js")).toBe(true);
		expect(filter("dist\\bundle.js")).toBe(true);
	});
});
