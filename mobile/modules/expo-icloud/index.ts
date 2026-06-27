import { requireNativeModule } from 'expo-modules-core';

const ExpoIcloudModule = requireNativeModule('ExpoIcloud');

export async function initICloudContainer(containerId: string): Promise<string | null> {
  return ExpoIcloudModule.initContainer(containerId) as Promise<string | null>;
}
