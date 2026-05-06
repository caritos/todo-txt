# Event Scheduling & Frequency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `start:`, `end:`, and `frequency:` extension support to `todo event` and `todo add`, with validation and auto-inject of `end:` from `start:` when omitted.

**Architecture:** A new `src/recurrence.ts` module exports `validateFrequency(text)` which both `add.ts` and `event.ts` call. Event-specific logic (`start:`/`end:` validation, `end:` auto-inject) stays in `event.ts`. All fields are inline todo.txt extensions — no CLI flags, consistent with `add`.

**Tech Stack:** TypeScript, Bun (runtime + test runner), `bun:test`

**Spec:** `docs/superpowers/specs/2026-05-06-event-scheduling-design.md`

---

### Task 1: Create `src/recurrence.ts` with `validateFrequency`

**Files:**
- Create: `src/recurrence.ts`
- Create: `tests/recurrence.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/recurrence.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { validateFrequency } from '../src/recurrence';

const origExit = process.exit;
const origError = console.error;
let lastExitCode: number | undefined;
let lastErrorMsg: string | undefined;

function setup() {
  lastExitCode = undefined;
  lastErrorMsg = undefined;
  (process as any).exit = (code: number) => {
    lastExitCode = code;
    throw new Error('exit:' + code);
  };
  console.error = (msg: string) => { lastErrorMsg = String(msg); };
}

function teardown() {
  (process as any).exit = origExit;
  console.error = origError;
}

function valid(text: string) {
  setup();
  try { validateFrequency(text); } finally { teardown(); }
  expect(lastExitCode).toBeUndefined();
}

function invalid(text: string, msgContains: string) {
  setup();
  try {
    expect(() => validateFrequency(text)).toThrow();
  } finally {
    teardown();
  }
  expect(lastExitCode).toBe(1);
  expect(lastErrorMsg).toContain(msgContains);
}

describe('validateFrequency', () => {
  it('no-ops when no frequency key', () => {
    valid('Buy groceries due:2026-05-10');
  });

  it('no-ops when auxiliary keys present without frequency:', () => {
    valid('Pay bills every:2 frequency-day:M');
  });

  it('accepts frequency:daily', () => {
    valid('Stand-up frequency:daily');
  });

  it('accepts frequency:weekly with frequency-day:', () => {
    valid('Standup frequency:weekly every:1 frequency-day:M,W,F');
  });

  it('accepts frequency:monthly with day number', () => {
    valid('Pay rent frequency:monthly frequency-month-day:6');
  });

  it('accepts frequency:monthly with positional', () => {
    valid('Review frequency:monthly frequency-month-day:first-monday');
  });

  it('accepts frequency:monthly with last positional', () => {
    valid('Review frequency:monthly frequency-month-day:last-friday');
  });

  it('accepts frequency:monthly with weekend-day positional', () => {
    valid('Rest frequency:monthly frequency-month-day:first-weekend-day');
  });

  it('accepts frequency:yearly with month', () => {
    valid('Birthday frequency:yearly frequency-month:May');
  });

  it('accepts frequency:yearly with month and positional', () => {
    valid('Holiday frequency:yearly frequency-month:May frequency-month-day:last-weekend-day');
  });

  it('accepts every: as positive integer', () => {
    valid('Standup frequency:weekly every:2 frequency-day:M');
  });

  it('rejects invalid frequency: value', () => {
    invalid('Task frequency:hourly', "invalid frequency 'hourly'");
  });

  it('rejects every: of zero', () => {
    invalid('Task frequency:daily every:0', "invalid every '0'");
  });

  it('rejects every: of negative', () => {
    invalid('Task frequency:daily every:-1', "invalid every '-1'");
  });

  it('rejects every: non-integer', () => {
    invalid('Task frequency:daily every:1.5', "invalid every '1.5'");
  });

  it('rejects invalid frequency-day: value', () => {
    invalid('Task frequency:weekly frequency-day:Mon', "invalid frequency-day value 'Mon'");
  });

  it('rejects frequency-month-day: number out of range', () => {
    invalid('Task frequency:monthly frequency-month-day:32', "invalid frequency-month-day '32'");
  });

  it('rejects frequency-month-day: bad positional position', () => {
    invalid('Task frequency:monthly frequency-month-day:sixth-monday', "invalid frequency-month-day 'sixth-monday'");
  });

  it('rejects frequency-month-day: bad positional day type', () => {
    invalid('Task frequency:monthly frequency-month-day:first-blah', "invalid frequency-month-day 'first-blah'");
  });

  it('rejects invalid frequency-month: value', () => {
    invalid('Task frequency:yearly frequency-month:Smarch', "invalid frequency-month 'Smarch'");
  });

  it('accepts frequency-month-day: day boundary values 1 and 31', () => {
    valid('Task frequency:monthly frequency-month-day:1');
    valid('Task frequency:monthly frequency-month-day:31');
  });

  it('accepts all valid frequency-day values', () => {
    valid('Task frequency:weekly frequency-day:M,T,W,Th,F,Sat,Sun');
  });

  it('accepts fifth positional', () => {
    valid('Task frequency:monthly frequency-month-day:fifth-monday');
  });

  it('accepts weekday and day positionals', () => {
    valid('Task frequency:monthly frequency-month-day:first-weekday');
    valid('Task frequency:monthly frequency-month-day:last-day');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/recurrence.test.ts
```

