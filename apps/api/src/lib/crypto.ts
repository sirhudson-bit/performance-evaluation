import crypto from 'node:crypto';

/**
 * Cryptographic helpers.
 *
 * AES-256-GCM is used for any secret stored at rest (currently AI provider API
 * keys). The key is derived from APP_KEY with a fixed, purpose-specific salt, so
 * rotating APP_KEY deliberately invalidates stored secrets rather than silently
 * producing garbage. Format: `v1.<iv>.<tag>.<ciphertext>` (all base64url).
 */

const VERSION = 'v1';

function key(): Buffer {
  const secret = process.env.APP_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('APP_KEY is missing or too short; secrets cannot be encrypted.');
  }
  return crypto.createHash('sha256').update(`performance-evaluation:secrets:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Stored secret is malformed or was written by an incompatible version.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

/** Constant-time string comparison for tokens and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function hmacSha256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
}

/** URL-safe random token for sessions, CSRF, and reset links. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Masks a secret for display, e.g. `sk-…AbC3`. Never reveals the whole value. */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 6) return '••••••';
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}
