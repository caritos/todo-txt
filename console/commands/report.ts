import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today } from '../output';
import { applyReport } from '../../shared/commands/report';

export function reportCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const { total, open, done, overdue, completedToday, completedThisWeek, byProject, byContext } = applyReport(tasks, todayStr);

  console.log('Tasks');
  console.log(`  Total      ${total}`);
  console.log(`  Open       ${open}`);
  console.log(`  Done       ${done}`);
  if (overdue > 0) console.log(`  Overdue    ${overdue}`);

  if (byProject.size > 0) {
    console.log('\nBy Project');
    for (const [proj, counts] of [...byProject.entries()].sort()) {
      const total = counts.open + counts.done;
      const detail = counts.done > 0
        ? `(${counts.open} open, ${counts.done} done)`
        : `(${counts.open} open)`;
      console.log(`  ${proj.padEnd(10)} ${total} task${total === 1 ? ' ' : 's'} ${detail}`);
    }
  }

  if (byContext.size > 0) {
    console.log('\nBy Context');
    for (const [ctx, counts] of [...byContext.entries()].sort()) {
      const total = counts.open + counts.done;
      console.log(`  ${ctx.padEnd(10)} ${total} task${total === 1 ? '' : 's'}`);
    }
  }

  if (done > 0) {
    console.log('\nCompleted');
    console.log(`  Today      ${completedToday}`);
    console.log(`  This week  ${completedThisWeek}`);
  }
}