Expected: error — `Cannot find module '../src/recurrence'`

- [ ] **Step 3: Create `src/recurrence.ts`**

```typescript
const VALID_FREQUENCY = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const VALID_FREQ_DAY = new Set(['M', 'T', 'W', 'Th', 'F', 'Sat', 'Sun']);
const VALID_FREQ_MONTH = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const VALID_POSITIONS = new Set(['first', 'second', 'third', 'fourth', 'fifth', 'last']);
const VALID_DAY_TYPES = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'day', 'weekday', 'weekend-day']);

function extractFreqExts(text: string): Record<string, string> {
  const exts: Record<string, string> = {};
  for (const m of text.matchAll(/(?:^|\s)(\w[\w-]*):([^/\s]\S*)/g)) {
    exts[m[1]!] = m[2]!;
  }
  return exts;
}

export function validateFrequency(text: string): void {
  const exts = extractFreqExts(text);
  if (!('frequency' in exts)) return;

  const freq = exts['frequency']!;
  if (!VALID_FREQUENCY.has(freq)) {
    console.error(`todo: invalid frequency '${freq}'. Must be: daily, weekly, monthly, yearly`);
    process.exit(1);
  }

  if ('every' in exts) {
    const n = Number(exts['every']);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`todo: invalid every '${exts['every']}'. Must be a positive integer`);
      process.exit(1);
    }
  }

  if ('frequency-day' in exts) {
    for (const day of exts['frequency-day']!.split(',')) {
      if (!VALID_FREQ_DAY.has(day)) {
        console.error(`todo: invalid frequency-day value '${day}'. Must be: M, T, W, Th, F, Sat, Sun`);
        process.exit(1);
      }
    }
  }

  if ('frequency-month-day' in exts) {
    const val = exts['frequency-month-day']!;
    const asNum = Number(val);
    if (!isNaN(asNum)) {
      if (!Number.isInteger(asNum) || asNum < 1 || asNum > 31) {
        console.error(`todo: invalid frequency-month-day '${val}'. Day must be 1–31`);
        process.exit(1);
      }
    } else {
      const dashIdx = val.indexOf('-');
      const position = val.slice(0, dashIdx);
      const dayType = val.slice(dashIdx + 1);
      if (!VALID_POSITIONS.has(position) || !VALID_DAY_TYPES.has(dayType)) {
        console.error(`todo: invalid frequency-month-day '${val}'. Must be 1–31 or {first|second|third|fourth|fifth|last}-{monday|...|day|weekday|weekend-day}`);
        process.exit(1);
      }
    }
  }

  if ('frequency-month' in exts) {
    for (const month of exts['frequency-month']!.split(',')) {
      if (!VALID_FREQ_MONTH.has(month)) {
        console.error(`todo: invalid frequency-month '${month}'. Must be: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec`);
        process.exit(1);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/recurrence.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/recurrence.ts tests/recurrence.test.ts
git commit -m "feat: add validateFrequency for frequency extension validation"
```

---

### Task 2: Add `start:`/`end:` validation and auto-inject to `event.ts`

