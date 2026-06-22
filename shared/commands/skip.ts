import { serializeTask } from '../parser';
import type { Task } from '../parser';
import { focusSortKey, overdueOccurrenceDate } from './focus';

export type SkipResult =
  | { tasks: Task[]; removed: true }
  | { tasks: Task[]; removed: false; skippedDate: string; nextDate: string };

export function applySkip(
  tasks: Task[],
  lineNum: number,
  todayStr: string,
): SkipResult {
  const task = tasks.find(t => t.line === lineNum);
  if (!task) throw new Error(`task #${lineNum} not found`);
  if (!task.extensions['frequency']) {
    return { tasks: tasks.filter(t => t.line !== lineNum), removed: true };
  }

  const skipDate = overdueOccurrenceDate(task, todayStr) ?? focusSortKey(task, todayStr).slice(0, 10);

  const existing = task.extensions['exdate'] ?? '';
  const exdateList = existing.split(',').filter(Boolean);
  if (exdateList.includes(skipDate)) {
    return { tasks, removed: false as const, skippedDate: skipDate, nextDate: skipDate };
  }
  exdateList.push(skipDate);
  exdateList.sort();
  const newExdate = exdateList.join(',');

  if (existing) {
    task.text = task.text.replace(/(?:^|\s)exdate:\S+/, ` exdate:${newExdate}`).trimStart();
  } else {
    task.text += ` exdate:${newExdate}`;
  }
  task.extensions['exdate'] = newExdate;
  task.raw = serializeTask(task);

  const nextDate = focusSortKey(task, todayStr).slice(0, 10);
  return { tasks, removed: false, skippedDate: skipDate, nextDate };
}
