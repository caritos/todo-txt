import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatFocusTask } from '../output';
import type { Task } from '../parser';
import { baseText } from '../parser';
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
    if (frequency === 'monthly') {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return nextMonthlyDate(start, todayStr) <= windowEnd;
    }
    if (frequency) {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return true;
    }
    const startDate = start.slice(0, 10);
    return startDate >= todayStr && startDate <= windowEnd;
  }

  if (start && frequency) {
    const startDate = start.slice(0, 10);
    if (startDate < addDays(todayStr, -730)) return false;
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1')) <= windowEnd;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr) <= windowEnd;
    return true;
  }

  if (start) {
    const startDate = start.slice(0, 10);
    return startDate >= todayStr && startDate <= windowEnd;
  }

  const due = task.extensions['due'];
  if (!due) return false;
  return due.slice(0, 10) <= windowEnd; // include overdue (no lower bound)
}

function nextWeeklyDate(startStr: string, todayStr: string, every: number = 1): string {
  const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
  const todayDate = new Date(todayStr + 'T12:00:00');
  const intervalDays = every * 7;
  const diffDays = Math.round((todayDate.getTime() - startDate.getTime()) / 86400000);
  if (diffDays <= 0) return startStr.slice(0, 10);
  const cycles = Math.ceil(diffDays / intervalDays);
  const next = new Date(startDate);
  next.setDate(startDate.getDate() + cycles * intervalDays);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function nextMonthlyDate(startStr: string, todayStr: string): string {
  const dom = parseInt(startStr.slice(8, 10));
  const t = new Date(todayStr + 'T12:00:00');
  let candidate = new Date(t.getFullYear(), t.getMonth(), dom);
  if (candidate < t) candidate = new Date(t.getFullYear(), t.getMonth() + 1, dom);
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
}

function focusSortKey(task: Task, todayStr: string): string {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const time = start ? start.slice(10) : ''; // e.g. 'T16:45' or ''

  if (type && start) {
    if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1')) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr) + time;
    if (frequency) return todayStr + time;
    return start.slice(0, 16); // date + time if present
  }

  if (start && frequency) {
    const time = start.slice(10);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1')) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr) + time;
    return todayStr + time; // daily and other frequencies: today at original time
  }

  if (start) return start.slice(0, 16);

  const due = task.extensions['due'];
  if (due) return due;
  return '9999-12-31';
}

const REC_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function focusNextRecurrence(task: Task, todayStr: string): string {
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  if (!start || !frequency) return '';

  const currentDate = focusSortKey(task, todayStr).slice(0, 10);
  const afterCurrent = addDays(currentDate, 1);
  const time = start.length > 10 ? start.slice(11, 16) : '';

  let nextDate: string;
  if (frequency === 'weekly') nextDate = nextWeeklyDate(start, afterCurrent, parseInt(task.extensions['every'] ?? '1'));
  else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent);
  else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent);
  else if (frequency === 'daily') nextDate = afterCurrent;
  else return '';

  const d = new Date(nextDate + 'T12:00:00');
  const showDay = frequency === 'weekly' || frequency === 'daily';
  const dayPart = showDay ? `${REC_DAY[d.getDay()]} ` : '';
  const monthDay = `${REC_MON[d.getMonth()]} ${d.getDate()}`;
  const yearPart = nextDate.slice(0, 4) !== todayStr.slice(0, 4) ? ` ${d.getFullYear()}` : '';
  const label = `${dayPart}${monthDay}${yearPart}${time ? ' ' + time : ''}`;
  return `↻ ${label}`;
}

function stepBack(date: string, freq: string, every = '1'): string {
  if (freq === 'weekly') return addDays(date, -(parseInt(every) * 7));
  if (freq === 'monthly') {
    const d = new Date(date + 'T12:00:00');
    const targetMonth = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
    const targetYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const day = Math.min(d.getDate(), lastDay);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    return `${parseInt(date.slice(0, 4)) - 1}-${date.slice(5)}`;
  }
  return addDays(date, -1);
}

function computeStreak(task: Task, allTasks: Task[], todayStr: string): number {
  const freq = task.extensions['frequency'];
  if (!freq) return 0;
  const base = baseText(task.text);
  const dates = new Set<string>(
    allTasks
      .filter(t => t.done && t.completionDate && baseText(t.text) === base)
      .map(t => t.completionDate!)
  );
  if (dates.size === 0) return 0;
  const mostRecent = [...dates].sort().at(-1)!;
  if (mostRecent < stepBack(todayStr, freq, task.extensions['every'])) return 0;
  let streak = 0;
  let check = mostRecent;
  while (dates.has(check)) {
    streak++;
    check = stepBack(check, freq, task.extensions['every']);
  }
  return streak;
}

export function focusCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const windowEnd = addDays(todayStr, 14);
  const tasks = readTasks(filePath);

  const effToday = (t: Task) => {
    if (t.done) return addDays(t.completionDate ?? todayStr, 1);
    const lastDone = t.extensions['last-done'];
    if (lastDone === todayStr) {
      const start = t.extensions['start'];
      const freq = t.extensions['frequency'];
      const every = t.extensions['every'] ?? '1';
      if (start && freq) {
        if (freq === 'weekly') return addDays(nextWeeklyDate(start, todayStr, parseInt(every)), 1);
        if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr), 1);
        if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr), 1);
      }
      return addDays(todayStr, 1);
    }
    return todayStr;
  };

  const relevant = tasks.filter(t => {
    if (t.done) {
      const freq = t.extensions['frequency'];
      const start = t.extensions['start'];
      if (!(freq && start)) return false;
      const recurUntil = t.extensions['recur-until'];
      if (recurUntil && recurUntil < addDays(t.completionDate ?? todayStr, 1)) return false;
      return true;
    }
    return !isPastEvent(t, todayStr);
  });
  const focused = relevant.filter(t => isInFocusWindow(t, effToday(t), windowEnd));

  if (focused.length === 0) {
    console.log(`\x1b[2mNothing in focus for the next 2 weeks.\x1b[0m`);
    return;
  }

  focused.sort((a, b) => {
    const da = focusSortKey(a, effToday(a));
    const db = focusSortKey(b, effToday(b));
    if (da !== db) return da.localeCompare(db);
    return (a.priority ?? 'Z').localeCompare(b.priority ?? 'Z');
  });
  focused.forEach(t => {
    const et = effToday(t);
    const streak = t.extensions['frequency'] ? computeStreak(t, tasks, todayStr) : 0;
    console.log(formatFocusTask(t, todayStr, focusSortKey(t, et), focusNextRecurrence(t, et), streak));
  });
  console.log(`\x1b[2m${focused.length} item${focused.length === 1 ? '' : 's'} in focus (${todayStr} – ${windowEnd})\x1b[0m`);
}