**Files:**
- Modify: `src/commands/event.ts`
- Modify: `tests/commands/event.test.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/event.test.ts`**

Append these test cases to the existing `describe('event command', ...)` block:

```typescript
  test('writes timed event with start: and end:', () => {
    run(['--file', todoFile, 'event', 'Standup start:2026-05-10T09:00 end:2026-05-10T09:30']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10T09:00');
    expect(content).toContain('end:2026-05-10T09:30');
    expect(content).toContain('type:event');
  });

  test('auto-injects end: equal to start: when start: present but end: absent', () => {
    run(['--file', todoFile, 'event', 'Birthday party start:2026-05-10']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).toContain('end:2026-05-10');
    expect(content).toContain('type:event');
  });

  test('does not inject end: when both start: and end: are given', () => {
    run(['--file', todoFile, 'event', 'Conference start:2026-05-10 end:2026-05-12']);
    const content = readFileSync(todoFile, 'utf8');
    const matches = content.match(/end:/g);
    expect(matches).toHaveLength(1);
    expect(content).toContain('end:2026-05-12');
  });

  test('does not inject end: when no start: given', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).not.toContain('end:');
  });

  test('exits with error for invalid start: format', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Meeting start:05/10/2026']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid start");
  });

  test('exits with error for invalid end: format', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Meeting start:2026-05-10 end:9am']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid end");
  });

  test('accepts all-day event with date-only start: and end:', () => {
    const { code } = run(['--file', todoFile, 'event', 'Holiday start:2026-05-10 end:2026-05-12']);
    expect(code).toBe(0);
  });

  test('accepts timed event with datetime start: and end:', () => {
    const { code } = run(['--file', todoFile, 'event', 'Meeting start:2026-05-10T09:00 end:2026-05-10T10:00']);
    expect(code).toBe(0);
  });

  test('accepts valid frequency extensions', () => {
    const { code } = run(['--file', todoFile, 'event', 'Standup start:2026-05-10T09:00 frequency:weekly frequency-day:M,W,F']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:weekly');
    expect(content).toContain('frequency-day:M,W,F');
  });

  test('exits with error for invalid frequency: value', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Task frequency:hourly']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid frequency");
  });
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
bun test tests/commands/event.test.ts
```

Expected: existing tests pass, new tests fail with incorrect behavior

- [ ] **Step 3: Update `src/commands/event.ts`**

Replace the entire file:

```typescript
import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { validateFrequency } from '../recurrence';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function getExtValue(text: string, key: string): string | undefined {
  for (const m of text.matchAll(/(?:^|\s)(\w[\w-]*):([^/\s]\S*)/g)) {
    if (m[1] === key) return m[2];
  }
  return undefined;
}

function validateStartEnd(text: string): void {
  for (const key of ['start', 'end']) {
    const val = getExtValue(text, key);
    if (val !== undefined && !DATE_RE.test(val) && !DATETIME_RE.test(val)) {
      console.error(`todo: invalid ${key} '${val}'. Must be YYYY-MM-DD or YYYY-MM-DDThh:mm`);
      process.exit(1);
    }
  }
}

function injectEnd(text: string): string {
  const startVal = getExtValue(text, 'start');
  const endVal = getExtValue(text, 'end');
  if (startVal !== undefined && endVal === undefined) {
    return `${text} end:${startVal}`;
  }
  return text;
}

export function eventCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo event <text>');
    process.exit(1);
  }

  let text = textParts.join(' ');
  validateFrequency(text);
  validateStartEnd(text);
  text = injectEnd(text);

  const todayStr = today();
  const normalized = text.replace(/\s*\btype:event\b/g, '').trim();
  const raw = `${todayStr} ${normalized} type:event`;

  appendFileSync(filePath, raw + '\n', 'utf8');

  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test tests/commands/event.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/commands/event.ts tests/commands/event.test.ts
git commit -m "feat: add start/end validation and end auto-inject to event command"
```

---

### Task 3: Add frequency validation to `add.ts`

**Files:**
- Modify: `src/commands/add.ts`
- Modify: `tests/commands/add.test.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/add.test.ts`**

Append these test cases to the existing `describe('add command', ...)` block:

