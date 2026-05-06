# Anniversary & Birthday Year Count Design

**Issue:** [#1](https://github.com/caritos/todo-txt/issues/1)
**Date:** 2026-05-06

## Problem

Users want to save anniversaries and birthdays and have the CLI automatically display how many years have passed (e.g., "42 years"). Generic `type:event` events don't carry enough semantic meaning to trigger this calculation.

## Solution

Introduce `type:anniversary` and `type:birthday` as special type values for the `event` command. When these types are listed, the CLI computes and displays `(N years)` from the `start:` date. Using either type without `start:` is an error.

## Behavior

### Creating

```
todo event "Augusto Caritos's Anniversary start:1984-05-06 frequency:yearly type:anniversary"
→ 2026-05-06 Augusto Caritos's Anniversary start:1984-05-06 frequency:yearly type:anniversary

todo event "John's Birthday start:1990-03-15 frequency:yearly type:birthday"
→ 2026-05-06 John's Birthday start:1990-03-15 frequency:yearly type:birthday
```

### Validation error

```
todo event "My Anniversary type:anniversary"
→ todo: type:anniversary requires a start: date
```

### Display (todo list)

```
 1  Augusto Caritos's Anniversary start:1984-05-06 frequency:yearly (42 years)
 2  John's Birthday start:1990-03-15 frequency:yearly (36 years)
```

Year count = `current year − start year`. If `start:` is absent or the type is neither `anniversary` nor `birthday`, no year count is shown.

## Files

| File | Change |
|------|--------|
| `src/commands/event.ts` | Detect `type:anniversary`/`type:birthday`, require `start:`, strip all type tags and append correct one |
| `src/output.ts` | Add `computeYearCount(task, todayStr)` helper; append result in `formatTask` |
| `tests/commands/event.test.ts` | New tests for anniversary/birthday creation and validation |
| `tests/commands/list.test.ts` | New tests for year count display |

## Implementation Details

### `src/commands/event.ts`

After existing `validateFrequency` and `validateStartEnd` calls:

1. Determine the type tag: scan text for `type:anniversary`, `type:birthday`, or default to `type:event`
2. If type is `anniversary` or `birthday` and `start:` is absent → `console.error` + `process.exit(1)`
3. Strip `type:event`, `type:anniversary`, `type:birthday` from text
4. Append the determined type tag

### `src/output.ts`

New helper (not exported):

```typescript
function computeYearCount(task: Task, todayStr: string): string | undefined {
  const type = task.extensions['type'];
  if (type !== 'anniversary' && type !== 'birthday') return undefined;
  const start = task.extensions['start'];
  if (!start) return undefined;
  const startYear = parseInt(start.slice(0, 4), 10);
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const years = currentYear - startYear;
  if (years <= 0) return undefined;
  return `(${years} years)`;
}
```

In `formatTask`, after `colorText`:

```typescript
const yearCount = computeYearCount(task, todayStr);
const coloredText = colorText(task.text, todayStr);
parts.push(yearCount ? `${coloredText} ${c(A.dim, yearCount)}` : coloredText);
```

## Testing

### `tests/commands/event.test.ts`

- `type:anniversary` with `start:` → writes with `type:anniversary`, no `type:event`
- `type:birthday` with `start:` → writes with `type:birthday`, no `type:event`
- `type:anniversary` without `start:` → exits code 1, stderr contains "requires a start:"
- `type:birthday` without `start:` → exits code 1, stderr contains "requires a start:"
- Plain `todo event` still writes `type:event` (regression)

### `tests/commands/list.test.ts`

- Anniversary event in fixture → list output contains `(42 years)` (or appropriate count)
- Birthday event in fixture → list output contains `(N years)`
- Regular `type:event` → list output does NOT contain `(N years)`
- Anniversary without `start:` in fixture → no `(N years)` shown

## Out of Scope

- Ordinal formatting ("42nd" instead of "42 years")
- Dedicated `todo anniversary` / `todo birthday` commands
- Showing year count on `type:event`
- Warning when anniversary is approaching (due-soon style highlighting)
