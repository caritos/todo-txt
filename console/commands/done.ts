import { appendFileSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyDone } from '../../shared/commands/done';

export function doneCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo done <n> [n...] | done <task text>');
    process.exit(1);
  }

  // If the first arg isn't a number, treat all args as ad-hoc task text to log as done
  if (isNaN(parseInt(nStrs[0]!, 10))) {
    const text = nStrs.join(' ');
    const todayStr = today();
    appendFileSync(filePath, `x ${todayStr} ${todayStr} ${text}\n`, 'utf8');
    console.log(`Done: ${text}`);
    return;
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo done <n> [n...] | done <task text>');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const todayStr = today();

  let result: ReturnType<typeof applyDone>;
  try {
    result = applyDone(tasks, nums, todayStr);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  const { tasks: updated, completed, skipped } = result;

  for (const s of skipped) {
    if (s.reason === 'already-done-today') {
      console.log(`Already completed today for #${s.num}.`);
    } else {
      console.log(`Task #${s.num} is already complete.`);
    }
  }

  if (completed.length > 0) {
    writeTasks(filePath, updated);
    for (const t of completed) console.log(`Done: ${formatTask(t, todayStr)}`);
  }
}
