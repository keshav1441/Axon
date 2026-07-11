import { randomUUID } from 'expo-crypto';

import { getDb } from './client';

export type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  done: number;
  position: number;
};

export type TaskRow = {
  id: string;
  title: string;
  done: number;
  nag_interval_minutes: number | null;
  created_at: number;
};

export type TaskWithSubtasks = TaskRow & { subtasks: SubtaskRow[] };

export async function createTask(title: string, nagIntervalMinutes: number | null = null): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.execute(
    'INSERT INTO tasks (id, title, done, nag_interval_minutes, created_at) VALUES (?, 0, ?, ?, ?)',
    [id, title, nagIntervalMinutes, Date.now()],
  );
  return id;
}

export async function addSubtasks(taskId: string, titles: string[]): Promise<void> {
  const db = await getDb();
  const { rows } = await db.execute(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM subtasks WHERE task_id = ?',
    [taskId],
  );
  let position = Number(rows[0]?.maxPos ?? -1);
  for (const title of titles) {
    position += 1;
    await db.execute(
      'INSERT INTO subtasks (id, task_id, title, done, position) VALUES (?, ?, ?, 0, ?)',
      [randomUUID(), taskId, title, position],
    );
  }
}

export async function listTasksWithSubtasks(): Promise<TaskWithSubtasks[]> {
  const db = await getDb();
  const { rows: taskRows } = await db.execute('SELECT * FROM tasks ORDER BY created_at DESC');
  const { rows: subtaskRows } = await db.execute('SELECT * FROM subtasks ORDER BY position ASC');

  const subtasksByTask = new Map<string, SubtaskRow[]>();
  for (const row of subtaskRows as unknown as SubtaskRow[]) {
    const list = subtasksByTask.get(row.task_id) ?? [];
    list.push(row);
    subtasksByTask.set(row.task_id, list);
  }

  return (taskRows as unknown as TaskRow[]).map((task) => ({
    ...task,
    subtasks: subtasksByTask.get(task.id) ?? [],
  }));
}

export async function toggleTaskDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET done = ? WHERE id = ?', [done ? 1 : 0, id]);
}

export async function toggleSubtaskDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE subtasks SET done = ? WHERE id = ?', [done ? 1 : 0, id]);
}

export async function updateSubtaskTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE subtasks SET title = ? WHERE id = ?', [title, id]);
}

export async function deleteSubtask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM subtasks WHERE id = ?', [id]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM subtasks WHERE task_id = ?', [id]);
  await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
}
