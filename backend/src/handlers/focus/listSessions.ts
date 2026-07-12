import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { focusSessions } from '../../db/schema';

export async function listSessions(db: Db, userId: string) {
  return db.select().from(focusSessions).where(eq(focusSessions.userId, userId)).orderBy(desc(focusSessions.startedAt));
}
