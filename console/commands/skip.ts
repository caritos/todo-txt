import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { today } from '../output';
import { serializeTask } from '../../shared/parser';
import { nextWeeklyDate, nextMonthlyDate, nextYearlyDate, focusSortKey } from './focus';

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
  const task = tasks.find(t => t.line === lineNum);

  if (!task) {
    console.error(`todo: task #${lineNum} not found`);
    process.exit(1);
  }
  if (!task.extensions['frequency']) {
    console.error(`todo: task #${lineNum} is not recurring`);
    process.exit(1);
  }

  const skipDate = focusSortKey(task, todayStr).slice(0, 10);

  const existing = task.extensions['exdate'] ?? '';
  const exdateList = existing.split(',').filter(Boolean);
  if (exdateList.includes(skipDate)) {
    console.log(`Already skipping ${skipDate} for #${lineNum}.`);
    return;
  }
  exdateList.push(skipDate);
  exdateList.sort();
  const newExdate = exdateList.join(',');

  if (existing) {
    task.text = task.text.replace(/(?:^|\s)exdate:\S+/, ` exdate:${newExdate}`).trimStart();
  } else {
    task.text += ` exdate:${newExdate}`;
  }
  task.extensions['exdate'] = newExdate;
  task.raw = serializeTask(task);

  writeTasks(filePath, tasks);

  // Show what it now looks like in focus
  const nextShowing = focusSortKey(task, todayStr).slice(0, 10);
  console.log(`Skipped ${skipDate}: #${lineNum} next shows ${nextShowing}`);
}
