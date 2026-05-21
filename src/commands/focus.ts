import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatFocusTask } from '../output';
import type { Task } from '../parser';
import { baseText } from '../parser';
import { isPastEvent } from './list';

const POSITIONAL_POSITIONS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const POSITIONAL_DAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function matchesDayType(dow: number, dayType: string): boolean {
  if (dayType === 'weekend-day') return dow === 0 || dow === 6;
  if (dayType === 'weekday') return dow >= 1 && dow <= 5;
  if (dayType === 'day') return true;
  return dow === (POSITIONAL_DAYS[dayType] ?? -1);
}

function resolvePositionalDay(year: number, month: number, positionalDay: string): number {
  const dashIdx = positionalDay.indexOf('-');
  const position = positionalDay.slice(0, dashIdx);
  const dayType = positionalDay.slice(dashIdx + 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (position === 'last') {
    for (let d = daysInMonth; d >= 1; d--) {
      if (matchesDayType(new Date(year, month, d).getDay(), dayType)) return d;
    }
    return daysInMonth;
  }
  const count = POSITIONAL_POSITIONS[position] ?? 1;
  let found = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (matchesDayType(new Date(year, month, d).getDay(), dayType)) {
      if (++found === count) return d;
    }
  }
  return 1;
}

export function nextYearlyDate(start: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
  const month0 = parseInt(start.slice(5, 7)) - 1;
  const thisYear = parseInt(todayStr.slice(0, 4));

  function occurrenceForYear(year: number): string {
    if (frequencyMonthDay && isNaN(Number(frequencyMonthDay))) {
      const day = resolvePositionalDay(year, month0, frequencyMonthDay);
      return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${year}-${start.slice(5, 10)}`;
  }

  const thisOccurrence = occurrenceForYear(thisYear);
  const result = thisOccurrence >= todayStr ? thisOccurrence : occurrenceForYear(thisYear + 1);
  if (exdates.has(result)) return nextYearlyDate(start, addDays(result, 1), exdates, frequencyMonthDay);
  return result;
}

function taskExdates(task: Task): Set<string> {
  return new Set((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
}

// Returns the most recent scheduled occurrence date that is strictly before todayStr,
// if that occurrence was not completed (no matching last-done). Returns null otherwise.
// Only applies to non-type, non-done weekly/monthly tasks without frequency-day.
function overdueOccurrenceDate(task: Task, todayStr: string): string | null {
  if (task.done || task.extensions['type']) return null;
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const lastDone = task.extensions['last-done'];
  if (!start || !frequency) return null;
  const startDate = start.slice(0, 10);

  const exdates = taskExdates(task);
  let prev: string | null = null;

  if (frequency === 'weekly' && !task.extensions['frequency-day']) {
    const everyN = parseInt(task.extensions['every'] ?? '1');
    const cycleDays = everyN * 7;
    const startD = new Date(startDate + 'T12:00:00');
    const todayD = new Date(todayStr + 'T12:00:00');
    const diffDays = Math.round((todayD.getTime() - startD.getTime()) / 86400000);
    if (diffDays <= 0) return null;
    const d = new Date(startD);
    d.setDate(startD.getDate() + Math.floor(diffDays / cycleDays) * cycleDays);
    prev = isoDate(d);
    // Walk backwards past any exdated occurrences
    while (prev && exdates.has(prev)) {
      const pd = new Date(prev + 'T12:00:00');
      pd.setDate(pd.getDate() - cycleDays);
      const p = isoDate(pd);
      prev = p >= startDate ? p : null;
    }
    // Only flag as overdue if the missed occurrence is within the current cycle window
    // (avoids false positives for long-running tasks with no last-done tracking)
    if (prev && prev < addDays(todayStr, -(cycleDays - 1))) return null;
    // Early completion: done anywhere within this cycle (before the occurrence date) counts
    if (prev && lastDone && lastDone > addDays(prev, -cycleDays)) return null;
  } else if (frequency === 'monthly') {
    const fmd = task.extensions['frequency-month-day'];
    const t = new Date(todayStr + 'T12:00:00');
    function dayForMonth(year: number, month: number): number {
      const val = fmd ?? startDate.slice(8, 10);
      if (isNaN(Number(val))) return resolvePositionalDay(year, month, val);
      return parseInt(val);
    }
    const year = t.getFullYear();
    const month = t.getMonth();
    const dayOfMonth = dayForMonth(year, month);
    const currCandidate = new Date(year, month, dayOfMonth);
    // Only consider this month's occurrence; if it's upcoming don't look at last month
    // (avoids clobbering the sort key when nextMonthlyDate is already within the window)
    if (currCandidate > t) return null;
    const candStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    if (!exdates.has(candStr)) prev = candStr;
  } else {
    return null;
  }

  if (!prev || prev < startDate || prev > todayStr) return null;
  if (lastDone && lastDone >= prev) return null;
  return prev;
}

function isInFocusWindow(task: Task, todayStr: string, windowEnd: string): boolean {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const exdates = taskExdates(task);

  if (type) {
    if (!start) return false;
    if (frequency === 'yearly') {
      const next = nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
      return next >= todayStr && next <= windowEnd;
    }
    if (frequency === 'monthly') {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) <= windowEnd;
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
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']) <= windowEnd;
    if (frequency === 'monthly') {
      const next = nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']);
      return next <= windowEnd || overdueOccurrenceDate(task, todayStr) !== null;
    }
    return startDate <= windowEnd;
  }

  if (start) {
    const startDate = start.slice(0, 10);
    return startDate <= windowEnd;
  }

  const due = task.extensions['due'];
  if (!due) return false;
  return due.slice(0, 10) <= windowEnd;
}

const FREQ_DAY_DOW: Record<string, number> = { Sun: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sat: 6 };

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nextWeeklyDate(startStr: string, todayStr: string, every: number = 1, exdates: Set<string> = new Set(), frequencyDay?: string): string {
  if (frequencyDay) {
    const dows = new Set(frequencyDay.split(',').map(d => FREQ_DAY_DOW[d]).filter((d): d is number => d !== undefined));
    if (every === 1) {
      for (let i = 0; i <= 7; i++) {
        const d = new Date(todayStr + 'T12:00:00');
        d.setDate(d.getDate() + i);
        if (dows.has(d.getDay())) {
          const dateStr = isoDate(d);
          if (exdates.has(dateStr)) return nextWeeklyDate(startStr, addDays(dateStr, 1), every, exdates, frequencyDay);
          return dateStr;
        }
      }
    } else {
      const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
      const todayDate = new Date(todayStr + 'T12:00:00');
      const diffDays = Math.round((todayDate.getTime() - startDate.getTime()) / 86400000);
      const intervalDays = every * 7;
      const startCycle = diffDays <= 0 ? 0 : Math.floor(diffDays / intervalDays);
      for (let cycle = startCycle; cycle <= startCycle + 2; cycle++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + cycle * intervalDays);
        for (let offset = 0; offset < intervalDays; offset++) {
          const candidate = new Date(weekStart);
          candidate.setDate(weekStart.getDate() + offset);
          if (candidate < todayDate) continue;
          if (dows.has(candidate.getDay())) {
            const dateStr = isoDate(candidate);
            if (exdates.has(dateStr)) continue;
            return dateStr;
          }
        }
      }
    }
    return startStr.slice(0, 10);
  }

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
    result = isoDate(next);
  }
  if (exdates.has(result)) return nextWeeklyDate(startStr, addDays(result, 1), every, exdates);
  return result;
}

export function nextMonthlyDate(startStr: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
  const t = new Date(todayStr + 'T12:00:00');

  function dayForMonth(year: number, month: number): number {
    const fmd = frequencyMonthDay ?? startStr.slice(8, 10);
    if (isNaN(Number(fmd))) return resolvePositionalDay(year, month, fmd);
    return parseInt(fmd);
  }

  let year = t.getFullYear();
  let month = t.getMonth();
  let candidate = new Date(year, month, dayForMonth(year, month));
  if (candidate < t) {
    month++;
    if (month > 11) { month = 0; year++; }
    candidate = new Date(year, month, dayForMonth(year, month));
  }
  const result = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
  if (exdates.has(result)) return nextMonthlyDate(startStr, addDays(result, 1), exdates, frequencyMonthDay);
  return result;
}

export function focusSortKey(task: Task, todayStr: string): string {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const time = start ? start.slice(10) : '';
  const exdates = taskExdates(task);

  if (type && start) {
    if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
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
    if (frequency === 'weekly') {
      if (overdueOccurrenceDate(task, todayStr)) return todayStr + time;
      const everyN = parseInt(task.extensions['every'] ?? '1');
      const currentOcc = nextWeeklyDate(start, todayStr, everyN, exdates, task.extensions['frequency-day']);
      const lastDone = task.extensions['last-done'];
      // If last-done falls within the current cycle, the user already did this — show next occurrence
      if (lastDone && lastDone > addDays(currentOcc, -(everyN * 7))) {
        return nextWeeklyDate(start, addDays(currentOcc, 1), everyN, exdates, task.extensions['frequency-day']) + time;
      }
      return currentOcc + time;
    }
    if (frequency === 'monthly') {
      if (overdueOccurrenceDate(task, todayStr)) return todayStr + time;
      return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
    }
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
  if (frequency === 'weekly') nextDate = nextWeeklyDate(start, afterCurrent, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']);
  else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent, exdates, task.extensions['frequency-month-day']);
  else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent, exdates, task.extensions['frequency-month-day']);
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
        if (freq === 'weekly') return addDays(nextWeeklyDate(start, todayStr, parseInt(every), exdates, t.extensions['frequency-day']), 1);
        if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr, exdates, t.extensions['frequency-month-day']), 1);
        if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr, exdates, t.extensions['frequency-month-day']), 1);
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
  const focused = relevant.filter(t => {
    const et = effToday(t);
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
