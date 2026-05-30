---
title: Default start:today when adding a task with no explicit start
date: 2026-05-30
status: approved
---

## Problem

`t add "some task"` produces a raw line with no `start:` extension. Without a `start:` date the task never appears in the focus view, so newly-added tasks are invisible until the user remembers to add the extension manually.

## Solution

In `buildAddRaw` (shared layer), auto-append `start:${todayStr}` when the user's input contains no `start:` extension. Explicit `start:` values are preserved unchanged.

## Affected files

- `shared/commands/add.ts` — add default-start logic in `buildAddRaw`
- `shared/tests/commands/add.test.ts` — update existing baseline test; add two new cases

## Behavior

| Input | Before | After |
|-------|--------|-------|
| `download pnb mobile banking app` | `2026-05-30 download pnb mobile banking app` | `2026-05-30 download pnb mobile banking app start:2026-05-30` |
| `water plants start:2026-05-24` | `2026-05-23 water plants start:2026-05-24` | unchanged |
| `(A) urgent task` | `(A) 2026-05-23 urgent task` | `(A) 2026-05-23 urgent task start:2026-05-23` |

## Implementation

```typescript
// shared/commands/add.ts — inside buildAddRaw, after validateFrequencyThrows
const exts = extractFreqExts(text);
const body = 'start' in exts ? text : `${text} start:${todayStr}`;
// then use body instead of text for the rest of the function
```

Both CLI (`console/commands/add.ts`) and mobile (`AddTaskModal.tsx`) call `buildAddRaw`, so both are fixed by this single change.

## Tests

1. Update: `'prepends creation date'` → expected output now includes `start:2026-05-23`
2. New: `'does not override explicit start date'` — explicit `start:2026-05-24` is preserved
3. New: `'priority task gets start:today appended'` — `(A)` task gets `start:` after the body
