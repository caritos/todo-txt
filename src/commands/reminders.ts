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
    if (r.completionDate) parts.push(r.completionDate);
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

// Implemented in Task 2
export function buildExistingIds(_filePath: string): Set<string> {
  return new Set();
}

// Implemented in Task 3
export function remindersCommand(_filePath: string, _args: string[], _executor?: JXAExecutor): void {}
