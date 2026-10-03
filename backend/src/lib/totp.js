/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP, HMAC-SHA1) with base32 secrets (RFC 4648),
 * implemented with node:crypto so any authenticator app (Google Authenticator, Microsoft Authenticator, Authy) works.
 */
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Invalid base32 character');
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** New random secret (160 bits, the RFC 4226 recommendation), base32 encoded. */
export const generateSecret = (bytes = 20) => base32Encode(crypto.randomBytes(bytes));

/** HOTP value for a counter (RFC 4226 dynamic truncation). `key` is a Buffer. */
export function hotp(key, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (time = Date.now(), period = 30) => Math.floor(time / 1000 / period);

/** Current TOTP code of a base32 secret. */
export const totp = (secret, { time = Date.now(), period = 30, digits = 6 } = {}) => hotp(base32Decode(secret), timeStep(time, period), digits);

/**
 * Verify a code within ±window steps. Returns the matched time step (to be stored so the code cannot be replayed),
 * or null. Steps at or before `afterStep` are refused.
 */
export function verifyTotp(secret, code, { time = Date.now(), period = 30, digits = 6, window = 1, afterStep = null } = {}) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d+$/.test(c) || c.length !== digits || !secret) return null;
  const key = base32Decode(secret);
  const now = timeStep(time, period);
  for (let s = now - window; s <= now + window; s += 1) {
    if (afterStep != null && s <= Number(afterStep)) continue;
    if (crypto.timingSafeEqual(Buffer.from(hotp(key, s, digits)), Buffer.from(c))) return s;
  }
  return null;
}

/** otpauth:// URL for QR codes (Key URI format). */
export function otpauthUrl({ secret, account, issuer }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
