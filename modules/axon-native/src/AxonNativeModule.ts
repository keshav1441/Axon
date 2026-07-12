import { NativeModule, requireNativeModule } from 'expo';

import type { AxonNativeModuleEvents } from './AxonNative.types';

declare class AxonNativeModule extends NativeModule<AxonNativeModuleEvents> {
  hasSmsPermission(): boolean;
  requestSmsPermission(): void;
  getRecentSms(sinceMs: number): Promise<{ body: string; timestampMs: number }[]>;

  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): void;

  hasOverlayPermission(): boolean;
  requestOverlayPermission(): void;

  hasAccessibilityServiceEnabled(): boolean;
  openAccessibilitySettings(): void;

  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;

  setDistractionApps(packages: string[]): void;
  setAppBudgetMinutes(budgets: Record<string, number>): void;
  setNudgeIntervalMinutes(minutes: number): void;

  startFocusMode(): void;
  stopFocusMode(): void;

  listInstalledApps(): { packageName: string; label: string }[];
}

export default requireNativeModule<AxonNativeModule>('AxonNative');
