import { readTasks, writeTasks } from '../store';
import { applyRm } from '../../shared/commands/rm';

export function rmCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo rm <n> [n...]');
    process.exit(1);
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo rm <n> [n...]');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const { tasks: updated, removed, missing } = applyRm(tasks, nums);

  if (missing.length > 0) {
    for (const n of missing) console.error(`Error: no task #${n}`);
    if (removed.length === 0) process.exit(1);
  }

  writeTasks(filePath, updated);
  for (const raw of removed) console.log(`Deleted: ${raw}`);
}
