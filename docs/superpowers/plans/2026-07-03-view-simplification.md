# View Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Day, Week, and Month mobile views (plus already-dead code found while tracing their references), leaving Calendar, Year, Search, and Settings — with Year repurposed as a "jump to a date in Calendar" picker.

**Architecture:** Rename `TaskContext`'s `selectedDate`/`setSelectedDate` (currently only used by the views being deleted) to a one-shot `pendingDateJump`/`requestDateJump`/`clearDateJump`. Year sets it and pushes to `/calendar`; Calendar consumes it once on mount to set its initial mini-grid month/year and scroll target, then clears it so later plain visits default to today.

**Tech Stack:** Expo Router, React (hooks/context), TypeScript, Jest (mobile), Bun test (shared/console).

**Spec:** `docs/superpowers/specs/2026-07-03-view-simplification-design.md`

## Global Constraints

- Only Day (`app/day/[date].tsx`), Week (`app/timeline.tsx`), and Month (`app/month.tsx`) views are the "real" removal target — but also remove already-dead code found during spec research: `app/done.tsx`, `app/events.tsx`, `src/components/WeekStrip.tsx`, `src/components/MonthGrid.tsx`, `src/components/CalendarHeader.tsx` (none of these five are reachable from any navigation or import today).
- The Year→Calendar jump must be one-shot: after Calendar consumes `pendingDateJump` once, a later plain open of Calendar (bottom nav, app relaunch) always defaults to today.
- Do not touch Search (`app/search.tsx`) or Settings (`app/settings.tsx`) beyond what's incidentally required (nothing is required — they don't reference any removed file).
- Do not touch shared-layer occurrence logic (`generateTaskOccurrences`, `applyFocusForWindow`, etc.) — it's still used by Calendar and by the console/CLI layer.
- No new automated tests for the mobile screen/component changes — this codebase doesn't unit-test screen-level or hook-level UI logic (no existing tests for `calendar.tsx`, `year.tsx`, `ViewSwitcher.tsx`, `BottomActionBar.tsx`, or `TaskContext.tsx`). Verification is `tsc --noEmit` clean plus the existing mobile Jest suite and shared/console Bun suite staying green.

---

### Task 1: Rename TaskContext's date-jump field, delete Day/Week/Month, wire Year→Calendar

**Files:**
- Modify: `mobile/src/context/TaskContext.tsx` (full rewrite)
- Modify: `mobile/app/year.tsx:28,117`
- Modify: `mobile/app/calendar.tsx:53-65,184-189`
- Modify: `mobile/src/components/ViewSwitcher.tsx` (full rewrite)
- Modify: `mobile/src/components/BottomActionBar.tsx:9-13,22`
- Modify: `mobile/app/_layout.tsx:29-45` (remove `timeline` and `day/[date]` Stack.Screen entries only — `done`/`events` are removed in Task 2)
- Delete: `mobile/app/day/[date].tsx`
- Delete: `mobile/app/timeline.tsx`
- Delete: `mobile/app/month.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (this is the foundational task).
- Produces: `TaskContextValue.pendingDateJump: string | null`, `requestDateJump: (date: string) => void`, `clearDateJump: () => void` — Task 2 doesn't touch these, but any future code reading task context must use these names, not the old `selectedDate`/`setSelectedDate`.

This task must land as one unit: `TaskContext`'s old `selectedDate`/`setSelectedDate` field is currently read by `day/[date].tsx`, `timeline.tsx`, and `ViewSwitcher.tsx`. Renaming it while those three still exist and reference the old names would break `tsc`. Since `day/[date].tsx` and `timeline.tsx` are being deleted anyway, there's no point updating them to the new names first — delete them in this same task.

- [ ] **Step 1: Rewrite `TaskContext.tsx`**

Replace the entire contents of `mobile/src/context/TaskContext.tsx` with:

```tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Task } from '@shared/parser';
import { readTasks, writeTasks, resolveFile, resolveWeekStart, setWeekStart as storeSetWeekStart } from '../store';
import { today } from '../utils';

