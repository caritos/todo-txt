# Week & Day View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-list Week view with a 7-column time grid, add shared selected-day state, and add Day as a primary navigation destination.

**Architecture:** `timeline.tsx` becomes the new `focus.tsx` (Week view) with selected-day column highlighting driven by `selectedDate` from TaskContext. ViewSwitcher's "Day" entry navigates to `day/[selectedDate]`. Old `focus.tsx` is deleted.

**Tech Stack:** Expo SDK 52, Expo Router v3, React Native (iOS), existing `Colors`/`Fonts`/`Spacing` tokens, `useTasks()` context hook, `addDays` from `@shared/utils`.

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `mobile/src/context/TaskContext.tsx` | Add `selectedDate` / `setSelectedDate` |
| Delete | `mobile/app/focus.tsx` | Remove flat-list week view |
| Rename→Replace | `mobile/app/timeline.tsx` | Becomes new Week screen (`focus.tsx` route stays `/focus`) |
| Modify | `mobile/app/_layout.tsx` | Remove `timeline` Stack.Screen |
| Modify | `mobile/src/components/ViewSwitcher.tsx` | Remove Timeline, add Day with dynamic route |
| Modify | `mobile/src/components/BottomActionBar.tsx` | Remove `/timeline`, add Day wildcard |
| Modify | `mobile/app/day/[date].tsx` | Back label, header format, "noon", write `selectedDate` on ‹/› |

---

## Task 1: Add `selectedDate` to TaskContext

**Files:**
- Modify: `mobile/src/context/TaskContext.tsx`

No unit tests — this is pure React state wiring.

- [ ] **Step 1: Add `selectedDate` and `setSelectedDate` to the context type and provider**

Replace the entire file with:

```tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Task } from '@shared/parser';
import { readTasks, writeTasks, resolveFile } from '../store';
import { today } from '../utils';

type TaskContextValue = {
  tasks: Task[];
  filePath: string;
  loading: boolean;
  reload: () => Promise<void>;
  save: (updated: Task[]) => Promise<void>;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today());

  const reload = useCallback(async () => {
    const path = await resolveFile();
    setFilePath(path);
    const loaded = await readTasks(path);
    setTasks(loaded);
  }, []);

  const save = useCallback(
    async (updated: Task[]) => {
      await writeTasks(filePath, updated);
      setTasks(updated);
    },
    [filePath]
  );

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <TaskContext.Provider value={{ tasks, filePath, loading, reload, save, selectedDate, setSelectedDate }}>
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

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "TaskContext"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/context/TaskContext.tsx
git commit -m "feat(context): add selectedDate / setSelectedDate to TaskContext"
```

---

## Task 2: Replace `focus.tsx` with the upgraded time-grid Week view

**Files:**
- Delete: `mobile/app/focus.tsx`
- Replace: `mobile/app/timeline.tsx` with new content (becomes the Week screen at route `/focus` via ViewSwitcher — file stays `timeline.tsx` for now, wired in Task 3)

- [ ] **Step 1: Delete the old flat-list focus screen**

```bash
rm /Users/eladio/src/todo-txt/mobile/app/focus.tsx
```

- [ ] **Step 2: Rewrite `mobile/app/timeline.tsx` with selected-day support**

Replace the entire file with:

