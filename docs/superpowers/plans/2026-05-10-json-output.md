# JSON Output for `list` Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `todo list` with `--json`, `--done`, `--pending`, `--from`, `--to`, `--due-from`, and `--due-to` flags so external tools can query tasks as a JSON array.

**Architecture:** All changes are confined to `src/commands/list.ts`. A `parseListArgs` helper peels off the new flags before the existing filter logic; `toJsonTask` converts a `Task` to the JSON shape. When `--json` is present the command outputs a JSON array and returns early, leaving the human-readable code path completely unchanged.

**Tech Stack:** Bun, TypeScript (`verbatimModuleSyntax: true`), `bun test`

---

## File Map

| File | Change |
|---|---|
| `src/commands/list.ts` | Add `JsonTask` type, `parseListArgs`, `toJsonTask`, update `listCommand` |
| `tests/list.test.ts` | Add unit tests for `toJsonTask` |
| `tests/commands/list.test.ts` | Add integration tests for all new CLI flags |

---

## Task 1: Add `toJsonTask` helper

**Files:**
- Modify: `src/commands/list.ts`
- Test: `tests/list.test.ts`

- [ ] **Step 1: Write the failing unit tests for `toJsonTask`**

First add `toJsonTask` to the existing import at the top of `tests/list.test.ts`:

```typescript
// existing line — add toJsonTask:
import { matchesFilters, isPastEvent, sortByPriority, toJsonTask } from '../src/commands/list';
```

Then append this describe block to `tests/list.test.ts`:

```typescript
describe('toJsonTask', () => {
  it('maps all fields, coercing absent optionals to null', () => {
    const t = parseLine('Buy groceries @personal', 5);
    const j = toJsonTask(t);
    expect(j.line).toBe(5);
    expect(j.done).toBe(false);
    expect(j.completionDate).toBeNull();
    expect(j.creationDate).toBeNull();
    expect(j.priority).toBeNull();
    expect(j.text).toBe('Buy groceries @personal');
    expect(j.description).toBe('Buy groceries @personal');
    expect(j.projects).toEqual([]);
    expect(j.contexts).toEqual(['@personal']);
    expect(j.extensions).toEqual({});
  });

  it('maps a task with all optional fields set', () => {
    const t = parseLine('(A) 2026-05-01 Fix login bug due:2026-05-15 +backend @work', 3);
    const j = toJsonTask(t);
    expect(j.done).toBe(false);
    expect(j.priority).toBe('A');
    expect(j.creationDate).toBe('2026-05-01');
    expect(j.completionDate).toBeNull();
    expect(j.text).toBe('Fix login bug due:2026-05-15 +backend @work');
    expect(j.description).toBe('Fix login bug +backend @work');
    expect(j.projects).toEqual(['+backend']);
    expect(j.contexts).toEqual(['@work']);
    expect(j.extensions).toEqual({ due: '2026-05-15' });
  });

  it('maps a completed task', () => {
    const t = parseLine('x 2026-05-07 2026-05-01 Deploy server +backend', 2);
    const j = toJsonTask(t);
    expect(j.done).toBe(true);
    expect(j.completionDate).toBe('2026-05-07');
    expect(j.creationDate).toBe('2026-05-01');
    expect(j.priority).toBeNull();
    expect(j.description).toBe('Deploy server +backend');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/list.test.ts
```

Expected: FAIL — `toJsonTask` is not exported from `src/commands/list.ts`

- [ ] **Step 3: Add `JsonTask` type and `toJsonTask` to `src/commands/list.ts`**

Add these after the existing imports. Also update the `parser` import to include `baseText`:

```typescript
// Replace:
import type { Task } from '../parser';
// With:
import { baseText, type Task } from '../parser';
```

Then add after the imports:

```typescript
export type JsonTask = {
  line: number;
  done: boolean;
  completionDate: string | null;
  creationDate: string | null;
  priority: string | null;
  text: string;
  description: string;
  projects: string[];
  contexts: string[];
  extensions: Record<string, string>;
};

export function toJsonTask(task: Task): JsonTask {
  return {
    line: task.line,
    done: task.done,
    completionDate: task.completionDate ?? null,
    creationDate: task.creationDate ?? null,
    priority: task.priority ?? null,
    text: task.text,
    description: baseText(task.text),
    projects: task.projects,
    contexts: task.contexts,
    extensions: task.extensions,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/list.test.ts
```

Expected: all `toJsonTask` tests PASS; existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts tests/list.test.ts
git commit -m "feat: add toJsonTask helper for JSON serialisation"
```

---

## Task 2: Flag parsing + `--json` standalone (all open tasks)

**Files:**
- Modify: `src/commands/list.ts`
- Test: `tests/commands/list.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Add a new describe block to `tests/commands/list.test.ts`. Add it after the existing `describe('list command', ...)` block. Reuse the shared `run` helper already defined at the top of that file.

