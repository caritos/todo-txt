import type { Task } from '../parser';
import { addDays } from '../utils';

export type ReportResult = {
  total: number;
  open: number;
  done: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  byProject: Map<string, { open: number; done: number }>;
  byContext: Map<string, { open: number; done: number }>;
};

function countByTag(tasks: Task[], getTag: (t: Task) => string[]): Map<string, { open: number; done: number }> {
  const map = new Map<string, { open: number; done: number }>();
  for (const task of tasks) {
    for (const tag of getTag(task)) {
      const entry = map.get(tag) ?? { open: 0, done: 0 };
      if (task.done) entry.done++;
      else entry.open++;
      map.set(tag, entry);
    }
  }
  return map;
}

export function applyReport(tasks: Task[], todayStr: string): ReportResult {
  const weekStart = addDays(todayStr, -6);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  return {
    total: tasks.length,
    open: open.length,
    done: done.length,
    overdue: open.filter(t => t.extensions['due'] !== undefined && t.extensions['due'] < todayStr).length,
    completedToday: done.filter(t => t.completionDate === todayStr).length,
    completedThisWeek: done.filter(t => t.completionDate !== undefined && t.completionDate >= weekStart).length,
    byProject: countByTag(tasks, t => t.projects),
    byContext: countByTag(tasks, t => t.contexts),
  };
}
