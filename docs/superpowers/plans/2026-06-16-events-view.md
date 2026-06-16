# Events View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Events screen that lists upcoming events (birthdays, anniversaries, etc.) grouped by month-year with recurring events expanded across a 2-year window.

**Architecture:** A single new screen `mobile/app/events.tsx` filters tasks by `task.extensions['type']`, generates multiple future occurrences per recurring event using existing `nextYearlyDate`/`nextMonthlyDate`/`nextWeeklyDate` helpers from `@shared/commands/focus`, and groups the results by `YYYY-MM` into section headers. Three one-line edits wire the route into the ViewSwitcher, BottomActionBar, and root layout.

**Tech Stack:** React Native, Expo Router, `react-native-safe-area-context`, `@shared/commands/focus` (nextYearlyDate, nextMonthlyDate, nextWeeklyDate), `@shared/utils` (addDays).

---

### Task 1: Wire navigation — ViewSwitcher, BottomActionBar, _layout.tsx

**Files:**
- Modify: `mobile/src/components/ViewSwitcher.tsx:8-15`
- Modify: `mobile/src/components/BottomActionBar.tsx:8-15`
- Modify: `mobile/app/_layout.tsx`

#### Context

`ViewSwitcher.tsx` has a `VIEWS` array at lines 8–15. `BottomActionBar.tsx` has a `ROUTE_LABELS` map at lines 8–15. Both need a one-line addition. `_layout.tsx` registers all screen names for Expo Router.

- [ ] **Step 1: Add Events to ViewSwitcher**

In `mobile/src/components/ViewSwitcher.tsx`, find the `VIEWS` array:

```ts
const VIEWS: View_[] = [
  { label: 'Day', route: '/day' },
  { label: 'Week', route: '/timeline' },
  { label: 'Month', route: '/month' },
  { label: 'Year', route: '/year' },
  { label: 'Tasks', route: '/done' },
  { label: 'Settings', route: '/settings' },
];
```

Replace with:

```ts
const VIEWS: View_[] = [
  { label: 'Day', route: '/day' },
  { label: 'Week', route: '/timeline' },
  { label: 'Month', route: '/month' },
  { label: 'Year', route: '/year' },
  { label: 'Tasks', route: '/done' },
  { label: 'Events', route: '/events' },
  { label: 'Settings', route: '/settings' },
];
```

- [ ] **Step 2: Add Events label to BottomActionBar**

In `mobile/src/components/BottomActionBar.tsx`, find `ROUTE_LABELS`:

```ts
const ROUTE_LABELS: Record<string, string> = {
  '/timeline': 'Week',
  '/month': 'Month',
  '/year': 'Year',
  '/done': 'Tasks',
  '/search': 'Search',
  '/settings': 'Settings',
};
```

Replace with:

```ts
const ROUTE_LABELS: Record<string, string> = {
  '/timeline': 'Week',
  '/month': 'Month',
  '/year': 'Year',
  '/done': 'Tasks',
  '/events': 'Events',
  '/search': 'Search',
  '/settings': 'Settings',
};
```

- [ ] **Step 3: Register the screen in _layout.tsx**

In `mobile/app/_layout.tsx`, the `Stack` already has several `Stack.Screen` entries. Find the block and add `events` after `year`:

```tsx
            <Stack.Screen name="index" />
            <Stack.Screen name="done" />
            <Stack.Screen name="year" />
            <Stack.Screen name="events" />
            <Stack.Screen name="timeline" />
            <Stack.Screen name="day/[date]" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep -E "(ViewSwitcher|BottomActionBar|_layout)" | head -10
```

