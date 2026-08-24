import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	createIgnoreFilter,
	execGit,
	getTrackedGitFiles,
} from "../src/jscpd-engine";
import { createTestFilter, isTestFile } from "../src/test-detector";

describe("Multi-Language Test File Detector (src/test-detector.ts)", () => {
	describe("JavaScript / TypeScript / Web Ecosystem", () => {
		const testFiles = [
			"src/components/Button.test.ts",
			"src/components/Button.test.tsx",
			"src/components/Button.test.js",
			"src/components/Button.test.jsx",
			"src/components/Button.test.mjs",
			"src/components/Button.test.cjs",
			"src/components/Button.spec.ts",
			"src/components/Button.spec.tsx",
			"src/components/Button.spec.js",
			"src/components/Button.spec.jsx",
			"src/components/Button.spec.mjs",
			"src/components/Button.spec.cjs",
			"cypress/e2e/login.cy.ts",
			"cypress/e2e/login.cy.js",
			"src/components/Button.cy.tsx",
			"src/components/Button.cy.jsx",
			"test/e2e/auth.e2e.ts",
			"test/e2e/auth.e2e.js",
			"src/auth/auth.e2e-spec.ts",
			"src/auth/auth.e2e-spec.js",
			"src/auth/auth.unit.ts",
			"src/auth/auth.integration.ts",
			"src/auth/auth-test.js",
			"src/auth/auth-spec.ts",
			"src/__tests__/Button.tsx",
			"src/__test__/helper.ts",
			"src/__mocks__/api.ts",
			"src/__fixtures__/user.json",
			"src/__snapshots__/Button.snap",
			"src/setupTests.ts",
			"src/setupTests.js",
			"src/jest.setup.ts",
			"src/vitest.setup.ts",
			"src/test-utils.tsx",
			"src/testUtils.ts",
		];

		for (const file of testFiles) {
			it(`detects test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Java / Kotlin / Scala / Groovy (JVM Ecosystem)", () => {
		const jvmTestFiles = [
			"src/test/java/com/example/UserServiceTest.java",
			"src/test/java/com/example/UserServiceTests.java",
			"src/test/java/com/example/UserServiceTestCase.java",
			"src/test/java/com/example/TestUserService.java",
			"src/it/java/com/example/UserIntegrationIT.java",
			"src/it/java/com/example/ITUserService.java",
			"src/androidTest/java/com/example/MainActivityTest.java",
			"src/testFixtures/java/com/example/UserDataFixture.java",
			"src/testDebug/java/com/example/DebugTest.java",
			"src/testRelease/java/com/example/ReleaseTest.java",
			"src/test/kotlin/com/example/UserServiceTest.kt",
			"src/test/kotlin/com/example/UserServiceTests.kt",
			"src/test/kotlin/com/example/UserServiceSpec.kt",
			"src/test/scala/com/example/UserServiceSpec.scala",
			"src/test/scala/com/example/UserServiceTest.scala",
			"src/test/groovy/com/example/UserServiceSpec.groovy",
			"src/test/groovy/com/example/UserServiceTest.groovy",
			"src/test/resources/application-test.yml",
			"src/test/resources/mock-data.json",
			"core/src/test/java/com/example/InternalTest.java",
			"UserServiceBenchmark.java",
			"SortingBenchmark.kt",
		];

		for (const file of jvmTestFiles) {
			it(`detects JVM test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Python Ecosystem", () => {
		const pythonTestFiles = [
			"tests/test_auth.py",
			"tests/auth_test.py",
			"tests/tests_auth.py",
			"tests/auth_tests.py",
			"unit_tests/test_database.py",
			"integration_tests/test_payment.py",
			"src/conftest.py",
			"src/test_utils.py",
			"src/test_helpers.py",
			"tests/fixtures/users.json",
		];

		for (const file of pythonTestFiles) {
			it(`detects Python test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Go Ecosystem", () => {
		const goTestFiles = [
			"pkg/auth/auth_test.go",
			"pkg/auth/auth_bench_test.go",
			"pkg/auth/auth_integration_test.go",
			"pkg/auth/test_helper.go",
			"pkg/auth/test_helpers.go",
			"testdata/response.json",
			"pkg/auth/testdata/cert.pem",
		];

		for (const file of goTestFiles) {
			it(`detects Go test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Rust Ecosystem", () => {
		const rustTestFiles = [
			"tests/integration_test.rs",
			"tests/common/mod.rs",
			"benches/algorithm_bench.rs",
			"src/auth_test.rs",
			"src/parser_tests.rs",
		];

		for (const file of rustTestFiles) {
			it(`detects Rust test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("C / C++ Ecosystem", () => {
		const cppTestFiles = [
			"tests/main.cpp",
			"tests/test_math.c",
			"tests/test_parser.cc",
			"src/math_test.cpp",
			"src/math_test.cc",
			"src/math_test.cxx",
			"src/math_test.c",
			"src/math_unittest.cpp",
			"src/math_unittest.cc",
			"src/MathTest.cpp",
			"src/MathTests.cpp",
			"googletest/gtest_main.cc",
		];

		for (const file of cppTestFiles) {
			it(`detects C/C++ test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("C# / F# / .NET Ecosystem", () => {
		const dotNetTestFiles = [
			"Services.Tests/UserServiceTests.cs",
			"Services.Test/UserServiceTest.cs",
			"Services.UnitTests/AuthTests.cs",
			"Services.IntegrationTests/DbTests.cs",
			"Services.Specs/PaymentSpec.cs",
			"UserServiceTestCase.cs",
			"UserBenchmark.cs",
			"Services.Tests/ParserTests.fs",
			"Services.Test/ParserTest.fs",
		];

		for (const file of dotNetTestFiles) {
			it(`detects .NET test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Ruby Ecosystem", () => {
		const rubyTestFiles = [
			"spec/models/user_spec.rb",
			"test/models/user_test.rb",
			"spec/spec_helper.rb",
			"test/test_helper.rb",
			"spec/rails_helper.rb",
			"test/test_runner.rb",
		];

		for (const file of rubyTestFiles) {
			it(`detects Ruby test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("PHP Ecosystem", () => {
		const phpTestFiles = [
			"tests/UserTest.php",
			"tests/UserTestCase.php",
			"tests/UserSpec.php",
			"tests/Unit/AuthTest.php",
			"tests/Feature/LoginTest.php",
		];

		for (const file of phpTestFiles) {
			it(`detects PHP test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Swift / Objective-C Ecosystem", () => {
		const swiftTestFiles = [
			"MyAppTests/MyAppTests.swift",
			"MyAppUITests/MyAppUITests.swift",
			"MyAppUnitTests/AuthTests.swift",
			"Tests/UserSpec.swift",
			"MyAppTests/UserTest.m",
			"MyAppTests/UserTests.mm",
		];

		for (const file of swiftTestFiles) {
			it(`detects Swift / Obj-C test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("Elixir / Erlang / Clojure / Haskell / OCaml / Dart / R / Julia / Lua / Zig / Shell", () => {
		const otherLangTestFiles = [
			"test/user_test.exs",
			"test/user_test.ex",
			"test/app_SUITE.erl",
			"test/user_test.clj",
			"test/user_test.cljs",
			"test/user_test.cljc",
			"test/UserSpec.hs",
			"test/UserTest.hs",
			"test/user_test.ml",
			"test/user_test.re",
			"test/user_test.res",
			"test/user_test.dart",
			"integration_test/app_test.dart",
			"tests/testthat/test-calc.R",
			"test/test_calc.jl",
			"test/runtests.jl",
			"spec/user_spec.lua",
			"test/user_test.lua",
			"test/calc_test.zig",
			"test/test_calc.zig",
			"test/deploy.bats",
			"test/test_script.sh",
			"test/script_test.sh",
			"test/script_test.bash",
		];

		for (const file of otherLangTestFiles) {
			it(`detects other language test file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("General Test Directories & Mocks & Fixtures", () => {
		const directoryFiles = [
			"e2e/login.spec.ts",
			"playwright/specs/home.spec.ts",
			"wiremock/stubs/api.json",
			"cucumber/features/step_definitions/steps.js",
			"smoke-tests/ping.ts",
			"contract-tests/consumer.ts",
			"acceptance-tests/checkout.ts",
			"fixtures/users.json",
			"mocks/service.ts",
			"snapshots/view.json",
		];

		for (const file of directoryFiles) {
			it(`detects test directory file: ${file}`, () => {
				expect(isTestFile(file)).toBe(true);
			});
		}
	});

	describe("False Positive Protection (Production code MUST NOT be flagged)", () => {
		const nonTestFiles = [
			"src/auth/attestation.ts",
			"src/auth/Attestation.java",
			"src/contest/voting.ts",
			"src/models/Contest.java",
			"src/models/Protest.java",
			"src/models/Detest.java",
			"src/utils/latest.ts",
			"src/utils/fastest.py",
			"src/utils/greatest.ts",
			"src/utils/smartest.cpp",
			"src/utils/shortest.rs",
			"src/utils/longest.go",
			"src/utils/sweetest.swift",
			"src/utils/brightest.kt",
			"src/context.ts",
			"src/contextual/parser.ts",
			"src/testament/document.rs",
			"src/biology/testosterone.ts",
			"src/anatomy/intestine.go",
			"src/legal/intestate.py",
			"src/contestant/profile.ts",
			"src/protester/report.py",
			"src/services/UserService.java",
			"src/services/UserController.cs",
			"src/models/Account.py",
			"src/lib/database.go",
		];

		for (const file of nonTestFiles) {
			it(`does not falsely classify production file as test: ${file}`, () => {
				expect(isTestFile(file)).toBe(false);
			});
		}
	});

	describe("Configuration Options & Filtering", () => {
		it("returns false for all files when ignoreTests is false", () => {
			expect(isTestFile("src/user.test.ts", { ignoreTests: false })).toBe(
				false,
			);
			expect(
				isTestFile("src/test/java/UserServiceTest.java", {
					ignoreTests: false,
				}),
			).toBe(false);
		});

		it("supports customTestPatterns to ignore extra patterns", () => {
			expect(isTestFile("src/custom/helper.ts")).toBe(false);
			expect(
				isTestFile("src/custom/helper.ts", {
					customTestPatterns: ["src/custom/**"],
				}),
			).toBe(true);
		});

		it("supports excludeTestPatterns to un-ignore test paths", () => {
			expect(isTestFile("src/components/Button.test.ts")).toBe(true);
			expect(
				isTestFile("src/components/Button.test.ts", {
					excludeTestPatterns: ["src/components/Button.test.ts"],
				}),
			).toBe(false);
		});

		it("creates a reusable filter via createTestFilter", () => {
			const filter = createTestFilter();
			expect(filter("src/user.test.ts")).toBe(true);
			expect(filter("src/user.ts")).toBe(false);

			const disabledFilter = createTestFilter({ ignoreTests: false });
			expect(disabledFilter("src/user.test.ts")).toBe(false);
		});
	});

	describe("Integration with createIgnoreFilter", () => {
		it("ignores test files by default in createIgnoreFilter", () => {
			const ignoreFilter = createIgnoreFilter();
			expect(ignoreFilter("src/user.test.ts")).toBe(true);
			expect(ignoreFilter("src/test/java/UserTest.java")).toBe(true);
			expect(ignoreFilter("src/auth/attestation.ts")).toBe(false);
			expect(ignoreFilter("src/user.ts")).toBe(false);
		});

		it("respects ignoreTests: false in createIgnoreFilter", () => {
			const ignoreFilter = createIgnoreFilter([], { ignoreTests: false });
			expect(ignoreFilter("src/user.test.ts")).toBe(false);
			expect(ignoreFilter("src/test/java/UserTest.java")).toBe(false);
			expect(ignoreFilter("node_modules/pkg/index.js")).toBe(true); // noise pattern still ignored
		});
	});

	describe("Monorepos & Nested Path Support", () => {
		const nestedPaths = [
			"apps/web/src/__tests__/Button.test.tsx",
			"packages/core/src/test/java/com/example/CoreTest.java",
			"services/auth/tests/test_token.py",
			"modules/payment/test/payment_test.go",
			"android/app/src/androidTest/java/com/example/AppTest.kt",
			"ios/MyAppTests/MyAppTests.swift",
			"backend/dotnet/App.Tests/Controllers/AuthControllerTests.cs",
		];

		for (const p of nestedPaths) {
			it(`detects nested monorepo test file: ${p}`, () => {
				expect(isTestFile(p)).toBe(true);
			});
		}
	});

	describe("Case Insensitivity & Edge Cases", () => {
		it("detects uppercase/mixed-case directory names", () => {
			expect(isTestFile("SRC/TEST/App.java")).toBe(true);
			expect(isTestFile("Tests/Unit/Parser.php")).toBe(true);
			expect(isTestFile("SPEC/models/user_spec.rb")).toBe(true);
		});

		it("safely handles empty, whitespace, and non-string inputs", () => {
			expect(isTestFile("")).toBe(false);
			expect(isTestFile("   ")).toBe(false);
			expect(isTestFile(".")).toBe(false);
			expect(isTestFile(undefined as unknown as string)).toBe(false);
			expect(isTestFile(null as unknown as string)).toBe(false);
		});
	});

	describe("Git Tracked File Enumeration Integration", () => {
		it("automatically filters test files from Git tracked enumeration", async () => {
			const tempDir = await fs.mkdtemp(
				path.join(os.tmpdir(), "test-detector-git-"),
			);
			try {
				await execGit(["init"], tempDir);
				await execGit(["config", "user.email", "test@example.com"], tempDir);
				await execGit(["config", "user.name", "Test User"], tempDir);

				await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
				await fs.mkdir(path.join(tempDir, "src/test/java"), {
					recursive: true,
				});

				await fs.writeFile(
					path.join(tempDir, "src/main.ts"),
					"export const a = 1;\n",
				);
				await fs.writeFile(
					path.join(tempDir, "src/main.test.ts"),
					"export const b = 2;\n",
				);
				await fs.writeFile(
					path.join(tempDir, "src/test/java/AppTest.java"),
					"class AppTest {}\n",
				);
				await fs.writeFile(
					path.join(tempDir, "src/attestation.ts"),
					"export const c = 3;\n",
				);

				await execGit(["add", "."], tempDir);
				await execGit(["commit", "-m", "init"], tempDir);

				const trackedDefault = await getTrackedGitFiles(tempDir);
				const relPathsDefault = trackedDefault.map((p) =>
					path.relative(tempDir, p).replace(/\\/g, "/"),
				);

				expect(relPathsDefault).toContain("src/main.ts");
				expect(relPathsDefault).toContain("src/attestation.ts");
				expect(relPathsDefault).not.toContain("src/main.test.ts");
				expect(relPathsDefault).not.toContain("src/test/java/AppTest.java");

				const trackedAll = await getTrackedGitFiles(tempDir, {
					ignoreTests: false,
				});
				const relPathsAll = trackedAll.map((p) =>
					path.relative(tempDir, p).replace(/\\/g, "/"),
				);

				expect(relPathsAll).toContain("src/main.ts");
				expect(relPathsAll).toContain("src/main.test.ts");
				expect(relPathsAll).toContain("src/test/java/AppTest.java");
				expect(relPathsAll).toContain("src/attestation.ts");
			} finally {
				await fs.rm(tempDir, { recursive: true, force: true });
			}
		});
	});
});
