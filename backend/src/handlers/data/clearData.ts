import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { transactions, tasks, focusSessions, categoryRules } from '../../db/schema';

const ClearDataSchema = z.object({
  scope: z.enum(['money', 'tasks', 'focus', 'all']),
});

export type ClearDataResult =
  | { ok: true; status: 200; body: { cleared: string[] } }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function clearData(db: Db, userId: string, input: unknown): Promise<ClearDataResult> {
  const parsed = ClearDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid scope', code: 'INVALID_INPUT' } };
  }
  const { scope } = parsed.data;
  const cleared: string[] = [];

  if (scope === 'money' || scope === 'all') {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(categoryRules).where(eq(categoryRules.userId, userId));
    cleared.push('money');
  }
  if (scope === 'tasks' || scope === 'all') {
    await db.delete(tasks).where(eq(tasks.userId, userId));
    cleared.push('tasks');
  }
  if (scope === 'focus' || scope === 'all') {
    await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
    cleared.push('focus');
  }

  return { ok: true, status: 200, body: { cleared } };
}
