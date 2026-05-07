import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatTask } from '../output';
import type { Task } from '../parser';
import { isPastEvent } from './list';

function nextYearlyDate(start: string, todayStr: string): string {
  const mmdd = start.slice(5, 10);
  const thisYear = todayStr.slice(0, 4);
  const thisOccurrence = `${thisYear}-${mmdd}`;
  if (thisOccurrence >= todayStr) return thisOccurrence;
  return `${parseInt(thisYear) + 1}-${mmdd}`;
}

function isInFocusWindow(task: Task, todayStr: string, windowEnd: string): boolean {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];

  if (type) {
    if (!start) return false;
    if (frequency === 'yearly') {
      const next = nextYearlyDate(start.slice(0, 10), todayStr);
      return next >= todayStr && next <= windowEnd;
    }
    if (frequency) {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return true;
    }
    const startDate = start.slice(0, 10);
    return startDate >= todayStr && startDate <= windowEnd;
  }

  const due = task.extensions['due'];
  if (!due) return false;
  return due >= todayStr && due <= windowEnd;
}

function nextWeeklyDate(startStr: string, todayStr: string): string {
  const startDow = new Date(startStr.slice(0, 10) + 'T12:00:00').getDay();
  const todayDate = new Date(todayStr + 'T12:00:00');
  const daysUntil = (startDow - todayDate.getDay() + 7) % 7;
  const next = new Date(todayDate);
  next.setDate(todayDate.getDate() + daysUntil);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function focusSortKey(task: Task, todayStr: string): string {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];

  if (type && start) {
    if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr);
    if (frequency) return todayStr;
    return start.slice(0, 10);
  }

  const due = task.extensions['due'];
  if (due) return due.slice(0, 10);
  return '9999-12-31';
}

export function focusCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const windowEnd = addDays(todayStr, 14);
  const tasks = readTasks(filePath);
  const open = tasks.filter(t => !t.done && !isPastEvent(t, todayStr));
  const focused = open.filter(t => isInFocusWindow(t, todayStr, windowEnd));

  if (focused.length === 0) {
    console.log(`\x1b[2mNothing in focus for the next 2 weeks.\x1b[0m`);
    return;
  }

  focused.sort((a, b) => {
    const da = focusSortKey(a, todayStr);
    const db = focusSortKey(b, todayStr);
    if (da !== db) return da.localeCompare(db);
    return (a.priority ?? 'Z').localeCompare(b.priority ?? 'Z');
  });
  focused.forEach(t => console.log(formatTask(t, todayStr)));
  console.log(`\x1b[2m${focused.length} item${focused.length === 1 ? '' : 's'} in focus (${todayStr} – ${windowEnd})\x1b[0m`);
}
