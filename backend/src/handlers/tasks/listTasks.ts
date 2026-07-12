import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

export async function listTasks(db: Db, userId: string) {
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}
