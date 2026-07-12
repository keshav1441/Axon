import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).optional(),
    nagSchedule: z.string().nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.nagSchedule !== undefined, {
    message: 'Provide title or nagSchedule',
  });

export type UpdateTitleResult =
  | { ok: true; status: 200; body: typeof tasks.$inferSelect }
  | { ok: false; status: 400 | 404; body: { error: string; code: string } };

export async function updateTaskTitle(
  db: Db,
  userId: string,
  taskId: string,
  input: unknown,
): Promise<UpdateTitleResult> {
  const parsed = UpdateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid update fields', code: 'INVALID_INPUT' } };
  }

  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Task not found', code: 'NOT_FOUND' } };
  }

  const patch: { title?: string; nagSchedule?: string | null } = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.nagSchedule !== undefined) patch.nagSchedule = parsed.data.nagSchedule;

  await db.update(tasks).set(patch).where(eq(tasks.id, taskId));
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { ok: true, status: 200, body: row };
}
