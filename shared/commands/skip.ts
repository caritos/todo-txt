import { serializeTask } from '../parser';
import type { Task } from '../parser';
import { focusSortKey } from './focus';

export function applySkip(
  tasks: Task[],
  lineNum: number,
  todayStr: string,
): { tasks: Task[]; skippedDate: string; nextDate: string } {
  const task = tasks.find(t => t.line === lineNum);
  if (!task) throw new Error(`task #${lineNum} not found`);
  if (!task.extensions['frequency']) throw new Error(`task #${lineNum} is not recurring`);

  const skipDate = focusSortKey(task, todayStr).slice(0, 10);

  const existing = task.extensions['exdate'] ?? '';
  const exdateList = existing.split(',').filter(Boolean);
  if (exdateList.includes(skipDate)) {
    return { tasks, skippedDate: skipDate, nextDate: skipDate };
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
  return { tasks, skippedDate: skipDate, nextDate };
}
