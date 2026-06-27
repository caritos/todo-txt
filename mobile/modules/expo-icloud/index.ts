import { requireOptionalNativeModule } from 'expo-modules-core';

const ExpoIcloudModule = requireOptionalNativeModule('ExpoIcloud');

export async function initICloudContainer(containerId: string): Promise<string | null> {
  if (!ExpoIcloudModule) {
    throw new Error('iCloud native module not loaded. Please reinstall the app.');
  }
  const result = await ExpoIcloudModule.initContainer(containerId) as { path: string | null; identityAvailable: string };
  if (!result.path) {
    if (result.identityAvailable === 'no') {
      throw new Error('Not signed into iCloud. Go to Settings → [your name] → iCloud and sign in.');
    }
    throw new Error('iCloud is not available for Stark. Go to Settings → [your name] → iCloud → Show All and make sure Stark is enabled.');
  }
  return result.path;
}
