# todo.txt CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict todo.txt-compliant CLI task manager in Bun/TypeScript with colorized output, full filtering, and atomic file writes.

**Architecture:** Three decoupled layers — a pure parser (`src/parser.ts`), an atomic file store (`src/store.ts`), and command handlers (`src/commands/`). The parser has no I/O; the store has no formatting; commands compose both. This keeps the parser reusable for a future web/mobile frontend.

**Tech Stack:** Bun (runtime + test runner via `bun test`), TypeScript, raw ANSI escape codes (no color library).

---

## File Map

| File | Responsibility |
|---|---|
| `src/index.ts` | CLI entry point — parse argv, extract `--file` flag, route to commands |
| `src/parser.ts` | `Task` type, `parseLine()`, `serializeTask()` — pure, no I/O |
| `src/store.ts` | `resolveFile()`, `readTasks()`, `writeTasks()` — atomic write via tmp+rename |
| `src/output.ts` | ANSI helpers, `formatTask()`, `formatSummary()`, `today()`, `addDays()` |
| `src/commands/help.ts` | `todo help` |
| `src/commands/add.ts` | `todo add <text>` |
| `src/commands/list.ts` | `todo list [filters]` — shared logic used by listall |
| `src/commands/listall.ts` | `todo listall [filters]` — thin wrapper over list |
| `src/commands/done.ts` | `todo done <n>` |
| `src/commands/rm.ts` | `todo rm <n>` |
| `src/commands/pri.ts` | `todo pri <n> <A-Z>` |
| `src/commands/depri.ts` | `todo depri <n>` |
| `src/commands/search.ts` | `todo search <term>` |
| `src/commands/report.ts` | `todo report` |
| `tests/parser.test.ts` | Unit tests for `parseLine()` and `serializeTask()` |
| `tests/store.test.ts` | Integration tests for store read/write/resolve |
| `tests/commands.test.ts` | Smoke tests for all commands via `Bun.spawnSync` |

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "quick-quokka",
  "version": "0.1.0",
  "module": "src/index.ts",
  "bin": {
    "todo": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create src/index.ts stub**

```bash
mkdir -p src
```

Write `src/index.ts`:

```typescript
#!/usr/bin/env bun
console.log('todo: not yet implemented');
```

- [ ] **Step 4: Install dependencies and verify**

```bash
bun install
bun run src/index.ts
```

Expected output: `todo: not yet implemented`

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/index.ts bun.lockb
git commit -m "feat: project scaffolding"
```

---

### Task 2: Parser — Task type and parseLine()

**Files:**
- Create: `src/parser.ts`
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/parser.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { parseLine } from '../src/parser';

describe('parseLine', () => {
  it('parses a simple task', () => {
    const t = parseLine('Buy groceries', 1);
    expect(t.line).toBe(1);
    expect(t.raw).toBe('Buy groceries');
    expect(t.done).toBe(false);
    expect(t.priority).toBeUndefined();
    expect(t.creationDate).toBeUndefined();
    expect(t.text).toBe('Buy groceries');
    expect(t.projects).toEqual([]);
    expect(t.contexts).toEqual([]);
    expect(t.extensions).toEqual({});
  });

  it('parses priority', () => {
    const t = parseLine('(A) Fix login bug', 1);
    expect(t.priority).toBe('A');
    expect(t.text).toBe('Fix login bug');
  });

  it('parses priority and creation date', () => {
    const t = parseLine('(B) 2026-05-01 Write docs', 2);
    expect(t.priority).toBe('B');
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Write docs');
  });

  it('parses creation date without priority', () => {
    const t = parseLine('2026-05-01 Call dentist', 3);
    expect(t.priority).toBeUndefined();
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Call dentist');
  });

  it('parses projects and contexts', () => {
    const t = parseLine('Fix bug +backend @work', 1);
    expect(t.projects).toEqual(['+backend']);
    expect(t.contexts).toEqual(['@work']);
    expect(t.text).toBe('Fix bug +backend @work');
  });

  it('parses multiple projects and contexts', () => {
    const t = parseLine('Fix thing +backend +api @work @phone', 1);
    expect(t.projects).toEqual(['+backend', '+api']);
    expect(t.contexts).toEqual(['@work', '@phone']);
  });

  it('parses key:value extensions', () => {
    const t = parseLine('Call dentist due:2026-05-10', 1);
    expect(t.extensions).toEqual({ due: '2026-05-10' });
  });

  it('parses a completed task with both dates', () => {
    const t = parseLine('x 2026-05-04 2026-05-01 Deploy server +backend', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBe('2026-05-04');
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Deploy server +backend');
    expect(t.projects).toEqual(['+backend']);
  });

  it('parses a completed task with completion date only', () => {
    const t = parseLine('x 2026-05-04 Deploy server', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBe('2026-05-04');
    expect(t.creationDate).toBeUndefined();
    expect(t.text).toBe('Deploy server');
  });

  it('parses a completed task with no dates', () => {
    const t = parseLine('x Deploy server', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBeUndefined();
    expect(t.text).toBe('Deploy server');
  });

  it('does not treat lowercase x mid-word as done marker', () => {
    const t = parseLine('Fix xerox machine', 1);
    expect(t.done).toBe(false);
    expect(t.text).toBe('Fix xerox machine');
  });

  it('does not parse priority mid-line', () => {
    const t = parseLine('Fix (A) bug', 1);
    expect(t.priority).toBeUndefined();
    expect(t.text).toBe('Fix (A) bug');
  });

  it('preserves raw line and line number', () => {
    const raw = '(A) 2026-05-01 Fix bug +backend @work due:2026-05-10';
    const t = parseLine(raw, 5);
    expect(t.raw).toBe(raw);
    expect(t.line).toBe(5);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/parser.test.ts
```

Expected: `Cannot find module '../src/parser'`

- [ ] **Step 3: Implement parseLine() in src/parser.ts**

```typescript
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_RE = /^\([A-Z]\)$/;

export type Task = {
  line: number;
  raw: string;
  done: boolean;
  completionDate?: string;
  priority?: string;
  creationDate?: string;
  text: string;
  projects: string[];
  contexts: string[];
  extensions: Record<string, string>;
};

export function parseLine(raw: string, lineNum: number): Task {
  const tokens = raw.split(' ');
  let i = 0;
  let done = false;
  let completionDate: string | undefined;
  let priority: string | undefined;
  let creationDate: string | undefined;

  if (tokens[i] === 'x') {
    done = true;
    i++;
    if (tokens[i] && DATE_RE.test(tokens[i]!)) {
      completionDate = tokens[i++];
    }
  } else if (PRIORITY_RE.test(tokens[i] ?? '')) {
    priority = tokens[i++]![1]!;
  }

  if (DATE_RE.test(tokens[i] ?? '')) {
    creationDate = tokens[i++];
  }

  const text = tokens.slice(i).join(' ');
  const projects = [...text.matchAll(/(?:^|\s)(\+\S+)/g)].map(m => m[1]!);
  const contexts = [...text.matchAll(/(?:^|\s)(@\S+)/g)].map(m => m[1]!);
  const extensions: Record<string, string> = {};
  for (const m of text.matchAll(/(?:^|\s)(\w+):(\S+)/g)) {
    extensions[m[1]!] = m[2]!;
  }

  return { line: lineNum, raw, done, completionDate, priority, creationDate, text, projects, contexts, extensions };
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/parser.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: Task type and parseLine()"
```

---

### Task 3: Parser — serializeTask()

**Files:**
- Modify: `src/parser.ts`
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Add serializeTask import to tests and write failing tests**

Update the import line at the top of `tests/parser.test.ts` (replace existing import):

```typescript
import { describe, it, expect } from 'bun:test';
import { parseLine, serializeTask } from '../src/parser';
import type { Task } from '../src/parser';
```

Then append the following `describe` block at the end of `tests/parser.test.ts`:

```typescript
describe('serializeTask', () => {
  it('serializes a simple task', () => {
    const task: Task = {
      line: 1, raw: '', done: false,
      text: 'Buy groceries', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('Buy groceries');
  });

  it('serializes a task with priority', () => {
    const task: Task = {
      line: 1, raw: '', done: false, priority: 'A',
      text: 'Fix login bug', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('(A) Fix login bug');
  });

  it('serializes a task with priority and creation date', () => {
    const task: Task = {
      line: 1, raw: '', done: false, priority: 'B',
      creationDate: '2026-05-01', text: 'Write docs',
      projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('(B) 2026-05-01 Write docs');
  });

  it('serializes a completed task with both dates', () => {
    const task: Task = {
      line: 1, raw: '', done: true,
      completionDate: '2026-05-04', creationDate: '2026-05-01',
      text: 'Deploy server +backend',
      projects: ['+backend'], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 2026-05-01 Deploy server +backend');
  });

  it('serializes a completed task with completion date only', () => {
    const task: Task = {
      line: 1, raw: '', done: true, completionDate: '2026-05-04',
      text: 'Quick fix', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 Quick fix');
  });

  it('does not include priority for completed tasks', () => {
    const task: Task = {
      line: 1, raw: '', done: true,
      completionDate: '2026-05-04', priority: undefined,
      text: 'Was urgent', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 Was urgent');
  });

  it('round-trips: parse then serialize reproduces original line', () => {
    const lines = [
      '(A) 2026-05-01 Fix login bug +backend @work due:2026-05-10',
      'x 2026-05-04 2026-05-01 Deploy server +backend @work',
      'Buy groceries @personal',
      '(C) Review pull requests +backend @work due:2026-05-07',
    ];
    for (const line of lines) {
      expect(serializeTask(parseLine(line, 1))).toBe(line);
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/parser.test.ts
```

Expected: `serializeTask is not a function`

- [ ] **Step 3: Implement serializeTask() — append to src/parser.ts**

```typescript
export function serializeTask(task: Task): string {
  const parts: string[] = [];
  if (task.done) {
    parts.push('x');
    if (task.completionDate) parts.push(task.completionDate);
  } else {
    if (task.priority) parts.push(`(${task.priority})`);
  }
  if (task.creationDate) parts.push(task.creationDate);
  parts.push(task.text);
  return parts.join(' ');
}
```

- [ ] **Step 4: Run all parser tests**

```bash
bun test tests/parser.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: serializeTask()"
```

---

### Task 4: Store

**Files:**
- Create: `src/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write failing store integration tests**

Create `tests/store.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'bun:test';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readTasks, writeTasks, resolveFile } from '../src/store';

