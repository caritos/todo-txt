import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyPri, applyDepri } from '../../shared/commands/pri';

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
  let result: ReturnType<typeof applyPri>;
  try {
    result = applyPri(tasks, n, p);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
  writeTasks(filePath, result.tasks);
  console.log(`Priority set: ${formatTask(result.updated, today())}`);
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
  let result: ReturnType<typeof applyDepri>;
  try {
    result = applyDepri(tasks, n);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('no priority')) {
      console.log(`Task #${n} has no priority.`);
      return;
    }
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
  writeTasks(filePath, result.tasks);
  console.log(`Priority removed: ${formatTask(result.updated, today())}`);
}
