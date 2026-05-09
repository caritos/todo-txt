# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun test                        # run all tests
bun test tests/parser.test.ts  # run a single test file
bun run ./src/index.ts help     # run the CLI directly
```

## Architecture

Three strictly decoupled layers — each layer only imports from layers below it:

```
src/index.ts          ← CLI entry point: arg parsing, --file flag, command routing
src/commands/*.ts     ← one file per command; composes parser + store + output
src/output.ts         ← pure formatting: ANSI colors, formatTask(), formatSummary()
src/store.ts          ← file I/O: readTasks(), writeTasks() (atomic via tmp+rename), resolveFile()
src/parser.ts         ← pure functions: parseLine(), serializeTask(), Task type
```

**File resolution order** (in `resolveFile`): `--file` flag → `TODO_FILE` env → `./todo.txt` in cwd.

**Task line numbers** are 1-based positions in the non-empty task list (blank lines stripped by `readTasks`). They renumber on every read, so `task.line` is display position, not a stable ID.

**Mutation pattern**: commands mutate `task` fields, then call `task.raw = serializeTask(task)` before passing to `writeTasks`. The store writes `task.raw` verbatim — it never calls `serializeTask` itself.

## Key invariants

- `verbatimModuleSyntax: true` — use `import type` for all type-only imports.
- Completed tasks have no priority (stripped by `serializeTask` when `task.done = true`).
- Extension regex `([^/\s]\S*)` intentionally excludes URL schemes — values starting with `/` are not captured as extensions (prevents `http://` from matching as `http: //`).
- `matchesFilters()` in `src/commands/list.ts` is exported and reused by `listall` and `search`.
- `today()` in `output.ts` returns the **local** calendar date (not UTC).