const TMP = join(tmpdir(), `todo-store-test-${process.pid}.txt`);

afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

describe('resolveFile', () => {
  it('prefers --file flag over env var', () => {
    process.env.TODO_FILE = '/env/todo.txt';
    expect(resolveFile('/flag/todo.txt')).toBe('/flag/todo.txt');
    delete process.env.TODO_FILE;
  });

  it('uses TODO_FILE env var when no flag', () => {
    process.env.TODO_FILE = '/env/todo.txt';
    expect(resolveFile()).toBe('/env/todo.txt');
    delete process.env.TODO_FILE;
  });

  it('falls back to ./todo.txt in cwd', () => {
    delete process.env.TODO_FILE;
    expect(resolveFile()).toMatch(/todo\.txt$/);
  });
});

describe('readTasks', () => {
  it('returns empty array for non-existent file', () => {
    expect(readTasks('/nonexistent/path/todo.txt')).toEqual([]);
  });

  it('reads and parses tasks, assigning 1-based line numbers', () => {
    writeFileSync(TMP, '(A) Fix bug\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.priority).toBe('A');
    expect(tasks[0]!.line).toBe(1);
    expect(tasks[1]!.text).toBe('Buy groceries');
    expect(tasks[1]!.line).toBe(2);
  });

  it('skips empty lines', () => {
    writeFileSync(TMP, '(A) Fix bug\n\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    expect(tasks).toHaveLength(2);
  });
});

describe('writeTasks', () => {
  it('writes tasks back preserving content', () => {
    writeFileSync(TMP, '(A) Fix bug\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    writeTasks(TMP, tasks);
    const tasks2 = readTasks(TMP);
    expect(tasks2).toHaveLength(2);
    expect(tasks2[0]!.text).toBe('Fix bug');
    expect(tasks2[1]!.text).toBe('Buy groceries');
  });

  it('parse → write → parse produces identical raw lines', () => {
    const content = [
      '(A) 2026-05-01 Fix login bug +backend @work due:2026-05-10',
      'x 2026-05-04 2026-05-01 Deploy server +backend @work',
      'Buy groceries @personal',
    ].join('\n') + '\n';
    writeFileSync(TMP, content, 'utf8');
    const before = readTasks(TMP);
    writeTasks(TMP, before);
    const after = readTasks(TMP);
    expect(after.map(t => t.raw)).toEqual(before.map(t => t.raw));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/store.test.ts
```

Expected: `Cannot find module '../src/store'`

- [ ] **Step 3: Implement src/store.ts**

```typescript
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseLine } from './parser';
import type { Task } from './parser';

export function resolveFile(flag?: string): string {
  return flag ?? process.env.TODO_FILE ?? resolve(process.cwd(), 'todo.txt');
}

export function readTasks(filePath: string): Task[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, i) => parseLine(line, i + 1));
}

export function writeTasks(filePath: string, tasks: Task[]): void {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, tasks.map(t => t.raw).join('\n') + '\n', 'utf8');
  renameSync(tmp, filePath);
}
```

- [ ] **Step 4: Run store tests**

```bash
bun test tests/store.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store.ts tests/store.test.ts
git commit -m "feat: store (resolveFile, readTasks, writeTasks)"
```

---

### Task 5: Output formatting

**Files:**
- Create: `src/output.ts`

- [ ] **Step 1: Create src/output.ts**

```typescript
const A = {
  reset:         '\x1b[0m',
  bold:          '\x1b[1m',
  dim:           '\x1b[2m',
  strikethrough: '\x1b[9m',
  red:           '\x1b[91m',
  green:         '\x1b[92m',
  blue:          '\x1b[94m',
  purple:        '\x1b[95m',
  orange:        '\x1b[38;5;208m',
  bgRed:         '\x1b[41m',
} as const;

function c(color: string, text: string): string {
  return `${color}${text}${A.reset}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function colorPriority(p: string): string {
  if (p === 'A') return c(A.bold + A.red, `(${p})`);
  if (p === 'B') return c(A.bold + A.blue, `(${p})`);
  if (p === 'C') return c(A.bold + A.orange, `(${p})`);
  return c(A.bold, `(${p})`);
}

function colorText(text: string, todayStr: string): string {
  return text
    .replace(/(?:^|\s)(\+\S+)/g, (m, tag: string) => m.replace(tag, c(A.green, tag)))
    .replace(/(?:^|\s)(@\S+)/g, (m, tag: string) => m.replace(tag, c(A.purple, tag)))
    .replace(/(?:^|\s)(due:\d{4}-\d{2}-\d{2})/g, (m, due: string) => {
      const date = due.slice(4);
      if (date < todayStr) return m.replace(due, c(A.bgRed + A.red, `${due} OVERDUE`));
      if (date <= addDays(todayStr, 3)) return m.replace(due, c(A.orange, due));
      return m;
    });
}

export function formatTask(task: import('./parser').Task, todayStr: string): string {
  const num = c(A.dim, String(task.line).padStart(2));

  if (task.done) {
    const raw = ['x', task.completionDate, task.creationDate, task.text]
      .filter(Boolean)
      .join(' ');
    return `${num}  ${c(A.dim + A.strikethrough, raw)}`;
  }

  const parts: string[] = [];
  if (task.priority) parts.push(colorPriority(task.priority));
  if (task.creationDate) parts.push(c(A.dim, task.creationDate));
  parts.push(colorText(task.text, todayStr));
  return `${num}  ${parts.join(' ')}`;
}

export function formatSummary(open: number, done: number, overdue: number, dueSoon: number): string {
  const parts: string[] = [];
  if (done > 0) {
    parts.push(`${open + done} total · ${open} open · ${done} completed`);
  } else {
    parts.push(`${open} open task${open === 1 ? '' : 's'}`);
  }
  if (overdue > 0) parts.push(c(A.red, `${overdue} overdue`));
  else if (dueSoon > 0) parts.push(`${dueSoon} due within 3 days`);
  return c(A.dim, parts.join(' · '));
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
bun run --no-install src/index.ts 2>&1
```

Expected: `todo: not yet implemented` with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/output.ts
git commit -m "feat: output formatting (ANSI colors, formatTask, formatSummary)"
```

---

### Task 6: help command and command routing

**Files:**
- Create: `src/commands/help.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create src/commands/help.ts**

```bash
mkdir -p src/commands
```

Write `src/commands/help.ts`:

```typescript
export function runHelp(): void {
  console.log(`Usage: todo <command> [arguments]

Commands:
  add <text>         Add a new task (creation date auto-stamped today)
  list [filters]     List open tasks. Filters: +project @context (A) keyword
  listall [filters]  List all tasks including completed. Same filter syntax.
  done <n>           Mark task #n as complete
  rm <n>             Permanently delete task #n
  pri <n> <A-Z>      Set or replace priority on task #n
  depri <n>          Remove priority from task #n
  search <term>      Search all tasks (open and completed)
  report             Show stats: totals, by project, by context
  help               Show this help

Options:
  --file <path>      Use a specific todo.txt file (overrides TODO_FILE env var)

Examples:
  todo add "Buy groceries @personal"
  todo add "(A) Fix login bug +backend @work due:2026-05-10"
  todo list +backend
  todo list @work (B)
  todo done 3
  todo pri 2 A
  todo search login

File location (in order of precedence):
  1. --file <path> flag
  2. TODO_FILE environment variable
  3. ./todo.txt in current directory`);
}
```

- [ ] **Step 2: Rewrite src/index.ts with routing stub**

```typescript
#!/usr/bin/env bun
import { runHelp } from './commands/help';
import { resolveFile } from './store';

const argv = process.argv.slice(2);

const fileIdx = argv.indexOf('--file');
let filePath: string | undefined;
if (fileIdx !== -1) {
  filePath = argv[fileIdx + 1];
  argv.splice(fileIdx, 2);
}

const [cmd, ...args] = argv;
const file = resolveFile(filePath);

switch (cmd) {
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    runHelp();
    break;
  default:
    console.error(`todo: unknown command '${cmd}'. Run 'todo help' for usage.`);
    process.exit(1);
}
```

- [ ] **Step 3: Smoke test**

```bash
bun run src/index.ts help
bun run src/index.ts --help
bun run src/index.ts -h
```

Expected: Help text printed for all three. No errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/help.ts src/index.ts
git commit -m "feat: help command and command routing"
```

---

### Task 7: add command

**Files:**
- Create: `src/commands/add.ts`
- Modify: `src/index.ts`
- Create: `tests/commands.test.ts`

- [ ] **Step 1: Write failing smoke tests**

Create `tests/commands.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TMP = join(tmpdir(), `todo-cmd-test-${process.pid}.txt`);

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k !== 'TODO_FILE')
  ) as Record<string, string>;
  const result = Bun.spawnSync(
    ['bun', 'run', 'src/index.ts', '--file', TMP, ...args],
    { cwd: process.cwd(), env }
  );
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    code: result.exitCode ?? 0,
  };
}

