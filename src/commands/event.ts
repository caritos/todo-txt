import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';

export function eventCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo event <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  const todayStr = today();
  const normalized = text.replace(/\s*\btype:event\b/g, '').trim();
  const raw = `${todayStr} ${normalized} type:event`;

  appendFileSync(filePath, raw + '\n', 'utf8');

  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
