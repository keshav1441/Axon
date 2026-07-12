import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { refreshTokens } from '../../src/handlers/auth/refresh';
import { ok, err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await refreshTokens(db, req.body, {
    jwtSecret: process.env.JWT_ACCESS_SECRET!,
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER!,
  });
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
