import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { logout } from '../../../src/handlers/auth/logout';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'logout-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('logout handler', () => {
  it('deletes the session for the given refresh token', async () => {
    const signupResult = await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '5555555555',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);
    if (!signupResult.ok) throw new Error('signup failed in test setup');

    const result = await logout(db, { refreshToken: signupResult.body.refreshToken });
    expect(result.ok).toBe(true);

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, signupResult.body.user.id));
    expect(remaining.length).toBe(0);
  });
});
