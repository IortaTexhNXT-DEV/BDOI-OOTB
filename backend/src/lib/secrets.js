/**
 * Secrets at rest and signed links:
 * - AES-256-GCM encryption of small values (TOTP secrets) with a key derived from DATA_ENCRYPTION_KEY;
 * - keyed hashes of one-time codes (password reset codes are never stored in clear);
 * - HMAC-signed, expiring file links (img tags cannot send a bearer header);
 * - random temporary passwords that satisfy the password policy.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

const derive = (secret, purpose) => crypto.createHmac('sha256', String(secret)).update(`brokerverse:${purpose}`).digest();

const PREFIX = 'enc:v1:';

/** Encrypt a string (null stays null). Output: enc:v1:<iv>:<tag>:<ciphertext>, base64url parts. */
export function encryptSecret(plain, secret = config.dataEncryptionKey) {
  if (plain === null || plain === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derive(secret, 'data-encryption'), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
}

export const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

/** Decrypt a value from encryptSecret. Values stored before encryption was introduced are returned unchanged. */
export function decryptSecret(value, secret = config.dataEncryptionKey) {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;
  const [iv, tag, ct] = value.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', derive(secret, 'data-encryption'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Keyed hash of a one-time code (for example a password reset code) bound to its owner. */
export const hashCode = (code, owner = '') => crypto.createHmac('sha256', derive(config.dataEncryptionKey, 'one-time-code'))
  .update(`${owner}:${String(code).trim()}`).digest('hex');

/** Constant-time comparison of two hex digests. */
export function sameHash(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ------------------------------------------------------------------ signed file links
const fileKey = () => derive(config.jwtSecret, 'file-url');
const fileSig = (key, exp) => crypto.createHmac('sha256', fileKey()).update(`${key}\n${exp}`).digest('base64url');

/**
 * Expiry for a new link: now + FILE_URL_TTL_SECONDS, rounded up to a 5-minute boundary so the same file keeps the same
 * URL for a while (the browser can cache images).
 */
export function linkExpiry(now = Date.now(), ttl = config.fileUrlTtl) {
  const bucket = 300;
  return Math.ceil((Math.floor(now / 1000) + ttl) / bucket) * bucket;
}

/** Query string (?exp=...&sig=...) that authorises GET of one stored object until exp. */
export const signFileQuery = (key, exp = linkExpiry()) => `exp=${exp}&sig=${fileSig(key, exp)}`;

/** Is (exp, sig) a valid, unexpired signature for the key? */
export function verifyFileSignature(key, exp, sig, now = Date.now()) {
  const e = Number(exp);
  if (!Number.isInteger(e) || e * 1000 < now || typeof sig !== 'string' || !sig) return false;
  const want = Buffer.from(fileSig(key, e));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// ------------------------------------------------------------------ temporary passwords
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '!@#$%*-_=+?';

/** Random password that satisfies the policy (all character classes, at least 14 characters). */
export function temporaryPassword(policy = {}) {
  const length = Math.max(14, Number(policy.minLength) || 0);
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
