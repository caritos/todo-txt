import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatTask, formatSummary } from '../output';
import type { Task } from '../parser';

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

export function listCommand(filePath: string, filters: string[]): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const open = tasks.filter(t => !t.done);
  const filtered = filters.length > 0 ? open.filter(t => matchesFilters(t, filters)) : open;

  filtered.forEach(t => console.log(formatTask(t, todayStr)));

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
