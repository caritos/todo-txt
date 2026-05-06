import { appendFileSync } from 'fs';
import { parseLine, serializeTask } from '../parser';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { validateFrequency } from '../recurrence';

export function addCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo add <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  validateFrequency(text);
  const todayStr = today();

  // If text already starts with a priority like "(A) ...", preserve it
  // Otherwise, just prepend creation date
  // Full spec-compliant line: if priority present → "(A) YYYY-MM-DD text"
  //                            otherwise          → "YYYY-MM-DD text"
  let raw: string;
  const priorityMatch = text.match(/^\(([A-Z])\)\s+/);
  if (priorityMatch) {
    const rest = text.slice(priorityMatch[0].length);
    raw = `(${priorityMatch[1]}) ${todayStr} ${rest}`;
  } else {
    raw = `${todayStr} ${text}`;
  }

  // Append to file (creates if not exists)
  appendFileSync(filePath, raw + '\n', 'utf8');

  // Read back to get the line number for display
  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
