import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { focusSessions } from '../../db/schema';

const CreateSessionSchema = z.object({
  appPackage: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  budgetMinutes: z.number().int().positive().optional(),
});

export type CreateSessionResult =
  | { ok: true; status: 201; body: typeof focusSessions.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createSession(db: Db, userId: string, input: unknown): Promise<CreateSessionResult> {
  const parsed = CreateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid focus session fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;
  const id = randomUUID();
  await db.insert(focusSessions).values({
    id,
    userId,
    appPackage: data.appPackage,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    budgetMinutes: data.budgetMinutes,
  });
  const [row] = await db.select().from(focusSessions).where(eq(focusSessions.id, id)).limit(1);
  return { ok: true, status: 201, body: row };
}
