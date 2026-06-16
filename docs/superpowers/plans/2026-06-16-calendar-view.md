# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tasks and Events views with a unified Calendar view — a swipeable month grid on top and a daily agenda list below.

**Architecture:** A single `mobile/app/calendar.tsx` screen holds all state. The top portion is a fixed-height month calendar driven by a Pan gesture. The bottom is a `SectionList` grouped by date. A `sectionListRef` is used to jump the agenda when a calendar date is tapped or the month is swiped. Navigation changes remove Tasks/Events from the menu and add Calendar.

**Tech Stack:** Expo Router, React Native `SectionList`, `react-native-gesture-handler` (Pan for swipe), `useSafeAreaInsets`, `@shared/parser`, `@shared/utils`, `@shared/commands/focus`.

---

### Task 1: Navigation stub — add Calendar route, remove Tasks/Events from menu

**Files:**
- Create: `mobile/app/calendar.tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`

- [ ] **Step 1: Create a stub screen at `mobile/app/calendar.tsx`**

```tsx
import { View, Text } from 'react-native';
import { Colors } from '../src/theme';

export default function CalendarScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.textSecondary }}>calendar coming soon</Text>
    </View>
  );
}
```

- [ ] **Step 2: Update `mobile/src/components/ViewSwitcher.tsx` — replace Tasks + Events with Calendar**

Replace the `VIEWS` array:

```tsx
const VIEWS: View_[] = [
  { label: 'Day', route: '/day' },
  { label: 'Week', route: '/timeline' },
  { label: 'Month', route: '/month' },
  { label: 'Year', route: '/year' },
  { label: 'Calendar', route: '/calendar' },
  { label: 'Search', route: '/search' },
  { label: 'Settings', route: '/settings' },
];
```

- [ ] **Step 3: Update `mobile/src/components/BottomActionBar.tsx` — update ROUTE_LABELS**

Replace the `ROUTE_LABELS` object:

```tsx
const ROUTE_LABELS: Record<string, string> = {
  '/timeline': 'Week',
  '/month': 'Month',
  '/year': 'Year',
  '/calendar': 'Calendar',
  '/search': 'Search',
  '/settings': 'Settings',
};
```

- [ ] **Step 4: Verify the app launches and Calendar appears in the menu**

Run: `mobile/scripts/sim.sh`

Navigate via the ≡ menu and confirm:
- "Tasks" and "Events" are gone
- "Calendar" appears and navigates to the stub screen
- BottomActionBar shows "Calendar" as the label on that route

- [ ] **Step 5: Commit**

```bash
git add mobile/app/calendar.tsx mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx
git commit -m "feat(nav): add Calendar route, remove Tasks/Events from menu"
```

---

### Task 2: Month calendar grid with swipe navigation

**Files:**
- Modify: `mobile/app/calendar.tsx`

- [ ] **Step 1: Replace the stub with the full month calendar top section**

```tsx
import { View, Text, TouchableOpacity, SectionList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today, addDays } from '../src/utils';
import type { Task } from '@shared/parser';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildCells(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

export default function CalendarScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  const [calYear, setCalYear] = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const cells = useMemo(() => buildCells(calYear, calMonth), [calYear, calMonth]);
  const rows = useMemo(() => {
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cells]);

  // Placeholder dot set — will be replaced in Task 3
  const datesWithItems = useMemo(() => new Set<string>(), []);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .minDistance(40)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX < 0) nextMonth();
        else prevMonth();
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Month calendar */}
        <View style={styles.calendarWrapper}>
          {/* Header */}
          <View style={styles.calHeader}>
            <Text style={styles.monthText}>{MONTH_NAMES[calMonth]} </Text>
            <Text style={styles.yearText}>{calYear}</Text>
          </View>
          {/* Day labels */}
          <View style={styles.dayLabelRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>
          {/* Date grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.calRow}>
              {row.map((dateStr, ci) => {
                if (!dateStr) return <View key={`e-${ri}-${ci}`} style={styles.calCell} />;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate && !isToday;
                const hasDot = datesWithItems.has(dateStr);
                const day = parseInt(dateStr.slice(8), 10);
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={styles.calCell}
                    onPress={() => setSelectedDate(dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dayNumWrap,
                      isToday && styles.dayNumWrapToday,
                      isSelected && styles.dayNumWrapSelected,
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        isToday && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}>
                        {day}
                      </Text>
                    </View>
                    {hasDot
                      ? <View style={styles.dot} />
                      : <View style={styles.dotPlaceholder} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Agenda placeholder */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textSecondary, fontFamily: Fonts.mono, fontSize: 12 }}>
            agenda coming in next task
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  calendarWrapper: {
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    paddingBottom: Spacing.xs,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  monthText: { fontSize: 17, color: Colors.textSecondary, fontWeight: '300' },
  yearText: { fontSize: 17, color: Colors.accent, fontWeight: '300' },

  dayLabelRow: { flexDirection: 'row', paddingBottom: 2 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 9, color: '#555', letterSpacing: 0.5 },

  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayNumWrap: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  dayNumWrapToday: { backgroundColor: Colors.accent },
  dayNumWrapSelected: { backgroundColor: '#2D2D2D' },
  dayNum: { fontSize: 12, color: Colors.textSecondary },
  dayNumToday: { color: '#fff', fontWeight: '700' },
  dayNumSelected: { color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent, marginTop: 1 },
  dotPlaceholder: { width: 4, height: 4, marginTop: 1 },
});
```

