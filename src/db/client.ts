import { open, type DB } from '@op-engineering/op-sqlite';

import { getOrCreateDbKey } from './key';
import { SCHEMA_STATEMENTS } from './schema';

let dbPromise: Promise<DB> | null = null;

async function openDb(): Promise<DB> {
  const encryptionKey = await getOrCreateDbKey();
  const db = open({ name: 'axon.db', encryptionKey });
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }
  return db;
}

/** Lazily opens the encrypted DB once and reuses the connection for the app's lifetime. */
export function getDb(): Promise<DB> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}
