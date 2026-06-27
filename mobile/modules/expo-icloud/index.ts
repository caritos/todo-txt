import { NativeModules } from 'react-native';

const { ExpoIcloud } = NativeModules;

export async function initICloudContainer(containerId: string): Promise<string> {
  if (!ExpoIcloud) {
    throw new Error('iCloud native module not loaded. Please reinstall the app.');
  }
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
