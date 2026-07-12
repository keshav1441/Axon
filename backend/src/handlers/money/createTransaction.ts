import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { transactions, categoryRules, bankAccounts } from '../../db/schema';
import { guessCategory } from '../../lib/categories';
import { encryptField, decryptField, hashForLookup } from '../../lib/encryption';

const CreateTransactionSchema = z.object({
  amount: z.string(),
  direction: z.enum(['debit', 'credit']),
  merchant: z.string().optional(),
  accountTail: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountId: z.string().optional(),
  source: z.enum(['sms', 'notif', 'manual']),
  occurredAt: z.string().datetime(),
  dedupRef: z.string().min(1),
});

export type CreateTxResult =
  | { ok: true; status: 200 | 201; body: typeof transactions.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

function decryptRow<T extends { merchant: string | null; accountTail: string | null; dedupRef: string }>(
  row: T,
  encryptionKey: string,
): T {
  return {
    ...row,
    merchant: row.merchant != null ? decryptField(row.merchant, encryptionKey) : row.merchant,
    accountTail: row.accountTail != null ? decryptField(row.accountTail, encryptionKey) : row.accountTail,
    dedupRef: decryptField(row.dedupRef, encryptionKey),
  };
}

export async function createTransaction(
  db: Db,
  userId: string,
  input: unknown,
  encryptionKey: string,
): Promise<CreateTxResult> {
  const parsed = CreateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid transaction fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;
  const dedupRefHash = hashForLookup(data.dedupRef, encryptionKey);

  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.dedupRefHash, dedupRefHash)))
    .limit(1);
  if (existing) {
    return { ok: true, status: 200, body: decryptRow(existing, encryptionKey) };
  }

  const rules = await db.select().from(categoryRules).where(eq(categoryRules.userId, userId));
  const learnedRules = Object.fromEntries(rules.map((r) => [r.keyword, r.category]));
  const category = guessCategory(data.merchant, learnedRules);

  let bankAccountId: string | undefined;
  if (data.bankAccountId) {
    const [owned] = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, data.bankAccountId)))
      .limit(1);
    bankAccountId = owned?.id;
  }
  if (!bankAccountId && data.accountTail) {
    const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
    const match = accounts.find((a) => {
      const lastDigits = decryptField(a.lastDigits, encryptionKey);
      if (lastDigits !== data.accountTail) return false;
      if (!data.bankName) return true;
      const bankName = decryptField(a.bankName, encryptionKey).toLowerCase();
      const parsedBankName = data.bankName.toLowerCase();
      return bankName.includes(parsedBankName) || parsedBankName.includes(bankName);
    });
    bankAccountId = match?.id;
  }

  const id = randomUUID();
  await db.insert(transactions).values({
    id,
    userId,
    bankAccountId,
    amount: data.amount,
    direction: data.direction,
    merchant: data.merchant ? encryptField(data.merchant, encryptionKey) : undefined,
    category,
    accountTail: data.accountTail ? encryptField(data.accountTail, encryptionKey) : undefined,
    source: data.source,
    occurredAt: new Date(data.occurredAt),
    dedupRef: encryptField(data.dedupRef, encryptionKey),
    dedupRefHash,
  });

  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return { ok: true, status: 201, body: decryptRow(row, encryptionKey) };
}
