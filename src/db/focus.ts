import { randomUUID } from 'expo-crypto';

import { getDb } from './client';

export type FocusApp = {
  package_name: string;
  label: string;
  budget_minutes: number | null;
};

export async function listFocusApps(): Promise<FocusApp[]> {
  const db = await getDb();
  const { rows } = await db.execute('SELECT * FROM focus_apps');
  return rows as unknown as FocusApp[];
}

export async function upsertFocusApp(app: FocusApp): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO focus_apps (package_name, label, budget_minutes) VALUES (?, ?, ?)
     ON CONFLICT (package_name) DO UPDATE SET label = excluded.label, budget_minutes = excluded.budget_minutes`,
    [app.package_name, app.label, app.budget_minutes],
  );
}

export async function removeFocusApp(packageName: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM focus_apps WHERE package_name = ?', [packageName]);
}

export async function recordFocusSession(
  packageName: string,
  startedAt: number,
  endedAt: number,
): Promise<void> {
  if (endedAt <= startedAt) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO focus_sessions (id, package_name, started_at, ended_at, duration_seconds)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), packageName, startedAt, endedAt, Math.round((endedAt - startedAt) / 1000)],
  );
}

function dayBounds(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const start = d.getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

export async function getUsageMinutesByPackage(daysAgo = 0): Promise<Record<string, number>> {
  const db = await getDb();
  const { start, end } = dayBounds(daysAgo);
  const { rows } = await db.execute(
    `SELECT package_name, SUM(duration_seconds) as total FROM focus_sessions
     WHERE started_at >= ? AND started_at < ? GROUP BY package_name`,
    [start, end],
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[String(row.package_name)] = Math.round((Number(row.total) || 0) / 60);
  }
  return result;
}

/** Consecutive days (walking back from today, excluding today) every budgeted app stayed under its limit. */
export async function getFocusStreakDays(maxLookback = 30): Promise<number> {
  const apps = (await listFocusApps()).filter((a) => a.budget_minutes != null);
  if (apps.length === 0) return 0;

  let streak = 0;
  for (let daysAgo = 1; daysAgo <= maxLookback; daysAgo++) {
    const usage = await getUsageMinutesByPackage(daysAgo);
    const withinBudget = apps.every((app) => (usage[app.package_name] ?? 0) <= app.budget_minutes!);
    if (!withinBudget) break;
    streak++;
  }
  return streak;
}
