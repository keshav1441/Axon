import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { logout } from '../../src/handlers/auth/logout';
import { err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await logout(db, req.body);
  if (result.ok) return res.status(204).end();
  return err(res, result.status, result.body.code, result.body.error);
}
