# ICS Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `todo import <ics-file>` command that converts Apple Calendar (and standard iCalendar) events into todo.txt event lines.

**Architecture:** `src/commands/import.ts` contains all parsing and mapping logic. It uses `ical.js` to decode the ICS file, then a private `mapVevent()` function converts each `VEVENT` to a raw todo.txt line string. `importCommand()` handles file I/O, error reporting, and appending. Tests go through the CLI (same `spawnSync` pattern as other command tests). Each task writes failing tests first, then implements.

**Tech Stack:** Bun / TypeScript, `ical.js` for ICS parsing.

---

### Task 1: Add ical.js dependency

**Files:**
- Modify: `package.json` (automated by bun)
- Modify: `bun.lock` (automated by bun)

- [ ] **Step 1: Install the package**

```bash
bun add ical.js
```

Expected: `ical.js` in `dependencies` in `package.json`.

- [ ] **Step 2: Verify bun can resolve the types**

```bash
bun run -e "import ICAL from 'ical.js'; console.log(typeof ICAL.parse)"
```

Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add ical.js dependency for ICS import"
```

---

### Task 2: Scaffold import command and wire to router

**Files:**
- Create: `src/commands/import.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create `src/commands/import.ts` stub**

```typescript
export function importCommand(_filePath: string, _args: string[]): void {
  console.error('todo: import not yet implemented');
  process.exit(1);
}
```

- [ ] **Step 2: Add import case to `src/index.ts`**

Add this import at the top of `src/index.ts` with the other command imports:

```typescript
import { importCommand } from './commands/import';
```

Add this case to the switch statement (before `default:`):

```typescript
  case 'import': {
    importCommand(filePath, filteredArgs.slice(1));
    break;
  }
```

- [ ] **Step 3: Verify routing works**

```bash
bun run ./src/index.ts import
```

Expected stderr: `todo: import not yet implemented`

- [ ] **Step 4: Commit**

```bash
git add src/commands/import.ts src/index.ts
git commit -m "chore: scaffold import command and wire to router"
```

---

### Task 3: TDD — error handling

**Files:**
- Create: `tests/commands/import.test.ts`
- Modify: `src/commands/import.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/commands/import.test.ts`:

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

