import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, hashForLookup } from '../../src/lib/encryption';

const KEY = 'a'.repeat(64); // 32-byte hex key, test-only

describe('encryption lib', () => {
  it('encrypts and decrypts back to the original plaintext', () => {
    const packed = encryptField('ref:568xxxxx8', KEY);
    expect(packed).not.toBe('ref:568xxxxx8');
    expect(decryptField(packed, KEY)).toBe('ref:568xxxxx8');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encryptField('New Auto Corner', KEY);
    const b = encryptField('New Auto Corner', KEY);
    expect(a).not.toBe(b);
    expect(decryptField(a, KEY)).toBe('New Auto Corner');
    expect(decryptField(b, KEY)).toBe('New Auto Corner');
  });

  it('returns unrecognized input unchanged instead of throwing (legacy plaintext rows)', () => {
    expect(decryptField('New Auto Corner Talegaon', KEY)).toBe('New Auto Corner Talegaon');
    expect(decryptField('', KEY)).toBe('');
  });

  it('hashForLookup is deterministic for the same input', () => {
    const h1 = hashForLookup('ref:568xxxxx8', KEY);
    const h2 = hashForLookup('ref:568xxxxx8', KEY);
    expect(h1).toBe(h2);
    expect(hashForLookup('ref:different', KEY)).not.toBe(h1);
  });
});
