import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';
import { decryptField } from '../../lib/encryption';

export async function listTransactions(db: Db, userId: string, encryptionKey: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredAt));

  return rows.map((row) => ({
    ...row,
    merchant: row.merchant != null ? decryptField(row.merchant, encryptionKey) : row.merchant,
    accountTail: row.accountTail != null ? decryptField(row.accountTail, encryptionKey) : row.accountTail,
    dedupRef: decryptField(row.dedupRef, encryptionKey),
  }));
}
