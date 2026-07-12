import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions, tasks, focusSessions } from '../../../src/db/schema';
import { clearData } from '../../../src/handlers/data/clearData';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-clear-data';

beforeAll(() => createTestUser(db, userId));
afterAll(() => deleteTestUser(db, userId));

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
});

async function seed() {
  await db.insert(transactions).values({
    id: `${userId}-tx`,
    userId,
    amount: '10.00',
    direction: 'debit',
    source: 'manual',
    occurredAt: new Date(),
    dedupRef: `${userId}-tx-dedup`,
  });
  await db.insert(tasks).values({ id: `${userId}-task`, userId, title: 'Test task' });
  await db.insert(focusSessions).values({
    id: `${userId}-session`,
    userId,
    appPackage: 'com.example.app',
    startedAt: new Date(),
    endedAt: new Date(),
  });
}

describe('clearData handler', () => {
  it('clears only transactions for scope "money"', async () => {
    await seed();
    const result = await clearData(db, userId, { scope: 'money' });
    expect(result.ok).toBe(true);

    const remainingTx = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const remainingTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
    const remainingSessions = await db.select().from(focusSessions).where(eq(focusSessions.userId, userId));

    expect(remainingTx).toHaveLength(0);
    expect(remainingTasks).toHaveLength(1);
    expect(remainingSessions).toHaveLength(1);
  });

  it('clears everything for scope "all"', async () => {
    await seed();
    const result = await clearData(db, userId, { scope: 'all' });
    expect(result.ok).toBe(true);

    const remainingTx = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const remainingTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
    const remainingSessions = await db.select().from(focusSessions).where(eq(focusSessions.userId, userId));

    expect(remainingTx).toHaveLength(0);
    expect(remainingTasks).toHaveLength(0);
    expect(remainingSessions).toHaveLength(0);
  });

  it('rejects an invalid scope', async () => {
    const result = await clearData(db, userId, { scope: 'bogus' });
    expect(result.ok).toBe(false);
  });
});
