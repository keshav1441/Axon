import { eq } from 'drizzle-orm';
import type { Db } from '../../src/db/client';
import { users } from '../../src/db/schema';

export async function createTestUser(db: Db, id: string): Promise<void> {
  await db
    .insert(users)
    .values({
      id,
      firstName: 'Test',
      lastName: 'User',
      email: `${id}@example.com`,
      phone: id,
      passwordHash: 'not-a-real-hash',
    })
    .onConflictDoNothing();
}

export async function deleteTestUser(db: Db, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}
