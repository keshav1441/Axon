import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { focusApps } from '../../db/schema';

const UpsertAppSchema = z.object({
  packageName: z.string().min(1),
  label: z.string().min(1),
  budgetMinutes: z.number().int().positive().nullable().optional(),
});

export type UpsertAppResult =
  | { ok: true; status: 200; body: typeof focusApps.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function upsertApp(db: Db, userId: string, input: unknown): Promise<UpsertAppResult> {
  const parsed = UpsertAppSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid focus app fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;

  await db
    .insert(focusApps)
    .values({ userId, packageName: data.packageName, label: data.label, budgetMinutes: data.budgetMinutes })
    .onConflictDoUpdate({
      target: [focusApps.userId, focusApps.packageName],
      set: { label: data.label, budgetMinutes: data.budgetMinutes },
    });

  const [row] = await db
    .select()
    .from(focusApps)
    .where(and(eq(focusApps.userId, userId), eq(focusApps.packageName, data.packageName)))
    .limit(1);
  return { ok: true, status: 200, body: row };
}
