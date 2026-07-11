import { getFocusStreakDays, getUsageMinutesByPackage, listFocusApps } from '@/db/focus';
import { listTasksWithSubtasks } from '@/db/tasks';
import { getMonthSummary } from '@/db/transactions';

export type DashboardSummary = {
  monthSpend: number;
  monthIncome: number;
  tasksDone: number;
  tasksTotal: number;
  screenTimeMinutesToday: number;
  focusStreakDays: number;
  todayScore: number;
};

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { start, end };
}

/**
 * There's no user-set monthly budget yet, so spend has no target to score
 * against - the blended score is task completion + staying under configured
 * Focus budgets today. Spend is still shown on the dashboard, just not
 * folded into the number.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { start, end } = monthBounds();
  const [monthSummary, tasks, focusApps, usageToday, focusStreakDays] = await Promise.all([
    getMonthSummary(start, end),
    listTasksWithSubtasks(),
    listFocusApps(),
    getUsageMinutesByPackage(0),
    getFocusStreakDays(),
  ]);

  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const taskRatio = tasksTotal === 0 ? 1 : tasksDone / tasksTotal;

  const budgetedApps = focusApps.filter((a) => a.budget_minutes != null);
  const screenTimeMinutesToday = Object.values(usageToday).reduce((sum, m) => sum + m, 0);
  const focusRatio =
    budgetedApps.length === 0
      ? 1
      : 1 -
        budgetedApps.reduce((sum, app) => {
          const used = usageToday[app.package_name] ?? 0;
          return sum + Math.min(used / app.budget_minutes!, 1);
        }, 0) /
          budgetedApps.length;

  const todayScore = Math.round(taskRatio * 50 + focusRatio * 50);

  return {
    monthSpend: monthSummary.totalSpend,
    monthIncome: monthSummary.totalIncome,
    tasksDone,
    tasksTotal,
    screenTimeMinutesToday,
    focusStreakDays,
    todayScore,
  };
}
