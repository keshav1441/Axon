import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenSessionId,
} from '../../src/lib/tokens';

describe('tokens lib', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken('user-1', 'test-secret');
    const payload = verifyAccessToken(token, 'test-secret');
    expect(payload?.sub).toBe('user-1');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken('user-1', 'test-secret');
    expect(verifyAccessToken(token, 'other-secret')).toBeNull();
  });

  it('generates a refresh token embedding the session id, hashes deterministically', () => {
    const token = generateRefreshToken('session-1');
    expect(parseRefreshTokenSessionId(token)).toBe('session-1');
    const hash1 = hashRefreshToken(token, 'pepper');
    const hash2 = hashRefreshToken(token, 'pepper');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});
