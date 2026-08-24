/**
 * Multi-language test file, test directory, mock, and fixture detector.
 * Identifies testing-related files across the software engineering ecosystem
 * (JavaScript, TypeScript, Python, Java, Kotlin, Scala, Groovy, Go, Rust,
 * C, C++, C#, F#, Ruby, PHP, Swift, Objective-C, Elixir, Erlang, Clojure,
 * Haskell, OCaml, Reason, ReScript, Dart, R, Julia, Lua, Zig, Shell, and more).
 */

import * as path from "node:path";
import ignore from "ignore";

export interface TestFileDetectorOptions {
	/**
	 * Whether test file detection is enabled. Defaults to true.
	 */
	ignoreTests?: boolean;
	/**
	 * Additional glob patterns or path substrings to treat as test files.
	 */
	customTestPatterns?: string[];
	/**
	 * Glob patterns or path substrings to exclude from test detection (i.e. keep as production code).
	 */
	excludeTestPatterns?: string[];
}

/**
 * Standard testing directory segment names across ecosystems.
 * Matched against individual path directory segments (case-insensitive where appropriate).
 */
const DEFAULT_TEST_DIRECTORY_NAMES: Record<string, true> = {
	tests: true,
	testing: true,
	__test__: true,
	__tests__: true,
	spec: true,
	specs: true,
	__spec__: true,
	__specs__: true,
	__mocks__: true,
	__fixtures__: true,
	__snapshots__: true,
	fixtures: true,
	fixture: true,
	mocks: true,
	mock: true,
	snapshots: true,
	snapshot: true,
	stubs: true,
	fakes: true,
	testdata: true,
	test_data: true,
	"test-data": true,
	testfixtures: true,
	test_fixtures: true,
	"test-fixtures": true,
	testsuite: true,
	testsuites: true,
	test_suite: true,
	"test-suite": true,
	testutils: true,
	test_utils: true,
	"test-utils": true,
	testhelpers: true,
	test_helpers: true,
	"test-helpers": true,
	unittest: true,
	unittests: true,
	unit_tests: true,
	"unit-tests": true,
	unit_test: true,
	"unit-test": true,
	integration_tests: true,
	"integration-tests": true,
	integration_test: true,
	"integration-test": true,
	functional_tests: true,
	"functional-tests": true,
	functional_test: true,
	"functional-test": true,
	system_tests: true,
	"system-tests": true,
	systemtest: true,
	systemtests: true,
	uitests: true,
	ui_tests: true,
	"ui-tests": true,
	e2e: true,
	"e2e-tests": true,
	e2e_tests: true,
	cypress: true,
	playwright: true,
	testthat: true,
	benches: true,
	benchmarks: true,
	bdd: true,
	cucumber: true,
	step_definitions: true,
	wiremock: true,
	contract_tests: true,
	"contract-tests": true,
	smoke_tests: true,
	"smoke-tests": true,
	acceptance_tests: true,
	"acceptance-tests": true,
	googletest: true,
	gtest: true,
	catch2: true,
	doctest: true,
	testcontainers: true,
};
/**
 * Standard test directory prefix / structured path regexes (e.g. Maven, Gradle, Android, .NET, Xcode).
 */
const STRUCTURED_TEST_PATH_PATTERNS: readonly RegExp[] = [
	// Maven / Gradle / JVM: src/test/**, src/it/**, src/androidTest/**, src/integrationTest/**, src/testFixtures/**
	/(?:^|\/)src\/(?:test|it|androidTest|integrationTest|functionalTest|testFixtures|testDebug|testRelease)(?:\/|$)/i,
	// .NET test project directories: MyProject.Tests, MyProject.UnitTests, MyProject.IntegrationTests, MyProject.Specs
	/(?:^|\/)[^/]+\.(?:tests|test|unittests|unittest|integrationtests|integrationtest|specs|spec|functionaltests)(?:\/|$)/i,
	// Xcode / Swift test folders: MyProjectTests, MyProjectUITests, MyProjectUnitTests
	/(?:^|\/)[^/]+(?:Tests|UITests|UnitTests)(?:\/|$)/,
	// General test suites and directories
	/(?:^|\/)(?:tests?|specs?|testing|test_suite|test_data|testdata|fixtures|mocks|snapshots|e2e|cypress|playwright|googletest|gtest|catch2|doctest)\//i,
];

