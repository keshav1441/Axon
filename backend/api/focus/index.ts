import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createSession } from '../../src/handlers/focus/createSession';
import { listSessions } from '../../src/handlers/focus/listSessions';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listSessions(db, auth.userId);
    return ok(res, 200, { sessions: rows });
  }

  if (req.method === 'POST') {
    const result = await createSession(db, auth.userId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET or POST');
}
