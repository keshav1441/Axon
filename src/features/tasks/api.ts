import { apiGet, apiPost } from '@/api/client';

export type TaskRow = {
  id: string;
  title: string;
  parentTaskId: string | null;
  status: 'open' | 'done';
  nagSchedule: string | null;
  createdAt: string;
};

export type SubtaskView = { id: string; task_id: string; title: string; done: boolean };
export type TaskWithSubtasks = {
  id: string;
  title: string;
  done: boolean;
  nag_interval_minutes: number | null;
  subtasks: SubtaskView[];
  createdAt: string;
};

function toSubtaskView(row: TaskRow): SubtaskView {
  return { id: row.id, task_id: row.parentTaskId!, title: row.title, done: row.status === 'done' };
}

export async function listTasksWithSubtasks(): Promise<TaskWithSubtasks[]> {
  const res = await apiGet<{ tasks: TaskRow[] }>('/api/tasks');
  const topLevel = res.tasks.filter((t) => !t.parentTaskId);
  const byParent = new Map<string, TaskRow[]>();
  for (const row of res.tasks) {
    if (!row.parentTaskId) continue;
    const list = byParent.get(row.parentTaskId) ?? [];
    list.push(row);
    byParent.set(row.parentTaskId, list);
  }

  return topLevel.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.status === 'done',
    nag_interval_minutes: t.nagSchedule != null ? Number(t.nagSchedule) : null,
    subtasks: (byParent.get(t.id) ?? []).map(toSubtaskView),
    createdAt: t.createdAt,
  }));
}

export async function createTask(title: string, nagIntervalMinutes: number | null = null): Promise<string> {
  const row = await apiPost<TaskRow>('/api/tasks', {
    title,
    nagSchedule: nagIntervalMinutes != null ? String(nagIntervalMinutes) : undefined,
  });
  return row.id;
}

export async function addSubtasks(taskId: string, titles: string[]): Promise<void> {
  for (const title of titles) {
    await apiPost<TaskRow>('/api/tasks', { title, parentTaskId: taskId });
  }
}

export async function toggleTaskDone(id: string, done: boolean): Promise<void> {
  await apiPost(`/api/tasks/status?id=${encodeURIComponent(id)}`, { status: done ? 'done' : 'open' });
}

export const toggleSubtaskDone = toggleTaskDone;

export async function updateSubtaskTitle(id: string, title: string): Promise<void> {
  await apiPost(`/api/tasks/title?id=${encodeURIComponent(id)}`, { title });
}

export async function setTaskNagSchedule(id: string, minutes: number | null): Promise<void> {
  await apiPost(`/api/tasks/title?id=${encodeURIComponent(id)}`, {
    nagSchedule: minutes != null ? String(minutes) : null,
  });
}

export async function deleteSubtask(id: string): Promise<void> {
  await apiPost(`/api/tasks/delete?id=${encodeURIComponent(id)}`);
}

export const deleteTask = deleteSubtask;