/**
 * False-positive guard root words.
 * Legitimate domain concepts/words that contain "test" but are NOT test files
 * unless accompanied by explicit test delimiters (e.g. `.test.`, `_test.`) or located in a test directory.
 */
const FALSE_POSITIVE_ROOTS =
	/^(?:at?test(?:ation|ing|ed|s)?|contest(?:ant|ants|ed|ing|s)?|detest(?:able|ed|ing|s)?|protest(?:er|ers|ed|ing|s)?|testament(?:ary|s)?|testosterone|testify|fastest|latest|greatest|smartest|shortest|longest|fittest|neatest|sweetest|brightest|hottest|context|contextual|latent|intestine|intestate)$/i;

/**
 * Prefix-based test filename patterns (e.g. `test_auth.py`, `TestUser.java`, `ITPayment.java`, `conftest.py`).
 */
const TEST_FILENAME_PREFIX_REGEX =
	/^(?:test[_-]|tests[_-]|test\.|tests\.|runtests\.|conftest\.|setupTests\.|setup-tests\.|setup_tests\.|jest\.setup\.|vitest\.setup\.)/i;

/**
 * Suffix-based test filename patterns (before extension):
 * E.g.:
 * - `.test`, `.spec`, `.cy`, `.e2e`, `.e2e-spec`, `.integration`, `.unit`
 * - `_test`, `_tests`, `_spec`, `_specs`, `_unittest`, `_unit_test`, `_integration_test`, `_bench_test`, `_bench`, `_SUITE`
 * - `-test`, `-spec`, `-tests`, `-specs`
 * - PascalCase `Test`, `Tests`, `TestCase`, `TestCases`, `IT`, `ITCase`, `Spec`, `Specs`, `Benchmark`, `Benchmarks`
 */
const TEST_SUFFIX_REGEX =
	/(?:[._-](?:test|tests|spec|specs|cy|e2e|e2e-spec|e2e_spec|integration|unit|unittest|unit_test|integration_test|integration-test|bench|bench_test|benchmark|suite|fixture|fixtures))$/i;

/**
 * PascalCase / CamelCase test name suffix regex (e.g. `UserTest`, `OrderTests`, `AuthTestCase`, `PaymentIT`, `CartSpec`, `SortBenchmark`).
 */
const PASCAL_TEST_SUFFIX_REGEX =
	/^[A-Z][A-Za-z0-9_]*(?:Test|Tests|TestCase|TestCases|IT|ITCase|Spec|Specs|Benchmark|Benchmarks)$/;

/**
 * Standalone test harness / helper filenames across languages.
 */
const TEST_HELPER_FILENAMES: Record<string, true> = {
	"test_helper.rb": true,
	"spec_helper.rb": true,
	"rails_helper.rb": true,
	"test_helper.go": true,
	"test_helpers.go": true,
	"test_utils.py": true,
	"test_util.py": true,
	"test-utils.ts": true,
	"test-utils.js": true,
	"test-utils.tsx": true,
	"test-utils.jsx": true,
	"testutils.ts": true,
	"testutils.js": true,
	"testutils.tsx": true,
	"testutils.jsx": true,
	"conftest.py": true,
	"setuptests.ts": true,
	"setuptests.js": true,
	"setuptests.tsx": true,
	"setuptests.jsx": true,
	"jest.setup.ts": true,
	"jest.setup.js": true,
	"jest.setup.mjs": true,
	"jest.setup.cjs": true,
	"vitest.setup.ts": true,
	"vitest.setup.js": true,
	"vitest.setup.mjs": true,
	"vitest.setup.cjs": true,
	"test_runner.rb": true,
	"runtests.jl": true,
};

/**
 * File extensions exclusively used for test scripts, fixtures, or snapshots.
 */
const TEST_ONLY_EXTENSIONS: Record<string, true> = {
	".bats": true,
	".snap": true,
	".snapshot": true,
};

/**
 * Checks whether a given relative or absolute file path corresponds to a test file,
 * test directory, mock, test helper, or fixture across any programming language.
 *
 * @param filePath - The file or directory path to inspect.
 * @param options - Optional configuration including custom/exclude patterns.
 * @returns `true` if the file is identified as a test file; `false` otherwise.
 */
