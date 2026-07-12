import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { refreshTokens } from '../../../src/handlers/auth/refresh';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'refresh-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('refresh handler', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const signupResult = await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '6666666666',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);
    if (!signupResult.ok) throw new Error('signup failed in test setup');

    const result = await refreshTokens(db, { refreshToken: signupResult.body.refreshToken }, secrets);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.accessToken).toBeTypeOf('string');
      expect(result.body.refreshToken).not.toBe(signupResult.body.refreshToken);
    }

    const reuse = await refreshTokens(db, { refreshToken: signupResult.body.refreshToken }, secrets);
    expect(reuse.ok).toBe(false);
  });

  it('rejects a malformed refresh token', async () => {
    const result = await refreshTokens(db, { refreshToken: 'garbage' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
