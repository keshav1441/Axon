import { apiDelete, apiGet, apiPost } from '@/api/client';
import { enqueuePendingWrite, flushPendingWrites } from '@/api/pending-writes';

export type FocusApp = {
  package_name: string;
  label: string;
  budget_minutes: number | null;
};

type FocusAppRow = { packageName: string; label: string; budgetMinutes: number | null };

function toFocusApp(row: FocusAppRow): FocusApp {
  return { package_name: row.packageName, label: row.label, budget_minutes: row.budgetMinutes };
}

export async function listFocusApps(): Promise<FocusApp[]> {
  const res = await apiGet<{ apps: FocusAppRow[] }>('/api/focus/apps');
  return res.apps.map(toFocusApp);
}

export async function upsertFocusApp(app: FocusApp): Promise<void> {
  await apiPost('/api/focus/apps', {
    packageName: app.package_name,
    label: app.label,
    budgetMinutes: app.budget_minutes,
  });
}

export async function removeFocusApp(packageName: string): Promise<void> {
  await apiDelete(`/api/focus/apps?packageName=${encodeURIComponent(packageName)}`);
}

export async function recordFocusSession(packageName: string, startedAt: number, endedAt: number): Promise<void> {
  if (endedAt <= startedAt) return;
  const body = {
    appPackage: packageName,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
  };
  try {
    await apiPost('/api/focus', body);
  } catch {
    await enqueuePendingWrite('/api/focus', body);
  }
}

export async function flushPendingFocusSessions(): Promise<void> {
  await flushPendingWrites((path, body) => apiPost(path, body));
}

export async function getUsageMinutesByPackage(): Promise<Record<string, number>> {
  const res = await apiGet<{ usage: Record<string, number> }>('/api/focus/usage');
  return res.usage;
}

export async function getFocusStreakDays(): Promise<number> {
  const res = await apiGet<{ streakDays: number }>('/api/focus/streak');
  return res.streakDays;
}
