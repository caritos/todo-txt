# JSON Output for `list` Command

**Date:** 2026-05-10
**Status:** Approved

## Problem

An external project needs machine-readable access to todo-txt tasks. It requires two query forms:
- Completed tasks filtered by completion date range
- Pending tasks filtered by due: date range

## Approach

Extend the existing `list` command (Option C: flag parsing inside `listCommand`). All new flags are parsed within `list.ts`; `index.ts` and other layers remain unchanged.

## New Flags

| Flag | Type | Meaning |
|---|---|---|
| `--json` | boolean | Output a JSON array instead of formatted text; suppresses the summary line |
| `--done` | boolean | Operate on completed tasks instead of open tasks |
| `--pending` | boolean | Explicit open-tasks mode (default behaviour; useful for script clarity) |
| `--from <date>` | `YYYY-MM-DD` | Keep completed tasks where `completionDate >= from` |
| `--to <date>` | `YYYY-MM-DD` | Keep completed tasks where `completionDate <= to` |
| `--due-from <date>` | `YYYY-MM-DD` | Keep pending tasks where `extensions.due >= due-from` |
| `--due-to <date>` | `YYYY-MM-DD` | Keep pending tasks where `extensions.due <= due-to` |

## Usage Examples

```bash
# All open tasks as JSON
todo list --json

# All completed tasks as JSON (no date filter)
todo list --json --done

# Completed tasks whose completion date falls within a range
todo list --json --done --from 2026-05-04 --to 2026-05-10

# Pending tasks whose due: date falls within a range
todo list --json --pending --due-from 2026-05-11 --due-to 2026-05-17

# JSON with existing filters still work
todo list --json +backend @work
```

## JSON Output Shape

Each element of the output array:

```json
{
  "line": 3,
  "done": false,
  "completionDate": null,
  "creationDate": "2026-05-01",
  "priority": "A",
  "text": "Fix login bug due:2026-05-15 +backend @work",
  "description": "Fix login bug +backend @work",
  "projects": ["+backend"],
  "contexts": ["@work"],
  "extensions": { "due": "2026-05-15" }
}
```

**Field notes:**
- `raw` is omitted — it is fully reconstructable and is an implementation detail
- Optional fields (`completionDate`, `creationDate`, `priority`) are always present, serialized as `null` when absent — consistent shape for consumers
- `line` is included so consumers can pass it back to `todo done <line>` or `todo edit <line>`
- `text` is the verbatim task text including embedded extensions; `description` is the clean human-readable text (extensions stripped via `baseText()`)
- `projects` and `contexts` retain `+`/`@` prefixes, matching how the parser stores them

## Behaviour Rules

- `--done` and `--pending` are mutually exclusive; `--done` takes precedence if both are passed
- `--from`/`--to` only filter when `--done` is active; silently ignored in pending mode
- `--due-from`/`--due-to` only filter when in pending mode; silently ignored in `--done` mode
- Pending tasks with no `due:` extension are excluded when `--due-from` or `--due-to` is provided
- Without `--json`, all new flags are ignored — no change to existing human-readable output
- Errors go to stderr as plain text; exit code 1 on error (same as today)

## Implementation Scope

**`src/commands/list.ts`** — only file that changes:
1. Parse new flags from the args array before the existing filter logic
2. Add `toJsonTask(task: Task): JsonTask` pure helper — converts a `Task` to the JSON shape above
3. When `--json` is set: select the right task set (done vs pending), apply date filters, apply existing keyword/project/context filters, then `JSON.stringify` to stdout
4. When `--json` is not set: existing code path is completely unchanged

**No changes to:** `index.ts`, `parser.ts`, `store.ts`, `output.ts`

## Testing

New test cases in `tests/list.test.ts` (or a new `tests/list-json.test.ts`):
- `--json` standalone returns all open tasks
- `--json --done --from/--to` returns only completed tasks in range
- `--json --pending --due-from/--due-to` returns only pending tasks with due: in range
- `--json` with `+project` / `@context` / keyword filters still applies them
- Optional fields serialise as `null` when absent
- Without `--json`, no behavioural change
