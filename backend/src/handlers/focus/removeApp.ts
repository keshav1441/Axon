import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { focusApps } from '../../db/schema';

export async function removeApp(db: Db, userId: string, packageName: string): Promise<void> {
  await db.delete(focusApps).where(and(eq(focusApps.userId, userId), eq(focusApps.packageName, packageName)));
}
