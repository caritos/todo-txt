import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { serializeTask, baseText } from '../parser';
import type { Task } from '../parser';

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