describe('import command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('exits with error if no ics file argument given', () => {
    const { stderr, code } = run(['--file', todoFile, 'import']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if ics file does not exist', () => {
    const { stderr, code } = run(['--file', todoFile, 'import', '/nonexistent/path.ics']);
    expect(code).toBe(1);
    expect(stderr).toContain('No such file');
  });

  test('exits with error if file is not valid ICS', () => {
    const badPath = join(dir, 'bad.ics');
    writeFileSync(badPath, 'this is not ics content', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', badPath]);
    expect(code).toBe(1);
    expect(stderr).toContain('does not appear to be a valid ICS file');
  });

  test('exits with error if ICS file has no VEVENT components', () => {
    const emptyIcs = join(dir, 'empty.ics');
    writeFileSync(emptyIcs, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//Test//EN\r\nEND:VCALENDAR\r\n', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', emptyIcs]);
    expect(code).toBe(1);
    expect(stderr).toContain('no events found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/commands/import.test.ts
```

Expected: all 4 tests fail (stub outputs "not yet implemented").

- [ ] **Step 3: Implement error handling in `src/commands/import.ts`**

Replace the entire file contents:

```typescript
import { readFileSync, appendFileSync } from 'fs';
import ICAL from 'ical.js';
import { today } from '../output';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const BYDAY_SHORT: Record<string, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'Th', FR: 'F', SA: 'Sat', SU: 'Sun',
};

const BYDAY_FULL: Record<string, string> = {
  MO: 'monday', TU: 'tuesday', WE: 'wednesday', TH: 'thursday',
  FR: 'friday', SA: 'saturday', SU: 'sunday',
};

function positionName(n: number): string | undefined {
  if (n === -1) return 'last';
  const names = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
  return n >= 1 && n <= 5 ? names[n - 1] : undefined;
}

function formatIcalTime(t: ICAL.Time): string {
  if (t.isDate) return t.toString();
  const js = t.toJSDate();
  const yyyy = js.getFullYear();
  const mm = String(js.getMonth() + 1).padStart(2, '0');
  const dd = String(js.getDate()).padStart(2, '0');
  const hh = String(js.getHours()).padStart(2, '0');
  const min = String(js.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function sanitizeExtValue(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\w@._:,/-]/g, '').slice(0, 200);
}

function detectType(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes('birthday')) return 'birthday';
  if (lower.includes('anniversary')) return 'anniversary';
  return 'event';
}

function mapRrule(_rrule: ICAL.Recur): string[] {
  return []; // implemented in Task 5
}

function mapVevent(_vevent: ICAL.Component, _todayStr: string): string | null {
  return null; // implemented in Task 4
}

export function importCommand(filePath: string, args: string[]): void {
  const icsPath = args[0];
  if (!icsPath) {
    console.error('Usage: todo import <ics-file>');
    process.exit(1);
  }

  let icsData: string;
  try {
    icsData = readFileSync(icsPath, 'utf8');
  } catch {
    console.error(`todo: cannot open '${icsPath}': No such file or directory`);
    process.exit(1);
  }

  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(icsData));
  } catch {
    console.error(`todo: '${icsPath}' does not appear to be a valid ICS file`);
    process.exit(1);
  }

  const vevents = comp.getAllSubcomponents('vevent');
  if (vevents.length === 0) {
    console.error(`todo: no events found in '${icsPath}'`);
    process.exit(1);
  }

  const todayStr = today();
  const lines: string[] = [];

  for (const vevent of vevents) {
    const line = mapVevent(vevent, todayStr);
    if (line === null) {
      console.error(`todo: skipping malformed event`);
    } else {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    console.error(`todo: no valid events found in '${icsPath}'`);
    process.exit(1);
  }

  appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');

  const basename = icsPath.split('/').pop() ?? icsPath;
  console.log(`Imported ${lines.length} event${lines.length === 1 ? '' : 's'} from ${basename} → ${filePath}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/commands/import.test.ts
```

Expected: all 4 error-handling tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/import.ts tests/commands/import.test.ts
git commit -m "feat: add import command with error handling"
```

---

### Task 4: TDD — core field mapping (SUMMARY, DTSTART, DTEND, type detection)

**Files:**
- Modify: `tests/commands/import.test.ts`
- Modify: `src/commands/import.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/import.test.ts`**

Add a helper function at the top of the describe block (after the `afterEach`):

```typescript
  function writeIcs(name: string, lines: string[]): string {
    const path = join(dir, name);
    writeFileSync(path, lines.join('\r\n') + '\r\n', 'utf8');
    return path;
  }
```

Then add these tests inside the `describe` block:

```typescript
  test('imports SUMMARY as task text', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team meeting',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('Team meeting');
  });

  test('imports all-day single-day event with start: and no end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Holiday',
      'DTSTART;VALUE=DATE:20260510',
      'DTEND;VALUE=DATE:20260511',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).not.toContain('end:');
  });

  test('imports all-day multi-day event with start: and end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Conference',
      'DTSTART;VALUE=DATE:20260510',
      'DTEND;VALUE=DATE:20260513',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).toContain('end:2026-05-13');
  });

  test('imports timed event with datetime start: and end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Standup',
      'DTSTART:20260506T140000Z',
      'DTEND:20260506T143000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/start:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(content).toMatch(/end:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  test('auto-detects type:birthday from SUMMARY containing "Birthday"', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      "SUMMARY:Claire's Birthday",
      'DTSTART;VALUE=DATE:20261023',
      'DTEND;VALUE=DATE:20261024',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:birthday');
    expect(content).not.toContain('type:event');
  });

  test('auto-detects type:anniversary from SUMMARY containing "Anniversary"', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Wedding Anniversary',
      'DTSTART;VALUE=DATE:20261023',
      'DTEND;VALUE=DATE:20261024',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:anniversary');
    expect(content).not.toContain('type:event');
  });

  test('defaults to type:event for regular events', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Basketball practice',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:event');
    expect(content).not.toContain('type:birthday');
    expect(content).not.toContain('type:anniversary');
  });

  test('prints import count on success', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team meeting',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    const { stdout, code } = run(['--file', todoFile, 'import', icsPath]);
    expect(code).toBe(0);
    expect(stdout).toContain('Imported 1 event');
  });

  test('skips malformed event and imports the rest', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Valid event',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    const { code } = run(['--file', todoFile, 'import', icsPath]);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('Valid event');
  });
