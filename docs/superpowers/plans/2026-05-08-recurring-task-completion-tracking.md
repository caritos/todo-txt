# Recurring Task Completion Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow recurring daily tasks to be marked done per-occurrence, hide completed-today occurrences from focus, show a streak count, and preserve full completion history in listall.

**Architecture:** When `t done` runs on a recurring task, it appends a plain completed-copy line to todo.txt and writes a `last-done:YYYY-MM-DD` extension on the original (which stays open). Focus excludes tasks whose `last-done` equals today and computes streak by counting consecutive completion dates in the completed-copy history.

**Tech Stack:** TypeScript, Bun, todo.txt format.

---

## File Map

| File | Change |
|---|---|
| `src/parser.ts` | Export `baseText()` — strips extensions from task text for matching |
| `src/output.ts` | Add optional `streak` param to `formatFocusTask`; append `×N` when ≥ 2 |
| `src/commands/done.ts` | Detect recurring tasks; create completed copy; update `last-done`; migrate old `done:true` recurring tasks |
| `src/commands/focus.ts` | Exclude tasks with `last-done === today`; compute streak per recurring task; pass to `formatFocusTask` |
| `tests/parser.test.ts` | Tests for `baseText` |
| `tests/commands/done.test.ts` | Tests for recurring task completion behavior |
| `tests/commands/focus.test.ts` | Tests for last-done filter and streak display |

---

## Task 1: Export `baseText` from `parser.ts`

`baseText` strips all `key:value` extensions from task text, leaving only description, `+project`, and `@context` tags. Both `done.ts` and `focus.ts` use it to match completed copies to their originals.

**Files:**
- Modify: `src/parser.ts`
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the bottom of the `describe` block in `tests/parser.test.ts`:

```typescript
import { parseLine, serializeTask, baseText } from '../src/parser';
```

(update the existing import line to add `baseText`)

Then add inside the existing `describe('parseLine', ...)` block (or a new describe):

```typescript
describe('baseText', () => {
  it('returns plain text unchanged', () => {
    expect(baseText('Buy groceries')).toBe('Buy groceries');
  });

  it('strips key:value extensions', () => {
    expect(baseText('stoicism start:2026-05-08T06:00 frequency:daily')).toBe('stoicism');
  });

  it('keeps +project and @context tags', () => {
    expect(baseText('morning reflection +family start:2026-05-08T06:00 frequency:daily')).toBe('morning reflection +family');
  });

  it('strips last-done extension', () => {
    expect(baseText('stoicism frequency:daily last-done:2026-05-08')).toBe('stoicism');
  });

  it('strips every: extension', () => {
    expect(baseText('review rss feeds frequency:daily every:1')).toBe('review rss feeds');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun test tests/parser.test.ts
```

Expected: FAIL — `baseText` is not exported.

- [ ] **Step 3: Implement `baseText` in `src/parser.ts`**

Add after the existing exports at the bottom of `src/parser.ts`:

```typescript
export function baseText(text: string): string {
  return text.replace(/(?:^|\s)\w[\w-]*:[^/\s]\S*/g, ' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
bun test tests/parser.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: export baseText helper from parser"
```

---

## Task 2: Streak display in `formatFocusTask`

Adds an optional `streak` parameter. When streak ≥ 2, appends `×N` in dim color after the recurrence label.

**Files:**
- Modify: `src/output.ts`

- [ ] **Step 1: Update `formatFocusTask` signature and body in `src/output.ts`**

Change the function signature (line 85) from:

```typescript
export function formatFocusTask(task: Task, todayStr: string, effectiveDate: string, recLabel = ''): string {
```

to:

```typescript
export function formatFocusTask(task: Task, todayStr: string, effectiveDate: string, recLabel = '', streak = 0): string {
```

Then change the two return statements at lines 107–108 from:

```typescript
  if (task.priority) return `${num}  ${whenCol}  ${colorPriority(task.priority)} ${title}${recPart}`;
  return `${num}  ${whenCol}  ${title}${recPart}`;
```

