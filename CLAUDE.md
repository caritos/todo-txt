# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Shared layer tests
bun test

# Run a single test file
bun test shared/tests/parser.test.ts

# Run the CLI directly
bun run ./console/index.ts help

# Mobile unit tests (Jest)
cd mobile && npm test

# Mobile: build and run on simulator / USB device / TestFlight
mobile/scripts/sim.sh

# Mobile: build and submit to App Store
mobile/scripts/ship.sh
```

## Repo Structure

Three strictly decoupled layers — each layer only imports from layers below it:

```
shared/                       ← platform-agnostic business logic
├── parser.ts                 ← Task type, parseLine(), serializeTask()
├── recurrence.ts             ← recurrence helpers
├── utils.ts                  ← shared date utilities
├── commands/                 ← pure transforms: Task[] in, result out, no I/O
│   ├── list.ts               ← matchesFilters(), sortByPriority()
│   ├── focus.ts              ← applyFocus(), isInFocusWindow(), overdueOccurrenceDate()
│   ├── done.ts               ← applyDone()
│   ├── add.ts                ← applyAdd(), buildAddRaw()
│   ├── edit.ts               ← applyEdit()
│   ├── rm.ts                 ← applyRm()
│   ├── pri.ts                ← applyPri(), applyDepri()
│   ├── skip.ts               ← applySkip()
│   ├── search.ts             ← applySearch()
│   └── report.ts             ← applyReport()
└── tests/

console/                      ← CLI (Node.js / Bun)
├── index.ts                  ← CLI entry point: arg parsing, --file flag, command routing
├── store.ts                  ← Node.js fs I/O: readTasks(), writeTasks(), resolveFile()
├── output.ts                 ← ANSI colors, formatTask(), formatSummary()
├── commands/                 ← thin wrappers: read → shared transform → write → print
└── tests/

