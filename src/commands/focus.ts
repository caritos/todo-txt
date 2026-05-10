import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatFocusTask } from '../output';
import type { Task } from '../parser';
import { baseText } from '../parser';
import { isPastEvent } from './list';

export function nextYearlyDate(start: string, todayStr: string, exdates: Set<string> = new Set()): string {
  const mmdd = start.slice(5, 10);
  const thisYear = todayStr.slice(0, 4);
  const thisOccurrence = `${thisYear}-${mmdd}`;
  const result = thisOccurrence >= todayStr ? thisOccurrence : `${parseInt(thisYear) + 1}-${mmdd}`;
  if (exdates.has(result)) return nextYearlyDate(start, addDays(result, 1), exdates);
  return result;
}

function taskExdates(task: Task): Set<string> {
  return new Set((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
}

function isInFocusWindow(task: Task, todayStr: string, windowEnd: string): boolean {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const exdates = taskExdates(task);

  if (type) {
    if (!start) return false;
    if (frequency === 'yearly') {
      const next = nextYearlyDate(start.slice(0, 10), todayStr, exdates);
      return next >= todayStr && next <= windowEnd;
    }
    if (frequency === 'monthly') {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return nextMonthlyDate(start, todayStr, exdates) <= windowEnd;
    }
    if (frequency) {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return true;
    }
    const startDate = start.slice(0, 10);
    const endDate = (task.extensions['end'] ?? start).slice(0, 10);
    return startDate <= windowEnd && endDate >= todayStr;
  }

  if (start && frequency) {
    const startDate = start.slice(0, 10);
    if (startDate < addDays(todayStr, -730)) return false;
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates) <= windowEnd;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates) <= windowEnd;
    return startDate <= windowEnd;
  }

  if (start) {
    const startDate = start.slice(0, 10);
    return startDate >= todayStr && startDate <= windowEnd;
  }

  const due = task.extensions['due'];
  if (!due) return false;
  return due.slice(0, 10) <= windowEnd;
}

export function nextWeeklyDate(startStr: string, todayStr: string, every: number = 1, exdates: Set<string> = new Set()): string {
  const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
  const todayDate = new Date(todayStr + 'T12:00:00');
  const intervalDays = every * 7;
  const diffDays = Math.round((todayDate.getTime() - startDate.getTime()) / 86400000);
  let result: string;
  if (diffDays <= 0) {
    result = startStr.slice(0, 10);
  } else {
    const cycles = Math.ceil(diffDays / intervalDays);
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + cycles * intervalDays);
    result = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }
  if (exdates.has(result)) return nextWeeklyDate(startStr, addDays(result, 1), every, exdates);
  return result;
}

export function nextMonthlyDate(startStr: string, todayStr: string, exdates: Set<string> = new Set()): string {
  const dom = parseInt(startStr.slice(8, 10));
  const t = new Date(todayStr + 'T12:00:00');
  let candidate = new Date(t.getFullYear(), t.getMonth(), dom);
  if (candidate < t) candidate = new Date(t.getFullYear(), t.getMonth() + 1, dom);
  const result = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
  if (exdates.has(result)) return nextMonthlyDate(startStr, addDays(result, 1), exdates);
  return result;
}

export function focusSortKey(task: Task, todayStr: string): string {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const time = start ? start.slice(10) : '';
  const exdates = taskExdates(task);

  if (type && start) {
    if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr, exdates);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates) + time;
    if (frequency) return todayStr + time;
    // Ongoing multi-day event: sort/display as today instead of its past start
    if (start.slice(0, 10) < todayStr) {
      const end = task.extensions['end'];
      if (end && end.slice(0, 10) >= todayStr) return todayStr + time;
    }
    return start.slice(0, 16);
  }

  if (start && frequency) {
    const time = start.slice(10);
    const startDate = start.slice(0, 10);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates) + time;
    return (startDate > todayStr ? startDate : todayStr) + time;
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

  const exdates = taskExdates(task);
  const currentDate = focusSortKey(task, todayStr).slice(0, 10);
  const afterCurrent = addDays(currentDate, 1);
  const time = start.length > 10 ? start.slice(11, 16) : '';

  let nextDate: string;
  if (frequency === 'weekly') nextDate = nextWeeklyDate(start, afterCurrent, parseInt(task.extensions['every'] ?? '1'), exdates);
  else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent, exdates);
  else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent, exdates);
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
        const exdates = taskExdates(t);
        if (freq === 'weekly') return addDays(nextWeeklyDate(start, todayStr, parseInt(every), exdates), 1);
        if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr, exdates), 1);
        if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr, exdates), 1);
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
  const tomorrow = addDays(todayStr, 1);
  const focused = relevant.filter(t => {
    const et = effToday(t);
    if (!t.done && t.extensions['last-done'] === todayStr) {
      // Hide only if the next occurrence is tomorrow or sooner (daily tasks
      // completed today); weekly/monthly tasks whose next date is further out
      // should still appear.
      const nextOcc = focusSortKey(t, et).slice(0, 10);
      if (nextOcc <= tomorrow) return false;
    }
    return isInFocusWindow(t, et, windowEnd);
  });

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
