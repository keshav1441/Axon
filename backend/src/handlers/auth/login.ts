import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { users, sessions } from '../../db/schema';
import { verifyPassword } from '../../lib/password';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../lib/tokens';
import { checkAndRecordAttempt } from '../../lib/rateLimit';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginResult =
  | { ok: true; status: 200; body: { accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string } } }
  | { ok: false; status: 400 | 401; body: { error: string; code: string } };

export async function login(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<LoginResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid login fields', code: 'INVALID_INPUT' } };
  }
  const { email, password } = parsed.data;

  const allowed = await checkAndRecordAttempt(db, `login:${email}`);
  if (!allowed) {
    return { ok: false, status: 400, body: { error: 'Too many attempts, try again later', code: 'RATE_LIMITED' } };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, status: 401, body: { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } };
  }

  const sessionId = randomUUID();
  const refreshToken = generateRefreshToken(sessionId);
  const refreshTokenHash = hashRefreshToken(refreshToken, secrets.refreshPepper);
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const accessToken = signAccessToken(user.id, secrets.jwtSecret);

  return {
    ok: true,
    status: 200,
    body: {
      accessToken,
      refreshToken,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    },
  };
}
