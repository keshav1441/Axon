import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'signup-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('signup handler', () => {
  it('creates a user and returns a token pair on valid input', async () => {
    const result = await signup(db, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: testEmail,
      phone: '9999999999',
      password: 'correct-horse-battery',
      confirmPassword: 'correct-horse-battery',
    }, secrets);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.body.user.email).toBe(testEmail);
      expect(result.body.accessToken).toBeTypeOf('string');
      expect(result.body.refreshToken).toBeTypeOf('string');
    }
  });

  it('rejects mismatched passwords', async () => {
    const result = await signup(db, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: testEmail,
      phone: '9999999999',
      password: 'correct-horse-battery',
      confirmPassword: 'different',
    }, secrets);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.body.code).toBe('PASSWORD_MISMATCH');
    }
  });

  it('rejects a duplicate email', async () => {
    await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '9999999999',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);

    const result = await signup(db, {
      firstName: 'Bea', lastName: 'Loveless', email: testEmail, phone: '8888888888',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('EMAIL_TAKEN');
    }
  });
});
