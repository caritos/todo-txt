# Add Form Redesign

**Date:** 2026-06-09

Replaces `AddTaskModal` with a Fantastical-inspired structured form. No NL mode. Single form with a Task/Event toggle in the header. Native date/time picking. Inline tag suggestions.

---

## Form Layout

```
┌──────────────────────────────────────────┐
│ ✕        [TASK  EVENT]          Add      │  ← header bar
├──────────────────────────────────────────┤
│ call dentist +health @phone              │  ← title input (JetBrains Mono)
│ +health  +work  +home                    │  ← tag suggestions (if typing + or @)
├──────────────────────────────────────────┤
│ Date              [compact date picker]  │
│ Time                             None    │
├──────────────────────────────────────────┤
│ Repeat                          Never ›  │
│ Priority                 [A] [B] [C] [—] │  ← Task only
└──────────────────────────────────────────┘
```

---

## Header

- **Left:** `✕` dismiss button — gray, 20px, font-weight 300
- **Center:** `TASK | EVENT` segmented toggle — two bordered rectangular segments, no border-radius. Active segment: `Colors.accent` text + border. Inactive: `#555` text + `Colors.separator` border. Left segment has no right border (they share one).
- **Right:** `Add` button — `Colors.accent` when title non-empty; `#444` and non-interactive when title is empty

---

## Title Field

- Full-width, `Fonts.mono` (JetBrains Mono), 15px, `Colors.text`
- `autoFocus` when modal opens
- Placeholder: `"What needs to be done?"` (Task) / `"Event name"` (Event) — color `#444`
- No label above it — the field IS the most prominent element

---

## Tag Suggestions Strip

Shown when the last word in the title starts with `+` or `@`.

- **Source:** All unique `+project` and `@context` tags found in `task.text` across the full task list (via regex)
- **Filter:** Tags that start with the partial word (case-insensitive); e.g. typing `+he` shows `+health` but not `+work`
- **Layout:** Horizontal `ScrollView` row with rectangular bordered chips (no border-radius), `#141414` background
- **On tap:** Replace the partial word in the title with the selected tag + a trailing space, return focus to the text input
- **Hidden when:** No partial tag word at the end, or no matching tags

---

## Field Rows

All rows share the same structure: left label (gray `#888`, 14px, flex 1) + right value. Value color: `Colors.accent` if set, `#333` for empty/default state.

Group 1 — Date + Time:

| Row | Default | Interaction |
|-----|---------|-------------|
| Date | today (always set) | `DateTimePicker mode="date" display="compact"` rendered inline |
| Time | None | Tap "None" → `hasTime = true`, shows compact picker + `✕` clear button |

Group 2 — Repeat + Priority:

| Row | Default | Mode | Interaction |
|-----|---------|------|-------------|
| Repeat | Never | Both | Tap → inline `RecurrencePicker` expands below; tapping any option collapses it |
| Priority | `—` (none) | Task only | Four chips `A B C —`; tap to select; `—` means no priority |

---

## todo.txt Raw String Mapping

| Field | todo.txt output |
|-------|-----------------|
| Title text | verbatim (includes `+project` `@context` typed inline) |
| Priority A/B/C | `(A)` / `(B)` / `(C)` prefix |
| Date | `start:YYYY-MM-DD` |
| Date + Time | `start:YYYY-MM-DDTHH:MM` (replaces date-only) |
| Repeat | `frequency:daily` / `frequency:weekly` / etc. via `recurrenceExtensions()` |
| Event type | `type:event` extension |

Assembly before calling `buildAddRaw`:
```
parts = [title.trim(), startExt, ...freqExt, ...typeExt]
text = priority !== 'none' ? `(${priority}) ${parts.join(' ')}` : parts.join(' ')
raw = buildAddRaw(text, todayStr)
```

`buildAddRaw` from `@shared/commands/add` handles:
- Frequency validation (throws on bad values)
- Injecting the creation date prefix (`YYYY-MM-DD` at start of line)
- Moving `(A)` priority to the front
- It will NOT inject `start:today` because we always provide `start:` ourselves

---

## Dependencies

- New: `@react-native-community/datetimepicker` — `display="compact"` gives a native iOS inline date/time control that matches the Fantastical-style tap-to-edit row
- Install via: `cd mobile && npx expo install @react-native-community/datetimepicker`
- **Requires a dev client rebuild** after install: `mobile/scripts/sim.sh`

---

## Files Changed

- `mobile/src/components/AddTaskModal.tsx` — complete rewrite (existing file)
- `mobile/src/components/RecurrencePicker.tsx` — add `recurrenceLabel()` export
- `mobile/package.json` — `@react-native-community/datetimepicker` added by `npx expo install`

---

## Out of Scope

- NL mode (removed entirely — no migration needed)
- Due date field (removed)
- Quick-char buttons (removed)
- Changes to recurrence options (existing `RecurrencePicker` kept as-is)
