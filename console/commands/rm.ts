import { readTasks, writeTasks } from '../store';

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
  const removed: string[] = [];
  const missing: number[] = [];

  for (const n of nums) {
    const idx = tasks.findIndex(t => t.line === n);
    if (idx === -1) {
      missing.push(n);
    } else {
      removed.push(tasks[idx]!.raw);
      tasks.splice(idx, 1);
      // re-index lines after removal so subsequent lookups stay correct
      for (let i = idx; i < tasks.length; i++) tasks[i]!.line = i + 1;
    }
  }

  if (missing.length > 0) {
    for (const n of missing) console.error(`Error: no task #${n}`);
    if (removed.length === 0) process.exit(1);
  }

  writeTasks(filePath, tasks);
  for (const raw of removed) console.log(`Deleted: ${raw}`);
}
