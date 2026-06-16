# Deferred Completion UX Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

When a user taps a task checkbox, show a filled checkmark immediately, then commit the completion after 2.5 seconds. Tapping the checkbox again before the timer fires cancels the completion (undo by re-tap). Consistent behavior across all screens where tasks can be checked off.

## Scope

- `mobile/app/done.tsx` — Tasks view (incomplete zone)
- `mobile/app/day/[date].tsx` — Day view (all-day lane + timed pills)

Week view (`timeline.tsx`) has no individual task checkboxes — tapping a pill navigates to the day view — so it is out of scope.

## Architecture

### New: `mobile/src/hooks/usePendingDone.ts`

Single hook that owns all pending-completion state and timer logic.

```
usePendingDone(tasks, todayStr, save, delayMs = 2500)
  → { isPending(line: number): boolean, tapCheckbox(task: Task): void }
```

**Internals:**
- `pendingLines: Set<number>` — React state; drives checkbox visual re-renders
- `timers: Map<number, ReturnType<typeof setTimeout>>` — ref (not state); never triggers renders
- `tapCheckbox(task)`:
  - If `pendingLines.has(task.line)`: cancel timer, remove from set → undo
  - Otherwise: add to set, start timer → on fire: call `applyDone([...tasks], [task.line], todayStr)` + `save(updated)`, remove from set
- `useEffect` cleanup: clear all active timers on unmount so nothing fires after the user navigates away

### Tasks view (`done.tsx`)

- Add `import { applyDone } from '@shared/commands/done'`
- Call `usePendingDone`
- Wrap the decorative `<View style={styles.cb} />` in a `TouchableOpacity` with `hitSlop={8}`
- Render `cbPending` style (accent fill + white ✓) when `isPending(task.line)`, otherwise `cb` (empty square)
- Row `onPress` still navigates to task detail — only the checkbox tap triggers completion

### Day view (`day/[date].tsx`)

- Remove the existing `handleDone` function and its immediate `applyDone` call
- Call `usePendingDone`
- Wire `tapCheckbox` to the existing checkbox `TouchableOpacity` in both the all-day lane and the timed pill
- Same pending visual swap as Tasks view

## Visual States

| State | Size | Fill | Border | Glyph |
|---|---|---|---|---|
| Empty | 17×17 | none | 1.5px `Colors.textSecondary` | — |
| Pending | 17×17 | `Colors.accent` | none | white `✓`, 11px, centered |
| Done (existing, completed zone) | 17×17 | `#333333` | 1.5px `#444444` | `✕`, dimmed |

No animation — instant fill on tap. Flat, consistent with the Braun/Bauhaus aesthetic.

The `pillCb` in the Day view timed pills is smaller (`10×10`). It gets the same treatment scaled down: accent fill + white `✓` at 7px when pending.

## Delay

2500 ms. Not configurable — a single well-chosen value keeps the hook simple.

## Error Handling

If `applyDone` or `save` throws, the task stays as-is (the pending visual has already cleared). No toast or alert — silent failure is acceptable here since the task simply remains in the list and the user can try again.

## Files Changed

| Action | File |
|---|---|
| Create | `mobile/src/hooks/usePendingDone.ts` |
| Modify | `mobile/app/done.tsx` |
| Modify | `mobile/app/day/[date].tsx` |