- [ ] **Step 2: Verify the calendar grid renders correctly**

Run: `mobile/scripts/sim.sh`

Confirm:
- Month name + year appear centered at top
- 7-column date grid with SUN–SAT labels
- Today's date has an accent-filled circle
- Swiping left/right changes the month
- Tapping a date updates the selected highlight

- [ ] **Step 3: Commit**

```bash
git add mobile/app/calendar.tsx
git commit -m "feat(calendar): month grid with swipe navigation"
```

---

### Task 3: Agenda data computation

**Files:**
- Modify: `mobile/app/calendar.tsx`

This task adds the data layer — computing the agenda sections and the dot set for the calendar.

- [ ] **Step 1: Add imports for focus helpers and the occurrence generator**

At the top of `mobile/app/calendar.tsx`, add to the existing imports:

```tsx
import { addDays } from '@shared/utils';
import { nextYearlyDate, nextMonthlyDate, nextWeeklyDate } from '@shared/commands/focus';
```

- [ ] **Step 2: Add the `generateOccurrences` helper (copied from `events.tsx`)**

Add after the `cleanTitle` function:

```tsx
function generateOccurrences(
  task: Task,
  fromStr: string,
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
    if (startDate >= fromStr && startDate <= cutoffStr) {
      results.push({ date: startDate, task });
    }
    return results;
  }

  let cursor: string;
  if (freq === 'yearly') {
    cursor = nextYearlyDate(startDate, fromStr, exdates, freqMonthDay, every);
  } else if (freq === 'monthly') {
    cursor = nextMonthlyDate(startVal, fromStr, exdates, freqMonthDay, every);
  } else if (freq === 'weekly') {
    cursor = nextWeeklyDate(startVal, fromStr, every, exdates, freqDay);
  } else {
    return results;
  }

  while (cursor <= cutoffStr) {
    results.push({ date: cursor, task });
    let next: string;
    if (freq === 'yearly') {
      next = nextYearlyDate(startDate, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else if (freq === 'monthly') {
      next = nextMonthlyDate(startVal, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else {
      next = nextWeeklyDate(startVal, addDays(cursor, 1), every, exdates, freqDay);
    }
    if (next <= cursor) break;
    cursor = next;
  }

  return results;
}
```

- [ ] **Step 3: Define `AgendaItem` type and `buildAgenda` computation**

Add the type and the `useMemo` to `CalendarScreen`, replacing the placeholder `datesWithItems` memo:

```tsx
type AgendaItem = {
  key: string;
  task: Task;
  kind: 'completed' | 'incomplete' | 'event';
  time?: string;
};

type AgendaSection = {
  dateStr: string;
  title: string;
  data: AgendaItem[];
};
```

Inside `CalendarScreen`, replace the placeholder `datesWithItems` useMemo with:

