import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { serializeTask } from '../parser';

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
