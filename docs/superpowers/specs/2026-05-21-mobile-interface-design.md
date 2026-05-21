# Mobile Interface Design

**Date:** 2026-05-21
**Status:** Approved

## Overview

Add an iOS mobile app to todo-txt while preserving the terminal CLI, sharing as much business logic as possible. iOS is the priority interface. The repo is restructured into named interface directories (`console/`, `mobile/`, `web/`) plus a `shared/` layer containing all platform-agnostic logic.

---

## Repo Structure

```
todo-txt/
├── shared/                   ← platform-agnostic business logic
│   ├── parser.ts             ← Task type, parseLine(), serializeTask() (moved from src/)
│   ├── recurrence.ts         ← recurrence helpers (moved from src/)
│   ├── commands/
│   │   ├── list.ts           ← matchesFilters(), sort logic
│   │   ├── focus.ts          ← isInFocusWindow(), focusSortKey(), overdueOccurrenceDate()
│   │   ├── done.ts           ← applyDone()
│   │   ├── add.ts            ← applyAdd()
│   │   ├── edit.ts           ← applyEdit()
│   │   ├── rm.ts             ← applyRm()
│   │   ├── pri.ts            ← applyPri()
│   │   ├── skip.ts           ← applySkip()
│   │   ├── search.ts         ← applySearch()
│   │   └── report.ts         ← applyReport()
│   └── tests/                ← shared logic tests (bun test)
├── console/                  ← current src/ renamed here
│   ├── index.ts              ← CLI entry point (unchanged)
│   ├── store.ts              ← Node.js fs I/O (unchanged)
│   ├── output.ts             ← ANSI colors, formatTask() (unchanged)
│   ├── commands/             ← thin wrappers: read → transform → write → print
│   └── tests/                ← CLI integration tests (current tests/ moved here)
├── mobile/                   ← Expo Router iOS app
│   ├── app/                  ← file-based screens
│   ├── src/
│   │   ├── store.ts          ← Expo FileSystem I/O (mirrors console/store.ts interface)
│   │   └── components/       ← React Native UI components
│   ├── tests/
│   └── package.json
├── web/                      ← marketing + support site
│   └── tests/
└── docs/
```

---

## Shared Layer

### Pure Transform Pattern

Every command becomes a pure function: `Task[]` in, result out. No I/O, no console output, no `process.exit`.

```ts
// Example signatures
applyDone(tasks: Task[], nStrs: string[]): { tasks: Task[], completed: Task[], copies: Task[] }
applyAdd(tasks: Task[], text: string, creationDate: string): { tasks: Task[], added: Task }
applyRm(tasks: Task[], nStrs: string[]): { tasks: Task[], removed: string[], missing: number[] }
applyEdit(tasks: Task[], nStr: string, text: string): { tasks: Task[], updated: Task }
applyPri(tasks: Task[], nStr: string, priority: string): { tasks: Task[], updated: Task }
applySkip(tasks: Task[], nStr: string): { tasks: Task[], skipped: Task }
applyReport(tasks: Task[]): { open: number, done: number, overdue: number, dueSoon: number }
```

**Error handling:** transforms throw `Error` with a plain message (e.g. `"no task #5"`). The CLI catches and calls `process.exit(1)`. Mobile catches and shows an inline error or alert. `process.exit` never appears in shared code.

### What Goes Where

| Shared | Console-only | Mobile-only |
|--------|-------------|-------------|
| parser.ts, recurrence.ts | store.ts (Node.js fs) | store.ts (Expo FileSystem) |
| commands/list, focus, done, add, edit, rm, pri, skip, search, report | output.ts (ANSI formatting) | app/ screens, components/ |
| | commands/import, reminders, event (ICS/osascript — desktop-only) | |

### Console Thin Wrappers

CLI command files shrink to orchestrators:

```ts
// console/commands/done.ts
export function doneCommand(filePath: string, nStrs: string[]): void {
  const tasks = readTasks(filePath);
  const { tasks: updated, completed, copies } = applyDone(tasks, nStrs);
  writeTasks(filePath, updated);
  for (const t of completed) console.log(`Done: ${t.raw}`);
}
```

All existing CLI behavior and tests are preserved — business logic just moves one level up.

---

## Mobile App

### Tech Stack

Matches the fressh mobile app exactly:
- **Expo Router** — file-based routing
- **React Native** — iOS UI
- **Expo FileSystem** — file I/O in place of Node.js `fs`
- **TypeScript** throughout

