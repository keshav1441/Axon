import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { focusSessions } from '../../../src/db/schema';
import { createSession } from '../../../src/handlers/focus/createSession';
import { listSessions } from '../../../src/handlers/focus/listSessions';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-focus-list';
const otherUserId = 'test-user-focus-list-other';

beforeAll(async () => {
  await createTestUser(db, userId);
  await createTestUser(db, otherUserId);
});
afterAll(async () => {
  await deleteTestUser(db, userId);
  await deleteTestUser(db, otherUserId);
});

afterEach(async () => {
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
  await db.delete(focusSessions).where(eq(focusSessions.userId, otherUserId));
});

describe('listSessions handler', () => {
  it('returns only the requesting user\'s sessions', async () => {
    await createSession(db, userId, { appPackage: 'com.instagram.android', startedAt: '2026-07-12T10:00:00.000Z' });
    await createSession(db, otherUserId, { appPackage: 'com.reddit.frontpage', startedAt: '2026-07-12T10:00:00.000Z' });

    const rows = await listSessions(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].appPackage).toBe('com.instagram.android');
  });
});