export function isTestFile(
	filePath: string,
	options: TestFileDetectorOptions = {},
): boolean {
	if (options.ignoreTests === false) {
		return false;
	}

	if (!filePath || typeof filePath !== "string") {
		return false;
	}

	const normalized = filePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
	if (!normalized || normalized === ".") {
		return false;
	}

	// 1. Check user-defined exclude patterns (takes precedence to un-ignore)
	if (options.excludeTestPatterns && options.excludeTestPatterns.length > 0) {
		try {
			const excludeFilter = ignore().add(options.excludeTestPatterns);
			if (excludeFilter.ignores(normalized)) {
				return false;
			}
		} catch {
			// Ignore pattern syntax errors gracefully
		}
	}

	// 2. Check user-defined custom test patterns
	if (options.customTestPatterns && options.customTestPatterns.length > 0) {
		try {
			const customFilter = ignore().add(options.customTestPatterns);
			if (customFilter.ignores(normalized)) {
				return true;
			}
		} catch {
			// Ignore pattern syntax errors gracefully
		}
	}

	const ext = path.extname(normalized).toLowerCase();

	// 3. Test-only extensions (e.g. .bats, .snap, .snapshot)
	if (TEST_ONLY_EXTENSIONS[ext]) {
		return true;
	}

	const baseName = path.basename(normalized);
	const baseNameLower = baseName.toLowerCase();

	// 4. Exact test helper filenames
	if (TEST_HELPER_FILENAMES[baseNameLower]) {
		return true;
	}

	const segments = normalized.split("/").filter(Boolean);
	const dirSegments = segments.slice(0, -1);

	// 5. Directory segment match (e.g. /test/, /tests/, /__tests__/, /spec/, /testdata/, etc.)
	for (const dir of dirSegments) {
		const dirLower = dir.toLowerCase();
		if (DEFAULT_TEST_DIRECTORY_NAMES[dirLower]) {
			return true;
		}
	}

	// 6. Structured directory path patterns (e.g. src/test/java/**, *.Tests/**, Xcode *Tests/**)
	if (dirSegments.length > 0) {
		for (const pattern of STRUCTURED_TEST_PATH_PATTERNS) {
			if (pattern.test(normalized)) {
				return true;
			}
		}
	}

	// 7. Check filename without extension (strip compound extensions like .test.ts or .spec.jsx)
	const nameWithoutExt = baseName.slice(0, baseName.length - ext.length);
	if (!nameWithoutExt) {
		return false;
	}

	// Guard against false positive root words when exact match without test delimiters
	if (FALSE_POSITIVE_ROOTS.test(nameWithoutExt)) {
		return false;
	}

	// 8. Test prefix matching (e.g. `test_*.py`, `test-*.js`, `Test*.java`, `IT*.java`)
	if (TEST_FILENAME_PREFIX_REGEX.test(baseName)) {
		return true;
	}

	// Special check for PascalCase Test* / IT* prefix like TestUser.java, ITOrder.java
	if (
		/^(?:Test|TestCase|IT)[A-Z0-9_]/.test(nameWithoutExt) &&
		!FALSE_POSITIVE_ROOTS.test(nameWithoutExt)
	) {
		return true;
	}

	// 9. Suffix-based delimiter matching (e.g. `*.test.*`, `*.spec.*`, `*_test.*`, `*-test.*`, `*.cy.*`, `*.e2e.*`)
	if (TEST_SUFFIX_REGEX.test(nameWithoutExt)) {
		return true;
	}

	// 10. PascalCase / CamelCase test name suffix matching (e.g. `UserServiceTest`, `OrderTests`, `PaymentIT`, `AuthSpec`)
	if (
		PASCAL_TEST_SUFFIX_REGEX.test(nameWithoutExt) &&
		!FALSE_POSITIVE_ROOTS.test(nameWithoutExt)
	) {
		return true;
	}

	return false;
}

/**
 * Creates a fast predicate function that returns `true` if a path is identified as a test file.
 */
export function createTestFilter(
	options: TestFileDetectorOptions = {},
): (relPath: string) => boolean {
	if (options.ignoreTests === false) {
		return () => false;
	}

	return (relPath: string) => isTestFile(relPath, options);
}
