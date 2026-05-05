import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays } from '../output';
import type { Task } from '../parser';

function countByTag(tasks: Task[], getTag: (t: Task) => string[]): Map<string, { open: number; done: number }> {
  const map = new Map<string, { open: number; done: number }>();
  for (const task of tasks) {
    for (const tag of getTag(task)) {
      const entry = map.get(tag) ?? { open: 0, done: 0 };
      if (task.done) entry.done++;
      else entry.open++;
      map.set(tag, entry);
    }
  }
  return map;
}

export function reportCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const weekStart = addDays(todayStr, -6); // last 7 days including today
  const tasks = readTasks(filePath);

  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  const overdue = open.filter(t => {
    const due = t.extensions['due'];
    return due !== undefined && due < todayStr;
  }).length;

  const completedToday = done.filter(t => t.completionDate === todayStr).length;
  const completedThisWeek = done.filter(t => t.completionDate !== undefined && t.completionDate >= weekStart).length;

  // Tasks section
  console.log('Tasks');
  console.log(`  Total      ${tasks.length}`);
  console.log(`  Open       ${open.length}`);
  console.log(`  Done       ${done.length}`);
  if (overdue > 0) console.log(`  Overdue    ${overdue}`);

  // By Project
  const byProject = countByTag(tasks, t => t.projects);
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

  // By Context
  const byContext = countByTag(tasks, t => t.contexts);
  if (byContext.size > 0) {
    console.log('\nBy Context');
    for (const [ctx, counts] of [...byContext.entries()].sort()) {
      const total = counts.open + counts.done;
      console.log(`  ${ctx.padEnd(10)} ${total} task${total === 1 ? '' : 's'}`);
    }
  }

  // Completed
  if (done.length > 0) {
    console.log('\nCompleted');
    console.log(`  Today      ${completedToday}`);
    console.log(`  This week  ${completedThisWeek}`);
  }
}
