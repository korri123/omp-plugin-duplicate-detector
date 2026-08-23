---
description: Scan codebase for duplicate code blocks, copy-pasted logic, and clone clusters
---

Scan the repository or a specific subdirectory to detect duplicated blocks of code.

Usage:
  /duplicates [options] [path]

Options:
  --min-lines=<number>    Minimum consecutive matching lines (default: 6)
  --min-tokens=<number>   Minimum token count (default: 30)
  --normalize             Normalize identifiers and literals (Type-2 clones)
  --path=<path>           Target path to scan
