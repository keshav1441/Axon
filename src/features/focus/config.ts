import { listFocusApps, type FocusApp } from '@/db/focus';
import { AxonNative } from '@/native/axon-native';

export const DEFAULT_NUDGE_INTERVAL_MINUTES = 5;

/** Read synchronously by the session-tracking event handler - avoids a DB hit on every foreground-app change. */
export const focusConfigCache = {
  distractionPackages: new Set<string>(),
};

export async function pushFocusConfigToNative(): Promise<FocusApp[]> {
  const apps = await listFocusApps();
  const budgets: Record<string, number> = {};
  for (const app of apps) {
    if (app.budget_minutes != null) budgets[app.package_name] = app.budget_minutes;
  }

  focusConfigCache.distractionPackages = new Set(apps.map((a) => a.package_name));

  AxonNative.setDistractionApps(apps.map((a) => a.package_name));
  AxonNative.setAppBudgetMinutes(budgets);
  AxonNative.setNudgeIntervalMinutes(DEFAULT_NUDGE_INTERVAL_MINUTES);

  return apps;
}
