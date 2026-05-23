import { readTasks, writeTasks } from '../store';
import { today, formatTask, addDays } from '../output';
import { serializeTask, baseText } from '../../shared/parser';
import type { Task } from '../../shared/parser';
import { nextWeeklyDate, nextMonthlyDate } from './focus';

export function doneCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const todayStr = today();
  let anyChange = false;

  for (const n of nums) {
    const task = tasks.find(t => t.line === n);
    if (!task) {
      console.error(`Error: no task #${n}`);
      process.exit(1);
    }

    const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);

    if (isRecurring) {
      const lastDone = task.extensions['last-done'];
      const alreadyToday = lastDone === todayStr || (task.done && task.completionDate === todayStr);
      if (alreadyToday) {
        console.log(`Already completed today for #${n}.`);
        continue;
      }

      // Create completed copy (plain done record, no recurrence extensions)
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

      // Reset original to open if it was done in old format
      if (task.done) {
        task.done = false;
        task.completionDate = undefined;
        task.priority = undefined;
      }

      // Update last-done on original
      const hasLastDone = /(?:^|\s)last-done:[^/\s]\S*/.test(task.text);
      if (hasLastDone) {
        task.text = task.text.replace(/\blast-done:[^/\s]\S*/g, `last-done:${todayStr}`);
      } else {
        task.text = `${task.text} last-done:${todayStr}`;
      }
      task.extensions['last-done'] = todayStr;

      // Advance start to the next scheduled occurrence so focus defers until then
      const startVal = task.extensions['start'];
      const freq = task.extensions['frequency'];
      if (startVal && (freq === 'weekly' || freq === 'monthly')) {
        const every = parseInt(task.extensions['every'] ?? '1');
        const exdates = new Set<string>((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
        const freqDay = task.extensions['frequency-day'];
        const freqMonthDay = task.extensions['frequency-month-day'];
        const currentOcc = freq === 'weekly'
          ? nextWeeklyDate(startVal, todayStr, every, exdates, freqDay)
          : nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay);
        const nextOcc = freq === 'weekly'
          ? nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay)
          : nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay);
        const timePart = startVal.slice(10);
        const newStart = nextOcc + timePart;
        task.text = task.text.replace(/\bstart:\S+/g, `start:${newStart}`);
        task.extensions['start'] = newStart;
      }

      task.raw = serializeTask(task);

      tasks.push(copy);
      console.log(`Done: ${formatTask(task, todayStr)}`);
      anyChange = true;
      continue;
    }

    if (task.done) {
      console.log(`Task #${n} is already complete.`);
      continue;
    }
    task.done = true;
    task.completionDate = todayStr;
    task.priority = undefined;
    task.raw = serializeTask(task);
    console.log(`Done: ${formatTask(task, todayStr)}`);
    anyChange = true;
  }

  if (anyChange) writeTasks(filePath, tasks);
}
