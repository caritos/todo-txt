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
      return true;
    }
    const startDate = start.slice(0, 10);
    return startDate >= todayStr && startDate <= windowEnd;
  }

  const due = task.extensions['due'];
  if (!due) return false;
  return due >= todayStr && due <= windowEnd;
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

  focused.forEach(t => console.log(formatTask(t, todayStr)));
  console.log(`\x1b[2m${focused.length} item${focused.length === 1 ? '' : 's'} in focus (${todayStr} – ${windowEnd})\x1b[0m`);
}
