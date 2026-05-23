import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { serializeTask } from '../../shared/parser';

export function priCommand(filePath: string, nStr: string | undefined, priStr: string | undefined): void {
  if (!nStr || !priStr) {
    console.error('Usage: todo pri <n> <A-Z>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo pri <n> <A-Z>');
    process.exit(1);
  }

  const p = priStr.toUpperCase();
  if (!/^[A-Z]$/.test(p)) {
    console.error('Usage: todo pri <n> <A-Z>');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);

  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  if (task.done) {
    console.error(`Error: cannot set priority on completed task #${n}`);
    process.exit(1);
  }

  task.priority = p;
  task.raw = serializeTask(task);
  writeTasks(filePath, tasks);

  const todayStr = today();
  console.log(`Priority set: ${formatTask(task, todayStr)}`);
}

export function depriCommand(filePath: string, nStr: string | undefined): void {
  if (!nStr) {
    console.error('Usage: todo depri <n>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo depri <n>');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);

  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  if (!task.priority) {
    console.log(`Task #${n} has no priority.`);
    return;
  }

  task.priority = undefined;
  task.raw = serializeTask(task);
  writeTasks(filePath, tasks);

  const todayStr = today();
  console.log(`Priority removed: ${formatTask(task, todayStr)}`);
}
