import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { login } from '../../src/handlers/auth/login';
import { logout } from '../../src/handlers/auth/logout';
import { refreshTokens } from '../../src/handlers/auth/refresh';
import { signup } from '../../src/handlers/auth/signup';
import { ok, err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const db = getDb(process.env.DATABASE_URL!);
  const tokenConfig = {
    jwtSecret: process.env.JWT_ACCESS_SECRET!,
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER!,
  };

  if (action === 'signup') {
    const result = await signup(db, req.body, tokenConfig);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (action === 'login') {
    const result = await login(db, req.body, tokenConfig);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (action === 'refresh') {
    const result = await refreshTokens(db, req.body, tokenConfig);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (action === 'logout') {
    const result = await logout(db, req.body);
    if (result.ok) return res.status(204).end();
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 404, 'NOT_FOUND', 'Unknown auth action');
}
