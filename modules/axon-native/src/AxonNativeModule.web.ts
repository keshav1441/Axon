import { registerWebModule, NativeModule } from 'expo';

import type { AxonNativeModuleEvents } from './AxonNative.types';

/** Axon is Android-only; this stub exists only so shared code doesn't crash under `expo start --web`. */
class AxonNativeModule extends NativeModule<AxonNativeModuleEvents> {
  hasSmsPermission = () => false;
  requestSmsPermission = () => {};
  hasNotificationAccess = () => false;
  openNotificationAccessSettings = () => {};
  hasOverlayPermission = () => false;
  requestOverlayPermission = () => {};
  hasAccessibilityServiceEnabled = () => false;
  openAccessibilitySettings = () => {};
  hasUsageAccess = () => false;
  openUsageAccessSettings = () => {};
  setDistractionApps = (_packages: string[]) => {};
  setAppBudgetMinutes = (_budgets: Record<string, number>) => {};
  setNudgeIntervalMinutes = (_minutes: number) => {};
  startFocusMode = () => {};
  stopFocusMode = () => {};
  listInstalledApps = () => [];
}

export default registerWebModule(AxonNativeModule, 'AxonNativeModule');
