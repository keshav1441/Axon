import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { createTestUser, deleteTestUser } from '../../helpers/testUser';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-create';

beforeAll(() => createTestUser(db, userId));
afterAll(() => deleteTestUser(db, userId));

afterEach(async () => {
  await db.delete(tasks).where(eq(tasks.userId, userId));
});

describe('createTask handler', () => {
  it('creates a task with default status open', async () => {
    const result = await createTask(db, userId, { title: 'Book flight' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.title).toBe('Book flight');
      expect(result.body.status).toBe('open');
    }
  });

  it('rejects an empty title', async () => {
    const result = await createTask(db, userId, { title: '' });
    expect(result.ok).toBe(false);
  });
});
