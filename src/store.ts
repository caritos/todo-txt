import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseLine } from './parser';
import type { Task } from './parser';

export function resolveFile(flag?: string): string {
  return flag ?? process.env.TODO_FILE ?? resolve(process.cwd(), 'todo.txt');
}

export function readTasks(filePath: string): Task[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, i) => parseLine(line, i + 1));
}

export function writeTasks(filePath: string, tasks: Task[]): void {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, tasks.map(t => t.raw).join('\n') + '\n', 'utf8');
  renameSync(tmp, filePath);
}
