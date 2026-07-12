import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { updateTaskStatus } from '../../src/handlers/tasks/updateTaskStatus';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const taskId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!taskId) return err(res, 400, 'INVALID_INPUT', 'Missing task id');

  const db = getDb(process.env.DATABASE_URL!);
  const result = await updateTaskStatus(db, auth.userId, taskId, req.body);
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
