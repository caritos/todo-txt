# ICS Import Design

**Issue:** [#5](https://github.com/caritos/todo-txt/issues/5)
**Date:** 2026-05-06

## Overview

A new `todo import <ics-file>` command that reads an `.ics` (iCalendar) file, converts each `VEVENT` to a todo.txt event line, and appends them all to `todo.txt`. Designed to handle full historical exports from Apple Calendar (and other compliant sources).

---

## Command Interface

```
todo import <ics-file>
```

Reads the given `.ics` file, converts each `VEVENT` to a todo.txt event line, and appends all of them to `todo.txt` (respecting the `--file` flag / `TODO_FILE` env var). Prints a summary on completion:

```
Imported 47 events from family.ics → todo.txt
```

**Error cases:**
- File not found → `todo: cannot open '<file>': No such file or directory`
- Not valid ICS → `todo: '<file>' does not appear to be a valid ICS file`
- Zero VEVENTs parsed → `todo: no events found in '<file>'`
- Individual malformed events are skipped with a warning printed to stderr; import continues

---

## ICS → todo.txt Field Mapping

Each `VEVENT` maps to a single todo.txt line. All fields are optional except `SUMMARY`.

| ICS field | todo.txt output |
|---|---|
| `SUMMARY` | task text (the main description) |
| `DTSTART` (date only) | `start:YYYY-MM-DD` |
| `DTSTART` (with time) | `start:YYYY-MM-DDThh:mm` (timezone converted to local) |
| `DTEND` (date only) | `end:YYYY-MM-DD` — omitted if equal to `DTSTART + 1 day` (ICS all-day single-day encoding) |
| `DTEND` (with time) | `end:YYYY-MM-DDThh:mm` |
| `LOCATION` | `location:Value` (spaces → underscores, special chars stripped) |
| `DESCRIPTION` | `description:Value` (newlines and spaces → underscores, truncated to 200 chars) |
| `RRULE:FREQ=` | `frequency:daily\|weekly\|monthly\|yearly` |
| `RRULE:INTERVAL=` | `every:N` |
| `RRULE:BYDAY=` | `frequency-day:M,T,W,Th,F,Sat,Sun` |
| `RRULE:BYMONTHDAY=` | `frequency-month-day:N` |
| `RRULE:BYMONTH=` | `frequency-month:Jan,Feb,...` |
| `RRULE:UNTIL=` | `recur-until:YYYY-MM-DD` (new extension, stored verbatim, not validated) |
| `EXDATE` | `exdate:YYYY-MM-DD,YYYY-MM-DD,...` (new extension, stored verbatim, not validated) |

### Type Auto-Detection

Checked against `SUMMARY`, case-insensitive:

- Contains "birthday" → `type:birthday`
- Contains "anniversary" → `type:anniversary`
- Otherwise → `type:event`

### Creation Date

Set to today (same as `todo event` behavior).

### Example Output Lines

```
# All-day single-day event
2026-05-06 Claire's Birthday start:2017-10-23 type:birthday

# Timed recurring event with EXDATE
2026-05-06 Basketball start:2022-09-29T19:30 end:2022-09-29T21:00 frequency:weekly frequency-day:Th recur-until:2023-07-05 exdate:2022-11-24,2022-12-29 type:event

# Event with location and description
2026-05-06 Review Finances start:2020-09-01 frequency:monthly frequency-month-day:1 recur-until:2022-04-30 location:@computer description:Review_finances_on_personal_capital type:event

# Anniversary
2026-05-06 Wedding Anniversary start:2019-05-01 frequency:yearly recur-until:2024-04-30 type:anniversary
```

---

## Architecture

Follows the existing three-layer pattern:

```
src/commands/import.ts         ← new: ICS parsing + field mapping
src/index.ts                   ← add 'import' case to the switch
src/commands/help.ts           ← document the import command
tests/commands/import.test.ts  ← new test file
```

**Dependency:** `ical.js` added via `bun add ical.js`. Used for parsing only — handles line unfolding, timezone normalization, RRULE parsing, and EXDATE.

**New extensions** (`exdate:` and `recur-until:`) are stored verbatim. No changes to `recurrence.ts` — unrecognized extensions pass through as-is, consistent with existing behavior.

**Write strategy:** collect all mapped raw strings, then append to file in a single `appendFileSync` call.

---

## RRULE Day Mapping

ICS `BYDAY` values map to the app's `frequency-day` values:

| ICS BYDAY | frequency-day |
|---|---|
| `MO` | `M` |
| `TU` | `T` |
| `WE` | `W` |
| `TH` | `Th` |
| `FR` | `F` |
| `SA` | `Sat` |
| `SU` | `Sun` |

ICS `BYMONTH` values (1–12) map to `Jan`, `Feb`, ..., `Dec`.

Positional `BYDAY` values in RRULE (e.g., `1MO` = first Monday, `-1FR` = last Friday) map to `frequency-month-day:first-monday` / `frequency-month-day:last-friday`. Only positions `1`–`5` (first–fifth) and `-1` (last) are supported; events with other positional values (e.g., `-2`) are skipped with a warning.

---

## Testing

Tests in `tests/commands/import.test.ts` use inline ICS fixture strings.

| Scenario | Expected output |
|---|---|
| All-day single-day event | `end:` omitted |
| All-day multi-day event | `start:` and `end:` both present |
| Timed event | `start:YYYY-MM-DDThh:mm end:YYYY-MM-DDThh:mm` |
| Recurring weekly with BYDAY | `frequency:weekly frequency-day:Th` |
| Recurring monthly with BYMONTHDAY | `frequency:monthly frequency-month-day:6` |
| Recurring yearly | `frequency:yearly` |
| RRULE with UNTIL | `recur-until:YYYY-MM-DD` |
| RRULE with INTERVAL | `every:2` |
| EXDATE | `exdate:2022-11-24,2022-12-29` |
| LOCATION with spaces | `location:St._Charles_Hospital` |
| DESCRIPTION multi-line | collapsed to single line |
| DESCRIPTION over 200 chars | truncated |
| SUMMARY contains "Birthday" | `type:birthday` |
| SUMMARY contains "Anniversary" | `type:anniversary` |
| Default type | `type:event` |
| File not found | exits with error |
| Zero events in file | exits with error |
| Malformed VEVENT | skipped, warning printed, rest imported |

---

## Out of Scope

- Recurrence expansion (generating individual occurrences from RRULE) — events are stored as a single line with the recurrence rule intact
- Deduplication — re-running import appends duplicates; user is responsible for managing the file
- `VTODO` components — only `VEVENT` is imported
- `VALARM` (reminders) — dropped
- Attendees / organizer fields — dropped
- `RRULE:COUNT=` — dropped (no equivalent extension; only `UNTIL` is mapped)
