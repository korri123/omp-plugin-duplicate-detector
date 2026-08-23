# @oh-my-pi/omp-plugin-duplicate-detector

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-f472b6.svg)](https://bun.sh)
[![Engine: jscpd](https://img.shields.io/badge/Engine-jscpd-green.svg)](https://github.com/kucherenko/jscpd)

A high-performance, real-time code clone and duplication detector plugin for **[oh-my-pi](https://github.com/oh-my-pi/oh-my-pi)** (`omp`).

Built on `jscpd` and powered by **Bun** native primitives, this plugin proactively intercepts agent mutations, identifies identical and parameterized code duplicates, tracks copy-pasted logic across your codebase, and provides LLM agents and developers with actionable refactoring feedback—all with **zero main-thread blocking** and **instant cold starts**.

---

## Key Highlights

- **Zero Main-Thread Blocking**: All repository scanning, AST tokenization, sliding-window hashing, and SQLite disk I/O run out-of-process in a dedicated `Bun.Worker` background thread.
- **Real-Time Mutation Interception**: Automatically inspects `write` and `edit` tool executions in sub-milliseconds. Warns agents when newly authored code duplicates existing workspace logic.
- **De-duplicating Duplicate Ledger**: Remembers previously reported duplicate clusters to prevent repetitive alerts across multi-step edits.
- **High-Density SQLite Disk Cache (DUP3)**: Token shards are dictionary-compressed into columnar binary streams with delta-encoded coordinates and cached in a per-workspace SQLite database using WAL mode. Cold starts load instantly without re-tokenization.
- **Native Bun.hash Engine**: Employs Bun's native 64-bit hasher (`fastTokenHash`) for token and window hashing, dramatically outperforming JavaScript-based hashing libraries.
- **Git-Aware Baseline Indexing**: Enters your project via `git ls-files --cached`, automatically ignoring untracked files, lockfiles, minified bundles, vendor directories, and non-code assets.
- **Autonomous Agent Tool & Skill**: Equips LLMs with the `detect_duplicates` tool and the `detect-duplicates` skill to audit code quality before and during refactors.
- **Interactive Slash Command & TTSR UI**: Run `/duplicates` directly in chat with argument auto-completion, collapsible diff previews, and TTSR-styled terminal notification cards.

---

## Table of Contents

- [Installation & Setup](#installation--setup)
- [How It Works](#how-it-works)
- [Usage](#usage)
  - [Interactive Slash Command (`/duplicates`)](#interactive-slash-command-duplicates)
  - [Agent Tool (`detect_duplicates`)](#agent-tool-detect_duplicates)
  - [Companion Skill (`detect-duplicates`)](#companion-skill-detect-duplicates)
- [Real-Time Mutation Interception](#real-time-mutation-interception)
  - [Feedback Modes (`steer`, `in-band`, `none`)](#feedback-modes)
  - [Duplicate Ledger & Anti-Spam](#duplicate-ledger--anti-spam)
  - [Late Finding Propagation](#late-finding-propagation)
- [Configuration](#configuration)
  - [Plugin Settings (`omp.settings`)](#plugin-settings)
  - [Project Configuration (`.jscpd.json`, `package.json`)](#project-configuration)
  - [Language Filtering & `formatsExts`](#language-filtering--formatsexts)
- [Architecture Deep-Dive](#architecture-deep-dive)
  - [1. Worker & RPC Lifecycle](#1-worker--rpc-lifecycle)
  - [2. Source-Aware Clone Index](#2-source-aware-clone-index)
  - [3. DUP3 Columnar Binary Shards & SQLite Storage](#3-dup3-columnar-binary-shards--sqlite-storage)
  - [4. Git-Aware Traversal & Circuit Breakers](#4-git-aware-traversal--circuit-breakers)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Installation & Setup

### Option 1: Local Plugin Linking (Recommended for Dev)

Link the plugin repository directly into your local `omp` plugins registry:

```bash
cd omp-plugin-duplicate-detector
omp plugin link .
```

### Option 2: Config File Declaration

Add the plugin path to your global `~/.omp/agent/config.yml` or project-level `.omp/config.yml`:

```yaml
extensions:
  - /path/to/omp-plugin-duplicate-detector
```

### Option 3: Single-Session CLI Flag

Load the plugin on demand for a single `omp` session:

```bash
omp --extension /path/to/omp-plugin-duplicate-detector
# or short form:
omp -e /path/to/omp-plugin-duplicate-detector
```

Upon startup, you will see a subtle baseline readiness notification in the transcript:
```text
Duplicate detector: Ready (1,420 Git files indexed, cached)
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MAIN THREAD (oh-my-pi)                           │
│                                                                         │
│   Agent Tool / Slash Command                 tool_result Hook           │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │   detect_duplicates       │         │   write / edit Mutation   │   │
│   │   /duplicates [path]      │         └─────────────┬─────────────┘   │
│   └─────────────┬─────────────┘                       │                 │
│                 │                                     ▼                 │
│                 │                           ┌───────────────────┐       │
│                 │                           │  DuplicateLedger  │       │
│                 │                           │  (suppress dupes) │       │
│                 ▼                           └─────────┬─────────┘       │
│   ┌───────────────────────────────────────────────────▼─────────────┐   │
│   │                DuplicateDetectorCoordinator                     │   │
│   │   - Epoch tracking  - Auto-restart backoff  - Timeout handling  │   │
│   └─────────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ RPC Protocol (postMessage)
┌─────────────────────────────────▼───────────────────────────────────────┐
│                      BACKGROUND WORKER THREAD                           │
│                                                                         │
│   ┌─────────────────────────┐             ┌─────────────────────────┐   │
│   │     detector-worker     │◄───────────►│  SourceAwareCloneIndex  │   │
│   │  (Git crawl & batching) │             │  (Fast multi-source)    │   │
│   └─────────────┬───────────┘             └─────────────────────────┘   │
│                 │                                     ▲                 │
│                 ▼                                     │ Hydrate         │
│   ┌───────────────────────────────────────────────────┴─────────────┐   │
│   │              DiskCacheManager (bun:sqlite WAL)                  │   │
│   │      - High-density DUP3 columnar binary compression            │   │
│   │      - Deterministic config & workspace fingerprinting          │   │
│   │      - LRU byte-budget eviction (250 MB cap)                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **Non-blocking Startup**: On session launch, `session_start` delegates repository indexing to the background worker. The main agent loop is completely unblocked.
2. **Git Baseline**: The worker queries `git ls-files --cached -z` to discover tracked files, filtering out ignored and non-code assets.
3. **SQLite Shard Cache**: Each source file's token stream is packed into a high-density binary shard (`DUP3`) and stored in SQLite. On subsequent runs, files matching the same content hash load without tokenization.
4. **Real-Time Hot Indexing**: When an agent writes or edits code, the mutation is hashed and compared against the workspace index in sub-milliseconds.
5. **Smart Notifications**: Any detected duplicate blocks are filtered through the `DuplicateLedger` and delivered to the agent or user.

---

## Usage

### Interactive Slash Command (`/duplicates`)

Run `/duplicates` directly within your interactive `omp` session to scan all or part of the workspace:

```text
# Scan the entire workspace using configured defaults
/duplicates

# Scan a specific directory
/duplicates src/services/

# Specify minimum matching lines and tokens
/duplicates --min-lines=8 --min-tokens=50

# Target a subdirectory with custom thresholds
/duplicates --path=packages/core --min-lines=10
```

The slash command runs the scan and appends the resulting report card directly into the session transcript with `{ triggerTurn: false }` (rendered in the TUI without triggering an unwanted AI response turn, but remaining available in conversation history for subsequent agent turns):

```text
┌─ [!] 2 duplicate blocks detected: src/utils/format.ts ────────────────── (r) ┐
│                                                                              │
│  • src/utils/format.ts:45-72 <-> src/legacy/string-helpers.ts:102-129 (28 lines)
│  • src/utils/format.ts:80-95 <-> packages/common/src/text.ts:12-27 (16 lines)│
│                                                                              │
│  ```typescript                                                               │
│  export function formatTimestamp(date: Date, locale = "en-US"): string {     │
│    return new Intl.DateTimeFormat(locale, { ... }).format(date);             │
│  }                                                                           │
│  ```                                                                         │
│                                                          (ctrl+o to expand)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Agent Tool (`detect_duplicates`)

Coding agents running in `omp` have access to the `detect_duplicates` tool schema to programmatically verify code health before or after refactoring:

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | No | Workspace root | Directory or path to inspect |
| `minLines` | `number` | No | `5` (or project config) | Minimum consecutive matching lines to report |
| `minTokens` | `number` | No | `40` (or project config) | Minimum token count threshold for a clone block |

#### Example Tool Call

```json
{
  "path": "src/controllers",
  "minLines": 6,
  "minTokens": 45
}
```

#### Tool Response

```markdown
# Duplicate Code Report

- **Indexed Files**: 84
- **Scan Target**: `src/controllers`
- **Duplicate Clusters Found**: 1

## Detected Clones

### Clone #1 (18 lines, format: typescript)
- **Location A**: `src/controllers/user.ts:42-59`
- **Location B**: `src/controllers/auth.ts:88-105`

```typescript
const sessionToken = await authService.createSession({
  userId: user.id,
  roles: user.roles,
  issuedAt: Date.now(),
});
res.setHeader("Set-Cookie", serializeCookie("session", sessionToken));
return res.status(200).json({ success: true });
```
```

---

### Companion Skill (`detect-duplicates`)

The plugin includes an auto-discovered `detect-duplicates` skill (`skills/detect-duplicates/SKILL.md`) that guides agents during architectural reviews, refactoring tasks, or duplicate cleanup audits.

---

## Real-Time Mutation Interception

Whenever an agent uses the `write` or `edit` tool, the plugin intercepts the `tool_result` event before the agent acts on the next step:

1. Checks if the mutated file is a supported source code format.
2. Updates the hot index in the worker thread via `checkAndUpdate`.
3. Compares newly generated token frames against all known repository code.
4. If a duplicate block is detected, it formats a clear, location-anchored warning.

### Feedback Modes

Configurable via `reminderMode` in your settings:

- **`steer` (Default)**: Emits an interactive TTSR warning card in the terminal UI and injects a steering instruction into the conversation stream, immediately alerting the agent to refactor before proceeding.
- **`in-band`**: Prepends a `<system-reminder reason="code_duplication">` XML block directly into the tool result output.
- **`none`**: Disables real-time mutation warnings while keeping the background index warm for explicit `/duplicates` or `detect_duplicates` runs.

### Duplicate Ledger & Anti-Spam

To avoid spamming the conversation during iterative edits on the same file, the `DuplicateLedger` maintains a record of surfaced clone identities (`sourceA:start-end <-> sourceB:start-end`). If subsequent edits do not introduce new duplicates, duplicate warnings are suppressed.

### Late Finding Propagation

If an agent mutates a file while baseline repository indexing is still running in the background, the worker registers a watch revision on that file. When baseline indexing finishes tokenizing older files and discovers a clone matching the recently edited file, it fires a `lateFinding` event that surfaces the warning card dynamically.

---

## Configuration

### Plugin Settings

Configure settings globally in `~/.omp/agent/config.yml` (or `.omp/config.yml`):

```json
{
  "settings": {
    "minLines": 5,
    "minTokens": 40,
    "checkOnMutation": true,
    "reminderMode": "steer",
    "ignorePatterns": "fixtures/**,generated/**",
    "maxIndexedFiles": 10000
  }
}
```

| Setting | Type | Default | Description |
|---|---|---|---|
| `minLines` | `number` | `5` | Minimum consecutive lines to report as a duplicate block |
| `minTokens` | `number` | `40` | Minimum token threshold for a duplicate block |
| `checkOnMutation` | `boolean` | `true` | Enable real-time checks on `write` / `edit` tool operations |
| `reminderMode` | `enum` | `"steer"` | Feedback delivery: `"steer"`, `"in-band"`, or `"none"` |
| `ignorePatterns` | `string` | `""` | Comma-separated glob patterns to ignore |
| `maxIndexedFiles` | `number` | `10000` | Maximum number of source files to index during baseline scan |

---

### Project Configuration

The plugin automatically discovers and honors standard `jscpd` configuration files in your repository, adhering to standard priority order:

1. `.jscpd.json`
2. `.jscpd.rc.json`
3. `.jscpd.rc`
4. `.jscpd.rc.yaml` / `.jscpd.rc.yml`
5. `.jscpd.yaml` / `.jscpd.yml`
6. `.config/.jscpd.json` or `.config/jscpd.json`
7. `package.json` under the `"jscpd"` key

#### Example `.jscpd.json`

```json
{
  "minLines": 6,
  "minTokens": 50,
  "maxLines": 500,
  "threshold": 0,
  "ignore": [
    "**/__tests__/**",
    "**/test/**",
    "**/fixtures/**"
  ],
  "formatsExts": {
    "typescript": ["ts", "tsx", "mts"],
    "javascript": ["js", "jsx", "mjs"]
  }
}
```

---

### Language Filtering & `formatsExts`

By default, the plugin tokenizes real programming languages (TypeScript, JavaScript, Python, Rust, Go, C/C++, Java, PHP, Ruby, Kotlin, Swift, Dart, Scala, C#, Shell, etc.) and automatically skips non-code formats:

- Documentation & markup: `markdown`, `txt`, `asciidoc`, `wiki`, `latex`, `svg`, `xml`
- Data & serialized files: `json`, `json5`, `csv`, `yaml`
- Build artifacts & diffs: `diff`, `log`, `tap`, `ignore`, `git`

To explicitly include a custom format or extension, define `formatsExts` in your project config:

```json
{
  "formatsExts": {
    "json": ["json"],
    "markdown": ["md", "mdx"]
  }
}
```

---

## Architecture Deep-Dive

### 1. Worker & RPC Lifecycle

The `DuplicateDetectorCoordinator` manages the lifecycle of the worker thread:

- **Isolated State**: The worker owns the `SourceAwareCloneIndex` and `DiskCacheManager`. The main thread never incurs garbage collection or tokenization overhead.
- **Typed RPC Protocol**: Discriminated union messages (`openWorkspace`, `checkAndUpdate`, `reconcile`, `scan`, `close`) ensure type-safe asynchronous communication.
- **Epoch Management**: Switching sessions or workspaces increments the coordinator's epoch, invalidating stale in-flight requests.
- **Fault-Tolerant Auto-Restart**: If the worker thread crashes or exits unexpectedly, the coordinator catches the event, terminates dead handles, and restarts with exponential backoff (up to 5 attempts), seamlessly reopening the active workspace.

---

### 2. Source-Aware Clone Index

Traditional clone detectors often store hashes in flat lookup maps that cannot easily handle file deletions or updates without costly full-index rebuilds.

`SourceAwareCloneIndex` introduces **multi-contributor frame promotion**:

- **Frame Storage**: Maps `hash -> SourceFrame | SourceFrame[]`. Single-occurrence frames remain unwrapped objects to conserve memory; multiple occurrences are promoted to arrays.
- **Source Indexing**: Maps `sourceId -> Set<hash>`.
- **Fast In-Place Deletion**: Calling `removeSource(filePath)` removes only that file's contributions in $O(\text{frames})$ time without destroying shared hashes belonging to other source files.
- **Fast Token Hash (`fastTokenHash`)**: Replaced JS-based hashing with `Bun.hash`, generating deterministic 64-bit Wyhash/Murmur-derived hex digests in nanoseconds.

---

### 3. DUP3 Columnar Binary Shards & SQLite Storage

To achieve instant cold-start loading, tokenized source files are cached in a per-workspace SQLite database (`~/.cache/omp/duplicate-detector/<workspace_hash>_<config_fingerprint>.sqlite`):

- **SQLite WAL Configuration**: Configured with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, and `PRAGMA temp_store = MEMORY` using `bun:sqlite` prepared statements.
- **DUP3 Columnar Format**:
  1. **Token Hash Dictionary**: Deduplicates repetitive 20-character token hashes into a lookup dictionary of 16-bit indices.
  2. **Columnar Coordinate Streams**: Stores lines, columns, byte ranges, and token lengths in contiguous columnar byte buffers using delta-encoding:
     $$\Delta\text{line} = \text{line}_i - \text{line}_{i-1}, \quad \Delta\text{range} = \text{start}_i - \text{start}_{i-1}$$
  3. **Raw Deflate Compression**: Compresses the packed buffer with `zlib.deflateRawSync`.
- **Backward Compatibility**: Seamlessly reads legacy `DUP2` frame shards and JSON shards without data loss.
- **LRU Byte-Budget Eviction**: Automatically tracks database size and prunes oldest entries when cache usage exceeds 250 MB.

---

### 4. Git-Aware Traversal & Circuit Breakers

To prevent freezing or unbounded memory consumption when starting in large monorepos, `$HOME`, or `/tmp`:

- **Strict Git Worktree Check**: Runs `git rev-parse --is-inside-work-tree`. If not in a Git repository, baseline scanning is safely skipped.
- **Zero Directory Crawling**: Uses `git ls-files --cached -z` to query Git's index directly in milliseconds. Never walks untracked folders or unindexed trees.
- **File Size Cap**: Files larger than 100 KiB (`MAX_FILE_SIZE_BYTES`) are skipped.
- **File Count Limit**: Baseline scanning halts when reaching `maxIndexedFiles` (default: 10,000 files).
- **Total Source Byte Limit**: Baseline scanning halts if cumulative indexed source code exceeds 64 MiB (`MAX_TOTAL_SOURCE_BYTES`).
- **Noise Exclusions**: Automatically excludes `.min.*`, `*.bundle.js`, `*.map`, `*.lock`, `*.lockb`, `.DS_Store`, `node_modules`, and files containing `@generated` / `DO NOT EDIT` headers.

---

## Development & Testing

### Prerequisites

- [Bun](https://bun.sh) (>= v1.1.0)
- Git

### Commands

```bash
# Install dependencies
bun install

# Run the test suite (120+ unit and integration tests)
bun test

# Typecheck with TypeScript
bun run typecheck

# Lint and format with Biome
bun run check
bun run format

# Compile the standalone worker bundle into dist/
bun run build:worker
```

> **Note**: Whenever you modify `src/detector-worker.ts`, `src/source-aware-index.ts`, or `src/disk-cache.ts`, run `bun run build:worker` to update `dist/detector-worker.js`.

---

## License

MIT - [Oh My Pi Contributors](https://github.com/oh-my-pi)
