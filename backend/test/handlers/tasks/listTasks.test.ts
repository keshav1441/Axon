import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { listTasks } from '../../../src/handlers/tasks/listTasks';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-list';
const otherUserId = 'test-user-tasks-list-other';

beforeAll(async () => {
  await createTestUser(db, userId);
  await createTestUser(db, otherUserId);
});
afterAll(async () => {
  await deleteTestUser(db, userId);
  await deleteTestUser(db, otherUserId);
});

afterEach(async () => {
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, otherUserId));
});

describe('listTasks handler', () => {
  it('returns only the requesting user\'s tasks', async () => {
    await createTask(db, userId, { title: 'Mine' });
    await createTask(db, otherUserId, { title: 'Not mine' });

    const rows = await listTasks(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Mine');
  });
});
