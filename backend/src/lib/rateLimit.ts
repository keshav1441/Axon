import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { authAttempts } from '../db/schema';

export async function checkAndRecordAttempt(
  db: Db,
  key: string,
  maxAttempts = 5,
  windowMinutes = 15,
): Promise<boolean> {
  const now = new Date();
  const [existing] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);

  if (!existing || now.getTime() - existing.windowStart.getTime() > windowMinutes * 60_000) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: authAttempts.key, set: { count: 1, windowStart: now } });
    return true;
  }

  if (existing.count >= maxAttempts) {
    return false;
  }

  await db
    .update(authAttempts)
    .set({ count: existing.count + 1 })
    .where(eq(authAttempts.key, key));
  return true;
}
