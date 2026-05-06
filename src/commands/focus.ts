import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { isPastEvent, sortByPriority } from './list';
import type { Task } from '../parser';

function isFocusTask(task: Task, todayStr: string): boolean {
  const due = task.extensions['due'];
  if (due !== undefined && due <= todayStr) return true;
  if (task.priority === 'A') return true;
  return false;
}

export function focusCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const candidates = tasks.filter(t => !t.done && !isPastEvent(t, todayStr));
  const focused = sortByPriority(candidates.filter(t => isFocusTask(t, todayStr)));

  if (focused.length === 0) {
    console.log('nothing needs attention');
    return;
  }

  focused.forEach(t => console.log(formatTask(t, todayStr)));
}
