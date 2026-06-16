# Add Form Progressive Disclosure Design

**Date:** 2026-06-16  
**Status:** Approved

## Goal

Redesign `AddTaskModal` to follow Fantastical's progressive disclosure pattern: the form opens in a minimal "title only" state and reveals date, time, repeat, and priority fields behind a "SHOW MORE" tap. This reduces cognitive load for the common case (quick-add a task with no date details) while keeping the full form accessible.

## Collapsed State (always on open)

The modal always resets to collapsed when opened or closed.

```
┌─────────────────────────────────────────┐
│  ✕          TASK  EVENT            Add  │  ← header (unchanged)
├─────────────────────────────────────────┤
│  What needs to be done? .............. │  ← TextInput, auto-focused
│  [tag suggestions row if typing a tag] │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│              SHOW MORE                  │  ← centered, Colors.accent, 11px caps
└─────────────────────────────────────────┘
```

Tapping Add while collapsed creates the task with `start:today` (auto-injected by `buildAddRaw`), no time, no repeat, no priority — sensible defaults for a quick-add.

## Expanded State (after tapping SHOW MORE)

The `SHOW MORE` link disappears; two groups appear in its place. No "Show Less".

### Group 1 — Start

| Row | Default | Behaviour |
|-----|---------|-----------|
| `Start date` + Switch | OFF | Toggle reveals date row + Time sub-toggle + Repeat row |
| `Date` (compact picker) | today | Visible only when Start date ON |
| `Time` + Switch | OFF | Visible only when Start date ON |
| `Time` (compact picker) + ✕ | — | Visible only when both Start date ON and Time ON |
| `Repeat` → `Never` | none | Visible only when Start date ON; taps to expand inline RecurrencePicker |

Toggling Start date OFF hides all sub-rows and resets `repeat` to `none`.

Repeat options (unchanged from current RecurrencePicker): Never / Every Day / Every Week / Every 2 Weeks / Every Month / Every Year.

### Group 2 — Priority (task type only)

Existing chip row: — / A / B / C. Hidden when TASK/EVENT toggle is set to EVENT.

## State Changes

| Field | Type | Default | Reset on close |
|-------|------|---------|----------------|
| `showMore` | boolean | `false` | `false` |
| `hasDate` | boolean | `false` | `false` |
| `hasTime` | boolean | existing | `false` |
| `date`, `time`, `repeat`, `priority` | existing | existing | unchanged |

`reset()` adds `setShowMore(false)` and `setHasDate(false)`.

## handleAdd Logic

```
parts = [title.trim()]

if hasDate:
  dateStr = dateToISO(date)
  startExt = hasTime ? `start:${dateStr}T${HH:MM}` : `start:${dateStr}`
  parts.push(startExt)
  if repeat !== 'none':
    parts.push(recurrenceExtensions(repeat))

if addType === 'event':
  parts.push('type:event')

// If hasDate is false, buildAddRaw auto-injects start:today
```

## Files Changed

- `mobile/src/components/AddTaskModal.tsx` — all changes contained here
- `mobile/src/components/RecurrencePicker.tsx` — no changes

## Out of Scope

- "Custom" repeat (drum-roll picker, On Days, On Week) — future enhancement
- Notes field — not part of todo.txt format
- "Remind me at a location" — not applicable
