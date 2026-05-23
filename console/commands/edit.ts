import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyEdit } from '../../shared/commands/edit';

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
  const tasks = readTasks(filePath);
  const todayStr = today();

  let result: ReturnType<typeof applyEdit>;
  try {
    result = applyEdit(tasks, n, newText, todayStr);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  writeTasks(filePath, result.tasks);
  console.log(`Updated: ${formatTask(result.updated, todayStr)}`);
}