```typescript
const JSON_FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work due:2026-05-15
(B) 2026-05-04 Write release notes +docs @work due:2026-05-20
2026-05-04 Buy groceries @personal
x 2026-05-07 2026-05-01 Deploy staging server +backend @work
x 2026-05-09 2026-05-05 Write docs +docs @work
`;

describe('list --json', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-json-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json returns valid JSON array', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('--json standalone returns only open tasks', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { done: boolean }) => !t.done)).toBe(true);
    expect(tasks.length).toBe(3);
  });

  test('--json output has correct shape with null for absent fields', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    const grocery = tasks.find((t: { description: string }) => t.description === 'Buy groceries @personal');
    expect(grocery).toBeDefined();
    expect(grocery.done).toBe(false);
    expect(grocery.completionDate).toBeNull();
    expect(grocery.creationDate).toBeNull();
    expect(grocery.priority).toBeNull();
    expect(grocery.projects).toEqual([]);
    expect(grocery.contexts).toEqual(['@personal']);
    expect(grocery.extensions).toEqual({});
  });

  test('--json output strips extensions from description', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    const bug = tasks.find((t: { description: string }) => t.description.includes('Fix login bug'));
    expect(bug.text).toContain('due:2026-05-15');
    expect(bug.description).not.toContain('due:');
  });

  test('--json does not print summary line', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    expect(stdout).not.toContain('open');
  });

  test('without --json, list still works as before', () => {
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(() => JSON.parse(stdout)).toThrow();
    expect(stdout).toContain('open');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/commands/list.test.ts
```

Expected: FAIL — `--json` flag is unrecognised and the output is not JSON

- [ ] **Step 3: Add `parseListArgs` and wire `--json` into `listCommand`**

Add `parseListArgs` just before `listCommand` in `src/commands/list.ts`:

```typescript
type ListArgs = {
  json: boolean;
  done: boolean;
  from: string | undefined;
  to: string | undefined;
  dueFrom: string | undefined;
  dueTo: string | undefined;
  filters: string[];
};

function parseListArgs(args: string[]): ListArgs {
  let json = false;
  let done = false;
  let from: string | undefined;
  let to: string | undefined;
  let dueFrom: string | undefined;
  let dueTo: string | undefined;
  const filters: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--json') { json = true; }
    else if (arg === '--done') { done = true; }
    else if (arg === '--pending') { /* default, no-op */ }
    else if (arg === '--from') { from = args[++i]; }
    else if (arg === '--to') { to = args[++i]; }
    else if (arg === '--due-from') { dueFrom = args[++i]; }
    else if (arg === '--due-to') { dueTo = args[++i]; }
    else { filters.push(arg); }
  }

  return { json, done, from, to, dueFrom, dueTo, filters };
}
```

Then replace the `listCommand` signature and opening block:

```typescript
// Replace:
export function listCommand(filePath: string, filters: string[]): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const open = tasks.filter(t => !t.done);
  const filtered = filters.length > 0 ? open.filter(t => matchesFilters(t, filters)) : open;

  sortByPriority(filtered).forEach(t => console.log(formatTask(t, todayStr)));

  // Summary stats (counts across ALL open tasks, not just filtered)
  const overdue = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due < todayStr;
  }).length;
  const dueSoon = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due >= todayStr && due <= addDays(todayStr, 3);
  }).length;

  console.log(formatSummary(open.length, 0, overdue, dueSoon));
}

// With:
export function listCommand(filePath: string, args: string[]): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const { json, done, from, to, dueFrom, dueTo, filters } = parseListArgs(args);
  const todayStr = today();
  const tasks = readTasks(filePath);

  if (json) {
    let result = done ? tasks.filter(t => t.done) : tasks.filter(t => !t.done);
    if (done) {
      if (from) { const f = from; result = result.filter(t => t.completionDate !== undefined && t.completionDate >= f); }
      if (to)   { const t2 = to; result = result.filter(t => t.completionDate !== undefined && t.completionDate <= t2); }
    } else {
      if (dueFrom) { const df = dueFrom; result = result.filter(t => t.extensions['due'] !== undefined && t.extensions['due'] >= df); }
      if (dueTo)   { const dt = dueTo;   result = result.filter(t => t.extensions['due'] !== undefined && t.extensions['due'] <= dt); }
    }
    if (filters.length > 0) result = result.filter(t => matchesFilters(t, filters));
    console.log(JSON.stringify(result.map(toJsonTask), null, 2));
    return;
  }

  const open = tasks.filter(t => !t.done);
  const filtered = filters.length > 0 ? open.filter(t => matchesFilters(t, filters)) : open;

  sortByPriority(filtered).forEach(t => console.log(formatTask(t, todayStr)));

  // Summary stats (counts across ALL open tasks, not just filtered)
  const overdue = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due < todayStr;
  }).length;
  const dueSoon = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due >= todayStr && due <= addDays(todayStr, 3);
  }).length;

  console.log(formatSummary(open.length, 0, overdue, dueSoon));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/commands/list.test.ts