// File-level cleanup: runs before and after every test in this file
beforeEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });
afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

describe('todo add', () => {
  it('creates todo.txt and stamps today as creation date', () => {
    const today = new Date().toISOString().slice(0, 10);
    run(['add', 'Buy groceries @personal']);
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain(`${today} Buy groceries @personal`);
  });

  it('preserves priority from inline text, places it before creation date', () => {
    const today = new Date().toISOString().slice(0, 10);
    run(['add', '(A) Fix login bug +backend']);
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain(`(A) ${today} Fix login bug +backend`);
  });

  it('appends multiple tasks', () => {
    run(['add', 'Task one']);
    run(['add', 'Task two']);
    const lines = readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it('prints the added task', () => {
    const { stdout } = run(['add', 'Buy milk']);
    expect(stdout).toContain('Buy milk');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts
```

Expected: tests fail with `unknown command 'add'`

- [ ] **Step 3: Implement src/commands/add.ts**

```typescript
import { appendFileSync } from 'fs';
import { parseLine, serializeTask } from '../parser';
import type { Task } from '../parser';
import { today } from '../output';

export function runAdd(args: string[], filePath: string): void {
  const rawText = args.join(' ').trim();
  if (!rawText) {
    console.error('Usage: todo add <text>');
    process.exit(1);
  }

  const parsed = parseLine(rawText, 0);
  const task: Task = {
    line: 0,
    raw: '',
    done: false,
    priority: parsed.priority,
    creationDate: today(),
    text: parsed.text,
    projects: parsed.projects,
    contexts: parsed.contexts,
    extensions: parsed.extensions,
  };
  task.raw = serializeTask(task);

  appendFileSync(filePath, task.raw + '\n', 'utf8');
  console.log(`Added: ${task.raw}`);
}
```

- [ ] **Step 4: Wire add into src/index.ts**

Add import after the existing imports:

```typescript
import { runAdd } from './commands/add';
```

Add case inside the switch, before `default`:

```typescript
  case 'add':
    runAdd(args, file);
    break;
```

- [ ] **Step 5: Run add tests**

```bash
bun test tests/commands.test.ts
```

Expected: All `todo add` tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/add.ts src/index.ts tests/commands.test.ts
git commit -m "feat: add command"
```

---

### Task 8: list command

**Files:**
- Create: `src/commands/list.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo list', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      '(A) 2026-05-01 Fix login bug +backend @work due:2026-05-01',
      '(B) 2026-05-04 Write release notes +docs @work',
      'Buy groceries @personal',
      'x 2026-05-04 2026-05-01 Deploy server +backend @work',
    ].join('\n') + '\n', 'utf8');
  });

  it('lists only open tasks', () => {
    const { stdout } = run(['list']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Write release notes');
    expect(stdout).toContain('Buy groceries');
    expect(stdout).not.toContain('Deploy server');
  });

  it('filters by project', () => {
    const { stdout } = run(['list', '+backend']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Write release notes');
    expect(stdout).not.toContain('Buy groceries');
  });

  it('filters by context', () => {
    const { stdout } = run(['list', '@personal']);
    expect(stdout).toContain('Buy groceries');
    expect(stdout).not.toContain('Fix login bug');
  });

  it('filters by keyword', () => {
    const { stdout } = run(['list', 'release']);
    expect(stdout).toContain('Write release notes');
    expect(stdout).not.toContain('Fix login bug');
  });

  it('ANDs multiple filters', () => {
    const { stdout } = run(['list', '+backend', '@work']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Buy groceries');
  });

  it('shows summary line', () => {
    const { stdout } = run(['list']);
    expect(stdout).toMatch(/open task/);
  });

  it('errors when file not found', () => {
    unlinkSync(TMP);
    const { stderr, code } = run(['list']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo list"
```

Expected: `unknown command 'list'`

- [ ] **Step 3: Implement src/commands/list.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { formatTask, formatSummary, today, addDays } from '../output';
import type { Task } from '../parser';

export function matchesFilters(task: Task, filters: string[]): boolean {
  return filters.every(f => {
    if (f.startsWith('+')) return task.projects.includes(f);
    if (f.startsWith('@')) return task.contexts.includes(f);
    if (/^\([A-Z]\)$/.test(f)) return task.priority === f[1];
    return task.text.toLowerCase().includes(f.toLowerCase());
  });
}

export function runList(args: string[], filePath: string, includeCompleted = false): void {
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found in current directory. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const todayStr = today();
  const all = readTasks(filePath);
  let tasks = includeCompleted ? all : all.filter(t => !t.done);
  if (args.length > 0) tasks = tasks.filter(t => matchesFilters(t, args));

  if (tasks.length === 0) {
    console.log('No tasks found.');
    return;
  }

  for (const task of tasks) console.log(formatTask(task, todayStr));

  const open = all.filter(t => !t.done).length;
  const done = all.filter(t => t.done).length;
  const overdue = all.filter(t =>
    !t.done && !!t.extensions.due && t.extensions.due < todayStr
  ).length;
  const in3days = addDays(todayStr, 3);
  const dueSoon = all.filter(t =>
    !t.done && !!t.extensions.due &&
    t.extensions.due >= todayStr && t.extensions.due <= in3days
  ).length;

  console.log('');
  console.log(formatSummary(open, done, overdue, dueSoon));
}
```

- [ ] **Step 4: Wire list into src/index.ts**

Add import:

```typescript
import { runList } from './commands/list';
```

Add case inside the switch:

```typescript
  case 'list':
    runList(args, file);
    break;
```

- [ ] **Step 5: Run list tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo list"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/list.ts src/index.ts tests/commands.test.ts
git commit -m "feat: list command with filtering"
```

---

### Task 9: listall command

**Files:**
- Create: `src/commands/listall.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo listall', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      '(A) Fix login bug +backend @work',
      'x 2026-05-04 Deploy server +backend @work',
    ].join('\n') + '\n', 'utf8');
  });

  it('includes completed tasks', () => {
    const { stdout } = run(['listall']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Deploy server');
  });

  it('shows total including completed in summary', () => {
    const { stdout } = run(['listall']);
    expect(stdout).toMatch(/2 total/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo listall"
```

Expected: `unknown command 'listall'`

- [ ] **Step 3: Create src/commands/listall.ts**

```typescript
import { runList } from './list';

export function runListAll(args: string[], filePath: string): void {
  runList(args, filePath, true);
}
```

- [ ] **Step 4: Wire listall into src/index.ts**

Add import:

```typescript
import { runListAll } from './commands/listall';
```

Add case inside the switch:

```typescript
  case 'listall':
    runListAll(args, file);
    break;
```

- [ ] **Step 5: Run listall tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo listall"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/listall.ts src/index.ts tests/commands.test.ts
git commit -m "feat: listall command"
```

---

### Task 10: done command

**Files:**
- Create: `src/commands/done.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo done', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      '(A) 2026-05-01 Fix login bug +backend @work',
      'Buy groceries @personal',
    ].join('\n') + '\n', 'utf8');
  });

  it('marks task done with today as completion date', () => {
    const today = new Date().toISOString().slice(0, 10);
    run(['done', '1']);
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain(`x ${today} 2026-05-01 Fix login bug +backend @work`);
  });

  it('removes priority when marking done', () => {
    run(['done', '1']);
    const content = readFileSync(TMP, 'utf8');
    expect(content).not.toContain('(A)');
  });

  it('errors on out-of-range task number', () => {
    const { stderr, code } = run(['done', '99']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });

  it('errors on non-numeric task number', () => {
    const { stderr, code } = run(['done', 'abc']);
    expect(code).toBe(1);
    expect(stderr).toContain('invalid task number');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo done"
```

Expected: `unknown command 'done'`

- [ ] **Step 3: Implement src/commands/done.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { serializeTask } from '../parser';
import { today } from '../output';

export function runDone(args: string[], filePath: string): void {
  const n = parseInt(args[0] ?? '', 10);
  if (isNaN(n)) {
    console.error('Error: invalid task number. Usage: todo done <n>');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);
  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  task.done = true;
  task.completionDate = today();
  task.priority = undefined;
  task.raw = serializeTask(task);

  writeTasks(filePath, tasks);
  console.log(`Done: ${task.raw}`);
}
```

- [ ] **Step 4: Wire done into src/index.ts**

Add import:

```typescript
import { runDone } from './commands/done';
```

Add case inside the switch:

```typescript
  case 'done':
    runDone(args, file);
    break;
```

- [ ] **Step 5: Run done tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo done"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/done.ts src/index.ts tests/commands.test.ts
git commit -m "feat: done command"
```

---

### Task 11: rm command

**Files:**
- Create: `src/commands/rm.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo rm', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      '(A) Fix login bug +backend',
      'Buy groceries @personal',
      'Call dentist @personal',
    ].join('\n') + '\n', 'utf8');
  });

  it('removes the specified task', () => {
    run(['rm', '2']);
    const lines = readFileSync(TMP, 'utf8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).not.toContain('Buy groceries');
  });

  it('errors on out-of-range task number', () => {
    const { stderr, code } = run(['rm', '99']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo rm"
```

Expected: `unknown command 'rm'`

- [ ] **Step 3: Implement src/commands/rm.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';

export function runRm(args: string[], filePath: string): void {
  const n = parseInt(args[0] ?? '', 10);
  if (isNaN(n)) {
    console.error('Error: invalid task number. Usage: todo rm <n>');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const idx = tasks.findIndex(t => t.line === n);
  if (idx === -1) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  const [removed] = tasks.splice(idx, 1);
  writeTasks(filePath, tasks);
  console.log(`Removed: ${removed!.raw}`);
}
```

- [ ] **Step 4: Wire rm into src/index.ts**

Add import:

```typescript
import { runRm } from './commands/rm';
```

Add case inside the switch:

```typescript
  case 'rm':
    runRm(args, file);
    break;
```

- [ ] **Step 5: Run rm tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo rm"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/rm.ts src/index.ts tests/commands.test.ts
git commit -m "feat: rm command"
```

---

### Task 12: pri and depri commands

**Files:**
- Create: `src/commands/pri.ts`
- Create: `src/commands/depri.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo pri', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      'Fix login bug +backend',
      '(B) Write release notes +docs',
    ].join('\n') + '\n', 'utf8');
  });

  it('sets priority on a task with no priority', () => {
    run(['pri', '1', 'A']);
    const first = readFileSync(TMP, 'utf8').split('\n')[0]!;
    expect(first).toMatch(/^\(A\)/);
  });

  it('replaces existing priority', () => {
    run(['pri', '2', 'A']);
    const second = readFileSync(TMP, 'utf8').split('\n')[1]!;
    expect(second).toMatch(/^\(A\)/);
    expect(second).not.toContain('(B)');
  });

  it('errors on invalid priority', () => {
    const { stderr, code } = run(['pri', '1', 'z']);
    expect(code).toBe(1);
    expect(stderr).toContain('priority must be A-Z');
  });
});

