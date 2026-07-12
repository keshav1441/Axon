import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { focusApps } from '../../db/schema';

export async function listApps(db: Db, userId: string) {
  return db.select().from(focusApps).where(eq(focusApps.userId, userId));
}
