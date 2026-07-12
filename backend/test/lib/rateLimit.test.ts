import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '../../src/db/client';
import { authAttempts } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { checkAndRecordAttempt } from '../../src/lib/rateLimit';

const db = getDb(process.env.TEST_DATABASE_URL!);
const testKey = 'test:rate-limit-key';

afterEach(async () => {
  await db.delete(authAttempts).where(eq(authAttempts.key, testKey));
});

describe('rateLimit lib', () => {
  it('allows attempts under the max, blocks once exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await checkAndRecordAttempt(db, testKey, 5, 15)).toBe(true);
    }
    expect(await checkAndRecordAttempt(db, testKey, 5, 15)).toBe(false);
  });
});