describe('todo depri', () => {
  beforeEach(() => {
    writeFileSync(TMP, ['(A) Fix login bug +backend'].join('\n') + '\n', 'utf8');
  });

  it('removes priority from a task', () => {
    run(['depri', '1']);
    const content = readFileSync(TMP, 'utf8');
    expect(content).not.toContain('(A)');
    expect(content).toContain('Fix login bug');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo pri|todo depri"
```

Expected: `unknown command 'pri'`

- [ ] **Step 3: Implement src/commands/pri.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { serializeTask } from '../parser';

export function runPri(args: string[], filePath: string): void {
  const n = parseInt(args[0] ?? '', 10);
  const p = (args[1] ?? '').toUpperCase();
  if (isNaN(n)) {
    console.error('Error: invalid task number. Usage: todo pri <n> <A-Z>');
    process.exit(1);
  }
  if (!/^[A-Z]$/.test(p)) {
    console.error('Error: priority must be A-Z');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);
  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  task.priority = p;
  task.raw = serializeTask(task);
  writeTasks(filePath, tasks);
  console.log(`Priority set: ${task.raw}`);
}
```

- [ ] **Step 4: Implement src/commands/depri.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { serializeTask } from '../parser';

export function runDepri(args: string[], filePath: string): void {
  const n = parseInt(args[0] ?? '', 10);
  if (isNaN(n)) {
    console.error('Error: invalid task number. Usage: todo depri <n>');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);
  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  task.priority = undefined;
  task.raw = serializeTask(task);
  writeTasks(filePath, tasks);
  console.log(`Priority removed: ${task.raw}`);
}
```

- [ ] **Step 5: Wire both into src/index.ts**

Add imports:

```typescript
import { runPri } from './commands/pri';
import { runDepri } from './commands/depri';
```

Add cases inside the switch:

```typescript
  case 'pri':
    runPri(args, file);
    break;
  case 'depri':
    runDepri(args, file);
    break;
```

- [ ] **Step 6: Run pri and depri tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo pri|todo depri"
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/commands/pri.ts src/commands/depri.ts src/index.ts tests/commands.test.ts
git commit -m "feat: pri and depri commands"
```

---

### Task 13: search command

**Files:**
- Create: `src/commands/search.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo search', () => {
  beforeEach(() => {
    writeFileSync(TMP, [
      '(A) Fix login bug +backend @work',
      'Buy groceries @personal',
      'x 2026-05-04 Deploy login server +backend',
    ].join('\n') + '\n', 'utf8');
  });

  it('searches open and completed tasks', () => {
    const { stdout } = run(['search', 'login']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Deploy login server');
  });

  it('is case-insensitive', () => {
    const { stdout } = run(['search', 'LOGIN']);
    expect(stdout).toContain('Fix login bug');
  });

  it('shows no results message when nothing matches', () => {
    const { stdout } = run(['search', 'zzznomatch']);
    expect(stdout).toContain('No tasks found');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo search"
```

Expected: `unknown command 'search'`

- [ ] **Step 3: Implement src/commands/search.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { formatTask, today } from '../output';

export function runSearch(args: string[], filePath: string): void {
  const term = args.join(' ').trim().toLowerCase();
  if (!term) {
    console.error('Usage: todo search <term>');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath).filter(t => t.raw.toLowerCase().includes(term));

  if (tasks.length === 0) {
    console.log('No tasks found.');
    return;
  }

  for (const task of tasks) console.log(formatTask(task, todayStr));
  console.log(`\n${tasks.length} result${tasks.length === 1 ? '' : 's'}`);
}
```

- [ ] **Step 4: Wire search into src/index.ts**

Add import:

```typescript
import { runSearch } from './commands/search';
```

Add case inside the switch:

```typescript
  case 'search':
    runSearch(args, file);
    break;
```

- [ ] **Step 5: Run search tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo search"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/search.ts src/index.ts tests/commands.test.ts
git commit -m "feat: search command"
```

---

### Task 14: report command

**Files:**
- Create: `src/commands/report.ts`
- Modify: `src/index.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/commands.test.ts`:

```typescript
describe('todo report', () => {
  beforeEach(() => {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(TMP, [
      '(A) Fix login bug +backend @work',
      '(B) Write release notes +docs @work',
      'Buy groceries @personal',
      `x ${today} 2026-05-01 Deploy server +backend @work`,
    ].join('\n') + '\n', 'utf8');
  });

  it('shows task totals', () => {
    const { stdout } = run(['report']);
    expect(stdout).toContain('Total');
    expect(stdout).toContain('Open');
    expect(stdout).toContain('Done');
  });

  it('shows project breakdown', () => {
    const { stdout } = run(['report']);
    expect(stdout).toContain('+backend');
    expect(stdout).toContain('+docs');
  });

  it('shows context breakdown', () => {
    const { stdout } = run(['report']);
    expect(stdout).toContain('@work');
    expect(stdout).toContain('@personal');
  });

  it('counts tasks completed today', () => {
    const { stdout } = run(['report']);
    expect(stdout).toContain('Today');
    expect(stdout).toContain('1');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/commands.test.ts --testNamePattern "todo report"
```

Expected: `unknown command 'report'`

- [ ] **Step 3: Implement src/commands/report.ts**

```typescript
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays } from '../output';

export function runReport(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error(`No todo.txt found. Run 'todo add' to create one.`);
    process.exit(1);
  }

  const todayStr = today();
  const weekAgo = addDays(todayStr, -7);
  const tasks = readTasks(filePath);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const overdue = open.filter(t => !!t.extensions.due && t.extensions.due < todayStr).length;

  const projectMap = new Map<string, { open: number; done: number }>();
  for (const t of tasks) {
    for (const p of t.projects) {
      if (!projectMap.has(p)) projectMap.set(p, { open: 0, done: 0 });
      if (t.done) projectMap.get(p)!.done++;
      else projectMap.get(p)!.open++;
    }
  }

  const contextMap = new Map<string, number>();
  for (const t of open) {
    for (const c of t.contexts) {
      contextMap.set(c, (contextMap.get(c) ?? 0) + 1);
    }
  }

  const doneToday = done.filter(t => t.completionDate === todayStr).length;
  const doneThisWeek = done.filter(t => !!t.completionDate && t.completionDate >= weekAgo).length;

  const lines: string[] = [
    'Tasks',
    `  Total      ${tasks.length}`,
    `  Open       ${open.length}`,
    `  Done       ${done.length}`,
  ];
  if (overdue > 0) lines.push(`  Overdue    ${overdue}`);

  if (projectMap.size > 0) {
    lines.push('', 'By Project');
    for (const [p, counts] of [...projectMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const total = counts.open + counts.done;
      lines.push(`  ${p.padEnd(14)} ${total} task${total === 1 ? '' : 's'} (${counts.open} open, ${counts.done} done)`);
    }
  }

  if (contextMap.size > 0) {
    lines.push('', 'By Context');
    for (const [c, count] of [...contextMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  ${c.padEnd(14)} ${count} task${count === 1 ? '' : 's'}`);
    }
  }

  lines.push('', 'Completed');
  lines.push(`  Today      ${doneToday}`);
  lines.push(`  This week  ${doneThisWeek}`);

  console.log(lines.join('\n'));
}
```

- [ ] **Step 4: Wire report into src/index.ts**

Add import:

```typescript
import { runReport } from './commands/report';
```

Add case inside the switch:

```typescript
  case 'report':
    runReport(file);
    break;
