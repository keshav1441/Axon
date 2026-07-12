import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';
import { hashForLookup } from '../../../src/lib/encryption';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-money-create';
const KEY = 'b'.repeat(64);

beforeAll(() => createTestUser(db, userId));
afterAll(() => deleteTestUser(db, userId));

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
});

describe('createTransaction handler', () => {
  it('creates a transaction and returns it decrypted', async () => {
    const result = await createTransaction(db, userId, {
      amount: '250.00', direction: 'debit', merchant: 'Zomato', category: 'food',
      source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'ref-1',
    }, KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.merchant).toBe('Zomato');
      expect(result.body.dedupRef).toBe('ref-1');
    }
  });

  it('stores merchant and dedupRef encrypted, not as plaintext', async () => {
    await createTransaction(db, userId, {
      amount: '250.00', direction: 'debit', merchant: 'Zomato', category: 'food',
      source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'ref-encrypted',
    }, KEY);
    const [row] = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(row.merchant).not.toBe('Zomato');
    expect(row.dedupRef).not.toBe('ref-encrypted');
  });

  it('is idempotent on duplicate dedupRef for the same user', async () => {
    const input = {
      amount: '250.00', direction: 'debit', merchant: 'Zomato', category: 'food',
      source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'ref-dup',
    };
    const first = await createTransaction(db, userId, input, KEY);
    const second = await createTransaction(db, userId, { ...input, source: 'notif' }, KEY);

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.body.id).toBe(first.body.id);

    const expectedHash = hashForLookup('ref-dup', KEY);
    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(rows.filter((r) => r.dedupRefHash === expectedHash).length).toBe(1);
  });
});
