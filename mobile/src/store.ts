import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { parseLine } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';
const DEFAULT_TODO = FileSystem.documentDirectory + 'todo.txt';

const IS_SIMULATOR = Platform.OS === 'ios' && __DEV__ &&
  (FileSystem.documentDirectory ?? '').includes('CoreSimulator');

export const ICLOUD_PATH = (() => {
  if (!FileSystem.documentDirectory) return null;
  if (IS_SIMULATOR) {
    const match = FileSystem.documentDirectory.match(/^file:\/\/\/Users\/([^/]+)\//);
    if (!match) return null;
    return `file:///Users/${match[1]}/Library/Mobile%20Documents/com~apple~CloudDocs/todo.txt`;
  }
  return `${FileSystem.documentDirectory}../Library/Mobile Documents/iCloud~com~apple~CloudDocs/todo.txt`;
})();

type Config = { filePath: string };

async function readConfig(): Promise<Config> {
  try {
    const json = await FileSystem.readAsStringAsync(CONFIG_FILE!, { encoding: 'utf8' });
    return JSON.parse(json) as Config;
  } catch {
    return { filePath: ICLOUD_PATH ?? DEFAULT_TODO! };
  }
}

export async function resolveFile(): Promise<string> {
  const config = await readConfig();
  return config.filePath;
}

export async function setFilePath(filePath: string): Promise<void> {
  await FileSystem.writeAsStringAsync(
    CONFIG_FILE!,
    JSON.stringify({ filePath }),
    { encoding: 'utf8' }
  );
}

export async function readTasks(filePath: string): Promise<Task[]> {
  try {
    const content = await FileSystem.readAsStringAsync(filePath, { encoding: 'utf8' });
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map((line, i) => parseLine(line, i + 1));
  } catch {
    return [];
  }
}

export async function writeTasks(filePath: string, tasks: Task[]): Promise<void> {
  const content = tasks.map(t => t.raw).join('\n') + '\n';
  const tmp = filePath + '.tmp';
  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  if (dir) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.writeAsStringAsync(tmp, content, { encoding: 'utf8' });
  await FileSystem.moveAsync({ from: tmp, to: filePath });
}
