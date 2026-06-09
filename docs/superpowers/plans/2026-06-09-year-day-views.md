# Year + Day Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Year view (12-month grid with busy-day dots) and a Day view (timeline + all-day section) to the mobile app, connected via tap-to-drill navigation.

**Architecture:** Two new Expo Router screens — `year.tsx` and `day/[date].tsx`. The Year screen reads from `TaskContext` to compute busy counts per day. The Day screen uses absolute positioning inside a fixed-height `ScrollView` container to place timed tasks and the current-time line on a 60px-per-hour timeline. No shared-layer changes needed.

**Tech Stack:** React Native, Expo Router (`useLocalSearchParams`, `router.replace`), existing `TaskContext`, `addDays` from `@shared/utils`.

---

### Task 1: Year screen

**Files:**
- Create: `mobile/app/year.tsx`

- [ ] **Step 1: Create `mobile/app/year.tsx`**

```typescript
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function busyDot(count: number): { size: number; opacity: number } | null {
  if (count === 0) return null;
  if (count <= 2) return { size: 4, opacity: 0.45 };
  if (count <= 5) return { size: 6, opacity: 0.7 };
  return { size: 8, opacity: 1.0 };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function YearScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const [year, setYear] = useState(todayYear);

  const busyCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.done) continue;
      const start = t.extensions['start'];
      if (!start) continue;
      const date = start.slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearTitle}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {MONTH_NAMES.map((monthName, monthIndex) => {
          const firstDay = new Date(year, monthIndex, 1).getDay();
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const cells: (number | null)[] = [
            ...Array(firstDay).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <View key={monthIndex}>
              <View style={styles.monthBlock}>
                <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
                <View style={styles.weekRow}>
                  {DAY_LABELS.map((d, i) => (
                    <Text key={i} style={styles.dayHdr}>{d}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((day, i) => {
                    if (day === null) {
                      return <View key={`empty-${i}`} style={styles.dayCell} />;
                    }
                    const dateStr = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
                    const isToday = dateStr === todayStr;
                    const isPast = dateStr < todayStr;
                    const count = busyCounts.get(dateStr) ?? 0;
                    const dot = busyDot(count);

                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={styles.dayCell}
                        onPress={() => router.push(`/day/${dateStr}` as any)}
                      >
                        <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                          <Text style={[
                            styles.dayNumText,
                            isPast && !isToday && styles.dayNumPast,
                            isToday && styles.dayNumTodayText,
                          ]}>
                            {day}
                          </Text>
                        </View>
                        {dot ? (
                          <View style={[
                            styles.dot,
                            { width: dot.size, height: dot.size, borderRadius: dot.size / 2, opacity: dot.opacity },
                          ]} />
                        ) : (
                          <View style={styles.dotPlaceholder} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.monthSep} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.navBar,
  },
  yearTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  arrow: { padding: Spacing.sm },
  arrowText: { fontSize: 22, color: Colors.textSecondary },
  scroll: { paddingBottom: 120 },
  monthBlock: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8 },
  monthTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: Colors.accent, marginBottom: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 9, color: '#555555', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 3 },
  dayNum: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dayNumToday: { backgroundColor: Colors.accent },
  dayNumText: { fontSize: 12, color: Colors.text },
  dayNumPast: { color: '#444444' },
  dayNumTodayText: { color: '#ffffff', fontWeight: '700' },
  dot: { backgroundColor: Colors.accent, marginTop: 2 },
  dotPlaceholder: { height: 6, marginTop: 2 },
  monthSep: { height: 1, backgroundColor: '#222222', marginHorizontal: 12 },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/year.tsx
git commit -m "feat(mobile): add Year screen with busy-day dots"
```

---

### Task 2: Day screen

**Files:**
- Create: `mobile/app/day/[date].tsx`

- [ ] **Step 1: Create `mobile/app/day/[date].tsx`**

Note: create the `mobile/app/day/` directory first — Expo Router uses the folder as a route segment.

