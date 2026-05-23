import { serializeTask } from '../parser';
import type { Task } from '../parser';

export function applyPri(
  tasks: Task[],
  n: number,
  priority: string,
): { tasks: Task[]; updated: Task } {
  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (task.done) throw new Error(`cannot set priority on completed task #${n}`);

  task.priority = priority.toUpperCase();
  task.raw = serializeTask(task);
  return { tasks, updated: task };
}

export function applyDepri(
  tasks: Task[],
  n: number,
): { tasks: Task[]; updated: Task } {
  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (!task.priority) throw new Error(`task #${n} has no priority`);

  task.priority = undefined;
  task.raw = serializeTask(task);
  return { tasks, updated: task };
}