```

Expected: all new `list --json` tests PASS; all existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts tests/commands/list.test.ts
git commit -m "feat: add --json flag to list command"
```

---

## Task 3: `--done` with `--from`/`--to` date filters

**Files:**
- Test: `tests/commands/list.test.ts`

The implementation was written in Task 2. This task adds tests to verify the `--done` mode and its date filters work correctly.

- [ ] **Step 1: Write the failing tests**

Add this describe block to `tests/commands/list.test.ts`, after the `list --json` block. It reuses `JSON_FIXTURE` and the `dir`/`todoFile` setup pattern.

```typescript
describe('list --json --done', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-done-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json --done returns only completed tasks', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json', '--done']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { done: boolean }) => t.done)).toBe(true);
    expect(tasks.length).toBe(2);
  });

  test('--json --done --from filters by completionDate lower bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-05-09']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].completionDate).toBe('2026-05-09');
  });

  test('--json --done --to filters by completionDate upper bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--to', '2026-05-07']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].completionDate).toBe('2026-05-07');
  });

  test('--json --done --from --to returns tasks in range (inclusive)', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-05-07', '--to', '2026-05-09']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(2);
  });

  test('--json --done --from --to returns empty array when no match', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-06-01', '--to', '2026-06-30']);
    const tasks = JSON.parse(stdout);
    expect(tasks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
bun test tests/commands/list.test.ts
```

Expected: all new `list --json --done` tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/commands/list.test.ts
git commit -m "test: verify --json --done with date range filters"
```

---

## Task 4: `--due-from`/`--due-to` filters for pending tasks

**Files:**
- Test: `tests/commands/list.test.ts`

The implementation was written in Task 2. This task adds tests to verify pending task due-date filtering.

- [ ] **Step 1: Write the failing tests**

Add this describe block to `tests/commands/list.test.ts`:

```typescript
describe('list --json --pending due-date filters', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-due-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json --due-from filters pending tasks by due: lower bound', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-18']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].extensions.due).toBe('2026-05-20');
  });

  test('--json --due-to filters pending tasks by due: upper bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-to', '2026-05-15']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].extensions.due).toBe('2026-05-15');
  });

  test('--json --due-from --due-to returns tasks in range (inclusive)', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-15', '--due-to', '2026-05-20']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(2);
  });

  test('--pending flag is a no-op (same as default)', () => {
    const withPending = run(['--file', todoFile, 'list', '--json', '--pending']).stdout;
    const withoutPending = run(['--file', todoFile, 'list', '--json']).stdout;
    expect(JSON.parse(withPending)).toEqual(JSON.parse(withoutPending));
  });

  test('tasks without due: are excluded when --due-from is provided', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-01']);
    const tasks = JSON.parse(stdout);
    const noDue = tasks.filter((t: { extensions: Record<string, string> }) => !t.extensions['due']);
    expect(noDue.length).toBe(0);
  });

  test('--json --due-from --due-to returns empty array when no match', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-06-01', '--due-to', '2026-06-30']);
    const tasks = JSON.parse(stdout);
    expect(tasks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
bun test tests/commands/list.test.ts
```

Expected: all new `list --json --pending due-date` tests PASS

- [ ] **Step 3: Add integration test for `--json` with existing text filters**

Add one more describe block:

```typescript
describe('list --json with existing filters', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-jfilter-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json +project filters to matching tasks only', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '+backend']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { projects: string[] }) => t.projects.includes('+backend'))).toBe(true);
    expect(tasks.length).toBe(1);
  });

  test('--json @context filters to matching tasks only', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '@personal']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { contexts: string[] }) => t.contexts.includes('@personal'))).toBe(true);
    expect(tasks.length).toBe(1);
  });

  test('--json keyword filter is case-insensitive', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', 'LOGIN']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].description).toContain('Fix login bug');
  });
});
```

- [ ] **Step 4: Run the full test suite**

```bash
bun test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add tests/commands/list.test.ts
git commit -m "test: verify --json due-date filters and compatibility with existing filters"
```
