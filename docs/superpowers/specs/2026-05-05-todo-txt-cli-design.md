# todo.txt CLI — Design Spec

**Date:** 2026-05-05  
**Stack:** Bun / TypeScript  
**Spec reference:** https://github.com/todotxt/todo.txt/blob/master/README.md

---

## Overview

A strict todo.txt-compliant CLI task manager. One file, one format, no cloud dependencies. Designed to be used per-project (the `todo.txt` lives in the current working directory), with the long-term goal of eventually supporting mobile/web access by keeping the core parser completely decoupled from the CLI layer.

---

## Architecture

Three layers with no coupling between them:

```
todo (CLI entry point — src/index.ts)
├── src/parser/     pure functions: parseLine() and serializeTask()
├── src/store/      read/write todo.txt; atomic writes via tmp+rename
└── src/commands/   one file per command; composes parser + store + output
```

### File resolution

The app resolves the todo.txt file in this order:
1. `--file <path>` flag (any command)
2. `TODO_FILE` environment variable
3. `./todo.txt` in the current working directory

If `./todo.txt` does not exist, `todo add` creates it. All other commands print a helpful error if the file is missing.

---

## Data Model

```typescript
type Task = {
  line: number;                        // 1-based line number (used as task ID)
  raw: string;                         // original line text (preserved exactly)
  done: boolean;                       // true if line starts with "x "
  completionDate?: string;             // YYYY-MM-DD — set when done
  priority?: string;                   // "A"–"Z"
  creationDate?: string;               // YYYY-MM-DD
  text: string;                        // full description (projects/contexts/extensions left inline)
  projects: string[];                  // e.g. ["+backend", "+docs"]
  contexts: string[];                  // e.g. ["@work", "@personal"]
  extensions: Record<string, string>;  // e.g. { due: "2026-05-10" }
}
```

### Parser rules (per spec)

`parseLine(raw: string, lineNum: number): Task`

Tokens are read left to right:

1. If line starts with `x ` → `done = true`, read optional completion date (YYYY-MM-DD)
2. If next token matches `(A)`–`(Z)` → `priority`
3. If next token matches YYYY-MM-DD → `creationDate`
4. Remainder is `text`; regex extracts `projects` (`+word`), `contexts` (`@word`), and `extensions` (`key:value`) — all left in `text` as-is

`serializeTask(task: Task): string`

Reconstructs the line in spec order: `[x] [completionDate] [priority] [creationDate] text`

Unknown or malformed lines are preserved as-is (stored in `raw`), displayed with a `?` prefix.

---

## Commands

| Command | Description |
|---|---|
| `todo help` | Print all commands with usage examples. Also `todo --help`, `todo -h`, `todo <cmd> --help` |
| `todo add <text>` | Append a new task; auto-stamp today as creation date |
| `todo list [filters]` | List open tasks only. Filters are space-separated: `+project`, `@context`, `(A)` for priority, or any keyword for free-text. Multiple filters are ANDed. |
| `todo listall [filters]` | List all tasks including completed. Same filter syntax as `list`. |
| `todo done <n>` | Mark task #n complete — prepend `x <today> ` |
| `todo rm <n>` | Permanently delete task #n from the file |
| `todo pri <n> <A-Z>` | Set or replace priority on task #n |
| `todo depri <n>` | Remove priority from task #n |
| `todo search <term>` | Full-text search across all tasks (open + completed) |
| `todo report` | Stats: total/open/done counts, breakdown by project and context, completed today/this week |

**Notes:**
- Task numbers (`<n>`) are 1-based line numbers, same convention as reference `todo.sh`
- `todo add` accepts full spec inline: `todo add "(A) Fix bug +backend @work due:2026-05-10"`
- Completed tasks stay in `todo.txt` (no separate `done.txt`)

---

## Output Format

Color scheme:

| Element | Color |
|---|---|
| Priority (A) | Red |
| Priority (B) | Blue |
| Priority (C) | Orange |
| Projects (`+x`) | Green |
| Contexts (`@x`) | Purple |
| Due dates (upcoming) | Orange |
| Overdue badge | Red background, red text |
| Completed tasks | Dimmed + strikethrough |
| Line numbers | Dimmed |

### `todo list` example

```
1  (A) 2026-05-01 Fix login bug +backend @work [due:2026-05-03 OVERDUE]
2  (B) 2026-05-04 Write release notes +docs @work
3  (C) 2026-05-04 Review pull requests +backend @work due:2026-05-07
4  Buy groceries @personal
5  Call dentist @personal due:2026-05-10

5 open tasks · 1 overdue · 1 due within 3 days
```

### `todo listall` example

Same as above, with completed tasks appended (dimmed, struck through):

```
6  x 2026-05-04 2026-05-01 Deploy staging server +backend @work
7  x 2026-05-03 2026-05-02 Update dependencies +backend

7 total · 5 open · 2 completed
```

### `todo report` example

```
Tasks
  Total      7
  Open       5
  Done       2
  Overdue    1

By Project
  +backend   4 tasks (2 open, 2 done)
  +docs      1 task  (1 open)

By Context
  @work      3 tasks
  @personal  2 tasks

Completed
  Today      1
  This week  2
```

---

## Error Handling

- **File not found** → `No todo.txt found in current directory. Run 'todo add' to create one.`
- **Invalid task number** → `Error: no task #<n>`
- **Malformed lines** → preserved as-is in file; displayed with `?` prefix in list output
- **Atomic writes** → always write to `.todo.txt.tmp` then rename; crash-safe

---

## Testing

Runner: `bun test`

- **Parser unit tests** — one test per spec rule; covers priority, dates, completion, `key:value`, edge cases (empty lines, malformed input). Pure functions, no I/O.
- **Store integration tests** — read/write round-trips on a temp file; verify atomic write and parse → serialize → parse idempotency.
- **Command smoke tests** — each command run against a fixture `todo.txt`; assert stdout matches expected output.

---

## Future: Recurring Tasks

Not in scope for v1. The `extensions` field on `Task` already captures `rec:` values (e.g. `rec:+1d`, `rec:1w`). A future `todo recur` command will handle rescheduling completed recurring tasks with no changes to the parser or data model.

---

## Out of Scope (v1)

- Separate `done.txt` — completed tasks stay in `todo.txt`
- Cloud sync — user manages file sync (Dropbox, iCloud, Git, etc.)
- Interactive TUI mode
- Recurring tasks (`rec:` extension)
- Mobile / web frontend (future milestone)
