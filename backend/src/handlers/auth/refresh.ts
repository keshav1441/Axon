import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { sessions } from '../../db/schema';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenSessionId,
} from '../../lib/tokens';

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

export type RefreshResult =
  | { ok: true; status: 200; body: { accessToken: string; refreshToken: string } }
  | { ok: false; status: 400 | 401; body: { error: string; code: string } };

export async function refreshTokens(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<RefreshResult> {
  const parsed = RefreshSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
  }

  const sessionId = parseRefreshTokenSessionId(parsed.data.refreshToken);
  if (!sessionId) {
    return { ok: false, status: 401, body: { error: 'Invalid refresh token', code: 'INVALID_TOKEN' } };
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const expectedHash = session ? hashRefreshToken(parsed.data.refreshToken, secrets.refreshPepper) : null;

  if (!session || expectedHash !== session.refreshTokenHash || session.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, body: { error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' } };
  }

  const newRefreshToken = generateRefreshToken(sessionId);
  const newHash = hashRefreshToken(newRefreshToken, secrets.refreshPepper);
  await db
    .update(sessions)
    .set({ refreshTokenHash: newHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
    .where(eq(sessions.id, sessionId));

  const accessToken = signAccessToken(session.userId, secrets.jwtSecret);

  return { ok: true, status: 200, body: { accessToken, refreshToken: newRefreshToken } };
}
