import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatTask, formatSummary } from '../output';
import { matchesFilters } from './list';

export function listallCommand(filePath: string, filters: string[]): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const filtered = filters.length > 0 ? tasks.filter(t => matchesFilters(t, filters)) : tasks;

  filtered.forEach(t => console.log(formatTask(t, todayStr)));

  // Summary: stats across ALL tasks (not filtered)
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const overdue = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due < todayStr;
  }).length;
  const dueSoon = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due >= todayStr && due <= addDays(todayStr, 3);
  }).length;

  console.log(formatSummary(open.length, done.length, overdue, dueSoon));
}
