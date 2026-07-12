import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { listApps } from '../../src/handlers/focus/listApps';
import { upsertApp } from '../../src/handlers/focus/upsertApp';
import { removeApp } from '../../src/handlers/focus/removeApp';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listApps(db, auth.userId);
    return ok(res, 200, { apps: rows });
  }

  if (req.method === 'POST') {
    const result = await upsertApp(db, auth.userId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (req.method === 'DELETE') {
    const packageName = typeof req.query.packageName === 'string' ? req.query.packageName : '';
    if (!packageName) return err(res, 400, 'INVALID_INPUT', 'Missing packageName');
    await removeApp(db, auth.userId, packageName);
    return res.status(204).end();
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET, POST, or DELETE');
}
