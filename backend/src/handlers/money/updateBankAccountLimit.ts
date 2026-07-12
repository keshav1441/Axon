import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { bankAccounts } from '../../db/schema';
import { decryptField } from '../../lib/encryption';

const UpdateLimitSchema = z.object({ limitAmount: z.string().nullable() });

export type UpdateLimitResult =
  | { ok: true; status: 200; body: typeof bankAccounts.$inferSelect }
  | { ok: false; status: 400 | 404; body: { error: string; code: string } };

export async function updateBankAccountLimit(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
  encryptionKey: string,
): Promise<UpdateLimitResult> {
  const parsed = UpdateLimitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid limit', code: 'INVALID_INPUT' } };
  }
  const [existing] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))
    .limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Bank account not found', code: 'NOT_FOUND' } };
  }
  await db.update(bankAccounts).set({ limitAmount: parsed.data.limitAmount }).where(eq(bankAccounts.id, id));
  const [row] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
  return {
    ok: true,
    status: 200,
    body: {
      ...row,
      bankName: decryptField(row.bankName, encryptionKey),
      lastDigits: decryptField(row.lastDigits, encryptionKey),
      label: row.label != null ? decryptField(row.label, encryptionKey) : row.label,
    },
  };
}
