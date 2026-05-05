import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';

export function searchCommand(filePath: string, termParts: string[]): void {
  if (termParts.length === 0) {
    console.error('Usage: todo search <term>');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const term = termParts.join(' ').toLowerCase();
  const todayStr = today();
  const tasks = readTasks(filePath);

  const matches = tasks.filter(t => t.raw.toLowerCase().includes(term));
  matches.forEach(t => console.log(formatTask(t, todayStr)));

  if (matches.length === 0) {
    console.log(`No tasks matching "${termParts.join(' ')}".`);
  }
}
