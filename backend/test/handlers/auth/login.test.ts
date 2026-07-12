import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { login } from '../../../src/handlers/auth/login';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'login-test@example.com';

beforeEach(async () => {
  await signup(db, {
    firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '7777777777',
    password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
  }, secrets);
});

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
  await db.delete(authAttempts).where(eq(authAttempts.key, `login:${testEmail}`));
});

describe('login handler', () => {
  it('logs in with correct credentials', async () => {
    const result = await login(db, { email: testEmail, password: 'correct-horse-battery' }, secrets);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body.user.email).toBe(testEmail);
    }
  });

  it('rejects a wrong password', async () => {
    const result = await login(db, { email: testEmail, password: 'wrong-password' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('rejects an unknown email', async () => {
    const result = await login(db, { email: 'nobody@example.com', password: 'whatever1' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
