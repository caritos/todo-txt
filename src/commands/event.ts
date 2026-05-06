import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { validateFrequency } from '../recurrence';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function getExtValue(text: string, key: string): string | undefined {
  for (const m of text.matchAll(/(?:^|\s)(\w[\w-]*):([^/\s]\S*)/g)) {
    if (m[1] === key) return m[2];
  }
  return undefined;
}

function validateStartEnd(text: string): void {
  for (const key of ['start', 'end']) {
    const val = getExtValue(text, key);
    if (val !== undefined && !DATE_RE.test(val) && !DATETIME_RE.test(val)) {
      console.error(`todo: invalid ${key} '${val}'. Must be YYYY-MM-DD or YYYY-MM-DDThh:mm`);
      process.exit(1);
    }
  }
}

function injectEnd(text: string): string {
  const startVal = getExtValue(text, 'start');
  const endVal = getExtValue(text, 'end');
  if (startVal !== undefined && endVal === undefined) {
    return `${text} end:${startVal}`;
  }
  return text;
}

function resolveType(text: string): string {
  const val = getExtValue(text, 'type');
  if (val === 'anniversary' || val === 'birthday') return val;
  return 'event';
}

export function eventCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo event <text>');
    process.exit(1);
  }

  let text = textParts.join(' ');
  validateFrequency(text);
  validateStartEnd(text);

  const type = resolveType(text);
  if ((type === 'anniversary' || type === 'birthday') && !getExtValue(text, 'start')) {
    console.error(`todo: type:${type} requires a start: date`);
    process.exit(1);
  }

  text = injectEnd(text);

  const todayStr = today();
  const normalized = text.replace(/\s*\btype:(?:event|anniversary|birthday)\b/g, '').trim();
  const raw = `${todayStr} ${normalized} type:${type}`;

  appendFileSync(filePath, raw + '\n', 'utf8');

  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
