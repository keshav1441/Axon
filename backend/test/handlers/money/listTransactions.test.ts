import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';
import { listTransactions } from '../../../src/handlers/money/listTransactions';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-money-list';
const otherUserId = 'test-user-money-list-other';
const KEY = 'b'.repeat(64);

beforeAll(async () => {
  await createTestUser(db, userId);
  await createTestUser(db, otherUserId);
});
afterAll(async () => {
  await deleteTestUser(db, userId);
  await deleteTestUser(db, otherUserId);
});

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, otherUserId));
});

describe('listTransactions handler', () => {
  it('returns only the requesting user\'s transactions, newest first, decrypted', async () => {
    await createTransaction(db, userId, {
      amount: '10.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-10T10:00:00.000Z', dedupRef: 'a',
    }, KEY);
    await createTransaction(db, userId, {
      amount: '20.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-11T10:00:00.000Z', dedupRef: 'b',
    }, KEY);
    await createTransaction(db, otherUserId, {
      amount: '999.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'c',
    }, KEY);

    const rows = await listTransactions(db, userId, KEY);
    expect(rows.length).toBe(2);
    expect(rows[0].dedupRef).toBe('b');
    expect(rows[1].dedupRef).toBe('a');
  });
});