```

- [ ] **Step 5: Run report tests**

```bash
bun test tests/commands.test.ts --testNamePattern "todo report"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/report.ts src/index.ts tests/commands.test.ts
git commit -m "feat: report command"
```

---

### Task 15: Final wiring and full test run

**Files:**
- Modify: `src/index.ts` — write final complete version

- [ ] **Step 1: Write the complete final src/index.ts**

```typescript
#!/usr/bin/env bun
import { runHelp } from './commands/help';
import { runAdd } from './commands/add';
import { runList } from './commands/list';
import { runListAll } from './commands/listall';
import { runDone } from './commands/done';
import { runRm } from './commands/rm';
import { runPri } from './commands/pri';
import { runDepri } from './commands/depri';
import { runSearch } from './commands/search';
import { runReport } from './commands/report';
import { resolveFile } from './store';

const argv = process.argv.slice(2);

const fileIdx = argv.indexOf('--file');
let filePath: string | undefined;
if (fileIdx !== -1) {
  filePath = argv[fileIdx + 1];
  argv.splice(fileIdx, 2);
}

const [cmd, ...args] = argv;
const file = resolveFile(filePath);

switch (cmd) {
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    runHelp();
    break;
  case 'add':       runAdd(args, file); break;
  case 'list':      runList(args, file); break;
  case 'listall':   runListAll(args, file); break;
  case 'done':      runDone(args, file); break;
  case 'rm':        runRm(args, file); break;
  case 'pri':       runPri(args, file); break;
  case 'depri':     runDepri(args, file); break;
  case 'search':    runSearch(args, file); break;
  case 'report':    runReport(file); break;
  default:
    console.error(`todo: unknown command '${cmd}'. Run 'todo help' for usage.`);
    process.exit(1);
}
```

- [ ] **Step 2: Run the full test suite**

```bash
bun test
```

Expected: All tests in `tests/parser.test.ts`, `tests/store.test.ts`, and `tests/commands.test.ts` pass.

- [ ] **Step 3: End-to-end manual smoke test**

```bash
# Start fresh
rm -f todo.txt

bun run src/index.ts help
bun run src/index.ts add "Buy milk @personal"
bun run src/index.ts add "(A) Fix login bug +backend @work due:$(date +%Y-%m-%d)"
bun run src/index.ts add "(B) Write release notes +docs @work"
bun run src/index.ts list
bun run src/index.ts list +backend
bun run src/index.ts list @personal
bun run src/index.ts pri 1 C
bun run src/index.ts list
bun run src/index.ts done 2
bun run src/index.ts listall
bun run src/index.ts search login
bun run src/index.ts report
bun run src/index.ts rm 1
bun run src/index.ts list

# Verify todo.txt is valid todo.txt format
cat todo.txt
```

Expected: each command produces correct output; the final `cat todo.txt` shows spec-compliant lines.

- [ ] **Step 4: Clean up smoke test artifact**

```bash
rm -f todo.txt
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: complete CLI — all commands wired and tested"
```
