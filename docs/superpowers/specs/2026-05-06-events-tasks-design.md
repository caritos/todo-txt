# Events vs Tasks Design

**Issue:** [#3](https://github.com/caritos/todo-txt/issues/3)
**Date:** 2026-05-06

## Problem

The CLI has no way to distinguish between events (occurrences that happen) and tasks (things to complete). Users need to differentiate the two, similar to how Apple Calendar handles events and Apple Reminders handles tasks.

## Solution

Add a `todo event <text>` command that writes a todo.txt line with `type:event` automatically appended. Everything else — listing, filtering, done, rm — works unchanged.

## Behavior

```
$ todo event "Team standup"
Added: 2026-05-06 Team standup type:event
```

The line written to `todo.txt`:
```
2026-05-06 Team standup type:event
```

Filtering events (free via existing keyword match):
```
$ todo list type:event
```

## Files

| File | Change |
|------|--------|
| `src/commands/event.ts` | New file — mirrors `add.ts`, appends `type:event` to text |
| `src/index.ts` | Add `case 'event'` routing |
| `src/commands/help.ts` | Document the new command |

## Out of Scope

- Visual distinction in list output (events render identically to tasks)
- Dedicated `todo events` listing command (use `todo list type:event`)
- Preventing `done`/`rm`/`pri` from acting on events
