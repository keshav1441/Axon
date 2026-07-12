import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions, tasks, focusSessions, focusApps } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { createSession } from '../../../src/handlers/focus/createSession';
import { getDashboardSummary } from '../../../src/handlers/dashboard/summary';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-dashboard';
const KEY = 'b'.repeat(64);

beforeAll(() => createTestUser(db, userId));
afterAll(() => deleteTestUser(db, userId));

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
  await db.delete(focusApps).where(eq(focusApps.userId, userId));
});

describe('getDashboardSummary', () => {
  it('aggregates spend, income, task counts, and today\'s screen time', async () => {
    const now = new Date();
    await createTransaction(db, userId, {
      amount: '100.00', direction: 'debit', source: 'sms', occurredAt: now.toISOString(), dedupRef: 'd1',
    }, KEY);
    await createTransaction(db, userId, {
      amount: '50.00', direction: 'credit', source: 'sms', occurredAt: now.toISOString(), dedupRef: 'd2',
    }, KEY);
    await createTask(db, userId, { title: 'Open task' });
    const done = await createTask(db, userId, { title: 'Done task' });
    if (done.ok) {
      await db.update(tasks).set({ status: 'done' }).where(eq(tasks.id, done.body.id));
    }
    const startedAt = new Date(now.getTime() - 20 * 60_000).toISOString();
    const endedAt = now.toISOString();
    await createSession(db, userId, { appPackage: 'com.instagram.android', startedAt, endedAt });

    const summary = await getDashboardSummary(db, userId);
    expect(summary.monthSpend).toBe('100.00');
    expect(summary.monthIncome).toBe('50.00');
    expect(summary.tasksDone).toBe(1);
    expect(summary.tasksTotal).toBe(2);
    expect(summary.screenTimeMinutesToday).toBeGreaterThanOrEqual(19);
    expect(summary.focusStreakDays).toBe(0);
  });
});
