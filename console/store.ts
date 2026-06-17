import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseLine, serializeTasks } from '../shared/parser';
import type { Task } from '../shared/parser';

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
  writeFileSync(filePath, serializeTasks(tasks), 'utf8');
}