```tsx
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRef, useState, useMemo, useEffect } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL_WIDTH = Math.floor((SCREEN_WIDTH - LABEL_WIDTH) / 7);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function taskTime(task: Task): { hours: number; minutes: number } | null {
  const start = task.extensions['start'];
  if (!start || start.length <= 10) return null;
  const timePart = start.slice(11, 16);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return null;
  const [hStr, mStr] = timePart.split(':');
  return { hours: parseInt(hStr!, 10), minutes: parseInt(mStr!, 10) };
}

function topOffset(hours: number, minutes: number): number {
  return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return 'noon';
  return `${h - 12} PM`;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

export default function WeekScreen() {
  const { tasks, selectedDate, setSelectedDate } = useTasks();
  const scrollRef = useRef<ScrollView>(null);
  const todayStr = today();
  const [anchorDate, setAnchorDate] = useState(todayStr);

  const { sundayStr, weekDates } = useMemo(() => {
    const d = new Date(anchorDate + 'T12:00:00');
    const dow = d.getDay();
    const sun = new Date(d);
    sun.setDate(d.getDate() - dow);
    const s = `${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`;
    return { sundayStr: s, weekDates: Array.from({ length: 7 }, (_, i) => addDays(s, i)) };
  }, [anchorDate]);

  const weekContainsToday = weekDates.includes(todayStr);

  useEffect(() => {
    const targetHour = weekContainsToday
      ? Math.max(START_HOUR, new Date().getHours() - 2)
      : 8;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: (targetHour - START_HOUR) * HOUR_HEIGHT, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [sundayStr, weekContainsToday]);

  const { tasksPerDay, busyCounts } = useMemo(() => {
    const perDay = new Map<string, { allDay: Task[]; timed: Task[] }>();
    const counts = new Map<string, number>();
    for (const d of weekDates) perDay.set(d, { allDay: [], timed: [] });
    for (const t of tasks) {
      if (t.done) continue;
      const start = t.extensions['start'];
      if (!start) continue;
      const d = start.slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
      const bucket = perDay.get(d);
      if (!bucket) continue;
      if (taskTime(t)) bucket.timed.push(t);
      else bucket.allDay.push(t);
    }
    for (const bucket of perDay.values()) {
      bucket.timed.sort((a, b) => {
        const ta = taskTime(a)!, tb = taskTime(b)!;
        return ta.hours * 60 + ta.minutes - (tb.hours * 60 + tb.minutes);
      });
    }
    return { tasksPerDay: perDay, busyCounts: counts };
  }, [tasks, weekDates]);

  const hasAnyAllDay = weekDates.some(d => (tasksPerDay.get(d)?.allDay.length ?? 0) > 0);
  const hasAnyTasks = weekDates.some(d => {
    const b = tasksPerDay.get(d);
    return (b?.allDay.length ?? 0) > 0 || (b?.timed.length ?? 0) > 0;
  });

  const sundayDate = new Date(sundayStr + 'T12:00:00');
  const now = new Date();
  const nowTop = weekContainsToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTop !== null && nowTop >= 0 && nowTop <= TIMELINE_HEIGHT;
  const todayColIndex = weekContainsToday ? weekDates.indexOf(todayStr) : -1;
  const selectedColIndex = weekDates.includes(selectedDate) ? weekDates.indexOf(selectedDate) : -1;
  const showSelectedCol = selectedColIndex >= 0 && selectedDate !== todayStr;

  function dotStyle(dateStr: string): { size: number; opacity: number } | null {
    const count = busyCounts.get(dateStr) ?? 0;
    if (count === 0) return null;
    if (count <= 2) return { size: 4, opacity: 0.45 };
    if (count <= 5) return { size: 6, opacity: 0.7 };
    return { size: 8, opacity: 1.0 };
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setAnchorDate(addDays(anchorDate, -7))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text>
          <Text style={styles.monthText}>{MONTHS[sundayDate.getMonth()]} </Text>
          <Text style={styles.yearText}>{sundayDate.getFullYear()}</Text>
        </Text>
        <TouchableOpacity onPress={() => setAnchorDate(addDays(anchorDate, 7))} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        <View style={{ width: LABEL_WIDTH }} />
        {weekDates.map((dateStr, i) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate && !isToday;
          const dot = dotStyle(dateStr);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.stripCell, { width: COL_WIDTH }, isSelected && styles.stripCellSelected]}
              onPress={() => setSelectedDate(dateStr)}
              activeOpacity={0.7}
            >
              <Text style={[styles.stripDayName, isSelected && styles.stripDayNameSelected]}>
                {DAY_NAMES[i]}
              </Text>
              <View style={[styles.stripDayBox, isToday && styles.stripDayBoxToday]}>
                <Text style={[styles.stripDayNum, isToday && styles.stripDayNumToday]}>
                  {parseInt(dateStr.slice(8), 10)}
                </Text>
              </View>
              {dot
                ? <View style={[styles.stripDot, { width: dot.size, height: dot.size, borderRadius: dot.size / 2, opacity: dot.opacity }]} />
                : <View style={styles.stripDotPlaceholder} />
              }
            </TouchableOpacity>
          );
        })}
      </View>

      {/* All-day row */}
      {hasAnyAllDay && (
        <View style={styles.allDayRow}>
          <View style={{ width: LABEL_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.allDayLabel}>ALL{'\n'}DAY</Text>
          </View>
          {weekDates.map(dateStr => {
            const allDay = tasksPerDay.get(dateStr)?.allDay ?? [];
            return (
              <View key={dateStr} style={[styles.allDayCell, { width: COL_WIDTH }]}>
                {allDay.slice(0, 2).map(t => (
                  <View key={t.line} style={styles.allDayChip}>
                    <Text style={styles.allDayChipText} numberOfLines={1}>{cleanTitle(t.text)}</Text>
                  </View>
                ))}
                {allDay.length > 2 && <Text style={styles.allDayMore}>+{allDay.length - 2}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {!hasAnyTasks && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>nothing this week.</Text>
        </View>
      )}

      {/* Timeline */}
      {hasAnyTasks && (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ height: TIMELINE_HEIGHT, position: 'relative' }}>
            {/* Time label column */}
            <View style={styles.labelCol}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
                <View key={hour} style={[styles.hourLabelCell, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}>
                  <Text style={styles.hourLabelText}>{hourLabel(hour)}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={[styles.grid, { left: LABEL_WIDTH }]}>
              {/* Hour lines */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
                <View key={hour} style={[styles.hourLine, { top: (hour - START_HOUR) * HOUR_HEIGHT }]} />
              ))}

              {/* Selected column highlight */}
              {showSelectedCol && (
                <View style={[styles.selectedBg, { left: selectedColIndex * COL_WIDTH, width: COL_WIDTH }]} />
              )}

              {/* Today column highlight */}
              {todayColIndex >= 0 && (
                <View style={[styles.todayBg, { left: todayColIndex * COL_WIDTH, width: COL_WIDTH }]} />
              )}

              {/* Current time line */}
              {showNow && nowTop !== null && (
                <View style={[styles.nowLine, { top: nowTop }]}>
                  <View style={styles.nowDot} />
                  <View style={styles.nowBar} />
                </View>
              )}

              {/* Columns */}
              {weekDates.map((dateStr, colIndex) => {
                const timed = tasksPerDay.get(dateStr)?.timed ?? [];
                return (
                  <View key={dateStr} style={[styles.column, { left: colIndex * COL_WIDTH, width: COL_WIDTH }]}>
                    {timed.map(task => {
                      const t = taskTime(task)!;
                      const rawTop = topOffset(t.hours, t.minutes);
                      if (rawTop < 0 || rawTop > TIMELINE_HEIGHT) return null;
                      return (
                        <View key={task.line} style={[styles.pill, { top: rawTop + 1 }]}>
                          <Text style={styles.pillText} numberOfLines={1}>{cleanTitle(task.text)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  navBtn: { padding: Spacing.sm },
  navArrow: { fontSize: 22, color: Colors.textSecondary },
  monthText: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300' },
  yearText: { fontSize: 20, color: Colors.accent, fontWeight: '300' },

  weekStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  stripCell: { alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 2 },
  stripCellSelected: { backgroundColor: '#2D2D2D', borderRadius: 5 },
  stripDayName: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5 },
  stripDayNameSelected: { color: Colors.accent, fontWeight: '600' },
  stripDayBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stripDayBoxToday: { backgroundColor: Colors.accent },
  stripDayNum: { fontSize: 12, color: Colors.text },
  stripDayNumToday: { color: '#ffffff', fontWeight: '700' },
  stripDot: { backgroundColor: Colors.accent },
  stripDotPlaceholder: { height: 8 },

  allDayRow: {
    flexDirection: 'row', minHeight: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: 3,
  },
  allDayLabel: { fontSize: 7, color: '#555555', letterSpacing: 0.5, textAlign: 'center' },
  allDayCell: { paddingHorizontal: 1, gap: 1 },
  allDayChip: {
    backgroundColor: Colors.accent + '22',
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingHorizontal: 2, paddingVertical: 1,
  },
  allDayChipText: { fontSize: 7, color: Colors.text, fontFamily: Fonts.mono },
  allDayMore: { fontSize: 7, color: Colors.textSecondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },

  labelCol: { position: 'absolute', left: 0, top: 0, width: LABEL_WIDTH, height: TIMELINE_HEIGHT },
  hourLabelCell: { position: 'absolute', left: 0, width: LABEL_WIDTH, paddingLeft: Spacing.sm, paddingTop: 3 },
  hourLabelText: { fontSize: 9, color: '#444444', fontFamily: Fonts.mono },

  grid: { position: 'absolute', top: 0, right: 0, height: TIMELINE_HEIGHT },
  hourLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: '#222222',
  },
  selectedBg: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    backgroundColor: '#2D2D2D',
  },
  todayBg: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    backgroundColor: Colors.accent + '11',
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', zIndex: 10,
  },
  nowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, marginLeft: 2 },
  nowBar: { flex: 1, height: 1, backgroundColor: Colors.accent },
  column: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#222222',
  },
  pill: {
    position: 'absolute', left: 2, right: 2,
    backgroundColor: Colors.surface,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingVertical: 2, paddingHorizontal: 2,
    minHeight: 18,
  },
  pillText: { fontSize: 8, color: Colors.text, fontFamily: Fonts.mono },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "timeline\|focus"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/focus.tsx mobile/app/timeline.tsx
git commit -m "feat(week): replace flat-list with 7-column time grid, add selected-day highlight"
```

---

## Task 3: Wire navigation

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`

- [ ] **Step 1: Remove `timeline` route from `_layout.tsx`**

In `mobile/app/_layout.tsx`, remove the line:
```tsx
            <Stack.Screen name="timeline" />
```

The file should now have `focus`, `year`, `day/[date]`, `done`, `search`, `settings`, `task/[line]` — no `timeline`.

- [ ] **Step 2: Update `ViewSwitcher.tsx`**

Replace the entire file with:

```tsx
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../theme';
import { useTasks } from '../context/TaskContext';

type View_ = { label: string; route: string };

const VIEWS: View_[] = [
  { label: 'Week', route: '/focus' },
  { label: 'Day', route: '/day' },
  { label: 'Year', route: '/year' },
  { label: 'Done', route: '/done' },
  { label: 'Settings', route: '/settings' },
];

type Props = { visible: boolean; onClose: () => void };

export function ViewSwitcher({ visible, onClose }: Props) {
  const router = useRouter();
  const { selectedDate } = useTasks();

  function navigate(route: string) {
    const target = route === '/day' ? `/day/${selectedDate}` : route;
    router.push(target as any);
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {VIEWS.map(v => (
            <TouchableOpacity key={v.route} style={styles.item} onPress={() => navigate(v.route)}>
              <Text style={styles.itemText}>{v.label}</Text>
            </TouchableOpacity>
          ))}
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
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.separator,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  item: { paddingVertical: 16, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  itemText: { fontSize: 17, color: Colors.text },
});
```

- [ ] **Step 3: Update `BottomActionBar.tsx`**

Replace the `ROUTE_LABELS` constant and the `label` line:

```tsx
const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Week',
  '/year': 'Year',
  '/done': 'Done',
  '/search': 'Search',
  '/settings': 'Settings',
};
```

And update the label derivation to handle the `/day/*` wildcard:

```tsx
  const label = pathname.startsWith('/day/') ? 'Day' : (ROUTE_LABELS[pathname] ?? 'Week');
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: only the pre-existing errors (task/[line].tsx:72, store.test.ts:27, shared/commands/skip.ts:25). No new errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx
git commit -m "feat(nav): add Day to ViewSwitcher, remove Timeline, wire selectedDate"
```

---

## Task 4: Upgrade `day/[date].tsx`

**Files:**
- Modify: `mobile/app/day/[date].tsx`

Changes: back label → "‹ Back", header format → "SUN  JUN 15", "noon" for 12 PM, ‹/› writes `selectedDate` to context.

- [ ] **Step 1: Update `formatDayHeader` to use abbreviated month name**

Replace the existing `formatDayHeader` function and add `MONTH_SHORT`:

```tsx
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]}  ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}
```

- [ ] **Step 2: Update `hourLabel` to return "noon" for 12**

```tsx
function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return 'noon';
  return `${h - 12} PM`;
}
```

- [ ] **Step 3: Pull `setSelectedDate` from context and update ‹/› handlers and back label**

At the top of `DayScreen`, destructure `setSelectedDate`:

```tsx
  const { tasks, setSelectedDate } = useTasks();
```

Update the back button text:

```tsx
          <Text style={styles.backText}>‹ Back</Text>
```

Update the ‹/› `onPress` handlers to also call `setSelectedDate`:

```tsx
          <TouchableOpacity onPress={() => {
            const prev = addDays(dateStr, -1);
            setSelectedDate(prev);
            router.replace(`/day/${prev}` as any);
          }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const next = addDays(dateStr, 1);
            setSelectedDate(next);
            router.replace(`/day/${next}` as any);
          }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "day/"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/day/[date].tsx
git commit -m "feat(day): back label, month abbreviation header, noon label, sync selectedDate on navigate"
```

---

## Manual Test Checklist

After running `mobile/scripts/sim.sh`:

- [ ] ViewSwitcher shows: Week, Day, Year, Done, Settings (no Timeline, no List, no Report, no Search)
- [ ] Week view is the 7-column time grid (not a flat list)
- [ ] Tapping a day in the WeekStrip highlights it with gray cell + accent day name
- [ ] Tapping today in the WeekStrip: today's accent square shows, no gray cell
- [ ] Selected day column in the time grid shows a gray tint (`#2D2D2D`)
- [ ] Today column still shows its subtle accent tint
- [ ] ‹/› in Week header navigates weeks, selected day persists
- [ ] ViewSwitcher "Day" navigates to the selected day (not always today)
- [ ] ‹/› in Day view updates the selected day — switching back to Week highlights the new day
- [ ] Day view header shows "SUN  JUN 15" format (abbreviated month)
- [ ] Day view back button shows "‹ Back"
- [ ] Day view hour labels show "noon" for 12 PM
- [ ] No crashes on any screen transition
