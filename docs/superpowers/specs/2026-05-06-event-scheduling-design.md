# Event Scheduling & Frequency Design

**Issue:** [#4](https://github.com/caritos/todo-txt/issues/4)
**Date:** 2026-05-06

## Problem

The `event` command creates events tagged with `type:event`, but provides no structured way to specify scheduling metadata: start/end dates and times, all-day vs timed events, and recurrence. Users need to express these without breaking the todo.txt extension format.

Additionally, recurrence (frequency) is useful on tasks too — not just events.

## Extension Key Design

All fields are optional inline extensions, consistent with how `add` works today (e.g. `due:2026-05-10`).

### Start and End

| Key | Format | Example |
|-----|--------|---------|
| `start:` | `YYYY-MM-DD` (all-day) or `YYYY-MM-DDThh:mm` (timed) | `start:2026-05-10T09:00` |
| `end:` | `YYYY-MM-DD` (all-day) or `YYYY-MM-DDThh:mm` (timed) | `end:2026-05-10T10:00` |

If `start:` is provided but `end:` is absent, `end:` is automatically set to the same value as `start:` (all-day event default).

### Frequency

| Key | Values | Used for |
|-----|--------|----------|
| `frequency:` | `daily\|weekly\|monthly\|yearly` | all |
| `every:` | positive integer (default 1) | all |
| `frequency-day:` | `M,T,W,Th,F,Sat,Sun` (comma-separated) | weekly only |
| `frequency-month-day:` | `1`–`31` or `{first\|second\|third\|fourth\|fifth\|last}-{monday\|tuesday\|wednesday\|thursday\|friday\|saturday\|sunday\|day\|weekday\|weekend-day}` | monthly, yearly |
| `frequency-month:` | `Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec` (comma-separated) | yearly only |

Frequency is optional on both tasks and events. When absent, no validation runs.

## Examples

```
# Timed event, weekly on Mon/Wed/Fri
todo event "Team standup start:2026-05-10T09:00 end:2026-05-10T09:30 frequency:weekly frequency-day:M,W,F"

# All-day event, end: auto-injected
todo event "Birthday party start:2026-05-10"
# written as: 2026-05-10 Birthday party type:event start:2026-05-10 end:2026-05-10

# All-day event, explicit end
todo event "Conference start:2026-05-10 end:2026-05-12"

# Monthly on the 6th
todo event "Rent due start:2026-05-06 frequency:monthly frequency-month-day:6"

# Monthly on the first Monday
todo event "Team review start:2026-05-05T10:00 frequency:monthly frequency-month-day:first-monday"

# Yearly on the last weekend day of May
todo event "Memorial day start:2026-05-25 frequency:yearly frequency-month:May frequency-month-day:last-weekend-day"

# Recurring task (frequency on add)
todo add "Pay bills due:2026-05-10 frequency:monthly frequency-month-day:10"
```

## Behavior

### event command (`src/commands/event.ts`)
1. Call `validateFrequency(text)` — exits with error on invalid frequency extensions
2. Validate `start:` and `end:` format if present — exit with error if malformed
3. If `start:` is present and `end:` is absent, inject `end:<start-value>` into the text
4. Append `type:event` (existing behavior, guarded against duplicates)
5. Write to file

### add command (`src/commands/add.ts`)
1. Call `validateFrequency(text)` — exits with error on invalid frequency extensions
2. Write to file (existing behavior unchanged)

## Files

| File | Change |
|------|--------|
| `src/recurrence.ts` | New — exports `validateFrequency(text: string): void` |
| `src/commands/event.ts` | Call `validateFrequency()`, validate `start:`/`end:`, auto-inject `end:` |
| `src/commands/add.ts` | Call `validateFrequency()` |
| `src/commands/help.ts` | Document `start:`, `end:`, and frequency extensions for both commands |

## Validation Rules

Validation only activates when `frequency:` is present. Auxiliary keys (`every:`, `frequency-day:`, etc.) appearing without `frequency:` pass through as regular extensions with no validation or error.

**`frequency:`** — must be one of `daily`, `weekly`, `monthly`, `yearly`

**`every:`** — must be a positive integer (`>= 1`)

**`frequency-day:`** — comma-separated list; each value must be one of `M`, `T`, `W`, `Th`, `F`, `Sat`, `Sun`

**`frequency-month-day:`** — either:
- Integer `1`–`31`, or
- `{first|second|third|fourth|fifth|last}-{monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|weekday|weekend-day}`

**`frequency-month:`** — comma-separated list; each value must be one of `Jan`, `Feb`, `Mar`, `Apr`, `May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec`

**`start:` / `end:`** — must match `YYYY-MM-DD` or `YYYY-MM-DDThh:mm`

## Testing

### `tests/recurrence.test.ts`
- Valid daily, weekly with days, monthly with day number, monthly with positional, yearly with month, yearly with positional
- Invalid `frequency:` value → error
- Invalid `every:` (non-integer, zero, negative) → error
- Invalid `frequency-day:` value → error
- Invalid `frequency-month-day:` (bad number, bad positional) → error
- Invalid `frequency-month:` value → error
- No frequency keys → passes silently

### `tests/event.test.ts`
- Timed event with `start:` + `end:` → written correctly
- All-day event with `start:` only → `end:` auto-injected equal to `start:`
- All-day event with `start:` + `end:` → written as-is
- Invalid `start:` format → exits with error
- Invalid `end:` format → exits with error
- Event with valid frequency extensions → validates and writes correctly
- Event with no scheduling fields → works unchanged (existing behavior)

### `tests/add.test.ts` (additions)
- `add` with valid frequency extensions → passes through
- `add` with invalid frequency → exits with error

## Out of Scope

- Rendering frequency/start/end fields differently in list output (events and tasks render the same)
- A dedicated `todo events` listing command (use `todo list type:event`)
- Recurrence expansion (generating future occurrences from a frequency rule)
- `calendar:` and `color:` fields (visible in the UI mockup but not part of this issue)