to:

```typescript
  const streakPart = streak >= 2 ? `  ${c(A.dim, `×${streak}`)}` : '';
  if (task.priority) return `${num}  ${whenCol}  ${colorPriority(task.priority)} ${title}${recPart}${streakPart}`;
  return `${num}  ${whenCol}  ${title}${recPart}${streakPart}`;
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
bun test
```

Expected: all tests PASS (no callers pass a streak yet, default is 0 so output is unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/output.ts
git commit -m "feat: add streak param to formatFocusTask"
```

---

## Task 3: Recurring task completion in `done.ts`

When `t done N` runs on a recurring task (has `frequency` and `start`), the command:
1. Rejects if `last-done === today` or (`done:true` and `completionDate === today`)
2. Otherwise: appends a completed-copy line (plain done record, no recurrence extensions), updates `last-done:today` on the original, resets `done:false` if the original was marked done in the old format

**Files:**
- Modify: `src/commands/done.ts`
- Modify: `tests/commands/done.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these helpers and a new `describe` block at the end of `tests/commands/done.test.ts` (`readFileSync` is already imported at the top of the file):

```typescript
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('done command - recurring tasks', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-recurring-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('creates completed copy and updates last-done on original', () => {
    const today = todayStr();
    writeFileSync(todoFile, `stoicism start:${daysAgo(1)}T06:00 frequency:daily\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Done:');
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    // completed copy: plain done line, no start/frequency
    const copy = lines.find(l => l.startsWith('x ') && l.includes('stoicism') && !l.includes('frequency:'));
    expect(copy).toBeDefined();
    expect(copy).toContain(today);
    // original stays open with last-done
    const original = lines.find(l => l.includes('frequency:daily'));
    expect(original).toBeDefined();
    expect(original).not.toMatch(/^x /);
    expect(original).toContain(`last-done:${today}`);
  });

  test('rejects with "Already completed today" if last-done equals today', () => {
    const today = todayStr();
    writeFileSync(todoFile, `stoicism start:2026-05-07T06:00 frequency:daily last-done:${today}\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Already completed today');
  });

  test('migrates old done:true recurring task: resets to open, creates copy, sets last-done', () => {
    const today = todayStr();
    const yesterday = daysAgo(1);
    writeFileSync(todoFile, `x ${yesterday} stoicism start:2026-05-07T06:00 frequency:daily\n`, 'utf8');
    const { code } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    // completed copy added
    const copy = lines.find(l => l.startsWith('x ') && l.includes('stoicism') && !l.includes('frequency:'));
    expect(copy).toBeDefined();
    // original reset to open
    const original = lines.find(l => l.includes('frequency:daily'));
    expect(original).not.toMatch(/^x /);
    expect(original).toContain(`last-done:${today}`);
  });

  test('rejects old done:true recurring task if completionDate is today', () => {
    const today = todayStr();
    writeFileSync(todoFile, `x ${today} stoicism start:2026-05-07T06:00 frequency:daily\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Already completed today');
  });

  test('preserves +project and @context in completed copy', () => {
    const today = todayStr();
    writeFileSync(todoFile, `morning reflection +family start:${daysAgo(1)}T06:00 frequency:daily\n`, 'utf8');
    run(['--file', todoFile, 'done', '1']);
    const content = readFileSync(todoFile, 'utf8');
    const copy = content.split('\n').find(l => l.startsWith('x ') && !l.includes('frequency:'));
    expect(copy).toContain('+family');
    expect(copy).not.toContain('start:');
    expect(copy).not.toContain('frequency:');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
bun test tests/commands/done.test.ts
```

Expected: 5 new tests FAIL.

- [ ] **Step 3: Implement recurring task handling in `src/commands/done.ts`**

Replace the entire file with:

```typescript
import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { serializeTask, baseText } from '../parser';
import type { Task } from '../parser';

export function doneCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const todayStr = today();
  let anyChange = false;

  for (const n of nums) {
    const task = tasks.find(t => t.line === n);
    if (!task) {
      console.error(`Error: no task #${n}`);
      process.exit(1);
    }

    const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);

    if (isRecurring) {
      const lastDone = task.extensions['last-done'];
      const alreadyToday = lastDone === todayStr || (task.done && task.completionDate === todayStr);
      if (alreadyToday) {
        console.log(`Already completed today for #${n}.`);
        continue;
      }

      // Create completed copy (plain done record, no recurrence extensions)
      const copyText = baseText(task.text);
      const copyRaw = ['x', todayStr, ...(task.creationDate ? [task.creationDate] : []), copyText].join(' ');
      const copy: Task = {
        line: 0,
        raw: copyRaw,
        done: true,
        completionDate: todayStr,
        creationDate: task.creationDate,
        text: copyText,
        projects: task.projects,
        contexts: task.contexts,
        extensions: {},
      };

      // Reset original to open if it was done in old format
      if (task.done) {
        task.done = false;
        task.completionDate = undefined;
        task.priority = undefined;
      }

      // Update last-done on original
      const hasLastDone = /(?:^|\s)last-done:[^/\s]\S*/.test(task.text);
      if (hasLastDone) {
        task.text = task.text.replace(/\blast-done:[^/\s]\S*/g, `last-done:${todayStr}`);
      } else {
        task.text = `${task.text} last-done:${todayStr}`;
      }
      task.raw = serializeTask(task);

      tasks.push(copy);
      console.log(`Done: ${formatTask(task, todayStr)}`);
      anyChange = true;
      continue;
    }

    if (task.done) {
      console.log(`Task #${n} is already complete.`);
      continue;
    }
    task.done = true;
    task.completionDate = todayStr;
    task.priority = undefined;
    task.raw = serializeTask(task);
    console.log(`Done: ${formatTask(task, todayStr)}`);
    anyChange = true;
  }

  if (anyChange) writeTasks(filePath, tasks);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
bun test tests/commands/done.test.ts
```

Expected: all tests PASS including the original 6 and the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/commands/done.ts tests/commands/done.test.ts
git commit -m "feat: complete recurring tasks per-occurrence with completion history"
```

---

## Task 4: Focus filter and streak computation

Two changes to `focus.ts`:
1. Exclude open recurring tasks where `last-done === today` (already completed)
2. Compute streak for each recurring task and pass to `formatFocusTask`

**Files:**
- Modify: `src/commands/focus.ts`
- Modify: `tests/commands/focus.test.ts`

- [ ] **Step 1: Write the failing tests**

Add at the end of `tests/commands/focus.test.ts`:

```typescript
describe('focus - recurring task completion tracking', () => {
  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  test('hides recurring task when last-done equals today', () => {
    const today = todayStr();
    writeFileSync(todoFile, `stoicism start:${daysAgo(1)}T06:00 frequency:daily last-done:${today}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('stoicism');
  });

  test('shows recurring task when last-done is yesterday', () => {
    const yesterday = daysAgo(1);
    writeFileSync(todoFile, `stoicism start:${daysAgo(2)}T06:00 frequency:daily last-done:${yesterday}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('stoicism');
  });

  test('shows streak count ×N for recurring task with 2+ consecutive completions', () => {
    const today = todayStr();
    const lines = [
      `stoicism start:${daysAgo(5)}T06:00 frequency:daily`,
      `x ${daysAgo(1)} stoicism`,
      `x ${daysAgo(2)} stoicism`,
      `x ${daysAgo(3)} stoicism`,
    ].join('\n') + '\n';
    writeFileSync(todoFile, lines, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('stoicism');
    expect(stdout).toContain('×3');
  });

  test('does not show streak for task with only 1 completion', () => {
    writeFileSync(todoFile, [
      `stoicism start:${daysAgo(5)}T06:00 frequency:daily`,
      `x ${daysAgo(1)} stoicism`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('×');
  });

  test('shows streak including today if last-done is today', () => {
    // task was done today AND yesterday AND the day before — streak = 3, but task hidden (last-done=today)
    // the next occurrence (tomorrow) shows with streak 3
    // Actually after last-done=today, task is hidden from focus entirely until tomorrow.
    // So we only see it if last-done < today. This test confirms streak on visible task.
    const yesterday = daysAgo(1);
    writeFileSync(todoFile, [
      `stoicism start:${daysAgo(5)}T06:00 frequency:daily last-done:${yesterday}`,
      `x ${yesterday} stoicism`,
      `x ${daysAgo(2)} stoicism`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('stoicism');
    expect(stdout).toContain('×2');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
bun test tests/commands/focus.test.ts
```

Expected: 5 new tests FAIL.

- [ ] **Step 3: Add `baseText`, `stepBack`, and `computeStreak` helpers to `src/commands/focus.ts`**

Add a new import line in `src/commands/focus.ts` directly after the existing `import type { Task } from '../parser';` line:

```typescript
import { baseText } from '../parser';
```

Then add these functions after the existing `focusNextRecurrence` function (after line 132):

```typescript
function stepBack(date: string, freq: string, every = '1'): string {
  if (freq === 'weekly') return addDays(date, -(parseInt(every) * 7));
  if (freq === 'monthly') {
    const d = new Date(date + 'T12:00:00');
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    return `${parseInt(date.slice(0, 4)) - 1}-${date.slice(5)}`;
  }
  return addDays(date, -1);
}

function computeStreak(task: Task, allTasks: Task[], todayStr: string): number {
  const freq = task.extensions['frequency'];
  if (!freq) return 0;
  const base = baseText(task.text);
  const dates = new Set<string>(
    allTasks
      .filter(t => t.done && t.completionDate && baseText(t.text) === base)
      .map(t => t.completionDate!)
  );
  if (dates.size === 0) return 0;
  const mostRecent = [...dates].sort().at(-1)!;
  if (mostRecent < stepBack(todayStr, freq, task.extensions['every'])) return 0;
  let streak = 0;
  let check = mostRecent;
  while (dates.has(check)) {
    streak++;
    check = stepBack(check, freq, task.extensions['every']);
  }
  return streak;
}
```

- [ ] **Step 4: Update the filter and forEach in `focusCommand`**

In `focusCommand` (around line 147), change the `relevant` filter from:

```typescript
  const relevant = tasks.filter(t => {
    if (t.done) {
      const freq = t.extensions['frequency'];
      const start = t.extensions['start'];
      if (!(freq && start)) return false;
      const recurUntil = t.extensions['recur-until'];
      if (recurUntil && recurUntil < addDays(t.completionDate ?? todayStr, 1)) return false;
      return true;
    }
    return !isPastEvent(t, todayStr);
  });
```

to:

```typescript
  const relevant = tasks.filter(t => {
    if (t.done) {
      const freq = t.extensions['frequency'];
      const start = t.extensions['start'];
      if (!(freq && start)) return false;
      const recurUntil = t.extensions['recur-until'];
      if (recurUntil && recurUntil < addDays(t.completionDate ?? todayStr, 1)) return false;
      return true;
    }
    if (t.extensions['last-done'] === todayStr) return false;
    return !isPastEvent(t, todayStr);
  });
```

Then change the `focused.forEach` (around line 171) from:

```typescript
  focused.forEach(t => {
    const et = effToday(t);
    console.log(formatFocusTask(t, todayStr, focusSortKey(t, et), focusNextRecurrence(t, et)));
  });
```

to:

```typescript
  focused.forEach(t => {
    const et = effToday(t);
    const streak = t.extensions['frequency'] ? computeStreak(t, tasks, todayStr) : 0;
    console.log(formatFocusTask(t, todayStr, focusSortKey(t, et), focusNextRecurrence(t, et), streak));
  });
```

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/focus.ts tests/commands/focus.test.ts
git commit -m "feat: hide completed recurring tasks from focus and show streak count"
```
