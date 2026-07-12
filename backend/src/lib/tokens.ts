import jwt from 'jsonwebtoken';
import { randomBytes, createHmac } from 'node:crypto';

export function signAccessToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string, secret: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      return { sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString('hex')}`;
}

export function hashRefreshToken(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('hex');
}

export function parseRefreshTokenSessionId(token: string): string | null {
  const idx = token.indexOf('.');
  if (idx === -1) return null;
  return token.slice(0, idx);
}