```typescript
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useEffect } from 'react';
import { useTasks } from '../../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../../src/theme';
import { today } from '../../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth() + 1;
  return `${DAY_NAMES[d.getDay()]!.toUpperCase()}  ${m}/${d.getDate()}`;
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function taskTime(task: Task): { hours: number; minutes: number } | null {
  const start = task.extensions['start'];
  if (!start || start.length <= 10) return null;
  const [hStr, mStr] = start.slice(11, 16).split(':');
  return { hours: parseInt(hStr ?? '0', 10), minutes: parseInt(mStr ?? '0', 10) };
}

function topOffset(hours: number, minutes: number): number {
  return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
}

function formatTime(hours: number, minutes: number): string {
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export default function DayScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { tasks } = useTasks();
  const todayStr = today();
  const scrollRef = useRef<ScrollView>(null);

  const dateStr = (Array.isArray(date) ? date[0] : date) ?? todayStr;
  const isToday = dateStr === todayStr;

  useEffect(() => {
    const targetHour = isToday
      ? Math.max(START_HOUR, new Date().getHours() - 2)
      : 8;
    const scrollY = (targetHour - START_HOUR) * HOUR_HEIGHT;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [dateStr, isToday]);

  const { allDay, timed } = useMemo(() => {
    const dayTasks = tasks.filter(t => {
      const start = t.extensions['start'];
      return start && start.slice(0, 10) === dateStr;
    });
    const allDay: Task[] = [];
    const timed: Task[] = [];
    for (const t of dayTasks) {
      if (taskTime(t)) timed.push(t);
      else allDay.push(t);
    }
    timed.sort((a, b) => {
      const ta = taskTime(a)!;
      const tb = taskTime(b)!;
      return ta.hours * 60 + ta.minutes - (tb.hours * 60 + tb.minutes);
    });
    return { allDay, timed };
  }, [tasks, dateStr]);

  const now = new Date();
  const nowTopValue = isToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTopValue !== null && nowTopValue >= 0 && nowTopValue <= TIMELINE_HEIGHT;

  const isEmpty = allDay.length === 0 && timed.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Year</Text>
        </TouchableOpacity>
        <Text style={styles.dayTitle}>{formatDayHeader(dateStr)}</Text>
        <View style={styles.dayNav}>
          <TouchableOpacity onPress={() => router.replace(`/day/${addDays(dateStr, -1)}` as any)}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace(`/day/${addDays(dateStr, 1)}` as any)}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {allDay.length > 0 && (
          <View style={styles.allDaySection}>
            <Text style={styles.allDayHdr}>ALL DAY</Text>
            {allDay.map(task => (
              <View key={task.line} style={styles.allDayRow}>
                <View style={styles.cb} />
                <Text style={styles.allDayTitle}>{cleanTitle(task.text)}</Text>
              </View>
            ))}
          </View>
        )}

        {isEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing scheduled.</Text>
          </View>
        )}

        <View style={{ height: TIMELINE_HEIGHT, position: 'relative' }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
            <View
              key={hour}
              style={[styles.hourLine, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}
            >
              <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
            </View>
          ))}

          {showNow && (
            <View style={[styles.nowLine, { top: nowTopValue! }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}

          {timed.map(task => {
            const t = taskTime(task)!;
            const top = topOffset(t.hours, t.minutes) + 2;
            if (top < 0 || top > TIMELINE_HEIGHT) return null;
            return (
              <View key={task.line} style={[styles.eventPill, { top, left: LABEL_WIDTH, right: 8 }]}>
                <Text style={styles.eventTime}>{formatTime(t.hours, t.minutes)}</Text>
                <Text style={styles.eventTitle} numberOfLines={1}>{cleanTitle(task.text)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.navBar,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 13, color: Colors.accent },
  dayTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, letterSpacing: 1 },
  dayNav: { flexDirection: 'row', gap: Spacing.lg, minWidth: 60, justifyContent: 'flex-end' },
  navArrow: { fontSize: 20, color: Colors.textSecondary },
  scroll: { paddingBottom: 120 },
  allDaySection: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  allDayHdr: {
    fontSize: 9, color: '#555555', letterSpacing: 1.5,
    paddingHorizontal: Spacing.md, paddingTop: 6, paddingBottom: 4,
  },
  allDayRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222222',
  },
  cb: { width: 14, height: 14, borderWidth: 1.5, borderColor: Colors.checkboxBorder, flexShrink: 0 },
  allDayTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, flex: 1 },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },
  hourLine: {
    position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222222',
  },
  hourLabel: {
    width: LABEL_WIDTH, fontSize: 10, color: '#444444',
    fontFamily: Fonts.mono, paddingLeft: Spacing.md, paddingTop: 4,
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', zIndex: 10,
  },
  nowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, marginLeft: 10 },
  nowBar: { flex: 1, height: 1, backgroundColor: Colors.accent },
  eventPill: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  eventTime: { fontSize: 9, color: Colors.accent, fontFamily: Fonts.mono, letterSpacing: 0.5 },
  eventTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/day/
git commit -m "feat(mobile): add Day screen with timeline view"
```

