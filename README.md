# @oh-my-pi/omp-plugin-duplicate-detector

A high-performance code clone and duplication detector plugin for **oh-my-pi** (`omp`).

Detects identical and parameterized code duplicates, copy-pasted boilerplate, and refactoring candidates across projects.

---

## Features

- **LLM-Callable Tool (`detect_duplicates`)**: Enables agents to autonomously inspect files and detect duplicate code blocks before refactoring.
- **Slash Command (`/duplicates`)**: Interactively scan your project and view formatted duplicate reports.
- **Fast Block Hashing**: Uses sliding-window normalized line hashing and maximal sequence extension for rapid scanning.
- **Type-1 & Type-2 Clones**: Supports exact duplicates and identifier/literal-normalized clone detection.
- **Companion Skill & Commands**: Shipped with automatic skill and slash command discovery.

---

## Installation & Setup

### 1. Local Development (Link)

Link the plugin directly into your local `omp` plugins environment:

```bash
cd omp-plugin-duplicate-detector
omp plugin link .
```

### 2. Config File

Add the plugin path to your global `~/.omp/agent/config.yml` or project `.omp/config.yml`:

```yaml
extensions:
  - /path/to/omp-plugin-duplicate-detector
```

### 3. CLI Argument

Load on demand for a single session:

```bash
omp --extension /path/to/omp-plugin-duplicate-detector
# or short form:
omp -e /path/to/omp-plugin-duplicate-detector
```

---

## Usage

### Slash Command

Run directly in interactive sessions:

```text
/duplicates
/duplicates src/
/duplicates --min-lines=8 --normalize
/duplicates --min-tokens=40 --path=packages/core
```

### Tool Invocation by Agents

When installed, `omp` coding agents have access to the `detect_duplicates` tool:

```json
{
  "path": "src/services",
  "minLines": 6,
  "minTokens": 30,
  "normalizeIdentifiers": true
}
```

---

## Settings Schema

Configurable via `.omp/settings.json` or `config.yml`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `minLines` | `number` | `6` | Minimum consecutive lines to trigger a clone report |
| `minTokens` | `number` | `30` | Minimum token count threshold for a clone block |
| `ignorePatterns` | `string` | `"node_modules/**,dist/**,..."` | Comma-separated glob patterns to ignore |
| `maxIndexedFiles` | `number` | `10000` | Maximum number of source code files to index during baseline initialization |

---

## Development

```bash
# Typecheck
bun run check

# Run tests
bun test
```

---

## License

MIT
