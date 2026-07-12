import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bankAccounts } from '../../db/schema';
import { decryptField } from '../../lib/encryption';

export async function listBankAccounts(db: Db, userId: string, encryptionKey: string) {
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  return rows.map((row) => ({
    ...row,
    bankName: decryptField(row.bankName, encryptionKey),
    lastDigits: decryptField(row.lastDigits, encryptionKey),
    label: row.label != null ? decryptField(row.label, encryptionKey) : row.label,
  }));
}