---

### Task 3: Wire navigation

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`

- [ ] **Step 1: Register routes in `_layout.tsx`**

Open `mobile/app/_layout.tsx`. Add two `Stack.Screen` entries alongside the existing ones:

```typescript
// Add after the existing <Stack.Screen> entries:
<Stack.Screen name="year" />
<Stack.Screen name="day/[date]" />
```

- [ ] **Step 2: Add Year to `ViewSwitcher.tsx`**

In `mobile/src/components/ViewSwitcher.tsx`, update VIEWS:

```typescript
// Before:
const VIEWS: View_[] = [
  { label: 'Week', route: '/focus' },
  { label: 'List', route: '/list' },
  { label: 'Search', route: '/search' },
  { label: 'Report', route: '/report' },
  { label: 'Settings', route: '/settings' },
];

// After:
const VIEWS: View_[] = [
  { label: 'Week', route: '/focus' },
  { label: 'Year', route: '/year' },
  { label: 'Done', route: '/done' },
  { label: 'List', route: '/list' },
  { label: 'Search', route: '/search' },
  { label: 'Report', route: '/report' },
  { label: 'Settings', route: '/settings' },
];
```

Note: Done is included here because the focus+done plan adds it — if that plan hasn't been run yet, omit `{ label: 'Done', route: '/done' }` for now.

- [ ] **Step 3: Add Year to `BottomActionBar.tsx`**

In `mobile/src/components/BottomActionBar.tsx`, update ROUTE_LABELS:

```typescript
// Before:
const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Week',
  '/list': 'List',
  '/search': 'Search',
  '/report': 'Report',
  '/settings': 'Settings',
};

// After:
const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Week',
  '/year': 'Year',
  '/done': 'Done',
  '/list': 'List',
  '/search': 'Search',
  '/report': 'Report',
  '/settings': 'Settings',
};
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx
git commit -m "feat(mobile): wire Year and Day routes into navigation"
```

---

### Task 4: Make Week section headers tappable → Day view

**Files:**
- Modify: `mobile/app/focus.tsx`

- [ ] **Step 1: Import `useRouter` and `TouchableOpacity` in focus.tsx**

At the top of `mobile/app/focus.tsx`, update imports:

```typescript
// Before:
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

// After (useRouter is likely already there; add TouchableOpacity if missing):
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
```

- [ ] **Step 2: Use `useRouter` in the component and wrap section header title**

Inside `FocusScreen`, add:
```typescript
const router = useRouter();
```

Then update `renderSectionHeader` to make the title tappable:

```typescript
// Before:
renderSectionHeader={({ section }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{section.title}</Text>
  </View>
)}

// After:
renderSectionHeader={({ section }) => (
  <View style={styles.sectionHeader}>
    <TouchableOpacity onPress={() => router.push(`/day/${section.date}` as any)}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </TouchableOpacity>
  </View>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/focus.tsx
git commit -m "feat(mobile): tap Week section header to open Day view"
```
