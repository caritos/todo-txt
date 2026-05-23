import type { Task } from '../parser';

export function applyRm(
  tasks: Task[],
  nums: number[],
): { tasks: Task[]; removed: string[]; missing: number[] } {
  const removed: string[] = [];
  const missing: number[] = [];

  for (const n of nums) {
    const idx = tasks.findIndex(t => t.line === n);
    if (idx === -1) {
      missing.push(n);
    } else {
      removed.push(tasks[idx]!.raw);
      tasks.splice(idx, 1);
      for (let i = idx; i < tasks.length; i++) tasks[i]!.line = i + 1;
    }
  }

  return { tasks, removed, missing };
}