```typescript
  test('accepts task with valid frequency extensions', () => {
    const { code } = run(['--file', todoFile, 'add', 'Pay bills frequency:monthly frequency-month-day:10']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:monthly');
    expect(content).toContain('frequency-month-day:10');
  });

  test('exits with error for invalid frequency: value on add', () => {
    const { stderr, code } = run(['--file', todoFile, 'add', 'Task frequency:hourly']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid frequency");
  });

  test('exits with error for invalid every: value on add', () => {
    const { stderr, code } = run(['--file', todoFile, 'add', 'Task frequency:daily every:0']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid every");
  });

  test('passes through auxiliary frequency keys without frequency: key', () => {
    const { code } = run(['--file', todoFile, 'add', 'Task every:2']);
    expect(code).toBe(0);
  });
```

Note: the `readFileSync` import is already present in `tests/commands/add.test.ts`.

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
bun test tests/commands/add.test.ts
```

Expected: existing tests pass, new frequency tests fail

- [ ] **Step 3: Add `validateFrequency` call to `src/commands/add.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { validateFrequency } from '../recurrence';
```

Then add a call to `validateFrequency(text)` immediately after the line `const text = textParts.join(' ');`:

```typescript
  const text = textParts.join(' ');
  validateFrequency(text);
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test tests/commands/add.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/commands/add.ts tests/commands/add.test.ts
git commit -m "feat: validate frequency extensions in add command"
```

---

### Task 4: Update help text

**Files:**
- Modify: `src/commands/help.ts`
- Modify: `tests/commands/help.test.ts`

- [ ] **Step 1: Add failing test to `tests/commands/help.test.ts`**

Append to the existing `describe('help command', ...)` block:

```typescript
  test('documents start: and end: extensions', () => {
    const { stdout } = run('help');
    expect(stdout).toContain('start:');
    expect(stdout).toContain('end:');
  });

  test('documents frequency: extension', () => {
    const { stdout } = run('help');
    expect(stdout).toContain('frequency:');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/commands/help.test.ts
```

Expected: new tests fail

- [ ] **Step 3: Update `src/commands/help.ts`**

Replace the `help` string in `helpCommand()` with:

```typescript
  const help = `Usage: todo <command> [options]

Commands:
  add <text>          Add a new task (creation date stamped automatically)
  event <text>        Add a new event (creation date stamped, tagged type:event)
  list [filters]      List open tasks. Filters: +project @context (A) keyword
  listall [filters]   List all tasks including completed
  done <n>            Mark task #n complete
  rm <n>              Delete task #n permanently
  pri <n> <A-Z>       Set priority on task #n
  depri <n>           Remove priority from task #n
  search <term>       Full-text search across all tasks
  report              Stats: counts, by project/context, completed today/week

Options:
  --file <path>       Use a specific todo.txt file (overrides TODO_FILE env)

Scheduling extensions (for event and add):
  start:<date>        Start date: YYYY-MM-DD (all-day) or YYYY-MM-DDThh:mm (timed)
  end:<date>          End date: same format. Auto-set to start: if omitted on events.
  frequency:<freq>    Recurrence: daily | weekly | monthly | yearly
  every:<n>           Repeat every N units (default 1)
  frequency-day:<days>        Weekly days: M,T,W,Th,F,Sat,Sun (comma-separated)
  frequency-month-day:<val>   Monthly/yearly day: 1-31 or first-monday, last-weekend-day, etc.
  frequency-month:<months>    Yearly months: Jan,Feb,... (comma-separated)

Examples:
  todo add "Fix login bug +backend @work due:2026-05-10"
  todo add "(A) Urgent task"
  todo add "Pay bills frequency:monthly frequency-month-day:10"
  todo event "Team standup +work @office"
  todo event "Birthday party start:2026-05-10"
  todo event "Standup start:2026-05-10T09:00 end:2026-05-10T09:30 frequency:weekly frequency-day:M,W,F"
  todo event "Book club start:2026-05-06 frequency:monthly frequency-month-day:first-tuesday"
  todo list type:event
  todo list +backend
  todo list @work (B)
  todo done 3
  todo pri 5 A`;
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test tests/commands/help.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/commands/help.ts tests/commands/help.test.ts
git commit -m "docs: document start/end and frequency extensions in help"
```
