# omp-plugin-duplicate-detector

Duplicate code warnings for [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`), using the [jscpd](https://github.com/kucherenko/jscpd) tokenizer.

<img width="717" height="254" alt="image" src="https://github.com/user-attachments/assets/d4673964-1842-4a38-93de-72772edede98" />

The plugin indexes your repository in the background. When the agent's `write` or `edit` adds code that duplicates code already in the repository, the agent gets a warning that names both locations, so it can reuse or extract the existing code instead of copying it. Only duplication that the change itself introduced is reported. Duplicates that already existed are not.

## Installation

```bash
omp plugin install omp-plugin-duplicate-detector
```

## Usage

Detection is on by default for every Git repository. Each new duplicate is reported once per session, as follows:

- **`steer`** (default): a warning card in the transcript, which also reaches the model at its next step. The running tool batch is not interrupted.
- **`in-band`**: the warning is attached to the `write`/`edit` tool result as additional context. No card is shown.

While the index is being built, a status-line item shows progress. If a check is still waiting when the tool result returns (because indexing hasn't finished), its warning arrives as soon as the check completes.

Subagents get warnings too. All sessions in one omp process share one background worker and one index per repository.

### `/duplicates`

```text
/duplicates on       # enable for this repository
/duplicates off      # disable for this repository
/duplicates status   # state, indexed file count, root, reminder mode
```

The setting is stored per repository in `~/.cache/omp/duplicate-detector/projects.json` (or under `$XDG_CACHE_HOME`). Linked worktrees and omp task isolations use the setting of the repository they come from.

## Configuration

Plugin settings (`omp plugin config set omp-plugin-duplicate-detector <key> <value>`, or per project in `.omp/plugin-overrides.json`):

| Setting | Default | Description |
|---|---|---|
| `minTokens` | `40` | Minimum duplicated tokens to report |
| `minLines` | `5` | Minimum duplicated lines (in the edited file) to report |
| `reminderMode` | `"steer"` | `"steer"` or `"in-band"` |
| `ignorePatterns` | — | Extra gitignore-style patterns, comma-separated (commas inside `{…}` are kept) |
| `ignoreTests` | `true` | Skip test files, test directories, mocks, fixtures, and snapshots |
| `maxIndexedFiles` | `10000` | Maximum number of files in the index |

### Project configuration

The plugin also reads standard jscpd configuration: `.jscpd.json`, the `.jscpd.rc*` and `.jscpd.y(a)ml` variants, the `.config/` variants, or a `"jscpd"` key in `package.json`. It looks in the working directory and each parent up to the repository root. Recognized keys:

```json
{
  "minLines": 6,
  "minTokens": 50,
  "ignore": ["generated/**"],
  "ignoreTests": true,
  "customTestPatterns": ["**/custom_fixtures/**"],
  "excludeTestPatterns": ["src/services/test-utils-in-prod.ts"],
  "formatsExts": { "markdown": ["md", "mdx"] }
}
```

Plugin settings take precedence over the project file, which takes precedence over the defaults. Ignore patterns from all sources are combined.

## What is indexed

The index holds files from `git ls-files --cached --others --exclude-standard` (tracked files plus untracked files that are not ignored), except for the following:

- **Build output, dependencies, and caches:** `node_modules`, `target`, `dist`, `build`, `out`, `vendor`, `coverage`, `.next`, `__pycache__`, `.venv`, and similar directories, at any depth, even if the repository doesn't gitignore them. Git is never asked to list their untracked contents.
- **Non-code formats:** docs, data, and config files (`.md`, `.json`, `.yaml`, `.toml`, `.csv`, `.svg`, `.xml`, …). You can opt formats back in with `formatsExts`.
- **Generated files and noise:** files with a generated-code marker (`@generated`, `DO NOT EDIT`, …) in their leading comments, lockfiles, minified bundles, and source maps.
- **Tests** (unless `ignoreTests` is `false`): test files and directories, mocks, fixtures, and snapshots, across common languages. Use `customTestPatterns` to add paths and `excludeTestPatterns` to keep specific paths as production code.
- **Large files:** anything over 100 KiB.

Outside a Git repository the detector is unavailable.

Changes made outside `write`/`edit` (for example by `bash`, subagents, or `git checkout`) are picked up by a cheap rescan after each such tool call and at the start of each turn. The rescan compares file size and mtime and re-tokenizes only the files that changed.

## Performance

- The index stores compact typed arrays (about 12 bytes per token) plus a winnowed fingerprint map. On a 3,900-file TypeScript monorepo (2.8M tokens), a cold index takes about 1.5 s in the background worker. The index itself holds about 40 MB, and extra process RSS peaks at about 200 MB while indexing. Version 0.3 used 1.1–1.5 GB per session.
- Nothing is cached on disk. Version 0.3 caches in `~/.cache/omp/duplicate-detector` (SQLite files and shard directories) are deleted automatically.

## Development

Requires [Bun](https://bun.sh) and Git.

```bash
bun install
bun test           # test suite
bun run typecheck  # TypeScript
bun run check      # Biome + knip
```

The worker (`src/detector/worker.ts`) runs from source under Bun. Inside omp it is bundled in memory at startup, so there is no build step.

## License

MIT — [Oh My Pi Contributors](https://github.com/oh-my-pi)
