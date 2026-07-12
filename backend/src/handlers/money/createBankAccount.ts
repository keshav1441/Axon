import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { bankAccounts } from '../../db/schema';
import { encryptField, decryptField } from '../../lib/encryption';

const CreateBankAccountSchema = z.object({
  bankName: z.string().min(1),
  lastDigits: z.string().min(2).max(6),
  cardType: z.enum(['debit', 'credit']),
  label: z.string().optional(),
  limitAmount: z.string().optional(),
});

export type CreateBankAccountResult =
  | { ok: true; status: 201; body: typeof bankAccounts.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createBankAccount(
  db: Db,
  userId: string,
  input: unknown,
  encryptionKey: string,
): Promise<CreateBankAccountResult> {
  const parsed = CreateBankAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid bank account fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;
  const id = randomUUID();
  await db.insert(bankAccounts).values({
    id,
    userId,
    bankName: encryptField(data.bankName, encryptionKey),
    lastDigits: encryptField(data.lastDigits, encryptionKey),
    cardType: data.cardType,
    label: data.label ? encryptField(data.label, encryptionKey) : undefined,
    limitAmount: data.limitAmount,
  });
  const [row] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
  return {
    ok: true,
    status: 201,
    body: {
      ...row,
      bankName: decryptField(row.bankName, encryptionKey),
      lastDigits: decryptField(row.lastDigits, encryptionKey),
      label: row.label != null ? decryptField(row.label, encryptionKey) : row.label,
    },
  };
}
