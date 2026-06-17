import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyAdd } from '../../shared/commands/add';

export function addCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo add <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  const todayStr = today();

  let updated: ReturnType<typeof applyAdd>['tasks'];
  try {
    ({ tasks: updated } = applyAdd(readTasks(filePath), text, todayStr));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  writeTasks(filePath, updated);
  console.log(`Added: ${formatTask(updated[updated.length - 1]!, todayStr)}`);
}
