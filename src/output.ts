import type { Task } from './parser';

const A = {
  reset:         '\x1b[0m',
  bold:          '\x1b[1m',
  dim:           '\x1b[2m',
  strikethrough: '\x1b[9m',
  red:           '\x1b[91m',
  green:         '\x1b[92m',
  blue:          '\x1b[94m',
  purple:        '\x1b[95m',
  orange:        '\x1b[38;5;208m',
  bgRed:         '\x1b[41m',
} as const;

function c(color: string, text: string): string {
  return `${color}${text}${A.reset}`;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function colorPriority(p: string): string {
  if (p === 'A') return c(A.bold + A.red, `(${p})`);
  if (p === 'B') return c(A.bold + A.blue, `(${p})`);
  if (p === 'C') return c(A.bold + A.orange, `(${p})`);
  return c(A.bold, `(${p})`);
}

function colorText(text: string, todayStr: string): string {
  return text
    .replace(/(?:^|\s)(\+\S+)/g, (m, tag: string) => m.replace(tag, c(A.green, tag)))
    .replace(/(?:^|\s)(@\S+)/g, (m, tag: string) => m.replace(tag, c(A.purple, tag)))
    .replace(/(?:^|\s)(due:\d{4}-\d{2}-\d{2})/g, (m, due: string) => {
      const date = due.slice(4);
      if (date < todayStr) return m.replace(due, c(A.bgRed + A.red, `${due} OVERDUE`));
      if (date <= addDays(todayStr, 3)) return m.replace(due, c(A.orange, due));
      return m;
    });
}

export function formatTask(task: Task, todayStr: string): string {
  const num = c(A.dim, String(task.line).padStart(2));

  if (task.done) {
    const raw = ['x', task.completionDate, task.creationDate, task.text]
      .filter(Boolean)
      .join(' ');
    return `${num}  ${c(A.dim + A.strikethrough, raw)}`;
  }

  const parts: string[] = [];
  if (task.priority) parts.push(colorPriority(task.priority));
  if (task.creationDate) parts.push(c(A.dim, task.creationDate));
  parts.push(colorText(task.text, todayStr));
  return `${num}  ${parts.join(' ')}`;
}

export function formatSummary(open: number, done: number, overdue: number, dueSoon: number): string {
  const parts: string[] = [];
  if (done > 0) {
    parts.push(`${open + done} total · ${open} open · ${done} completed`);
  } else {
    parts.push(`${open} open task${open === 1 ? '' : 's'}`);
  }
  if (overdue > 0) parts.push(c(A.red, `${overdue} overdue`));
  else if (dueSoon > 0) parts.push(`${dueSoon} due within 3 days`);
  return c(A.dim, parts.join(' · '));
}