Expected: no output (no errors in these files).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx mobile/app/_layout.tsx
git commit -m "feat(nav): add Events route to ViewSwitcher and BottomActionBar"
```

---

### Task 2: Create the Events screen

**Files:**
- Create: `mobile/app/events.tsx`

#### Context

The screen filters `tasks` to events only (`!!task.extensions['type']`), generates future occurrences up to 730 days out using shared recurrence helpers, groups occurrences by month-year, and renders a `ScrollView` of section headers + rows. Each row taps to `/task/[line]`. No checkbox — events are read-only. Uses `useSafeAreaInsets` for Dynamic Island clearance, matching all other screens.

**Shared helpers used:**
- `nextYearlyDate(startDate, fromDate, exdates, freqMonthDay, every)` — `@shared/commands/focus`
- `nextMonthlyDate(startVal, fromDate, exdates, freqMonthDay, every)` — `@shared/commands/focus`
- `nextWeeklyDate(startVal, fromDate, every, exdates, freqDay)` — `@shared/commands/focus`
- `addDays(dateStr, n)` — `@shared/utils`

**Design tokens:** `Colors.background` (#1A1A1A), `Colors.accent` (#E8461A), `Colors.text` (#F0F0F0), `Colors.textSecondary` (#888888), `Colors.separator` (#333333), `Fonts.mono` (JetBrains Mono).

- [ ] **Step 1: Create `mobile/app/events.tsx`**

Create the file with this full implementation:

```tsx
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import { nextYearlyDate, nextMonthlyDate, nextWeeklyDate } from '@shared/commands/focus';
import type { Task } from '@shared/parser';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function monthYearLabel(yyyyMM: string): string {
  const year = parseInt(yyyyMM.slice(0, 4), 10);
  const month = parseInt(yyyyMM.slice(5, 7), 10) - 1;
  return `${MONTH_NAMES[month]!.toUpperCase()} ${year}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

function generateOccurrences(
  task: Task,
  todayStr: string,
  cutoffStr: string,
): Array<{ date: string; task: Task }> {
  const startVal = task.extensions['start'];
  if (!startVal) return [];
  const startDate = startVal.slice(0, 10);
  const freq = task.extensions['frequency'];
  const every = parseInt(task.extensions['every'] ?? '1', 10);
  const exdates = new Set((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
  const freqDay = task.extensions['frequency-day'];
  const freqMonthDay = task.extensions['frequency-month-day'];
  const results: Array<{ date: string; task: Task }> = [];

  if (!freq) {
    // Non-recurring: show once if on or after today and within cutoff
    if (startDate >= todayStr && startDate <= cutoffStr) {
      results.push({ date: startDate, task });
    }
    return results;
  }

  // Seed the first occurrence on or after today
  let cursor: string;
  if (freq === 'yearly') {
    cursor = nextYearlyDate(startDate, todayStr, exdates, freqMonthDay, every);
  } else if (freq === 'monthly') {
    cursor = nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
  } else if (freq === 'weekly') {
    cursor = nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
  } else {
    // daily frequency not typical for events — skip
    return results;
  }

  // Step forward collecting occurrences until cutoff
  while (cursor <= cutoffStr) {
    results.push({ date: cursor, task });
    if (freq === 'yearly') {
      cursor = nextYearlyDate(startDate, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else if (freq === 'monthly') {
      cursor = nextMonthlyDate(startVal, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else {
      cursor = nextWeeklyDate(startVal, addDays(cursor, 1), every, exdates, freqDay);
    }
  }

  return results;
}

export default function EventsScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const cutoffStr = addDays(todayStr, 730);

  const sections = useMemo(() => {
    const events = tasks.filter(t => !t.done && !!t.extensions['type']);
    const all: Array<{ date: string; task: Task }> = [];
    for (const event of events) {
      all.push(...generateOccurrences(event, todayStr, cutoffStr));
    }
    all.sort((a, b) => a.date.localeCompare(b.date));

    const byMonth = new Map<string, Array<{ date: string; task: Task }>>();
    for (const occ of all) {
      const key = occ.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(occ);
    }

    return [...byMonth.entries()].map(([key, items]) => ({
      key,
      label: monthYearLabel(key),
      items,
    }));
  }, [tasks, todayStr, cutoffStr]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>no upcoming events.</Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.key}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.label}</Text>
              </View>
              {section.items.map((occ, i) => (
                <TouchableOpacity
                  key={`${occ.task.line}-${occ.date}-${i}`}
                  style={styles.row}
                  onPress={() => router.push(`/task/${occ.task.line}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventTitle}>{cleanTitle(occ.task.text)}</Text>
                  <Text style={styles.eventDate}>{dayLabel(occ.date)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 120 },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 2,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  eventTitle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  eventDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "events" | head -10
```

Expected: no output.

- [ ] **Step 3: Verify full error count hasn't grown**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `3` (the same 3 pre-existing errors — task/[line].tsx, store.test.ts, skip.ts — nothing new).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/events.tsx
git commit -m "feat(mobile): add Events screen — upcoming events grouped by month"
```
