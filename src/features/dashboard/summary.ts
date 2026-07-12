import { apiGet } from '@/api/client';
import { getUsageMinutesByPackage, listFocusApps } from '@/features/focus/api';

export type DashboardSummary = {
  monthSpend: number;
  monthIncome: number;
  tasksDone: number;
  tasksTotal: number;
  screenTimeMinutesToday: number;
  focusStreakDays: number;
  todayScore: number;
};

type SummaryResponse = {
  monthSpend: string;
  monthIncome: string;
  tasksDone: number;
  tasksTotal: number;
  screenTimeMinutesToday: number;
  focusStreakDays: number;
};

/**
 * There's no user-set monthly budget yet, so spend has no target to score
 * against - the blended score is task completion + staying under configured
 * Focus budgets today. Spend is still shown on the dashboard, just not
 * folded into the number.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [res, focusApps, usageToday] = await Promise.all([
    apiGet<SummaryResponse>('/api/dashboard/summary'),
    listFocusApps(),
    getUsageMinutesByPackage(),
  ]);

  const taskRatio = res.tasksTotal === 0 ? 1 : res.tasksDone / res.tasksTotal;

  const budgetedApps = focusApps.filter((a) => a.budget_minutes != null);
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
    monthSpend: Number(res.monthSpend),
    monthIncome: Number(res.monthIncome),
    tasksDone: res.tasksDone,
    tasksTotal: res.tasksTotal,
    screenTimeMinutesToday: res.screenTimeMinutesToday,
    focusStreakDays: res.focusStreakDays,
    todayScore,
  };
}
