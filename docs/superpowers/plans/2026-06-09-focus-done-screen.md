# Focus Item Count + Done Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add item counts to Focus section headers and build a new Done screen showing tasks completed in the last 30 days.

**Architecture:** The `sectionHeader()` helper is extracted from `focus.tsx` to `mobile/src/utils.ts` so both screens share it. The Done screen is a self-contained `done.tsx` that reads from the existing `TaskContext` with no new shared-layer logic. Navigation is wired through `ViewSwitcher`, `BottomActionBar`, and `_layout.tsx`.

**Tech Stack:** React Native, Expo Router, `SectionList`, existing `TaskContext`, `@shared/utils.addDays`.

---

### Task 1: Extract `sectionHeader` to mobile utils

**Files:**
- Modify: `mobile/src/utils.ts`
- Modify: `mobile/app/focus.tsx`

- [ ] **Step 1: Add `sectionHeader` to `mobile/src/utils.ts`**

Replace the full file contents:

```typescript
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function today(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

export function formatDateLabel(dateStr: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const time = dateStr.length > 10 ? ' ' + dateStr.slice(11, 16) : '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${time}`;
}

function isoDate(d: Date): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

export function sectionHeader(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const tomorrowDate = new Date(todayStr + 'T12:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = isoDate(tomorrowDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yr = d.getFullYear().toString().slice(2);
  if (dateStr === todayStr) return `TODAY  ${m}/${day}/${yr}`;
  if (dateStr === tomorrowStr) return `TOMORROW  ${m}/${day}/${yr}`;
  return `${DAY_NAMES[d.getDay()]!.toUpperCase()}  ${m}/${day}/${yr}`;
}
```

- [ ] **Step 2: Update `focus.tsx` to import `sectionHeader` from utils and remove the local copy**

At the top of `mobile/app/focus.tsx`, change the import line:
```typescript
// Before:
import { today, formatDateLabel } from '../src/utils';

// After:
import { today, formatDateLabel, sectionHeader } from '../src/utils';
```

Then delete these two functions from `focus.tsx` (they are no longer needed locally):
```typescript
// DELETE these from focus.tsx:
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d: Date): string { ... }

function sectionHeader(dateStr: string, todayStr: string): string { ... }
```

- [ ] **Step 3: Verify the app still compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/utils.ts mobile/app/focus.tsx
git commit -m "refactor(mobile): extract sectionHeader to utils"
```

---

### Task 2: Focus screen — item count in section headers

**Files:**
- Modify: `mobile/app/focus.tsx:84-92`

- [ ] **Step 1: Update `renderSectionHeader` in `focus.tsx`**

Find the `renderSectionHeader` prop in the `SectionList` (currently around line 84) and replace it:

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
    <Text style={styles.sectionTitle}>{section.title}</Text>
    <Text style={styles.sectionCount}>
      {section.data.length === 1 ? '1 item' : `${section.data.length} items`}
    </Text>
  </View>
)}
```

- [ ] **Step 2: Update `sectionHeader` style in `focus.tsx` to flex-row with space-between**

Find the `sectionHeader` entry in `StyleSheet.create` and replace:

```typescript
// Before:
sectionHeader: {
  paddingHorizontal: Spacing.md,
  paddingTop: Spacing.md,
  paddingBottom: 4,
  backgroundColor: Colors.background,
},

// After:
sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  paddingHorizontal: Spacing.md,
  paddingTop: Spacing.md,
  paddingBottom: 4,
  backgroundColor: Colors.background,
},
```

- [ ] **Step 3: Add `sectionCount` style**

Add after the `sectionTitle` style entry:

```typescript
sectionCount: {
  fontSize: 10,
  color: '#444444',
  fontFamily: Fonts.mono,
},
```

Also add `Fonts` to the theme import at the top of `focus.tsx`:
```typescript
// Before:
import { Colors, Spacing } from '../src/theme';
// After:
import { Colors, Fonts, Spacing } from '../src/theme';
```

- [ ] **Step 4: Verify with TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/focus.tsx
git commit -m "feat(mobile): add item count to Focus section headers"
```

---

### Task 3: Done screen

