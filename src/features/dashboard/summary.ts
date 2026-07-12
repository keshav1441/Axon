import { apiGet } from '@/api/client';

export type DashboardSummary = {
  monthSpend: number;
  monthIncome: number;
  tasksDone: number;
  tasksTotal: number;
  focusMinutesThisMonth: number;
  focusMinutesThisYear: number;
};

type SummaryResponse = {
  monthSpend: string;
  monthIncome: string;
  tasksDone: number;
  tasksTotal: number;
  focusMinutesThisMonth: number;
  focusMinutesThisYear: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiGet<SummaryResponse>('/api/dashboard/summary');
  return {
    monthSpend: Number(res.monthSpend),
    monthIncome: Number(res.monthIncome),
    tasksDone: res.tasksDone,
    tasksTotal: res.tasksTotal,
    focusMinutesThisMonth: res.focusMinutesThisMonth,
    focusMinutesThisYear: res.focusMinutesThisYear,
  };
}
