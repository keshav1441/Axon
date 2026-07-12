import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { updateTaskStatus } from '../../src/handlers/tasks/updateTaskStatus';
import { updateTaskTitle } from '../../src/handlers/tasks/updateTaskTitle';
import { deleteTask } from '../../src/handlers/tasks/deleteTask';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const taskId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!taskId) return err(res, 400, 'INVALID_INPUT', 'Missing task id');

  const db = getDb(process.env.DATABASE_URL!);

  if (action === 'status') {
    const result = await updateTaskStatus(db, auth.userId, taskId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (action === 'title') {
    const result = await updateTaskTitle(db, auth.userId, taskId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (action === 'delete') {
    const result = await deleteTask(db, auth.userId, taskId);
    if (result.ok) return res.status(204).end();
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 404, 'NOT_FOUND', 'Unknown task action');
}
