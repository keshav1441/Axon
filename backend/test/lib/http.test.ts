import { describe, it, expect } from 'vitest';
import { requireAuth, getClientIp } from '../../src/lib/http';
import { signAccessToken } from '../../src/lib/tokens';

describe('http lib', () => {
  it('requireAuth returns userId for a valid bearer token', () => {
    const token = signAccessToken('user-42', 'secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    expect(requireAuth(req, 'secret')).toEqual({ userId: 'user-42' });
  });

  it('requireAuth returns null when header is missing or invalid', () => {
    expect(requireAuth({ headers: {} } as any, 'secret')).toBeNull();
    expect(requireAuth({ headers: { authorization: 'Bearer garbage' } } as any, 'secret')).toBeNull();
  });

  it('getClientIp reads x-forwarded-for first entry', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} } as any;
    expect(getClientIp(req)).toBe('1.2.3.4');
  });
});
