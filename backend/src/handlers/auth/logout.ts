import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { sessions } from '../../db/schema';
import { parseRefreshTokenSessionId } from '../../lib/tokens';

const LogoutSchema = z.object({ refreshToken: z.string().min(1) });

export async function logout(
  db: Db,
  input: unknown,
): Promise<{ ok: true; status: 204 } | { ok: false; status: 400; body: { error: string; code: string } }> {
  const parsed = LogoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
  }
  const sessionId = parseRefreshTokenSessionId(parsed.data.refreshToken);
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  return { ok: true, status: 204 };
}
