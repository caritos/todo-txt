import { serializeTask, baseText } from '../parser';
import type { Task } from '../parser';
import { addDays } from '../utils';
import { nextWeeklyDate, nextMonthlyDate, nextYearlyDate } from './focus';

export interface SkippedTask {
  num: number;
  reason: 'already-done' | 'already-done-today';
}

export function applyDone(
  tasks: Task[],
  nums: number[],
  todayStr: string,
): { tasks: Task[]; completed: Task[]; copies: Task[]; skipped: SkippedTask[] } {
  const completed: Task[] = [];
  const copies: Task[] = [];
  const skipped: SkippedTask[] = [];

  for (const n of nums) {
    const task = tasks.find(t => t.line === n);
    if (!task) throw new Error(`no task #${n}`);

    const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);

    if (isRecurring) {
      const lastDone = task.extensions['last-done'];
      const alreadyToday = lastDone === todayStr || (task.done && task.completionDate === todayStr);
      if (alreadyToday) {
        skipped.push({ num: n, reason: 'already-done-today' });
        continue;
      }

      const copyText = baseText(task.text);
      const copyRaw = ['x', todayStr, ...(task.creationDate ? [task.creationDate] : []), copyText].join(' ');
      const copy: Task = {
        line: 0,
        raw: copyRaw,
        done: true,
        completionDate: todayStr,
        creationDate: task.creationDate,
        text: copyText,
        projects: task.projects,
        contexts: task.contexts,
        extensions: {},
      };

      if (task.done) {
        task.done = false;
        task.completionDate = undefined;
        task.priority = undefined;
      }

      const hasLastDone = /(?:^|\s)last-done:[^/\s]\S*/.test(task.text);
      if (hasLastDone) {
        task.text = task.text.replace(/\blast-done:[^/\s]\S*/g, `last-done:${todayStr}`);
      } else {
        task.text = `${task.text} last-done:${todayStr}`;
      }
      task.extensions['last-done'] = todayStr;

      const startVal = task.extensions['start'];
      const freq = task.extensions['frequency'];
      if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'yearly' || freq === 'daily')) {
        const every = parseInt(task.extensions['every'] ?? '1');
        const exdates = new Set<string>((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
        const freqDay = task.extensions['frequency-day'];
        const freqMonthDay = task.extensions['frequency-month-day'];
        let currentOcc: string;
        let nextOcc: string;
        if (freq === 'weekly') {
          currentOcc = nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
          nextOcc = nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay);
        } else if (freq === 'monthly') {
          currentOcc = nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
          nextOcc = nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay, every);
        } else if (freq === 'daily') {
          const startDate = startVal.slice(0, 10);
          const startMs = new Date(startDate + 'T12:00:00').getTime();
          const todayMs = new Date(todayStr + 'T12:00:00').getTime();
          const daysSinceStart = Math.round((todayMs - startMs) / 86400000);
          const cycles = daysSinceStart <= 0 ? 0 : Math.ceil(daysSinceStart / every);
          currentOcc = addDays(startDate, cycles * every);
          nextOcc = addDays(currentOcc, every);
        } else {
          currentOcc = nextYearlyDate(startVal.slice(0, 10), todayStr, exdates, freqMonthDay, every);
          nextOcc = nextYearlyDate(startVal.slice(0, 10), addDays(currentOcc, 1), exdates, freqMonthDay, every);
        }
        const timePart = startVal.slice(10);
        const newStart = nextOcc + timePart;
        task.text = task.text.replace(/\bstart:\S+/g, `start:${newStart}`);
        task.extensions['start'] = newStart;
      }

      task.raw = serializeTask(task);
      tasks.push(copy);
      completed.push(task);
      copies.push(copy);
      continue;
    }

    if (task.done) {
      skipped.push({ num: n, reason: 'already-done' });
      continue;
    }
    task.done = true;
    task.completionDate = todayStr;
    task.priority = undefined;
    task.raw = serializeTask(task);
    completed.push(task);
  }

  return { tasks, completed, copies, skipped };
}
