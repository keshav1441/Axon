import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { focusSessions } from '../../../src/db/schema';
import { createSession } from '../../../src/handlers/focus/createSession';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-focus-create';

beforeAll(() => createTestUser(db, userId));
afterAll(() => deleteTestUser(db, userId));

afterEach(async () => {
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
});

describe('createSession handler', () => {
  it('creates a focus session', async () => {
    const result = await createSession(db, userId, {
      appPackage: 'com.instagram.android',
      startedAt: '2026-07-12T10:00:00.000Z',
      endedAt: '2026-07-12T10:15:00.000Z',
      budgetMinutes: 30,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.appPackage).toBe('com.instagram.android');
  });

  it('rejects a missing appPackage', async () => {
    const result = await createSession(db, userId, { startedAt: '2026-07-12T10:00:00.000Z' });
    expect(result.ok).toBe(false);
  });
});
