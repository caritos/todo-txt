# Overdue Task Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make overdue tasks visually distinct in the Week/Focus view — accent-colored title, strikethrough date, and "↑ overdue" label.

**Architecture:** Single change to `TaskRow.tsx`. The `isOverdue` prop already exists and is passed from `focus.tsx`; this plan only changes how the component renders when that prop is true.

**Tech Stack:** React Native, `StyleSheet`, existing `Colors` and `Fonts` tokens from `mobile/src/theme.ts`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `mobile/src/components/TaskRow.tsx` | Add overdue title color + mixed-style meta line |

---

## Task 1: Apply overdue styling to TaskRow

**Files:**
- Modify: `mobile/src/components/TaskRow.tsx`

No unit tests: this is pure React Native visual styling with no extractable logic.

- [ ] **Step 1: Read the current file**

Read `mobile/src/components/TaskRow.tsx` to confirm the exact current content before editing.

- [ ] **Step 2: Replace the component body and styles**

Replace the `TaskRow` function and its `StyleSheet.create` block with the following. The only lines that change are the `title` Text style, the meta rendering block, and three new style entries.

**New `TaskRow` function** (replace lines 34–56):

```tsx
export function TaskRow({ task, dateLabel, recurrenceLabel, isOverdue, onPress, onDone, onDelete }: Props) {
  const title = cleanTitle(task.text);
  const meta = [dateLabel, recurrenceLabel].filter(Boolean).join('   ');

  return (
    <Swipeable
      renderRightActions={() => <RightActions onDone={onDone} onDelete={onDelete} />}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.row}>
        <View style={[styles.checkbox, isOverdue && styles.checkboxOverdue]} />
        <View style={styles.content}>
          <Text style={[styles.title, isOverdue && styles.titleOverdue]} numberOfLines={3}>{title}</Text>
          {isOverdue ? (
            <Text style={styles.meta}>
              {dateLabel ? <Text style={styles.metaStrike}>{dateLabel}</Text> : null}
              <Text style={styles.metaOverdue}>{dateLabel ? ' ↑ overdue' : '↑ overdue'}</Text>
              {recurrenceLabel ? <Text>{'   '}{recurrenceLabel}</Text> : null}
            </Text>
          ) : (
            meta ? <Text style={styles.meta}>{meta}</Text> : null
          )}
        </View>
        {task.priority ? (
          <Text style={styles.priority}>{task.priority}</Text>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
}
```

**New styles** — add these three entries to `StyleSheet.create({...})`, alongside the existing entries:

```ts
  titleOverdue: { color: Colors.accent },
  metaStrike: { fontSize: 11, color: '#555555', textDecorationLine: 'line-through', letterSpacing: 0.2 },
  metaOverdue: { fontSize: 11, color: Colors.accent, letterSpacing: 0.2 },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "TaskRow"
```

Expected: no output (no errors in TaskRow.tsx).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/TaskRow.tsx
git commit -m "feat(focus): overdue tasks show accent title and strikethrough date"
```

---

## Manual Test Checklist

After Metro hot-reloads:

- [ ] An overdue task (past `start:` date) shows its title in `#E8461A` accent color
- [ ] The meta line shows the date with strikethrough + ` ↑ overdue` in accent
- [ ] If the task has a recurrence label, it still appears after the overdue label
- [ ] If the task has no `dateLabel`, only `↑ overdue` shows (no stray strikethrough)
- [ ] A normally-scheduled task (today or future) is completely unchanged — white title, plain date
- [ ] Checkbox border is still accent on overdue tasks (pre-existing, should be untouched)
