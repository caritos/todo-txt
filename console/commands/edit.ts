import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { parseLine, serializeTask } from '../../shared/parser';
import { validateFrequency } from '../../shared/recurrence';

export function editCommand(filePath: string, nStr: string | undefined, textParts: string[]): void {
  if (!nStr || textParts.length === 0) {
    console.error('Usage: todo edit <n> <new text>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo edit <n> <new text>');
    process.exit(1);
  }

  const newText = textParts.join(' ');
  validateFrequency(newText);

  const tasks = readTasks(filePath);
  const task = tasks.find(t => t.line === n);

  if (!task) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  if (task.done) {
    console.error(`Error: cannot edit completed task #${n}`);
    process.exit(1);
  }

  // Build a synthetic raw line from the new text + original creation date,
  // then parse it to extract priority, text body, and extensions correctly.
  const creationDate = task.creationDate ?? today();
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

  writeTasks(filePath, tasks);

  const todayStr = today();
  console.log(`Updated: ${formatTask(task, todayStr)}`);
}
