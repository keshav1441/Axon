import { randomUUID } from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { users, sessions } from '../../db/schema';
import { hashPassword } from '../../lib/password';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../lib/tokens';
import { checkAndRecordAttempt } from '../../lib/rateLimit';

const SignupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export type SignupResult =
  | { ok: true; status: 201; body: { accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string } } }
  | { ok: false; status: 400 | 409; body: { error: string; code: string } };

export async function signup(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<SignupResult> {
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid signup fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;

  if (data.password !== data.confirmPassword) {
    return { ok: false, status: 400, body: { error: 'Passwords do not match', code: 'PASSWORD_MISMATCH' } };
  }

  const allowed = await checkAndRecordAttempt(db, `signup:${data.email}`);
  if (!allowed) {
    return { ok: false, status: 400, body: { error: 'Too many attempts, try again later', code: 'RATE_LIMITED' } };
  }

  const existing = await db.select().from(users).where(or(eq(users.email, data.email), eq(users.phone, data.phone))).limit(1);
  if (existing.length > 0) {
    const code = existing[0].email === data.email ? 'EMAIL_TAKEN' : 'PHONE_TAKEN';
    return { ok: false, status: 409, body: { error: 'Account already exists', code } };
  }

  const passwordHash = await hashPassword(data.password);
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    passwordHash,
  });

  const sessionId = randomUUID();
  const refreshToken = generateRefreshToken(sessionId);
  const refreshTokenHash = hashRefreshToken(refreshToken, secrets.refreshPepper);
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const accessToken = signAccessToken(userId, secrets.jwtSecret);

  return {
    ok: true,
    status: 201,
    body: {
      accessToken,
      refreshToken,
      user: { id: userId, firstName: data.firstName, lastName: data.lastName, email: data.email },
    },
  };
}
