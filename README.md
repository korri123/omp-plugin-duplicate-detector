# omp-plugin-duplicate-detector

Real-time duplicate code detection for [oh-my-pi](https://github.com/oh-my-pi/oh-my-pi) (`omp`), built on [jscpd](https://github.com/kucherenko/jscpd).

The plugin indexes your repository in the background and watches the agent as it works. When newly written or edited code duplicates existing logic anywhere in the workspace, the agent is warned immediately, before the copy-paste hardens into a maintenance problem. Duplicate detection can be toggled on or off per project using `/duplicates on|off`.

Indexing and mutation checks run entirely in a background worker with a persistent on-disk cache, so sessions start instantly and the agent loop is never blocked, even in large repositories.
## Installation

Link the plugin into your local `omp` registry:

```bash
omp plugin link /path/to/omp-plugin-duplicate-detector
```

Or declare it in `~/.omp/agent/config.yml` (or a project-level `.omp/config.yml`):

```yaml
extensions:
  - /path/to/omp-plugin-duplicate-detector
```

Or load it for a single session:

```bash
omp -e /path/to/omp-plugin-duplicate-detector
```

On startup you'll see a short readiness note in the transcript, e.g. `Duplicate detector: Ready (1,420 Git files indexed, cached)`.

## Usage

### Real-time warnings

Enabled by default. Whenever the agent writes or edits a source file, the change is checked against the workspace index. If it duplicates existing code, a warning naming both locations is surfaced. How it's delivered is controlled by `reminderMode`:

- **`steer`** (default) — shows a warning card in the terminal and steers the agent to reconsider before its next step.
- **`in-band`** — appends a system reminder to the tool result instead.
- **`none`** — disables real-time warnings; the index stays warm for on-demand scans.

Previously reported duplicates are remembered per session, so iterative edits to the same file don't repeat the same warning.

### `/duplicates` slash command

Toggle duplicate detection on or off on a per-project basis. The preference is stored persistently in `~/.cache/omp/duplicate-detector/projects.json`.

```text
/duplicates on                           # enable duplicate detector for this project
/duplicates off                          # disable duplicate detector for this project
/duplicates status                       # show current status for this project
```
## Configuration

Plugin settings (via the extension's `settings` in your omp config):

| Setting | Default | Description |
|---|---|---|
| `minLines` | `5` | Minimum consecutive lines to report as a duplicate |
| `minTokens` | `40` | Minimum token count for a duplicate block |
| `checkOnMutation` | `true` | Real-time checks on `write` / `edit` |
| `reminderMode` | `"steer"` | `"steer"`, `"in-band"`, or `"none"` |
| `ignorePatterns` | — | Glob patterns to exclude (array, or comma-separated string) |
| `maxIndexedFiles` | `10000` | Cap on files indexed during the baseline scan |

### Project configuration

Standard `jscpd` configuration is discovered automatically — `.jscpd.json` and its `.jscpd.rc*` / `.config/` variants, or a `"jscpd"` key in `package.json`:

```json
{
  "minLines": 6,
  "minTokens": 50,
  "ignore": ["**/__tests__/**", "**/fixtures/**"]
}
```

By default only real programming languages are tokenized; documentation, markup, data files, lockfiles, minified bundles, and generated code are skipped. Use `formatsExts` in your jscpd config to opt extra formats in (e.g. `{ "markdown": ["md", "mdx"] }`).

## Scope and performance

- Only Git-tracked files are indexed (`git ls-files`); outside a Git repository, baseline scanning is skipped.
- Hard caps on file size, file count, and total indexed bytes prevent runaway memory use in large monorepos.
- Tokenized files are cached on disk per workspace with size-bounded eviction, so repeat sessions skip re-tokenization entirely.

## Development

Requires [Bun](https://bun.sh) and Git.

```bash
bun install        # dependencies
bun test           # test suite
bun run typecheck  # TypeScript
bun run check      # lint (Biome)
bun run build:worker  # rebuild dist/detector-worker.js after worker-side changes
```

## License

MIT — [Oh My Pi Contributors](https://github.com/oh-my-pi)
