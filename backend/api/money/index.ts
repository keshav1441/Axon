import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createTransaction } from '../../src/handlers/money/createTransaction';
import { listTransactions } from '../../src/handlers/money/listTransactions';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listTransactions(db, auth.userId, process.env.FIELD_ENCRYPTION_KEY!);
    return ok(res, 200, { transactions: rows });
  }

  if (req.method === 'POST') {
    const result = await createTransaction(db, auth.userId, req.body, process.env.FIELD_ENCRYPTION_KEY!);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET or POST');
}
