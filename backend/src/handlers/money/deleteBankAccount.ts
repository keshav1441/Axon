import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bankAccounts } from '../../db/schema';

export async function deleteBankAccount(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
}