```tsx
const { sections, datesWithItems } = useMemo(() => {
  const pastCutoff = addDays(todayStr, -90);
  const futureCutoff = addDays(todayStr, 730);
  const byDate = new Map<string, AgendaItem[]>();

  function ensure(date: string) {
    if (!byDate.has(date)) byDate.set(date, []);
  }

  // 1. Past completed tasks (last 90 days), grouped by completion date
  for (const t of tasks) {
    if (!t.done || !t.completionDate) continue;
    const date = t.completionDate.slice(0, 10);
    if (date < pastCutoff || date > todayStr) continue;
    ensure(date);
    byDate.get(date)!.push({
      key: `done-${t.line}-${date}`,
      task: t,
      kind: 'completed',
      time: t.extensions['start']?.slice(11, 16) || undefined,
    });
  }

  // 2. Incomplete tasks grouped by start: date (today + future; also past if overdue)
  for (const t of tasks) {
    if (t.done || !!t.extensions['type']) continue;
    const startVal = t.extensions['start'];
    if (!startVal) continue;
    const date = startVal.slice(0, 10);
    if (date < pastCutoff || date > futureCutoff) continue;
    ensure(date);
    byDate.get(date)!.push({
      key: `task-${t.line}-${date}`,
      task: t,
      kind: 'incomplete',
      time: startVal.length > 10 ? startVal.slice(11, 16) : undefined,
    });
  }

  // 3. Event occurrences: past 90 days + future 2 years
  for (const t of tasks) {
    if (!t.extensions['type']) continue;
    const occurrences = generateOccurrences(t, pastCutoff, futureCutoff);
    for (const occ of occurrences) {
      ensure(occ.date);
      byDate.get(occ.date)!.push({
        key: `event-${t.line}-${occ.date}`,
        task: t,
        kind: 'event',
        time: t.extensions['start']?.slice(11, 16) || undefined,
      });
    }
  }

  // Sort by date and build sections
  const sortedDates = [...byDate.keys()].sort();
  const dotSet = new Set(sortedDates);
  const sectionList: AgendaSection[] = sortedDates.map(dateStr => {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
    const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    const day = d.getDate();
    const suffix = dateStr === todayStr ? ' — TODAY' : '';
    const title = `${dow} ${mon} ${day}${suffix}`;
    return { dateStr, title, data: byDate.get(dateStr)! };
  });

  return { sections: sectionList, datesWithItems: dotSet };
}, [tasks, todayStr]);
```

- [ ] **Step 4: Verify dots appear on the calendar**

Run: `mobile/scripts/sim.sh`

Confirm that dates with tasks/events show a small accent dot below the date number.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/calendar.tsx
git commit -m "feat(calendar): compute agenda sections and dot indicators"
```

---

### Task 4: Agenda SectionList

**Files:**
- Modify: `mobile/app/calendar.tsx`

- [ ] **Step 1: Add `sectionListRef` and replace the agenda placeholder with a `SectionList`**

Add the ref declaration near the top of `CalendarScreen` (after the state declarations):

```tsx
const sectionListRef = useRef<SectionList<AgendaItem, AgendaSection>>(null);
```

Replace the agenda placeholder `<View>` with:

```tsx
<SectionList<AgendaItem, AgendaSection>
  ref={sectionListRef}
  sections={sections}
  keyExtractor={item => item.key}
  stickySectionHeadersEnabled={false}
  renderSectionHeader={({ section }) => (
    <View style={[
      styles.sectionHeader,
      section.dateStr === todayStr && styles.sectionHeaderToday,
    ]}>
      <Text style={[
        styles.sectionTitle,
        section.dateStr === todayStr && styles.sectionTitleToday,
      ]}>
        {section.title}
      </Text>
    </View>
  )}
  renderItem={({ item, section }) => (
    <TouchableOpacity
      style={[
        styles.agendaRow,
        section.dateStr === todayStr && styles.agendaRowToday,
      ]}
      onPress={() => router.push(`/task/${item.task.line}` as any)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.agendaIcon,
        item.kind === 'event' && styles.agendaIconEvent,
        item.kind === 'completed' && styles.agendaIconDone,
      ]}>
        {item.kind === 'completed' ? '✓' : item.kind === 'event' ? '◆' : '○'}
      </Text>
      <Text
        style={[styles.agendaTitle, item.kind === 'completed' && styles.agendaTitleDone]}
        numberOfLines={1}
      >
        {cleanTitle(item.task.text)}
      </Text>
      {item.time ? (
        <Text style={styles.agendaTime}>{item.time}</Text>
      ) : null}
    </TouchableOpacity>
  )}
  contentContainerStyle={{ paddingBottom: 120 }}
