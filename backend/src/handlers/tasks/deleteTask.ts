import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

export type DeleteTaskResult =
  | { ok: true; status: 204 }
  | { ok: false; status: 404; body: { error: string; code: string } };

/** Deletes the task and any rows that use it as parentTaskId (subtasks). */
export async function deleteTask(db: Db, userId: string, taskId: string): Promise<DeleteTaskResult> {
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Task not found', code: 'NOT_FOUND' } };
  }

  await db.delete(tasks).where(and(eq(tasks.parentTaskId, taskId), eq(tasks.userId, userId)));
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return { ok: true, status: 204 };
}
