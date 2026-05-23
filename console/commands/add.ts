import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { buildAddRaw } from '../../shared/commands/add';

export function addCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo add <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  const todayStr = today();

  let raw: string;
  try {
    raw = buildAddRaw(text, todayStr);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  // Append to file (creates if not exists)
  appendFileSync(filePath, raw + '\n', 'utf8');

  // Read back to get the line number for display
  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