mobile/                       ← Expo Router iOS app
├── app/                      ← file-based screens (Expo Router)
│   ├── _layout.tsx           ← root Stack layout, fonts, TaskProvider, BottomActionBar
│   ├── focus.tsx             ← Focus screen (default — next 14 days, day-grouped)
│   ├── list.tsx              ← List screen (stats cards + flat task list)
│   ├── search.tsx            ← Search screen
│   ├── report.tsx            ← Report screen (summary stats)
│   ├── settings.tsx          ← File path + iCloud toggle
│   ├── timeline.tsx          ← Week view (7-column timed grid); tap date → Day view
│   ├── month.tsx             ← Month view (full-screen flex grid); tap cell → Day view
│   ├── year.tsx              ← Year view (dot-density heatmap by month)
│   ├── day/[date].tsx        ← Day view (timed + all-day lanes for a single date)
│   ├── done.tsx              ← Tasks view: completed (above) + add-task anchor + incomplete (below)
│   └── task/[line].tsx       ← Task detail formSheet: Done, Edit, Priority, Skip, Delete; shows DUE date
├── src/
│   ├── store.ts              ← Expo FileSystem I/O (mirrors console/store.ts interface)
│   ├── theme.ts              ← Colors, Fonts, Spacing design tokens
│   ├── utils.ts              ← today(), formatDateLabel()
│   ├── nlParser.ts           ← natural language → todo.txt raw string (chrono-node)
│   ├── context/TaskContext.tsx  ← global task state (tasks, filePath, reload, save)
│   └── components/           ← TaskRow, EventPill, CalendarHeader, WeekStrip, MonthGrid,
│                               StatsCard, PriorityPicker, RecurrencePicker,
│                               AddTaskModal, BottomActionBar, ViewSwitcher
└── tests/
```

## Shared Layer

**Pure transform pattern** — every command is a pure function: `Task[]` in, result out. No I/O, no console output, no `process.exit`.

**Error handling** — transforms throw `Error` with a plain message. The CLI catches and calls `process.exit(1)`. Mobile catches and shows an inline error or alert. `process.exit` never appears in shared code.

**`@shared/*` alias** — mobile imports shared code via `@shared/parser`, `@shared/commands/focus`, etc., resolved by Metro (watchFolders) and babel-plugin-module-resolver.

## Console Layer

**File resolution order** (in `resolveFile`): `--file` flag → `TODO_FILE` env → `./todo.txt` in cwd.

**Mutation pattern**: shared transforms return `{ tasks: Task[] }`. Console commands write `tasks` back via `writeTasks`, which writes each `task.raw` verbatim. `serializeTask` is called inside shared transforms before returning.

## Mobile Layer

**Tech stack**: Expo SDK 52, Expo Router v3, React Native (iOS only), expo-file-system, react-native-reanimated, react-native-gesture-handler, @expo-google-fonts/jetbrains-mono, chrono-node.

**Design tokens**: background `#1A1A1A`, accent `#E8461A`, text `#F0F0F0`, secondary `#888888`, separator `#333333`. Task text in JetBrains Mono. One accent color only — Braun/Bauhaus.

**iCloud sync**: user points Settings file path to iCloud Drive container; iOS syncs automatically with other devices and with the CLI on Mac. On first launch (no saved config), the app defaults to the iCloud Drive path computed by `ICLOUD_PATH` in `mobile/src/store.ts` (exported and re-used by `settings.tsx`). `writeTasks()` calls `makeDirectoryAsync({ intermediates: true })` before writing the `.tmp` file, so the parent directory is always created on demand — required for iCloud paths that may not exist yet.

**Day/week view filtering**: Mobile day (`app/day/[date].tsx`) and week (`app/timeline.tsx`) views use `applyFocusForWindow(tasks, todayStr, windowEnd)` + `focusItemOccurrence(item)` from `@shared/commands/focus` — the same logic as the console's `focus` command. Never duplicate this filtering in the mobile layer. The window must be at least `addDays(todayStr, 14)` so overdue recurring tasks (whose `nextWeeklyDate` lands beyond today but whose `focusSortKey` resolves to today via `overdueOccurrenceDate`) pass `isInFocusWindow`.

**Month view** (`app/month.tsx`): full-screen flex grid — no ScrollView. Cells are grouped into rows of 7, each row has `flex: 1` so all rows distribute vertical space equally. Uses `useSafeAreaInsets` to push the `‹ MONTH YEAR ›` header below the Dynamic Island. Tasks mapped by `start:` date (not next occurrence — recurring tasks show on their `start:` date, not the next scheduled occurrence).

**Calendar navigation pattern**: tapping a day cell in Month view or a date in the Week strip navigates to `/day/[date]` via `router.push`. The ViewSwitcher (bottom-left ≡) and BottomActionBar label together support: Day, Week, Month, Year, Tasks, Search, Settings.

**Temporal navigation consistency**: all calendar views (Day, Week, Month, Year, Calendar) have both `‹`/`›` arrow buttons in the header and horizontal swipe gestures. Swipe uses `activeOffsetX([-20, 20]).failOffsetY([-10, 10])` so vertical scrolling still works in views that scroll (Week timeline, Year month list). Year view scopes the swipe gesture to the header bar only to avoid conflicting with the month-list ScrollView body.

**Week view pill layout** (`app/timeline.tsx`): timed pills and all-day chips have no `numberOfLines` cap — text wraps within the column width. Concurrent items at the same time slot are laid out side by side using the same slot-counting algorithm as the day view: `slotCount` maps each `time` string to a total count; `slotCursor` assigns each item a `col` index; pill `left` and `width` are computed as `2 + col * (pillWidth + 1)` and `Math.floor((innerWidth - (total-1)) / total)` respectively.

**Month view today cell** (`app/month.tsx`): the accent-color border (`cellToday`) uses `zIndex: 1` on both the cell and the row containing today so all four border sides render on top of neighbouring cells' backgrounds and borders.

**Search screen** (`app/search.tsx`): uses `useSafeAreaInsets` with `paddingTop: insets.top` on the input row so the status bar / Dynamic Island does not overlap the text field.

**Tasks view** (`app/done.tsx`): single `ScrollView` with three zones — (1) completed tasks from the last 30 days grouped by completion date, **oldest-first** so the most-recent completions sit closest to the add-task anchor, with strikethrough styling; (2) an inline `+ add task…` `TextInput` anchor that the view scrolls to on mount via `onLayout` + `scrollTo`; (3) incomplete tasks sorted by `start:` date ascending, no `start:` sorts to bottom. Both zones exclude events (`task.extensions['type']` set). Incomplete task start-date labels show `today`/`yesterday` for those days, the actual date (`Jun 6`, with year when different) for overdue tasks, and weekday (`Mon`) for future tasks. Recurring tasks are hidden from the incomplete list when: `frequency:` + `last-done === todayStr` (completed today, waiting for next occurrence), `frequency:` + `start > todayStr` (next occurrence is in the future after being advanced by `applyDone`), or `frequency:` + `exdate:` + `taskOccurrence(task, todayStr).date > todayStr` while `start:` ≤ today (skipped). Add task uses `buildAddRaw` + `parseLine` + `save`.

**Task detail** (`app/task/[line].tsx`): shows a **DUE** row when `task.extensions['start']` is set, using `formatDateLabel(start.slice(0, 10))`. The date is tinted accent-red when overdue (`start < todayStr` and task not done). Delete alert message differs for recurring tasks: non-recurring says "This cannot be undone"; recurring says "This deletes all future occurrences. Use Skip to skip just this one." — because `applyRm` removes the single todo.txt line that defines all occurrences.

## Key Invariants

- `verbatimModuleSyntax: true` — use `import type` for all type-only imports (all layers).
- Completed tasks have no priority (stripped by `serializeTask` when `task.done = true`).
- Extension regex `([^/\s]\S*)` intentionally excludes URL schemes — values starting with `/` are not captured as extensions (prevents `http://` from matching as `http: //`).
- `matchesFilters()` in `shared/commands/list.ts` is exported and reused by console `listall`, `search`, and mobile.
- `today()` returns the **local** calendar date (not UTC) — both `console/output.ts` and `mobile/src/utils.ts`.
- `nextWeeklyDate` in `shared/commands/focus.ts` accepts an optional `frequencyDay` param (e.g. `"W,F"`). When present, it finds the next calendar date that falls on one of those weekdays rather than advancing by 7-day intervals.
- `rm` accepts multiple task numbers. Re-indexes remaining tasks after each removal so subsequent numbers in the same batch stay correct.
- `done` accepts either a task number or a text string. When passed a string (`t done "buy milk"`), it creates the task and immediately marks it complete, writing `x <today> <today> <text>` to the file.
- `done` advances `start` to the next scheduled occurrence for `frequency:weekly`, `frequency:monthly`, and `frequency:yearly` tasks. Daily and other frequencies are left unchanged.
- `skip` on a non-recurring task (no `frequency:` extension) removes it from the list instead of erroring. `applySkip` returns a `SkipResult` union: `{ removed: true }` or `{ removed: false; skippedDate; nextDate }`. For overdue weekly/monthly tasks, `applySkip` uses `overdueOccurrenceDate()` to add the actual missed occurrence date to `exdate` — NOT `focusSortKey` (which returns today for overdue tasks and would fail to advance past the missed occurrence).
- `add` and `event` inject `start:today` when no `start:` is provided. This makes new tasks appear in focus immediately.
- `focus` handles `frequency:yearly` via `nextYearlyDate` in `isInFocusWindow` and `focusSortKey` — without this, completed yearly tasks stayed visible in focus until the next occurrence's date passed.
- `focus` shows **overdue** tasks: regular tasks whose `start:` date is in the past, and recurring tasks whose most-recent scheduled occurrence hasn't been marked done. `overdueOccurrenceDate()` detects missed occurrences; their sort key is set to today so they sort to the top.
- **Task line numbers** are 1-based positions in the non-empty task list (blank lines stripped by `readTasks`). They renumber on every read — `task.line` is display position, not a stable ID.
- `WeekStrip` (mobile) starts from today and shows the next 7 days — not a fixed Sunday-to-Saturday week.
- `cleanTitle()` strips todo.txt extensions from task text for display. It is defined **inline** in each screen file — it is not exported from a shared module.
