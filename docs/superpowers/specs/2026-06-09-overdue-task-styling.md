# Overdue Task Styling

**Date:** 2026-06-09

Overdue tasks in the Week/Focus view get a high-contrast visual treatment so they stand out clearly from normally-scheduled tasks.

---

## Scope

One file: `mobile/src/components/TaskRow.tsx`. No shared layer changes, no new components.

---

## Changes

### Title color

When `isOverdue` is true, the task title text renders in `Colors.accent` (`#E8461A`) instead of `Colors.text` (`#F0F0F0`).

```
isOverdue  → title color: Colors.accent
otherwise  → title color: Colors.text  (unchanged)
```

### Meta line

When `isOverdue` is false the meta line renders exactly as today: a single `<Text>` with `dateLabel` and `recurrenceLabel` joined by spaces.

When `isOverdue` is true, the meta line uses inline `<Text>` nodes for mixed styling:

1. **Date portion** (`dateLabel`): `textDecorationLine: 'line-through'`, color `#555555`
2. **Overdue label**: ` ↑ overdue` in `Colors.accent`, same 11px size
3. **Recurrence label** (if present): unchanged, `Colors.textSecondary`, preceded by three spaces

If `dateLabel` is absent, just render `↑ overdue` in `Colors.accent` with no strikethrough portion.

### Checkbox border

Already renders in `Colors.accent` when overdue (`checkboxOverdue` style). No change needed.

---

## Non-goals

- No changes to `EventPill` (events don't use `isOverdue`)
- No changes to the Done screen, List screen, or any other view
- No animation or badge count
