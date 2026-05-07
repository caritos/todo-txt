import { readFileSync, appendFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { today } from '../output';

export type ReminderRecord = {
  id: string;
  title: string;
  list: string;
  dueDate: string | null;
  completed: boolean;
  completionDate: string | null;
  creationDate: string | null;
  priority: number;
  notes: string | null;
};

type JXAOutput = {
  allLists: string[];
  reminders: ReminderRecord[];
};

export type JXAExecutor = (jxa: string) => string;

const PRIORITY_MAP: Record<number, string> = { 1: '(A)', 5: '(B)', 9: '(C)' };

export function sanitizeListName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
}

function sanitizeExtValue(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\w@._:,/-]/g, '').slice(0, 200);
}

export function mapReminder(r: ReminderRecord, todayStr: string): string {
  const parts: string[] = [];

  if (r.completed) {
    parts.push('x');
    parts.push(r.completionDate ?? todayStr);
  } else {
    const pri = PRIORITY_MAP[r.priority];
    if (pri) parts.push(pri);
  }

  parts.push(r.creationDate ?? todayStr);
  parts.push(r.title.replace(/\n/g, ' ').trim().slice(0, 500));

  const listTag = sanitizeListName(r.list);
  if (listTag) parts.push(`+${listTag}`);

  if (r.dueDate) parts.push(`due:${r.dueDate}`);

  if (r.notes) {
    const sanitized = sanitizeExtValue(r.notes);
    if (sanitized) parts.push(`note:${sanitized}`);
  }

  parts.push(`reminders-id:${sanitizeExtValue(r.id)}`);

  return parts.join(' ');
}

export function buildExistingIds(filePath: string): Set<string> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return new Set();
  }
  const ids = new Set<string>();
  for (const line of content.split('\n')) {
    const m = line.match(/(?:^|\s)reminders-id:(\S+)/);
    if (m) ids.add(m[1]!);
  }
  return ids;
}

function buildJXA(listFilter?: string): string {
  const listCheck = listFilter
    ? `if (listName !== ${JSON.stringify(listFilter)}) continue;`
    : '';
  return `(function() {
  var app = Application('Reminders');
  var allLists = [];
  var reminders = [];
  var lists = app.lists();
  function safeDate(d) {
    if (!d) return null;
    try {
      var yyyy = d.getFullYear();
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var dd = String(d.getDate()).padStart(2, '0');
      return yyyy + '-' + mm + '-' + dd;
    } catch(e) { return null; }
  }
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i];
    var listName = list.name();
    allLists.push(listName);
    ${listCheck}
    var items = list.reminders();
    for (var j = 0; j < items.length; j++) {
      try {
        var props = items[j].properties();
        reminders.push({
          id: props.id || '',
          title: props.name || '',
          list: listName,
          dueDate: safeDate(props.dueDate),
          completed: !!props.completed,
          completionDate: safeDate(props.completionDate),
          creationDate: safeDate(props.creationDate),
          priority: props.priority || 0,
          notes: props.body ? String(props.body) : null
        });
      } catch(e) {}
    }
  }
  return JSON.stringify({ allLists: allLists, reminders: reminders });
})()`;
}

function defaultExecutor(jxa: string): string {
  return execFileSync('osascript', ['-l', 'JavaScript', '-e', jxa], {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
  });
}

export function remindersCommand(filePath: string, args: string[], executor: JXAExecutor = defaultExecutor): void {
  const listFilter = args[0];
  const todayStr = today();

  const jxa = buildJXA(listFilter);
  let raw: string;
  try {
    raw = executor(jxa);
  } catch (err: unknown) {
    if (err instanceof Error && 'stderr' in err) {
      const stderr = String((err as { stderr?: Buffer | string }).stderr ?? '').trim();
      if (stderr) console.error(stderr);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    console.error('todo: failed to read Reminders — check System Settings → Privacy & Security → Automation');
    process.exit(1);
  }

  let output: JXAOutput;
  try {
    output = JSON.parse(raw) as JXAOutput;
  } catch {
    console.error('todo: unexpected output from Reminders app');
    process.exit(1);
  }

  if (listFilter && !output.allLists.includes(listFilter)) {
    console.error(`todo: no list named '${listFilter}' found in Reminders`);
    process.exit(1);
  }

  const filtered = listFilter
    ? output.reminders.filter(r => r.list === listFilter)
    : output.reminders;

  if (filtered.length === 0) {
    console.log('No reminders found');
    return;
  }

  const existingIds = buildExistingIds(filePath);
  const newLines: string[] = [];
  let skipped = 0;

  for (const r of filtered) {
    const sanitizedId = sanitizeExtValue(r.id);
    if (existingIds.has(sanitizedId)) {
      skipped++;
      continue;
    }
    newLines.push(mapReminder(r, todayStr));
  }

  if (newLines.length === 0) {
    console.log(`Nothing new to import (all ${filtered.length} reminders already present in todo.txt)`);
    return;
  }

  appendFileSync(filePath, newLines.join('\n') + '\n', 'utf8');

  const basename = filePath.split('/').pop() ?? filePath;
  const skipMsg = skipped > 0 ? ` (${skipped} skipped as duplicates)` : '';
  console.log(`Imported ${newLines.length} reminder${newLines.length === 1 ? '' : 's'}${skipMsg} → ${basename}`);
}