**Files:**
- Create: `mobile/app/done.tsx`

- [ ] **Step 1: Create `mobile/app/done.tsx`**

```typescript
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today, sectionHeader } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function frequencyLabel(task: Task): string {
  const f = task.extensions['frequency'];
  return f ? ` · ${f}` : '';
}

function dayLabel(dateStr: string, todayStr: string): string {
  const yesterday = addDays(todayStr, -1);
  if (dateStr === todayStr) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]!;
}

type Section = { title: string; date: string; data: Task[] };

export default function DoneScreen() {
  const { tasks } = useTasks();
  const todayStr = today();

  const sections = useMemo<Section[]>(() => {
    const thirtyDaysAgo = addDays(todayStr, -29);
    const done = tasks
      .filter(t => t.done && t.completionDate && t.completionDate >= thirtyDaysAgo)
      .sort((a, b) => b.completionDate!.localeCompare(a.completionDate!));

    const byDate = new Map<string, Task[]>();
    for (const t of done) {
      const date = t.completionDate!;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(t);
    }

    return [...byDate.entries()].map(([date, data]) => ({
      title: sectionHeader(date, todayStr),
      date,
      data,
    }));
  }, [tasks, todayStr]);

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.line)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length === 1 ? '1 done' : `${section.data.length} done`}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.cbDone}>
              <Text style={styles.cbX}>✕</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{cleanTitle(item.text)}</Text>
              <Text style={styles.meta}>
                {dayLabel(item.completionDate!, todayStr)}{frequencyLabel(item)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing done in the last 30 days.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickySectionHeadersEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: 10,
    color: '#444444',
    fontFamily: Fonts.mono,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  cbDone: {
    width: 17,
    height: 17,
    backgroundColor: '#333333',
    borderWidth: 1.5,
    borderColor: '#444444',
    flexShrink: 0,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbX: {
    fontSize: 9,
    color: '#555555',
    lineHeight: 11,
  },
  content: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
    textDecorationLine: 'line-through',
    textDecorationColor: '#444444',
  },
  meta: {
    fontSize: 11,
    color: '#444444',
    letterSpacing: 0.2,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },
});
```

- [ ] **Step 2: Verify with TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/done.tsx
git commit -m "feat(mobile): add Done screen showing last 30 days of completed tasks"
```

---

### Task 4: Wire up navigation

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`

- [ ] **Step 1: Register `/done` route in `_layout.tsx`**

In `mobile/app/_layout.tsx`, add a `Stack.Screen` for `done` alongside the others:

```typescript
// Add after <Stack.Screen name="report" />:
<Stack.Screen name="done" />
```

- [ ] **Step 2: Add Done to `ViewSwitcher`**

In `mobile/src/components/ViewSwitcher.tsx`, update the `VIEWS` array:

```typescript
// Before:
const VIEWS: View_[] = [
  { label: 'Focus', route: '/focus' },
  { label: 'List', route: '/list' },
  { label: 'Search', route: '/search' },
  { label: 'Report', route: '/report' },
  { label: 'Settings', route: '/settings' },
];

// After:
const VIEWS: View_[] = [
  { label: 'Focus', route: '/focus' },
  { label: 'List', route: '/list' },
  { label: 'Done', route: '/done' },
  { label: 'Search', route: '/search' },
  { label: 'Report', route: '/report' },
  { label: 'Settings', route: '/settings' },
];
```

- [ ] **Step 3: Add Done to `BottomActionBar` route labels**

In `mobile/src/components/BottomActionBar.tsx`, update `ROUTE_LABELS`:

```typescript
// Before:
const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Focus',
  '/list': 'List',
  '/search': 'Search',
  '/report': 'Report',
  '/settings': 'Settings',
};

// After:
const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Focus',
  '/list': 'List',
  '/done': 'Done',
  '/search': 'Search',
  '/report': 'Report',
  '/settings': 'Settings',
};
```

- [ ] **Step 4: Verify with TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx mobile/src/components/ViewSwitcher.tsx mobile/src/components/BottomActionBar.tsx
git commit -m "feat(mobile): wire up Done screen in navigation"
```
