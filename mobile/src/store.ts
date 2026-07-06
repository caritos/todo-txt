import * as FileSystem from 'expo-file-system';
import { parseLine, serializeTasks } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';

// Always-writable default inside the app sandbox
export const LOCAL_PATH = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + 'todo.txt'
  : null;

type Config = { weekStart?: 0 | 1 };

async function readConfig(): Promise<Config> {
  try {
    const json = await FileSystem.readAsStringAsync(CONFIG_FILE!, { encoding: 'utf8' });
    return JSON.parse(json) as Config;
  } catch {
    return {};
  }
}

async function writeConfig(config: Config): Promise<void> {
  await FileSystem.writeAsStringAsync(CONFIG_FILE!, JSON.stringify(config), { encoding: 'utf8' });
}

// There is only ever one valid storage location now (the app's own sandbox),
// so this is always computed fresh rather than trusted from persisted config —
// a persisted absolute path (embedding the sandbox container UUID) can go stale
// across a reinstall/rebuild and silently fail to read, wiping the task list.
export async function resolveFile(): Promise<string> {
  return LOCAL_PATH!;
}

export async function resolveWeekStart(): Promise<0 | 1> {
  const config = await readConfig();
  return config.weekStart ?? 0;
}

export async function setWeekStart(weekStart: 0 | 1): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, weekStart });
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
  if (!filePath) throw new Error('File path not configured. Open Settings to set a location.');

  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  if (dir) {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch (mkdirErr) {
      let dirExists = false;
      try {
        const info = await FileSystem.getInfoAsync(dir);
        dirExists = info.exists;
      } catch {
        dirExists = true;
      }
      if (!dirExists) {
        const detail = mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr);
        throw new Error(`Could not create directory for todo.txt. Check the file path in Settings. (${detail})`);
      }
    }
  }
  try {
    await FileSystem.writeAsStringAsync(filePath, serializeTasks(tasks), { encoding: 'utf8' });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not write to ${filePath.replace(/^file:\/\//, '')}. Check the file path in Settings. (${detail})`);
  }
}
