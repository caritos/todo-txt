# Event Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `todo event <text>` command that writes a task line with `type:event` automatically appended.

**Architecture:** One new command file (`src/commands/event.ts`) mirroring `add.ts`, wired into the router in `src/index.ts`, documented in `src/commands/help.ts`. No changes to parser, store, or output layers.

**Tech Stack:** TypeScript, Bun runtime, bun:test

---

### Task 1: Write failing tests for `event` command

**Files:**
- Create: `tests/commands/event.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
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

describe('event command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('creates todo.txt if it does not exist', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    expect(existsSync(todoFile)).toBe(true);
  });

  test('appends event with type:event extension', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2} Team standup type:event\n$/);
  });

  test('prints confirmation with event text', () => {
    const { stdout, code } = run(['--file', todoFile, 'event', 'Team standup']);
    expect(code).toBe(0);
    expect(stdout).toContain('Added:');
    expect(stdout).toContain('Team standup');
  });

  test('exits with error if no text given', () => {
    const { stderr, code } = run(['--file', todoFile, 'event']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('handles multi-word event text', () => {
    run(['--file', todoFile, 'event', 'Weekly team sync +work @office']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('+work');
    expect(content).toContain('@office');
    expect(content).toContain('type:event');
  });

  test('type:event is filterable via list command', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    run(['--file', todoFile, 'add', 'Buy milk']);
    const { stdout } = run(['--file', todoFile, 'list', 'type:event']);
    expect(stdout).toContain('Team standup');
    expect(stdout).not.toContain('Buy milk');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/commands/event.test.ts`
Expected: All tests FAIL — "unknown command 'event'" or file not found error

---

### Task 2: Implement the `event` command and wire the router

**Files:**
- Create: `src/commands/event.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create `src/commands/event.ts`**

```typescript
import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';

export function eventCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo event <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  const todayStr = today();
  const raw = `${todayStr} ${text} type:event`;

  appendFileSync(filePath, raw + '\n', 'utf8');

  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
```

- [ ] **Step 2: Add import to `src/index.ts`**

Add this import after the existing imports (around line 11):

```typescript
import { eventCommand } from './commands/event';
```

- [ ] **Step 3: Add routing case to `src/index.ts`**

Add this case inside the `switch (cmd)` block, after the `search` case (around line 79):

```typescript
  case 'event': {
    eventCommand(filePath, filteredArgs.slice(1));
    break;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/commands/event.test.ts`
Expected: All 6 tests PASS

---

### Task 3: Update help text

**Files:**
- Modify: `src/commands/help.ts`

- [ ] **Step 1: Add `event` to the commands list in `src/commands/help.ts`**

Replace the `add <text>` line in the help string so `event` appears right below it:

```
  add <text>          Add a new task (creation date stamped automatically)
  event <text>        Add a new event (creation date stamped, tagged type:event)
```

The full updated help string in `helpCommand()`:

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

Examples:
  todo add "Fix login bug +backend @work due:2026-05-10"
  todo add "(A) Urgent task"
  todo event "Team standup +work @office"
  todo list type:event
  todo list +backend
  todo list @work (B)
  todo done 3
  todo pri 5 A`;
```

- [ ] **Step 2: Run the help tests to verify nothing broke**

Run: `bun test tests/commands/help.test.ts`
Expected: All tests PASS

---

### Task 4: Full test suite + commit

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 2: Commit**

```bash
git add src/commands/event.ts src/index.ts src/commands/help.ts tests/commands/event.test.ts
git commit -m "feat: add event command (type:event tag)"
```
