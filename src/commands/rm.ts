import { readTasks, writeTasks } from '../store';

export function rmCommand(filePath: string, nStr: string | undefined): void {
  if (!nStr) {
    console.error('Usage: todo rm <n>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo rm <n>');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const idx = tasks.findIndex(t => t.line === n);

  if (idx === -1) {
    console.error(`Error: no task #${n}`);
    process.exit(1);
  }

  const [removed] = tasks.splice(idx, 1);
  writeTasks(filePath, tasks);
  console.log(`Deleted: ${removed!.raw}`);
}
