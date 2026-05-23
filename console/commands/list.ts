import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatTask, formatSummary } from '../output';
import { baseText, type Task } from '../parser';

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
    line: task.line, // valid at query time only — renumbers on every read
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

export function sortByPriority(tasks: Task[]): Task[] {
  const rank = (p: string | undefined) => p === undefined ? 26 : p.charCodeAt(0) - 65;
  return [...tasks].sort((a, b) => rank(a.priority) - rank(b.priority));
}

const YEARLY_TYPES = new Set(['anniversary', 'birthday']);

export function isPastEvent(task: Task, todayStr: string): boolean {
  if (!task.extensions['type']) return false;
  const start = task.extensions['start'];
  if (!start) return false;
  if (task.extensions['frequency']) {
    const until = task.extensions['recur-until'];
    return until !== undefined && until < todayStr;
  }
  // anniversary/birthday without frequency are inherently yearly-recurring; never "past"
  if (YEARLY_TYPES.has(task.extensions['type']!)) return false;
  // Multi-day event: still ongoing if end: is in the future
  const end = task.extensions['end'];
  if (end) return end.slice(0, 10) < todayStr;
  return start.slice(0, 10) < todayStr;
}

export function matchesFilters(task: Task, filters: string[]): boolean {
  // Each filter must match: ANDed together
  // Filter types:
  //   +project  → task.projects includes filter
  //   @context  → task.contexts includes filter
  //   (A)       → task.priority === 'A'
  //   keyword   → task.text includes filter (case-insensitive)
  return filters.every(f => {
    if (f.startsWith('+')) return task.projects.includes(f);
    if (f.startsWith('@')) return task.contexts.includes(f);
    if (/^\([A-Z]\)$/.test(f)) return task.priority === f[1];
    return task.text.toLowerCase().includes(f.toLowerCase());
  });
}

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
    else if (arg === '--from') {
      if (i + 1 >= args.length) { console.error('--from requires a date argument'); process.exit(1); }
      from = args[++i];
    }
    else if (arg === '--to') {
      if (i + 1 >= args.length) { console.error('--to requires a date argument'); process.exit(1); }
      to = args[++i];
    }
    else if (arg === '--due-from') {
      if (i + 1 >= args.length) { console.error('--due-from requires a date argument'); process.exit(1); }
      dueFrom = args[++i];
    }
    else if (arg === '--due-to') {
      if (i + 1 >= args.length) { console.error('--due-to requires a date argument'); process.exit(1); }
      dueTo = args[++i];
    }
    else { filters.push(arg); }
  }

  return { json, done, from, to, dueFrom, dueTo, filters };
}

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
