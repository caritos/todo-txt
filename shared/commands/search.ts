import type { Task } from '../parser';

export function applySearch(tasks: Task[], term: string): Task[] {
  const lower = term.toLowerCase();
  return tasks.filter(t => t.raw.toLowerCase().includes(lower));
}
