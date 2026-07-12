import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { getFocusStreakDays } from '../../src/handlers/focus/usage';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);
  const streakDays = await getFocusStreakDays(db, auth.userId);
  return ok(res, 200, { streakDays });
}