```

Also add this import at the top of the test file:

```typescript
import { readFileSync } from 'fs';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/commands/import.test.ts
```

Expected: the new core-mapping tests fail (mapVevent still returns null).

- [ ] **Step 3: Implement `mapVevent` core fields in `src/commands/import.ts`**

Replace the `mapVevent` stub with (EXDATE/LOCATION/DESCRIPTION added in Task 6):

```typescript
function mapVevent(vevent: ICAL.Component, todayStr: string): string | null {
  try {
    const event = new ICAL.Event(vevent);
    const summary = event.summary;
    if (!summary) return null;

    const parts: string[] = [todayStr, summary];

    const dtstart = event.startDate;
    if (dtstart) parts.push(`start:${formatIcalTime(dtstart)}`);

    const dtend = event.endDate;
    if (dtend && dtstart) {
      const isSingleAllDay =
        dtstart.isDate && dtend.isDate &&
        dtend.toJSDate().getTime() - dtstart.toJSDate().getTime() === 86400000;
      if (!isSingleAllDay) parts.push(`end:${formatIcalTime(dtend)}`);
    }

    const rruleProp = vevent.getFirstPropertyValue('rrule') as ICAL.Recur | null;
    if (rruleProp) parts.push(...mapRrule(rruleProp));

    parts.push(`type:${detectType(summary)}`);

    return parts.join(' ');
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/commands/import.test.ts
```

Expected: all tests pass (including error-handling tests from Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/commands/import.ts tests/commands/import.test.ts
git commit -m "feat: implement core ICS field mapping (SUMMARY, DTSTART, DTEND, type)"
```

---

### Task 5: TDD — RRULE mapping

**Files:**
- Modify: `tests/commands/import.test.ts`
- Modify: `src/commands/import.ts`

- [ ] **Step 1: Add failing RRULE tests to `tests/commands/import.test.ts`**

Add inside the `describe` block:

```typescript
  test('maps RRULE FREQ=WEEKLY to frequency:weekly', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Basketball',
      'DTSTART;TZID=America/New_York:20220929T193000',
      'DTEND;TZID=America/New_York:20220929T210000',
      'RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=20230705T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:weekly');
    expect(content).toContain('frequency-day:Th');
    expect(content).toContain('recur-until:2023-07-05');
  });

  test('maps RRULE FREQ=MONTHLY;BYMONTHDAY to frequency:monthly frequency-month-day:N', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Rent due',
      'DTSTART;VALUE=DATE:20200901',
      'DTEND;VALUE=DATE:20200902',
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=1',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:monthly');
    expect(content).toContain('frequency-month-day:1');
  });

  test('maps RRULE FREQ=MONTHLY;BYDAY=1MO to frequency-month-day:first-monday', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team review',
      'DTSTART;VALUE=DATE:20260505',
      'DTEND;VALUE=DATE:20260506',
      'RRULE:FREQ=MONTHLY;BYDAY=1MO',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:monthly');
    expect(content).toContain('frequency-month-day:first-monday');
  });

  test('maps RRULE FREQ=MONTHLY;BYDAY=-1FR to frequency-month-day:last-friday', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Last Friday meeting',
      'DTSTART;VALUE=DATE:20260501',
      'DTEND;VALUE=DATE:20260502',
      'RRULE:FREQ=MONTHLY;BYDAY=-1FR',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:monthly');
    expect(content).toContain('frequency-month-day:last-friday');
  });

  test('maps RRULE FREQ=YEARLY to frequency:yearly', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Annual review',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'RRULE:FREQ=YEARLY',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:yearly');
  });

  test('maps RRULE INTERVAL=2 to every:2', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Biweekly sync',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=M',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:weekly');
    expect(content).toContain('every:2');
  });

  test('maps RRULE FREQ=YEARLY;BYMONTH=5 to frequency-month:May', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Memorial day',
      'DTSTART;VALUE=DATE:20260525',
      'DTEND;VALUE=DATE:20260526',
      'RRULE:FREQ=YEARLY;BYMONTH=5',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:yearly');
    expect(content).toContain('frequency-month:May');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/commands/import.test.ts
```

Expected: the RRULE tests fail (mapRrule returns `[]`).

- [ ] **Step 3: Implement `mapRrule` in `src/commands/import.ts`**

Replace the `mapRrule` stub with:

```typescript
function mapRrule(rrule: ICAL.Recur): string[] {
  const FREQ_MAP: Record<string, string> = {
    DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly',
  };
  const freq = FREQ_MAP[rrule.freq];
  if (!freq) return [];

  const parts: string[] = [`frequency:${freq}`];

  if (rrule.interval && rrule.interval > 1) parts.push(`every:${rrule.interval}`);

  if (rrule.until) parts.push(`recur-until:${rrule.until.toString().slice(0, 10)}`);

  const byday = rrule.parts['BYDAY'] as string[] | undefined;
  if (byday && byday.length > 0) {
    const match = String(byday[0]).match(/^(-?\d+)([A-Z]+)$/);
    if (match) {
      const pos = parseInt(match[1]!);
      const dayCode = match[2]!;
      const position = positionName(pos);
      const dayName = BYDAY_FULL[dayCode];
      if (position && dayName) parts.push(`frequency-month-day:${position}-${dayName}`);
    } else {
      const days = byday.map(d => BYDAY_SHORT[String(d)]).filter((d): d is string => d !== undefined);
      if (days.length > 0) parts.push(`frequency-day:${days.join(',')}`);
    }
  } else {
    const bymonthday = rrule.parts['BYMONTHDAY'] as number[] | undefined;
    if (bymonthday && bymonthday.length > 0) parts.push(`frequency-month-day:${bymonthday[0]}`);
  }

  const bymonth = rrule.parts['BYMONTH'] as number[] | undefined;
  if (bymonth && bymonth.length > 0) {
    const months = bymonth.map(m => MONTH_NAMES[m - 1]).filter((m): m is string => m !== undefined);
    if (months.length > 0) parts.push(`frequency-month:${months.join(',')}`);
  }

  return parts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/commands/import.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/import.ts tests/commands/import.test.ts
git commit -m "feat: implement RRULE mapping for ICS import"
```

---

### Task 6: TDD — EXDATE, LOCATION, DESCRIPTION

**Files:**
- Modify: `tests/commands/import.test.ts`
- Modify: `src/commands/import.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/import.test.ts`**

Add inside the `describe` block:

```typescript
  test('maps EXDATE to exdate: extension with comma-separated dates', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Basketball',
      'DTSTART;TZID=America/New_York:20220929T193000',
      'DTEND;TZID=America/New_York:20220929T210000',
      'RRULE:FREQ=WEEKLY;BYDAY=TH',
      'EXDATE;TZID=America/New_York:20221124T193000',
      'EXDATE;TZID=America/New_York:20221229T193000',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/exdate:2022-11-24[^,\s]*,2022-12-29|exdate:2022-12-29[^,\s]*,2022-11-24/);
  });

  test('maps LOCATION to location: extension with spaces replaced by underscores', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Cardiology Appt',
      'DTSTART;VALUE=DATE:20240123',
      'DTEND;VALUE=DATE:20240124',
      'LOCATION:1741 N Ocean Ave Medford NY',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('location:1741_N_Ocean_Ave_Medford_NY');
  });

  test('maps DESCRIPTION to description: extension with newlines and spaces replaced by underscores', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Review Finances',
      'DTSTART;VALUE=DATE:20200901',
      'DTEND;VALUE=DATE:20200902',
      'DESCRIPTION:Review finances on personal capital',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('description:Review_finances_on_personal_capital');
  });

  test('truncates DESCRIPTION to 200 characters', () => {
    const longDesc = 'A'.repeat(250);
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Long event',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      `DESCRIPTION:${longDesc}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    const match = content.match(/description:(\S+)/);
    expect(match).not.toBeNull();
    expect(match![1]!.length).toBeLessThanOrEqual(200);
  });

  test('omits location: when LOCATION is absent', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Simple event',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).not.toContain('location:');
    expect(content).not.toContain('description:');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/commands/import.test.ts
```

Expected: the new EXDATE/LOCATION/DESCRIPTION tests fail (mapVevent does not yet produce those fields).

- [ ] **Step 3: Add EXDATE, LOCATION, DESCRIPTION to `mapVevent` in `src/commands/import.ts`**

Replace the `mapVevent` function body — add these three blocks between the RRULE block and the `type:` push:

```typescript
    const exdateProps = vevent.getAllProperties('exdate');
    if (exdateProps.length > 0) {
      const dates: string[] = [];
      for (const prop of exdateProps) {
        for (const val of prop.getValues() as ICAL.Time[]) {
          dates.push(val.toString().slice(0, 10));
        }
      }
      if (dates.length > 0) parts.push(`exdate:${dates.join(',')}`);
    }

    const location = vevent.getFirstPropertyValue('location') as string | null;
    if (location) {
      const sanitized = sanitizeExtValue(location);
      if (sanitized) parts.push(`location:${sanitized}`);
    }

    const description = vevent.getFirstPropertyValue('description') as string | null;
    if (description) {
      const sanitized = sanitizeExtValue(description);
      if (sanitized) parts.push(`description:${sanitized}`);
    }
```

The full updated `mapVevent` should now look like:

```typescript
function mapVevent(vevent: ICAL.Component, todayStr: string): string | null {
  try {
    const event = new ICAL.Event(vevent);
    const summary = event.summary;
    if (!summary) return null;

    const parts: string[] = [todayStr, summary];

    const dtstart = event.startDate;
    if (dtstart) parts.push(`start:${formatIcalTime(dtstart)}`);

    const dtend = event.endDate;
    if (dtend && dtstart) {
      const isSingleAllDay =
        dtstart.isDate && dtend.isDate &&
        dtend.toJSDate().getTime() - dtstart.toJSDate().getTime() === 86400000;
      if (!isSingleAllDay) parts.push(`end:${formatIcalTime(dtend)}`);
    }

    const rruleProp = vevent.getFirstPropertyValue('rrule') as ICAL.Recur | null;
    if (rruleProp) parts.push(...mapRrule(rruleProp));

    const exdateProps = vevent.getAllProperties('exdate');
    if (exdateProps.length > 0) {
      const dates: string[] = [];
      for (const prop of exdateProps) {
        for (const val of prop.getValues() as ICAL.Time[]) {
          dates.push(val.toString().slice(0, 10));
        }
      }
      if (dates.length > 0) parts.push(`exdate:${dates.join(',')}`);
    }

    const location = vevent.getFirstPropertyValue('location') as string | null;
    if (location) {
      const sanitized = sanitizeExtValue(location);
      if (sanitized) parts.push(`location:${sanitized}`);
    }

    const description = vevent.getFirstPropertyValue('description') as string | null;
    if (description) {
      const sanitized = sanitizeExtValue(description);
      if (sanitized) parts.push(`description:${sanitized}`);
    }

    parts.push(`type:${detectType(summary)}`);

    return parts.join(' ');
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/commands/import.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/import.ts tests/commands/import.test.ts
git commit -m "feat: add EXDATE, LOCATION, DESCRIPTION mapping to ICS import"
```

---

### Task 7: Update help command

**Files:**
- Modify: `src/commands/help.ts`
- Modify: `tests/commands/help.test.ts`

- [ ] **Step 1: Write the failing test**

Open `tests/commands/help.test.ts` and add this test inside the existing `describe` block:

```typescript
  test('documents the import command', () => {
    const { stdout } = run(['help']);
    expect(stdout).toContain('import');
    expect(stdout).toContain('.ics');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test tests/commands/help.test.ts
```

Expected: the new test fails.

- [ ] **Step 3: Add import to the help text in `src/commands/help.ts`**

In the `help` template string, add after the `event` line:

```
  import <ics-file>   Import events from an iCalendar (.ics) file
```

And add after the existing examples:

```
  todo import family.ics
  todo import --file work.txt meetings.ics
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/commands/help.test.ts
```

Expected: all help tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Smoke test the real ICS file**

Download `family.ics.txt` from the GitHub issue and run:

```bash
cp /path/to/family.ics.txt /tmp/family.ics
bun run ./src/index.ts --file /tmp/out.txt import /tmp/family.ics
wc -l /tmp/out.txt
head -20 /tmp/out.txt
```

Expected: output shows the import count and the first 20 imported lines look correct.

- [ ] **Step 7: Commit**

```bash
git add src/commands/help.ts tests/commands/help.test.ts
git commit -m "feat: document import command in help"
```
