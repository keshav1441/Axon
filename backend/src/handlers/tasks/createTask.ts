import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  parentTaskId: z.string().optional(),
  nagSchedule: z.string().optional(),
});

export type CreateTaskResult =
  | { ok: true; status: 201; body: typeof tasks.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createTask(db: Db, userId: string, input: unknown): Promise<CreateTaskResult> {
  const parsed = CreateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid task fields', code: 'INVALID_INPUT' } };
  }
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    userId,
    title: parsed.data.title,
    parentTaskId: parsed.data.parentTaskId,
    nagSchedule: parsed.data.nagSchedule,
    status: 'open',
  });
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return { ok: true, status: 201, body: row };
}
