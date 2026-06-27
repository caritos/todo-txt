import * as FileSystem from 'expo-file-system';
import { writeICloudFile } from 'expo-icloud';
import { parseLine, serializeTasks } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';

// CoreSimulator only appears in documentDirectory on a Mac simulator, never on a real device
const IS_SIMULATOR = (FileSystem.documentDirectory ?? '').includes('CoreSimulator');

// Always-writable default inside the app sandbox
export const LOCAL_PATH = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + 'todo.txt'
  : null;

// iCloud path — on simulator this is the Mac iCloud Drive (works for CLI dev).
// On real devices this is the intended app container path; requires the
// com.apple.developer.icloud-container-identifiers entitlement (see issue #46).
export const ICLOUD_PATH = (() => {
  if (!FileSystem.documentDirectory) return null;
  if (IS_SIMULATOR) {
    const match = FileSystem.documentDirectory.match(/^file:\/\/\/Users\/([^/]+)\//);
    if (!match) return null;
    return `file:///Users/${match[1]}/Library/Mobile%20Documents/com~apple~CloudDocs/todo.txt`;
  }
  return 'file:///private/var/mobile/Library/Mobile%20Documents/iCloud~com~caritos~todo-txt/Documents/todo.txt';
})();

type Config = { filePath: string; weekStart?: 0 | 1 };

// Old iCloud path used `..` traversal out of the sandbox — iOS rejects it as non-writable.
// Detect it and fall back to LOCAL_PATH so users with a stale saved config recover automatically.
const OLD_ICLOUD_PATH_RE = /\/Documents\/\.\.\/Library\/Mobile.Documents\//;

async function readConfig(): Promise<Config> {
  try {
    const json = await FileSystem.readAsStringAsync(CONFIG_FILE!, { encoding: 'utf8' });
    const config = JSON.parse(json) as Config;
    if (OLD_ICLOUD_PATH_RE.test(config.filePath)) {
      return { ...config, filePath: LOCAL_PATH! };
    }
    return config;
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

const ICLOUD_CONTAINER_ID = 'iCloud.com.caritos.todo-txt';

export async function writeTasks(filePath: string, tasks: Task[]): Promise<void> {
  if (!filePath) throw new Error('File path not configured. Open Settings to set a location.');

  const isIcloud = !IS_SIMULATOR && (filePath.includes('Mobile%20Documents') || filePath.includes('Mobile Documents'));

  if (isIcloud) {
    // iCloud paths require NSFileCoordinator for writes — Expo FileSystem does not use
    // file coordination, so direct writes to iCloud containers fail with "not writable".
    // The native module handles container init, directory creation, and coordinated write.
    const nativePath = filePath.replace(/^file:\/\//, '').replace(/%20/g, ' ');
    await writeICloudFile(nativePath, serializeTasks(tasks), ICLOUD_CONTAINER_ID);
    return;
  }

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
