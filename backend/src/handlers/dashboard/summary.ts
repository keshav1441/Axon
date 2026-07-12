import { and, eq, gte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions, tasks, focusSessions } from '../../db/schema';

/** Must match the client's FOCUS_MODE_SESSION_PACKAGE sentinel (src/features/focus/focus-mode.ts). */
const FOCUS_MODE_SESSION_PACKAGE = 'axon.focus_mode_block';

export async function getDashboardSummary(db: Db, userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

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

  const focusModeSessionsThisYear = await db
    .select()
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.appPackage, FOCUS_MODE_SESSION_PACKAGE),
        gte(focusSessions.startedAt, yearStart),
      ),
    );

  let focusMinutesThisMonth = 0;
  let focusMinutesThisYear = 0;
  for (const s of focusModeSessionsThisYear) {
    if (!s.endedAt) continue;
    const minutes = (s.endedAt.getTime() - s.startedAt.getTime()) / 60_000;
    focusMinutesThisYear += minutes;
    if (s.startedAt >= monthStart) focusMinutesThisMonth += minutes;
  }

  return {
    monthSpend,
    monthIncome,
    tasksDone,
    tasksTotal,
    focusMinutesThisMonth: Math.round(focusMinutesThisMonth),
    focusMinutesThisYear: Math.round(focusMinutesThisYear),
  };
}
