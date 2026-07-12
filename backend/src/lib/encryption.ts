import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PACKED_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

function keyBuffer(hexKey: string): Buffer {
  return Buffer.from(hexKey, 'hex');
}

/** AES-256-GCM, random IV per call. Packs iv:authTag:ciphertext (hex) into one string. */
export function encryptField(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBuffer(hexKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Reverses encryptField. Falls back to returning the input unchanged if it
 * doesn't look like packed ciphertext - lets pre-encryption plaintext rows
 * keep working instead of throwing.
 */
export function decryptField(packed: string, hexKey: string): string {
  if (!PACKED_RE.test(packed)) return packed;
  const [ivHex, authTagHex, ciphertextHex] = packed.split(':');
  try {
    const decipher = createDecipheriv(ALGORITHM, keyBuffer(hexKey), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    return packed;
  }
}

/** Deterministic HMAC-SHA256, for equality lookups on encrypted columns (e.g. dedup checks). */
export function hashForLookup(plaintext: string, hexKey: string): string {
  return createHmac('sha256', keyBuffer(hexKey)).update(plaintext).digest('hex');
}