type TaskContextValue = {
  tasks: Task[];
  filePath: string;
  weekStart: 0 | 1;
  setWeekStart: (ws: 0 | 1) => Promise<void>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (updated: Task[]) => Promise<void>;
  pendingDateJump: string | null;
  requestDateJump: (date: string) => void;
  clearDateJump: () => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filePath, setFilePath] = useState('');
  const [weekStart, setWeekStartState] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDateJump, setPendingDateJump] = useState<string | null>(null);

  // Keep a ref so save() always sees the latest filePath even if the
  // callback closure hasn't been recreated yet (avoids stale-closure
  // race on fast interactions shortly after launch).
  const filePathRef = useRef('');

  const reload = useCallback(async () => {
    const [path, ws] = await Promise.all([resolveFile(), resolveWeekStart()]);
    filePathRef.current = path;
    setFilePath(path);
    setWeekStartState(ws);
    try {
      const loaded = await readTasks(path);
      setTasks(loaded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setWeekStart = useCallback(async (ws: 0 | 1) => {
    await storeSetWeekStart(ws);
    setWeekStartState(ws);
  }, []);

  const save = useCallback(
    async (updated: Task[]) => {
      const path = filePathRef.current || filePath;
      if (!path) throw new Error('File path not configured. Open Settings to set a location.');
      await writeTasks(path, updated);
      setTasks(updated);
    },
    [filePath]
  );

  const requestDateJump = useCallback((date: string) => setPendingDateJump(date), []);
  const clearDateJump = useCallback(() => setPendingDateJump(null), []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <TaskContext.Provider value={{ tasks, filePath, weekStart, setWeekStart, loading, error, reload, save, pendingDateJump, requestDateJump, clearDateJump }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be called inside <TaskProvider>');
  return ctx;
}
```

- [ ] **Step 2: Delete the three view files**

```bash
cd /Volumes/robin/src/todo-txt
rm mobile/app/day/[date].tsx
rm mobile/app/timeline.tsx
rm mobile/app/month.tsx
```

- [ ] **Step 3: Wire Year to jump into Calendar instead of Day**

In `mobile/app/year.tsx`, change line 28 from:
```tsx
  const { tasks } = useTasks();
```
to:
```tsx
  const { tasks, requestDateJump } = useTasks();
```

Then change line 117 from:
```tsx
                        onPress={() => router.push(`/day/${dateStr}` as any)}
```
to:
```tsx
                        onPress={() => { requestDateJump(dateStr); router.push('/calendar'); }}
```

- [ ] **Step 4: Make Calendar consume the jump request**

In `mobile/app/calendar.tsx`, change lines 53-65 from:
```tsx
  const { tasks, save, weekStart } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  const [calYear, setCalYear] = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const flatListRef = useRef<FlatList<FlatRow>>(null);
```
to:
```tsx
  const { tasks, save, weekStart, pendingDateJump, clearDateJump } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  // Captured once at mount — pendingDateJump gets cleared shortly after
  // (see the scroll effect below), but the delayed scrollToDate call still
  // needs a stable target to read.
  const jumpTargetRef = useRef(pendingDateJump);

  const [calYear, setCalYear] = useState(() =>
    jumpTargetRef.current ? parseInt(jumpTargetRef.current.slice(0, 4), 10) : todayYear
  );
  const [calMonth, setCalMonth] = useState(() =>
    jumpTargetRef.current ? parseInt(jumpTargetRef.current.slice(5, 7), 10) - 1 : todayMonth
  );
  const [selectedDate, setSelectedDate] = useState(() => jumpTargetRef.current ?? todayStr);

  const flatListRef = useRef<FlatList<FlatRow>>(null);
```

Then change lines 184-189 (the mount scroll effect) from:
```tsx
  useEffect(() => {
    if (flatData.length === 0 || hasScrolledToToday.current) return;
    hasScrolledToToday.current = true;
    const timer = setTimeout(() => scrollToDate(todayStr), 200);
    return () => clearTimeout(timer);
  }, [flatData]);
```
to:
```tsx
  useEffect(() => {
    if (flatData.length === 0 || hasScrolledToToday.current) return;
    hasScrolledToToday.current = true;
    const target = jumpTargetRef.current ?? todayStr;
    if (pendingDateJump) clearDateJump();
    const timer = setTimeout(() => scrollToDate(target), 200);
    return () => clearTimeout(timer);
  }, [flatData]);
```

- [ ] **Step 5: Simplify ViewSwitcher**

Replace the entire contents of `mobile/src/components/ViewSwitcher.tsx` with:

```tsx
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../theme';

type NavItem = { label: string; route: string } | { separator: true };

const VIEWS: NavItem[] = [
  { label: 'Calendar', route: '/calendar' },
  { separator: true },
  { label: 'Year', route: '/year' },
  { separator: true },
  { label: 'Settings', route: '/settings' },
];

type Props = { visible: boolean; onClose: () => void };

export function ViewSwitcher({ visible, onClose }: Props) {
  const router = useRouter();

  function navigate(route: string) {
    router.push(route as any);
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {VIEWS.map((v, i) => {
            if ('separator' in v) {
              return <View key={`sep-${i}`} style={styles.separator} />;
            }
            return (
              <TouchableOpacity key={v.route} style={styles.item} onPress={() => navigate(v.route)}>
                <Text style={styles.itemText}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 44,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  item: { paddingVertical: 16, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  itemText: { fontSize: 17, color: Colors.text },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.xs,
  },
});
```

- [ ] **Step 6: Fix BottomActionBar's route labels**

In `mobile/src/components/BottomActionBar.tsx`, change lines 9-13 from:
```tsx
const ROUTE_LABELS: Record<string, string> = {
  '/timeline': 'Week',
  '/month': 'Month',
  '/calendar': 'Calendar',
  '/settings': 'Settings',
};
```
to:
```tsx
const ROUTE_LABELS: Record<string, string> = {
  '/calendar': 'Calendar',
  '/year': 'Year',
  '/settings': 'Settings',
};
```

Then change line 22 from:
```tsx
  const label = pathname.startsWith('/day/') ? 'Day' : (ROUTE_LABELS[pathname] ?? 'Calendar');
```
to:
```tsx
  const label = ROUTE_LABELS[pathname] ?? 'Calendar';
```

- [ ] **Step 7: Drop the deleted routes from `_layout.tsx`**

In `mobile/app/_layout.tsx`, change lines 29-45 from:
```tsx
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="done" />
            <Stack.Screen name="year" />
            <Stack.Screen name="events" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="timeline" />
            <Stack.Screen name="day/[date]" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="task/[line]"
              options={{ presentation: 'formSheet', headerShown: false }}
            />
          </Stack>
```
to:
```tsx
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="done" />
            <Stack.Screen name="year" />
            <Stack.Screen name="events" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="task/[line]"
              options={{ presentation: 'formSheet', headerShown: false }}
            />
          </Stack>
```

(`done` and `events` entries stay for now — Task 2 removes those files and entries.)

- [ ] **Step 8: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean). This is the key check for this task — it confirms nothing still references the deleted files or the old `selectedDate`/`setSelectedDate` field.

- [ ] **Step 9: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 88 passed, 88 total` (unchanged — none of the existing tests touch these files).

- [ ] **Step 10: Run the shared+console suite**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, 0 fail (unaffected by mobile-only changes).

- [ ] **Step 11 (manual simulator verification) — SKIP if you have no simulator-driving tool.** If you do (a human, or an agent with simulator access), run `mobile/scripts/sim.sh`, then in the app: open Year, tap any date, confirm Calendar opens scrolled to and with that date highlighted in the mini-grid; then navigate away (e.g. to Settings) and back to Calendar via the bottom nav, and confirm it now opens at today (the one-shot jump was consumed, not repeated). If you don't have simulator access, note in your report that this step was not performed and why — this mirrors the same accepted gap from the undo-completion plan (`docs/superpowers/plans/2026-07-03-undo-completion.md` Task 3 Step 6).

- [ ] **Step 12: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/src/context/TaskContext.tsx mobile/app/year.tsx mobile/app/calendar.tsx \
  mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx \
  mobile/app/_layout.tsx
git rm "mobile/app/day/[date].tsx" mobile/app/timeline.tsx mobile/app/month.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): remove Day/Week/Month views, jump Year->Calendar directly

Calendar already has its own built-in mini month-grid, making standalone
Month redundant; Day's only other entry points were Week and Month, so
removing those orphaned Day too. TaskContext's selectedDate/setSelectedDate
(previously only used by these three views) is renamed to a one-shot
pendingDateJump/requestDateJump/clearDateJump: Year now requests a jump
and pushes to /calendar; Calendar consumes it once on mount to set its
initial mini-grid month and scroll target, then clears it so a later
plain visit to Calendar defaults back to today.
EOF
)"
```

---

### Task 2: Delete remaining dead code

**Files:**
- Delete: `mobile/app/done.tsx`
- Delete: `mobile/app/events.tsx`
- Delete: `mobile/src/components/WeekStrip.tsx`
- Delete: `mobile/src/components/MonthGrid.tsx`
- Delete: `mobile/src/components/CalendarHeader.tsx`
- Modify: `mobile/app/_layout.tsx` (remove the `done` and `events` Stack.Screen entries left in place by Task 1)

**Interfaces:**
- Consumes: nothing from Task 1 — these five files don't reference `pendingDateJump`/`requestDateJump`/`clearDateJump` or any file Task 1 touched (confirmed: neither `done.tsx` nor `events.tsx` reads `selectedDate`/`setSelectedDate` from `TaskContext`, and the three components aren't imported anywhere).
- Produces: nothing — no other task depends on these files existing or being gone.

- [ ] **Step 1: Delete the five dead files**

```bash
cd /Volumes/robin/src/todo-txt
rm mobile/app/done.tsx
rm mobile/app/events.tsx
rm mobile/src/components/WeekStrip.tsx
rm mobile/src/components/MonthGrid.tsx
rm mobile/src/components/CalendarHeader.tsx
```

- [ ] **Step 2: Remove their `_layout.tsx` Stack.Screen entries**

In `mobile/app/_layout.tsx`, change (this is the post-Task-1 state):
```tsx
            <Stack.Screen name="index" />
            <Stack.Screen name="done" />
            <Stack.Screen name="year" />
            <Stack.Screen name="events" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
```
to:
```tsx
            <Stack.Screen name="index" />
            <Stack.Screen name="year" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 88 passed, 88 total`.

- [ ] **Step 5: Run the shared+console suite**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git rm mobile/app/done.tsx mobile/app/events.tsx mobile/src/components/WeekStrip.tsx \
  mobile/src/components/MonthGrid.tsx mobile/src/components/CalendarHeader.tsx
git add mobile/app/_layout.tsx
git commit -m "$(cat <<'EOF'
chore(mobile): remove dead screens and components

done.tsx and events.tsx were unreachable from any navigation (not in
ViewSwitcher's list); WeekStrip, MonthGrid, and CalendarHeader were not
imported anywhere, leftover from an earlier design iteration predating
the current agenda-based Calendar and flex-grid Month implementations.
Found while tracing references for the Day/Week/Month view removal.
EOF
)"
```

---

### Task 3: Remove stale tests and update documentation

**Files:**
- Modify: `mobile/src/__tests__/uiUtils.test.ts:253-330` (delete)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the final file layout from Tasks 1-2 (used to write accurate documentation).
- Produces: nothing — this is the terminal task.

- [ ] **Step 1: Remove the two stale test blocks**

In `mobile/src/__tests__/uiUtils.test.ts`, delete everything from line 253 to the end of the file (line 330) — this removes the blank line after the `parseDateParts` describe block's closing `});`, plus the entire `describe('topOffset regression (issue #25: now-line before hour label)', ...)` block and the entire `describe('week view all-day section (issue #27: scrollable, no cap)', ...)` block. Both regression-test formulas and behavior that only existed in the now-deleted Day/Week screens. The file's import line (`import { pad, buildCells, cleanTitle, hourLabel, formatTime, parseDateParts } from '../uiUtils';`) needs no change — every one of those six names still has call sites in the surviving lines 1-252.

After this step, line 252 (`});`, closing the `parseDateParts` describe block) must be the last line of the file. To do this mechanically rather than by hand-editing:

```bash
cd /Volumes/robin/src/todo-txt
sed -i '' '253,330d' mobile/src/__tests__/uiUtils.test.ts
tail -3 mobile/src/__tests__/uiUtils.test.ts
```
Expected `tail` output — the file's last 3 lines should be:
```
    expect(result.year).toBe(2025);
  });
});
```

- [ ] **Step 2: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 79 passed, 79 total` (88 minus the 5 `topOffset regression` tests and 4 `week view all-day section` tests removed).

- [ ] **Step 3: Update the Repo Structure tree in `CLAUDE.md`**

Change:
```
mobile/                       ← Expo Router iOS app
├── app/                      ← file-based screens (Expo Router)
│   ├── _layout.tsx           ← root Stack layout, fonts, TaskProvider, BottomActionBar
│   ├── focus.tsx             ← Focus screen (default — next 14 days, day-grouped)
│   ├── list.tsx              ← List screen (stats cards + flat task list)
│   ├── search.tsx            ← Search screen
│   ├── report.tsx            ← Report screen (summary stats)
│   ├── settings.tsx          ← File path settings
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
to:
```
mobile/                       ← Expo Router iOS app
├── app/                      ← file-based screens (Expo Router)
│   ├── _layout.tsx           ← root Stack layout, fonts, TaskProvider, BottomActionBar
│   ├── index.tsx             ← redirects to /calendar
│   ├── calendar.tsx          ← Calendar screen (default): agenda list + built-in mini month-grid
│   ├── year.tsx              ← Year view (dot-density heatmap by month); tap a date jumps into Calendar
│   ├── search.tsx            ← Search screen
│   ├── settings.tsx          ← File path settings
│   └── task/[line].tsx       ← Task detail formSheet: Done, Edit, Priority, Skip, Delete; shows DUE date
├── src/
│   ├── store.ts              ← Expo FileSystem I/O (mirrors console/store.ts interface)
│   ├── theme.ts              ← Colors, Fonts, Spacing design tokens
│   ├── utils.ts              ← today(), formatDateLabel()
│   ├── nlParser.ts           ← natural language → todo.txt raw string (chrono-node)
│   ├── context/TaskContext.tsx  ← global task state (tasks, filePath, reload, save, pendingDateJump)
│   └── components/           ← TaskRow, EventPill, StatsCard, PriorityPicker, RecurrencePicker,
│                               AddTaskModal, BottomActionBar, ViewSwitcher
└── tests/
```

- [ ] **Step 4: Rewrite the "Day/week view filtering" bullet**

Change:
```
**Day/week view filtering**: Mobile day (`app/day/[date].tsx`) and week (`app/timeline.tsx`) views use `applyFocusForWindow(tasks, todayStr, windowEnd)` + `focusItemOccurrence(item)` from `@shared/commands/focus` — the same logic as the console's `focus` command. Never duplicate this filtering in the mobile layer. The window must be at least `addDays(todayStr, 14)` so overdue recurring tasks (whose `nextWeeklyDate` lands beyond today but whose `focusSortKey` resolves to today via `overdueOccurrenceDate`) pass `isInFocusWindow`.
```
to:
```
**Calendar view filtering**: `app/calendar.tsx` uses `applyFocusForWindow(tasks, todayStr, windowEnd)` + `focusItemOccurrence(item)` from `@shared/commands/focus` — the same logic as the console's `focus` command. Never duplicate this filtering in the mobile layer. The window must be at least `addDays(todayStr, 14)` so overdue recurring tasks (whose `nextWeeklyDate` lands beyond today but whose `focusSortKey` resolves to today via `overdueOccurrenceDate`) pass `isInFocusWindow`.
```

- [ ] **Step 5: Remove the "Month view" bullet**

Delete this line entirely (Month view no longer exists — Calendar's built-in mini-grid is a much simpler component with no such invariant):
```
**Month view** (`app/month.tsx`): full-screen flex grid — no ScrollView. Cells are grouped into rows of 7, each row has `flex: 1` so all rows distribute vertical space equally. Uses `useSafeAreaInsets` to push the `‹ MONTH YEAR ›` header below the Dynamic Island. Tasks mapped by `start:` date (not next occurrence — recurring tasks show on their `start:` date, not the next scheduled occurrence).
```

- [ ] **Step 6: Rewrite the "Calendar navigation pattern" bullet**

Change:
```
**Calendar navigation pattern**: tapping a day cell in Month view or a date in the Week strip navigates to `/day/[date]` via `router.push`. The ViewSwitcher (bottom-left ≡) and BottomActionBar label together support: Day, Week, Month, Year, Tasks, Search, Settings.
```
to:
```
**Calendar navigation pattern**: tapping a date in Calendar's built-in mini-grid scrolls the agenda list to that date within the same screen (`scrollToDate`); tapping a date in Year view jumps into Calendar at that date via `requestDateJump` + `router.push('/calendar')`. The ViewSwitcher (bottom-left ≡) and BottomActionBar label together support: Calendar, Year, Search, Settings.
```

- [ ] **Step 7: Rewrite the "Temporal navigation consistency" bullet**

Change:
```
**Temporal navigation consistency**: all calendar views (Day, Week, Month, Year, Calendar) have both `‹`/`›` arrow buttons in the header and horizontal swipe gestures. Swipe uses `activeOffsetX([-20, 20]).failOffsetY([-10, 10])` so vertical scrolling still works in views that scroll (Week timeline, Year month list). Year view scopes the swipe gesture to the header bar only to avoid conflicting with the month-list ScrollView body.
```
to:
```
**Temporal navigation consistency**: both remaining calendar views (Calendar, Year) have `‹`/`›` arrow buttons in the header and horizontal swipe gestures. Swipe uses `activeOffsetX([-20, 20]).failOffsetY([-10, 10])` so vertical scrolling still works in views that scroll. Year view scopes the swipe gesture to the header bar only to avoid conflicting with the month-list ScrollView body.
```

- [ ] **Step 8: Remove the "Week view pill layout" bullet**

Delete this line entirely (Week view no longer exists):
```
**Week view pill layout** (`app/timeline.tsx`): timed pills and all-day chips have no `numberOfLines` cap — text wraps within the column width. Concurrent items at the same time slot are laid out side by side using the same slot-counting algorithm as the day view: `slotCount` maps each `time` string to a total count; `slotCursor` assigns each item a `col` index; pill `left` and `width` are computed as `2 + col * (pillWidth + 1)` and `Math.floor((innerWidth - (total-1)) / total)` respectively.
```

- [ ] **Step 9: Remove the "Month view today cell" bullet**

Delete this line entirely (Month view no longer exists):
```
**Month view today cell** (`app/month.tsx`): the accent-color border (`cellToday`) uses `zIndex: 1` on both the cell and the row containing today so all four border sides render on top of neighbouring cells' backgrounds and borders.
```

- [ ] **Step 10: Rewrite the "Safe area handling" bullet**

Change:
```
**Safe area handling**: `_layout.tsx` sets `headerShown: false` globally, so every screen is responsible for its own safe-area padding. Use `useSafeAreaInsets()` from `react-native-safe-area-context` and apply `paddingTop: insets.top` to the top-most View or ScrollView in every screen. Screens that already do this: `done.tsx`, `search.tsx`, `settings.tsx`, `day/[date].tsx` (on the header), `month.tsx`, `events.tsx`.
```
to:
```
**Safe area handling**: `_layout.tsx` sets `headerShown: false` globally, so every screen is responsible for its own safe-area padding. Use `useSafeAreaInsets()` from `react-native-safe-area-context` and apply `paddingTop: insets.top` to the top-most View or ScrollView in every screen. Screens that already do this: `calendar.tsx`, `year.tsx` (on the header), `search.tsx`, `settings.tsx`.
```

- [ ] **Step 11: Rewrite the "Section headers" bullet**

Change:
```
**Section headers** across all screens use `fontSize: 11`, `letterSpacing: 2`, `fontFamily: Fonts.mono`. Color differs by context: `Colors.textSecondary` for date-grouped completed tasks (`done.tsx`), `Colors.accent` for event category headers (`events.tsx`).
```
to:
```
**Section headers** across screens use `fontSize: 11`, `letterSpacing: 2`, `fontFamily: Fonts.mono`. `app/calendar.tsx`'s date-grouped agenda sections use `Colors.textSecondary`, brightening to `Colors.accent` for today's section (`sectionTitleToday`).
```

- [ ] **Step 12: Remove the "Tasks view" bullet**

Delete this line entirely (`done.tsx` no longer exists):
```
**Tasks view** (`app/done.tsx`): single `ScrollView` with three zones — (1) completed tasks from the last 30 days grouped by completion date, **oldest-first** so the most-recent completions sit closest to the add-task anchor, with strikethrough styling; (2) an inline `+ add task…` `TextInput` anchor that the view scrolls to on mount via `onLayout` + `scrollTo`; (3) incomplete tasks sorted by `start:` date ascending, no `start:` sorts to bottom. Both zones exclude events (`task.extensions['type']` set). Incomplete task start-date labels show `today`/`yesterday` for those days, the actual date (`Jun 6`, with year when different) for overdue tasks, and weekday (`Mon`) for future tasks. Recurring tasks are hidden from the incomplete list when: `frequency:` + `last-done === todayStr` (completed today, waiting for next occurrence), `frequency:` + `start > todayStr` (next occurrence is in the future after being advanced by `applyDone`), or `frequency:` + `exdate:` + `taskOccurrence(task, todayStr).date > todayStr` while `start:` ≤ today (skipped). Add task uses `applyAdd` + `save`.
```

- [ ] **Step 13: Fix the "Task detail" bullet's stale view list**

Within the Task detail bullet, change this fragment:
```
the same canonical occurrence logic used by Calendar/Focus/Day/Week views
```
to:
```
the same canonical occurrence logic used by Calendar/Focus views
```
(Leave the rest of that bullet — including its later "matching how Calendar/Focus already display such events" fragment — unchanged; it doesn't mention Day/Week.)

- [ ] **Step 14: Fix the "Birthday badge & age display" bullet's stale view list**

Within that bullet, change this fragment:
```
narrow single-line rows (Month grid cells, timed event pills in Day/Week views) truncate with `numberOfLines={1}`
```
to:
```
narrow single-line rows (Calendar's mini-grid day cells, agenda rows) truncate with `numberOfLines={1}`
```

- [ ] **Step 15: Remove the "WeekStrip" Key Invariants bullet**

Delete this line entirely (the `WeekStrip` component no longer exists):
```
- `WeekStrip` (mobile) starts from today and shows the next 7 days — not a fixed Sunday-to-Saturday week.
```

- [ ] **Step 16: Verify no stale references remain**

Run: `cd /Volumes/robin/src/todo-txt && grep -n "day view\|week view\|Day view\|Week view\|Month view\|Tasks view\|events\.tsx\|done\.tsx\|WeekStrip\|MonthGrid\|CalendarHeader\|timeline\.tsx\|month\.tsx\|day/\[date\]" CLAUDE.md`
Expected: no output (all matching lines removed or rewritten).

- [ ] **Step 17: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/src/__tests__/uiUtils.test.ts CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: update CLAUDE.md and remove stale tests for view simplification

Repo Structure tree and Mobile Layer invariant notes referenced
timeline.tsx, month.tsx, day/[date].tsx, done.tsx, events.tsx, and
WeekStrip — all removed. Also corrected the tree's focus.tsx/list.tsx/
report.tsx entries, which no longer existed independent of this change,
and added the missing index.tsx/events.tsx entries while rewriting the
same block. Removed two uiUtils.test.ts blocks that regression-tested
formulas which only lived in the deleted Day/Week screens.
EOF
)"
```
