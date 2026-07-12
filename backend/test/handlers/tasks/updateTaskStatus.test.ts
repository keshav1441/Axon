import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { updateTaskStatus } from '../../../src/handlers/tasks/updateTaskStatus';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-status';
const otherUserId = 'test-user-tasks-status-other';

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

describe('updateTaskStatus handler', () => {
  it('updates status for a task owned by the user', async () => {
    const created = await createTask(db, userId, { title: 'Book flight' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTaskStatus(db, userId, created.body.id, { status: 'done' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.status).toBe('done');
  });

  it('returns not-found for a task owned by another user', async () => {
    const created = await createTask(db, otherUserId, { title: 'Not mine' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTaskStatus(db, userId, created.body.id, { status: 'done' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
