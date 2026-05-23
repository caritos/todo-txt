import { parseLine, serializeTask } from '../parser';
import type { Task } from '../parser';
import { validateFrequency } from '../recurrence';

export function applyEdit(
  tasks: Task[],
  n: number,
  newText: string,
  todayStr: string,
): { tasks: Task[]; updated: Task } {
  validateFrequency(newText);

  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (task.done) throw new Error(`cannot edit completed task #${n}`);

  const creationDate = task.creationDate ?? todayStr;
  let syntheticRaw: string;
  const priorityMatch = newText.match(/^\(([A-Z])\)\s+/);
  if (priorityMatch) {
    const rest = newText.slice(priorityMatch[0].length);
    syntheticRaw = `(${priorityMatch[1]}) ${creationDate} ${rest}`;
  } else {
    syntheticRaw = `${creationDate} ${newText}`;
  }

  const parsed = parseLine(syntheticRaw, task.line);
  task.priority = parsed.priority;
  task.text = parsed.text;
  task.projects = parsed.projects;
  task.contexts = parsed.contexts;
  task.extensions = parsed.extensions;
  task.raw = serializeTask(task);

  return { tasks, updated: task };
}
