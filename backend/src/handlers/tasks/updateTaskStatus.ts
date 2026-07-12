import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

const UpdateStatusSchema = z.object({ status: z.enum(['open', 'done']) });

export type UpdateStatusResult =
  | { ok: true; status: 200; body: typeof tasks.$inferSelect }
  | { ok: false; status: 400 | 404; body: { error: string; code: string } };

export async function updateTaskStatus(
  db: Db,
  userId: string,
  taskId: string,
  input: unknown,
): Promise<UpdateStatusResult> {
  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid status', code: 'INVALID_INPUT' } };
  }

  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Task not found', code: 'NOT_FOUND' } };
  }

  await db.update(tasks).set({ status: parsed.data.status }).where(eq(tasks.id, taskId));
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { ok: true, status: 200, body: row };
}