/>
```

- [ ] **Step 2: Add agenda styles to the `StyleSheet.create` block**

Append to the existing styles:

```tsx
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  sectionHeaderToday: {
    backgroundColor: Colors.accent + '11',
  },
  sectionTitle: {
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  sectionTitleToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  agendaRowToday: {
    backgroundColor: Colors.accent + '08',
  },
  agendaIcon: { fontSize: 11, color: Colors.textSecondary, width: 14, textAlign: 'center' },
  agendaIconEvent: { color: Colors.accent },
  agendaIconDone: { color: '#444' },
  agendaTitle: { flex: 1, fontSize: 13, color: Colors.text, fontFamily: Fonts.mono },
  agendaTitleDone: { color: '#444', textDecorationLine: 'line-through' },
  agendaTime: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.mono },
```

- [ ] **Step 3: Verify the agenda renders**

Run: `mobile/scripts/sim.sh`

Confirm:
- Date section headers appear in small caps
- Today's header is accent-colored
- Completed tasks show `✓` with strikethrough
- Events show `◆` in accent
- Incomplete tasks show `○`
- Times appear right-aligned when present
- Tapping a row opens the task detail sheet

- [ ] **Step 4: Commit**

```bash
git add mobile/app/calendar.tsx
git commit -m "feat(calendar): agenda SectionList with date headers and row types"
```

---

### Task 5: Calendar ↔ agenda synchronization

**Files:**
- Modify: `mobile/app/calendar.tsx`

- [ ] **Step 1: Add `scrollToDate` helper and mount-scroll to today**

Add a helper function inside `CalendarScreen` (after the memos):

```tsx
function scrollToDate(dateStr: string) {
  const sectionIndex = sections.findIndex(s => s.dateStr >= dateStr);
  if (sectionIndex < 0) return;
  sectionListRef.current?.scrollToLocation({
    sectionIndex,
    itemIndex: 0,
    animated: true,
    viewOffset: 0,
  });
}
```

Add a `useEffect` to scroll to today on mount (after the `scrollToDate` definition):

```tsx
useEffect(() => {
  const timer = setTimeout(() => scrollToDate(todayStr), 200);
  return () => clearTimeout(timer);
}, []);
```

- [ ] **Step 2: Wire calendar date tap → scroll agenda**

In the `TouchableOpacity` inside the calendar grid, update the `onPress` handler:

```tsx
onPress={() => {
  setSelectedDate(dateStr);
  scrollToDate(dateStr);
}}
```

- [ ] **Step 3: Wire month swipe → jump agenda to first item in new month**

Add a `useEffect` that runs when `calYear` or `calMonth` changes and jumps the agenda:

```tsx
useEffect(() => {
  const monthPrefix = `${calYear}-${pad(calMonth + 1)}`;
  const target = sections.find(s => s.dateStr.startsWith(monthPrefix))
    ?? sections.find(s => s.dateStr >= `${calYear}-${pad(calMonth + 1)}-01`);
  if (!target) return;
  const timer = setTimeout(() => scrollToDate(target.dateStr), 50);
  return () => clearTimeout(timer);
}, [calYear, calMonth, sections]);
```

- [ ] **Step 4: Verify synchronization**

Run: `mobile/scripts/sim.sh`

Confirm:
- On launch, the agenda is scrolled to today
- Tapping a calendar date scrolls the agenda to that date's section
- Swiping the calendar to a new month jumps the agenda to that month's first item

- [ ] **Step 5: Commit**

```bash
git add mobile/app/calendar.tsx
git commit -m "feat(calendar): sync calendar selection and month swipe with agenda scroll"
```

---

### Task 6: Close issue and push

**Files:** none

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Close issue #17**

```bash
gh issue close 17 --comment "Calendar view implemented in mobile/app/calendar.tsx. Replaces Tasks and Events in the menu. Month calendar at top (swipe left/right to change months), scrollable daily agenda below showing completed tasks, incomplete tasks, and event occurrences. Tapping a calendar date or swiping months syncs the agenda."
```
