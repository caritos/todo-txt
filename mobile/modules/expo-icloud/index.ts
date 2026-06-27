import { NativeModules } from 'react-native';

const { ExpoIcloud } = NativeModules;

function assertLoaded(): void {
  if (!ExpoIcloud) {
    throw new Error('iCloud native module not loaded. Please reinstall the app.');
  }
}

export async function initICloudContainer(containerId: string): Promise<string> {
  assertLoaded();
  try {
    return await ExpoIcloud.initContainer(containerId) as string;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === 'NOT_SIGNED_IN') {
      throw new Error('Not signed into iCloud. Go to Settings → [your name] → iCloud and sign in.');
    }
    throw new Error('iCloud is not available for Stark. Go to Settings → [your name] → iCloud → Show All and make sure Stark is enabled.');
  }
}

export async function writeICloudFile(path: string, content: string, containerId: string): Promise<void> {
  assertLoaded();
  try {
    await ExpoIcloud.writeFile(path, content, containerId);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not write to iCloud todo.txt. ${detail}`);
  }
}

export async function readICloudFile(path: string, containerId: string): Promise<string> {
  assertLoaded();
  return await ExpoIcloud.readFile(path, containerId) as string;
}
