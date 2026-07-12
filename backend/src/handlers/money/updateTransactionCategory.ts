import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { transactions, categoryRules } from '../../db/schema';
import { deriveKeyword } from '../../lib/categories';
import { decryptField } from '../../lib/encryption';

const UpdateCategorySchema = z.object({ category: z.string().min(1).max(40) });

export type UpdateCategoryResult =
  | { ok: true; status: 200; body: typeof transactions.$inferSelect }
  | { ok: false; status: 400 | 404; body: { error: string; code: string } };

export async function updateTransactionCategory(
  db: Db,
  userId: string,
  transactionId: string,
  input: unknown,
  encryptionKey: string,
): Promise<UpdateCategoryResult> {
  const parsed = UpdateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid category', code: 'INVALID_INPUT' } };
  }

  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Transaction not found', code: 'NOT_FOUND' } };
  }

  await db.update(transactions).set({ category: parsed.data.category }).where(eq(transactions.id, transactionId));

  if (existing.merchant) {
    const merchant = decryptField(existing.merchant, encryptionKey);
    const keyword = deriveKeyword(merchant);
    if (keyword) {
      await db
        .insert(categoryRules)
        .values({ userId, keyword, category: parsed.data.category })
        .onConflictDoUpdate({
          target: [categoryRules.userId, categoryRules.keyword],
          set: { category: parsed.data.category },
        });
    }
  }

  const [row] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  return {
    ok: true,
    status: 200,
    body: {
      ...row,
      merchant: row.merchant != null ? decryptField(row.merchant, encryptionKey) : row.merchant,
      accountTail: row.accountTail != null ? decryptField(row.accountTail, encryptionKey) : row.accountTail,
      dedupRef: decryptField(row.dedupRef, encryptionKey),
    },
  };
}
