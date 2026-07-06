import * as FileSystem from 'expo-file-system';
import { parseLine, serializeTasks } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';

// Always-writable default inside the app sandbox
export const LOCAL_PATH = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + 'todo.txt'
  : null;

type Config = { filePath: string; weekStart?: 0 | 1 };

async function readConfig(): Promise<Config> {
  try {
    const json = await FileSystem.readAsStringAsync(CONFIG_FILE!, { encoding: 'utf8' });
    return JSON.parse(json) as Config;
  } catch {
    return { filePath: LOCAL_PATH! };
  }
}

async function writeConfig(config: Config): Promise<void> {
  await FileSystem.writeAsStringAsync(CONFIG_FILE!, JSON.stringify(config), { encoding: 'utf8' });
}

export async function resolveFile(): Promise<string> {
  const config = await readConfig();
  return config.filePath;
}

export async function resolveWeekStart(): Promise<0 | 1> {
  const config = await readConfig();
  return config.weekStart ?? 0;
}

export async function setFilePath(filePath: string): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, filePath });
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
