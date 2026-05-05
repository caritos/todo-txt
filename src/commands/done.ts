import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { serializeTask } from '../parser';

export function doneCommand(filePath: string, nStr: string | undefined): void {
  if (!nStr) {
    console.error('Usage: todo done <n>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo done <n>');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  // File-not-found: readTasks returns [] for missing file
  const task = tasks.find(t => t.line === n);

  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  if (task.done) {
    console.log(`Task #${n} is already complete.`);
    return;
  }

  const todayStr = today();
  task.done = true;
  task.completionDate = todayStr;
  task.priority = undefined; // spec: priority is removed on completion
  task.raw = serializeTask(task);
  writeTasks(filePath, tasks);

  console.log(`Done: ${formatTask(task, todayStr)}`);
}
