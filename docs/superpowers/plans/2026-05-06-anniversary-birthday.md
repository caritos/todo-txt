# Anniversary & Birthday Year Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `type:anniversary` and `type:birthday` in `todo event`, requiring `start:`, and display `(N years)` in list output computed from the start year.

**Architecture:** Two isolated changes — `event.ts` gains type detection and validation; `output.ts` gains a `computeYearCount` helper used in `formatTask`. No new files needed.

**Tech Stack:** TypeScript, Bun (runtime + test runner), `bun:test`

**Spec:** `docs/superpowers/specs/2026-05-06-anniversary-birthday-design.md`

---

### Task 1: Support `type:anniversary` and `type:birthday` in `event.ts`

**Files:**
- Modify: `src/commands/event.ts`
- Modify: `tests/commands/event.test.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/event.test.ts`**

Append these inside the existing `describe('event command', () => {` block, before the closing `}`:

```typescript
  test('writes anniversary with type:anniversary when specified', () => {
    run(['--file', todoFile, 'event', 'Augusto Anniversary start:1984-05-06 frequency:yearly type:anniversary']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:anniversary');
    expect(content).not.toContain('type:event');
  });

  test('writes birthday with type:birthday when specified', () => {
    run(['--file', todoFile, 'event', "John's Birthday start:1990-03-15 frequency:yearly type:birthday"]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:birthday');
    expect(content).not.toContain('type:event');
  });

  test('exits with error for type:anniversary without start:', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'My Anniversary type:anniversary']);
    expect(code).toBe(1);
    expect(stderr).toContain('requires a start:');
  });

  test('exits with error for type:birthday without start:', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', "John's Birthday type:birthday"]);
    expect(code).toBe(1);
    expect(stderr).toContain('requires a start:');
  });

  test('plain event still writes type:event not type:anniversary or type:birthday', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:event');
    expect(content).not.toContain('type:anniversary');
    expect(content).not.toContain('type:birthday');
  });
```

Note: `readFileSync` is already imported at the top of `tests/commands/event.test.ts`.

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
bun test tests/commands/event.test.ts
```

Expected: existing 17 tests pass, 5 new tests fail.

- [ ] **Step 3: Replace `src/commands/event.ts` entirely**

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

function resolveType(text: string): string {
  const val = getExtValue(text, 'type');
  if (val === 'anniversary' || val === 'birthday') return val;
  return 'event';
}

export function eventCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo event <text>');
    process.exit(1);
  }

  let text = textParts.join(' ');
  validateFrequency(text);
  validateStartEnd(text);

  const type = resolveType(text);
  if ((type === 'anniversary' || type === 'birthday') && !getExtValue(text, 'start')) {
    console.error(`todo: type:${type} requires a start: date`);
    process.exit(1);
  }

  text = injectEnd(text);

  const todayStr = today();
  const normalized = text.replace(/\s*\btype:(?:event|anniversary|birthday)\b/g, '').trim();
  const raw = `${todayStr} ${normalized} type:${type}`;

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

Expected: all 22 tests pass.

- [ ] **Step 5: Run full suite — no regressions**

```bash
bun test
```

Expected: all 135 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/event.ts tests/commands/event.test.ts
git commit -m "feat: support type:anniversary and type:birthday in event command"
```

---

### Task 2: Display year count in list output

**Files:**
- Modify: `src/output.ts`
- Modify: `tests/commands/list.test.ts`

- [ ] **Step 1: Add failing tests to `tests/commands/list.test.ts`**

At the top of the file, add this import after the existing imports:

```typescript
import { writeFileSync } from 'fs';
```

Wait — check if `writeFileSync` is already imported (it is — the existing fixture setup uses it). No change needed to imports.

Add a new `describe` block at the bottom of the file (after the closing `}` of the existing `describe('list command', ...)`):

```typescript
describe('list command — year count display', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('shows (N years) for type:anniversary with start:', () => {
    const startYear = 1984;
    const expectedYears = new Date().getFullYear() - startYear;
    writeFileSync(todoFile, `2026-05-06 Augusto Anniversary start:${startYear}-05-06 frequency:yearly type:anniversary\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain(`(${expectedYears} years)`);
  });

  test('shows (N years) for type:birthday with start:', () => {
    const startYear = 1990;
    const expectedYears = new Date().getFullYear() - startYear;
    writeFileSync(todoFile, `2026-05-06 John Birthday start:${startYear}-03-15 frequency:yearly type:birthday\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain(`(${expectedYears} years)`);
  });

  test('does not show (N years) for type:event', () => {
    writeFileSync(todoFile, `2026-05-06 Team standup start:2024-05-06 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).not.toContain('years)');
  });

  test('does not show (N years) for anniversary without start:', () => {
    writeFileSync(todoFile, `2026-05-06 My Anniversary type:anniversary\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).not.toContain('years)');
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
bun test tests/commands/list.test.ts
```

Expected: existing 8 tests pass, 4 new tests fail.

- [ ] **Step 3: Update `src/output.ts`**

Add the `computeYearCount` helper function after the `colorText` function (before `formatTask`):

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

Then in `formatTask`, replace this line:

```typescript
  parts.push(colorText(task.text, todayStr));
```

With:

```typescript
  const yearCount = computeYearCount(task, todayStr);
  const coloredText = colorText(task.text, todayStr);
  parts.push(yearCount ? `${coloredText} ${c(A.dim, yearCount)}` : coloredText);
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
bun test tests/commands/list.test.ts
```

Expected: all 12 tests pass.

- [ ] **Step 5: Run full suite — no regressions**

```bash
bun test
```

Expected: all 139 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/output.ts tests/commands/list.test.ts
git commit -m "feat: show year count for anniversary and birthday events in list"
```
