# Apple Reminders Import — Design Spec

**Date:** 2026-05-06
**Issue:** #6 — import tasks from Apple Reminder

---

## Overview

A new `todo reminders [list-name]` command that queries the macOS Reminders app via `osascript` (JXA) and appends imported tasks to `todo.txt`. Supports importing all reminders (completed and incomplete), deduplicates across runs using a stable `reminders-id:` extension, and tags each task with its source list as a `+Project`.

---

## Command Interface

```
todo reminders [list-name]
```

- No argument: import from all lists
- With `list-name`: import only that list (error if not found)
- Respects `--file` flag and `TODO_FILE` env var via existing `resolveFile`

---

## Architecture

New file: `src/commands/reminders.ts`. Three internal functions plus the exported entry point:

1. **`buildJXA(listFilter?: string): string`** — returns a JXA script string scoped to one list or all lists; output is a JSON array of reminder records
2. **`fetchReminders(listFilter?: string): ReminderRecord[]`** — shells out via `execSync('osascript -l JavaScript -e <jxa>')`, parses the JSON, throws on non-zero exit or invalid JSON
3. **`mapReminder(r: ReminderRecord, todayStr: string): string`** — maps one record to a todo.txt line
4. **`remindersCommand(filePath: string, args: string[]): void`** — entry point: reads existing file, extracts known `reminders-id` values, fetches, deduplicates, appends

Wired into `src/index.ts` (new `reminders` case) and `src/commands/help.ts`.

---

## Field Mapping

| Reminders field | todo.txt output |
|---|---|
| `completed = true` | `x ` prefix |
| `completionDate` | completion date (YYYY-MM-DD) |
| `creationDate` | creation date (YYYY-MM-DD) |
| `priority` (1=high, 5=med, 9=low, 0=none) | `(A)`, `(B)`, `(C)`, omitted |
| `title` | task text (newlines → space, max 500 chars) |
| `list` | `+ListName` (spaces → underscores, non-word chars stripped) |
| `dueDate` | `due:YYYY-MM-DD` (omitted if absent) |
| `notes` | `note:` extension (sanitized, max 200 chars, omitted if empty) |
| `id` | `reminders-id:<sanitized-id>` |

### Example lines

Incomplete with due date:
```
2026-05-06 Fix quarterly report +Work due:2026-05-10 note:Check_with_finance reminders-id:25BA5C3A-F99D-40FC-A206-81E2BB3BBB21
```

Completed with priority:
```
x 2026-04-30 2026-04-01 (A) Submit expense report +Work reminders-id:9E3D1AB2-C3D4-5E6F-A7B8-9C0D1E2F3A4B
```

### Sanitization

- List name: `name.replace(/\s+/g, '_').replace(/[^\w]/g, '')` — alphanumeric + underscore only
- Notes: reuse `sanitizeExtValue` from import.ts pattern: replace whitespace with `_`, strip non-`[\w@._:,/-]`, truncate to 200
- Reminders ID: same `sanitizeExtValue` pass (the UUID format survives unchanged)

---

## Deduplication

On each run:
1. Read the existing todo.txt (via `readFileSync`; file may not exist yet — treat as empty)
2. Extract every `reminders-id:` value from all lines into a `Set<string>`
3. For each fetched reminder, skip if its sanitized ID is already in the set
4. Append only new lines

Output:
```
Imported 12 reminders (3 skipped as duplicates) → /path/to/todo.txt
```
If nothing new:
```
Nothing new to import (all 15 reminders already present in todo.txt)
```
If file did not exist yet, it is created on first import.

---

## Error Handling

| Condition | Behaviour |
|---|---|
| `osascript` exits non-zero | Print stderr + `todo: failed to read Reminders — check System Settings → Privacy & Security → Automation`, exit 1 |
| Output is not valid JSON | `todo: unexpected output from Reminders app`, exit 1 |
| Named list not found | `todo: no list named '<name>' found in Reminders`, exit 1 |
| No reminders in scope | `No reminders found`, exit 0 |
| All reminders already imported | `Nothing new to import (all N reminders already present in todo.txt)`, exit 0 |

---

## Testing

- Unit tests in `tests/reminders.test.ts`
- Mock `execSync` to return fixture JSON arrays covering:
  - Incomplete reminder with due date and notes
  - Completed reminder with priority and completion date
  - Reminder with no optional fields
  - Deduplication: existing `reminders-id` in file → skipped
  - Named list not found → error
  - Invalid JSON from osascript → error
- No integration test against the live Reminders app (requires macOS + permissions)
