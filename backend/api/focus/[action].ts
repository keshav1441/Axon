import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { getFocusStreakDays, getUsageMinutesByPackage } from '../../src/handlers/focus/usage';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const db = getDb(process.env.DATABASE_URL!);

  if (action === 'streak') {
    const streakDays = await getFocusStreakDays(db, auth.userId);
    return ok(res, 200, { streakDays });
  }

  if (action === 'usage') {
    const usage = await getUsageMinutesByPackage(db, auth.userId, 0);
    return ok(res, 200, { usage });
  }

  return err(res, 404, 'NOT_FOUND', 'Unknown focus action');
}
