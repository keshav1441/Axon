import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createBankAccount } from '../../src/handlers/money/createBankAccount';
import { listBankAccounts } from '../../src/handlers/money/listBankAccounts';
import { deleteBankAccount } from '../../src/handlers/money/deleteBankAccount';
import { updateBankAccountLimit } from '../../src/handlers/money/updateBankAccountLimit';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listBankAccounts(db, auth.userId, process.env.FIELD_ENCRYPTION_KEY!);
    return ok(res, 200, { accounts: rows });
  }

  if (req.method === 'POST') {
    const result = await createBankAccount(db, auth.userId, req.body, process.env.FIELD_ENCRYPTION_KEY!);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return err(res, 400, 'INVALID_INPUT', 'Missing account id');
    const result = await updateBankAccountLimit(db, auth.userId, id, req.body, process.env.FIELD_ENCRYPTION_KEY!);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return err(res, 400, 'INVALID_INPUT', 'Missing account id');
    await deleteBankAccount(db, auth.userId, id);
    return res.status(204).end();
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET, POST, PATCH, or DELETE');
}
