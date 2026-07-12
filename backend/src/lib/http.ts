import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken } from './tokens';

export function ok(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function err(res: VercelResponse, status: number, code: string, message: string): void {
  res.status(status).json({ error: message, code });
}

export function requireAuth(req: VercelRequest, secret: string): { userId: string } | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  const payload = verifyAccessToken(token, secret);
  if (!payload) return null;
  return { userId: payload.sub };
}

export function getClientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}
