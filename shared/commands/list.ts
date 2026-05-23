import type { Task } from '../parser';
import { baseText } from '../parser';

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
