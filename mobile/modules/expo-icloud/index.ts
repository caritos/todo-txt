import { requireOptionalNativeModule } from 'expo-modules-core';

const ExpoIcloudModule = requireOptionalNativeModule('ExpoIcloud');

export async function initICloudContainer(containerId: string): Promise<string | null> {
  if (!ExpoIcloudModule) return null;
  return ExpoIcloudModule.initContainer(containerId) as Promise<string | null>;
}
