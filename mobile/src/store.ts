import * as FileSystem from 'expo-file-system';
import { parseLine, serializeTasks } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';
const DEFAULT_TODO = FileSystem.documentDirectory + 'todo.txt';

// CoreSimulator only appears in documentDirectory on a Mac simulator, never on a real device
const IS_SIMULATOR = (FileSystem.documentDirectory ?? '').includes('CoreSimulator');

export const ICLOUD_PATH = (() => {
  if (!FileSystem.documentDirectory) return null;
  if (IS_SIMULATOR) {
    const match = FileSystem.documentDirectory.match(/^file:\/\/\/Users\/([^/]+)\//);
    if (!match) return null;
    return `file:///Users/${match[1]}/Library/Mobile%20Documents/com~apple~CloudDocs/todo.txt`;
  }
  // On real devices, use the app's Documents folder — the iCloud container path requires
  // registered entitlements (com.apple.developer.icloud-container-identifiers) that are
  // not yet configured. Users can point Settings to any path they choose.
  return FileSystem.documentDirectory + 'todo.txt';
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
  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  if (dir) {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      // Directory already exists or is system-managed; proceed to write
    }
  }
  await FileSystem.writeAsStringAsync(filePath, serializeTasks(tasks), { encoding: 'utf8' });
}