### Navigation

Bottom tab bar with four tabs:

```
[ Focus ]  [ List ]  [ Search ]  [ Report ]
```

Settings accessible via a gear icon in the navigation bar header.

### Screen Map

```
mobile/app/
├── _layout.tsx                  ← root layout, font loading, store init
├── (tabs)/
│   ├── _layout.tsx              ← tab bar
│   ├── index.tsx                ← Focus tab (default — next 14 days)
│   ├── list.tsx                 ← List / ListAll (toggle)
│   ├── search.tsx               ← Search
│   └── report.tsx               ← Report (stats summary)
├── task/
│   └── [line].tsx               ← Task detail sheet: edit, pri, skip, rm
└── settings.tsx                 ← file location + iCloud toggle
```

### Focus Screen Layout (Fantastical-inspired, Braun/Bauhaus aesthetic)

- **Header**: large `May 2026` — month in off-white, year in orange (`#E8461A`)
- **Week strip**: horizontal scrollable row of 7 days; today's date in a filled orange circle; dots below dates indicate tasks that day
- **Day-grouped sections**: `TODAY`, `TOMORROW`, `Thu May 23`, etc. — mirrors `focus` sort order
- **Task rows**: orange left-edge bar for today/overdue items, gray for future; title in off-white; time right-aligned if present; monospace font for task text
- **Swipe left**: reveals **Done** and **Delete** fast-path actions
- **Tap**: opens `task/[line].tsx` detail sheet

### Task Detail Sheet

Bottom sheet opened by tapping a task row. Actions:
- **Done** — marks complete (calls `applyDone`)
- **Edit** — inline text field replacing task text (calls `applyEdit`)
- **Priority** — A–Z geometric picker (calls `applyPri`)
- **Skip** — visible only for recurring tasks (calls `applySkip`)
- **Delete** — with confirmation (calls `applyRm`)

### Add Task

`+` FAB button (orange, bottom-right) on Focus and List screens. Opens a modal with a plain text input. Submits via `applyAdd`.

### Components

```
mobile/src/components/
├── TaskRow.tsx          ← shared list item (priority indicator, title, time, tags)
├── FocusRow.tsx         ← focus variant with orange/gray left-edge bar
├── WeekStrip.tsx        ← scrollable 7-day header strip
├── AddTaskModal.tsx     ← text input sheet
├── PriorityPicker.tsx   ← geometric A–Z letter picker
└── NavBar.tsx           ← shared header with gear icon
```

---

## Data & Storage

Mirrors the fressh pattern:

- **Default**: `todo.txt` stored in the app's document directory via Expo FileSystem — offline, zero setup
- **iCloud option**: user toggles in Settings to switch to the iCloud container path; iOS syncs automatically with other devices and with the CLI on Mac when pointed at the same file via `--file` or `TODO_FILE`
- **Config persistence**: `todo-config.json` in the app document directory stores the active file path (same pattern as fressh's `fressh-config.json`)
- **`mobile/src/store.ts`**: same interface as `console/store.ts` — `readTasks()` and `writeTasks()` — implemented with `expo-file-system`

---

## Visual Design

**Braun/Bauhaus — function is the aesthetic.**

| Token | Value |
|-------|-------|
| Background | `#1A1A1A` |
| Primary text | `#F0F0F0` |
| Secondary text | `#888888` |
| Accent (orange) | `#E8461A` |
| Hairline separator | `#333333` |
| UI chrome font | SF Pro / Helvetica Neue, tight-tracked |
| Task text font | JetBrains Mono (carries terminal DNA) |

Rules:
- One accent color only — no priority rainbow; urgent/today items get orange, everything else is gray
- No gradients, no drop shadows, no rounded pill badges
- No decorative elements — every visual element must serve a function
- Week strip circles: filled orange for today, empty with hairline border for other days

---

## Testing

| Layer | Runner | Location |
|-------|--------|----------|
| `shared/` transforms | `bun test` | `shared/tests/` |
| `console/` CLI wrappers | `bun test` | `console/tests/` (current `tests/` moved here) |
| `mobile/` components | Expo / Jest | `mobile/tests/` |

Shared logic is tested once and those tests cover both platforms. Console tests shrink to thin integration coverage since business logic has moved to shared.

---

## Out of Scope

- `import`, `reminders`, `event` commands — CLI-only (ICS/osascript), not on mobile
- Android — iOS only for now
- Web task interface — `web/` is marketing and support pages only
