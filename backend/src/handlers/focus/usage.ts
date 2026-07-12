import { and, eq, gte, lt } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { focusSessions, focusApps } from '../../db/schema';

function dayBounds(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const start = d;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getUsageMinutesByPackage(db: Db, userId: string, daysAgo = 0): Promise<Record<string, number>> {
  const { start, end } = dayBounds(daysAgo);
  const rows = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), gte(focusSessions.startedAt, start), lt(focusSessions.startedAt, end)));

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (!row.endedAt) continue;
    const minutes = (row.endedAt.getTime() - row.startedAt.getTime()) / 60_000;
    result[row.appPackage] = (result[row.appPackage] ?? 0) + minutes;
  }
  for (const key of Object.keys(result)) {
    result[key] = Math.round(result[key]);
  }
  return result;
}

/** Consecutive days (walking back from today, excluding today) every budgeted app stayed under its limit. */
export async function getFocusStreakDays(db: Db, userId: string, maxLookback = 30): Promise<number> {
  const apps = (await db.select().from(focusApps).where(eq(focusApps.userId, userId))).filter(
    (a) => a.budgetMinutes != null,
  );
  if (apps.length === 0) return 0;

  let streak = 0;
  for (let daysAgo = 1; daysAgo <= maxLookback; daysAgo++) {
    const usage = await getUsageMinutesByPackage(db, userId, daysAgo);
    const withinBudget = apps.every((app) => (usage[app.packageName] ?? 0) <= app.budgetMinutes!);
    if (!withinBudget) break;
    streak++;
  }
  return streak;
}
