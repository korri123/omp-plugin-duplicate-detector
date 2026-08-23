---
name: detect-duplicates
description: Detect code duplicates, copy-pasted logic, and clone blocks across the codebase before or during refactoring.
---

# Detect Duplicates Skill

Use this skill when auditing codebase health, identifying refactoring candidates, or finding duplicated blocks of logic across multiple files.

## When to Run

- Before large refactoring tasks to identify shared abstraction opportunities.
- When cleaning up repetitive boilerplate or duplicated utility functions.
- When verifying that a new implementation doesn't duplicate existing patterns in sibling packages.

## Available Tools & Commands

1. **Tool**: `detect_duplicates`
   - Parameters:
     - `path`: Optional relative or absolute directory path to scan.
     - `minLines`: Minimum consecutive line threshold (default `6`).
     - `minTokens`: Minimum token count (default `30`).
     - `normalizeIdentifiers`: Set `true` to match code with different variable/literal names.

2. **Slash Command**: `/duplicates`
   - Run `/duplicates` in interactive mode to generate a summary report directly in your session.
   - Accepts arguments: `/duplicates --min-lines=8 --normalize src/`

## Workflow

1. Run `detect_duplicates` on the target directory.
2. Review the resulting clone clusters in the summary.
3. Group duplicated blocks by domain concept and extract shared helpers or components.
4. Re-run `detect_duplicates` to verify elimination of the duplicate blocks.
