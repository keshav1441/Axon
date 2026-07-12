import { and, eq, gte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions, tasks } from '../../db/schema';
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

  const usageToday = await getUsageMinutesByPackage(db, userId, 0);
  const screenTimeMinutesToday = Object.values(usageToday).reduce((sum, m) => sum + m, 0);

  const focusStreakDays = await getFocusStreakDays(db, userId);

  return { monthSpend, monthIncome, tasksDone, tasksTotal, screenTimeMinutesToday, focusStreakDays };
}
