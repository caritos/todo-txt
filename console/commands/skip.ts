import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { today } from '../output';
import { applySkip } from '../../shared/commands/skip';

export function skipCommand(filePath: string, lineArg: string | undefined): void {
  if (!lineArg) {
    console.error('Usage: todo skip <n>');
    process.exit(1);
  }
  const lineNum = parseInt(lineArg);
  if (isNaN(lineNum)) {
    console.error(`todo: invalid task number '${lineArg}'`);
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error("No todo.txt found. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);

  let result: ReturnType<typeof applySkip>;
  try {
    result = applySkip(tasks, lineNum, todayStr);
  } catch (e) {
    console.error(`todo: ${(e as Error).message}`);
    process.exit(1);
  }

  if (result.removed) {
    writeTasks(filePath, result.tasks);
    console.log(`Skipped and removed #${lineNum}`);
    return;
  }
  const { tasks: updated, skippedDate, nextDate } = result;
  if (skippedDate === nextDate) {
    console.log(`Already skipping ${skippedDate} for #${lineNum}.`);
    return;
  }
  writeTasks(filePath, updated);
  console.log(`Skipped ${skippedDate}: #${lineNum} next shows ${nextDate}`);
}
