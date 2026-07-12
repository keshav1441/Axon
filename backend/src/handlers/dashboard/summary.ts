import { and, eq, gte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions, tasks, focusApps } from '../../db/schema';
import { getUsageMinutesByPackage, getFocusStreakDays } from '../focus/usage';

export async function getDashboardSummary(db: Db, userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthTxns = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredAt, monthStart)));
  const monthSpend = monthTxns
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + Number(t.amount), 0)
    .toFixed(2);
  const monthIncome = monthTxns
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + Number(t.amount), 0)
    .toFixed(2);

  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const tasksDone = userTasks.filter((t) => t.status === 'done').length;
  const tasksTotal = userTasks.length;

  // Only sum currently-configured distraction apps - excludes Focus Mode block
  // sessions (a separate, non-distraction concept recorded in the same table)
  // and any stray rows for apps that are no longer tracked.
  const distractionApps = await db.select().from(focusApps).where(eq(focusApps.userId, userId));
  const usageToday = await getUsageMinutesByPackage(db, userId, 0);
  const screenTimeMinutesToday = distractionApps.reduce((sum, app) => sum + (usageToday[app.packageName] ?? 0), 0);

  const focusStreakDays = await getFocusStreakDays(db, userId);

  return { monthSpend, monthIncome, tasksDone, tasksTotal, screenTimeMinutesToday, focusStreakDays };
}
