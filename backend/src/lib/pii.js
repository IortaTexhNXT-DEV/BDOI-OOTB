/**
 * Personal identifiers: field-level encryption at rest and masking by role (Data Privacy Act of 2012, NPC rules).
 *
 * Encryption (migration 0277): TIN, government ID and bank account numbers are stored as
 *   pii:1:<key id>:<base64 iv + AES-256-CBC ciphertext>:<base64 first 16 bytes of HMAC-SHA256(key id + iv + ciphertext)>
 * The database encrypts them itself (trigger pii_protect_columns / pii_protect_json, pgcrypto) with the keys this file
 * derives from PII_ENCRYPTION_KEY and hands to every database session (sessionSettings, set by db/pool.js on connect),
 * so every writer, including SQL seeds and the go-live loaders, stores ciphertext without knowing about it. A blind
 * index (HMAC-SHA256 of the normalised value, column <name>_bidx) keeps search by exact value working.
 * The API decrypts on the way out (protectPayload, called by the response serialiser in app.js) and the exports do the
 * same (xlsx.js, csv.js, pdf). Key rotation: scripts/rotate-pii-key.js and deploy/REFERENCE.md.
 *
 * Masking: a user without the permission view:pii ("View full personal identifiers") receives TIN, government ID
 * numbers, mobile numbers, e-mail addresses, bank account numbers and birth dates partially masked in every API
 * response and export. Which keys are personal comes from the personal data catalogue of the masking tool
 * (scripts/lib/pii-catalogue.js, jsonKeyRule), so the catalogue drives both. Settings: privacy.masking_enabled,
 * privacy.pii_reveal_mode ('always': holders of view:pii see full values; 'on-request': they see masked values until
 * they switch on "Show full identifiers", and every such request is recorded in the audit trail),
 * privacy.masking_exempt_paths (API paths answered unmasked, e.g. the user's own profile).
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { jsonKeyRule } from '../../scripts/lib/pii-catalogue.js';

const PREFIX = 'pii:1:';
const derive = (secret, purpose) => crypto.createHmac('sha256', String(secret)).update(`brokerverse:pii:${purpose}`).digest();

/** Keys of one secret: { kid, enc, mac, bidx }. The key id is a short fingerprint of the secret (never the secret). */
export function deriveKeys(secret) {
  return {
    kid: crypto.createHash('sha256').update(`brokerverse:pii:kid:${secret}`).digest('hex').slice(0, 8),
    enc: derive(secret, 'encryption'), mac: derive(secret, 'mac'), bidx: derive(secret, 'blind-index'),
  };
}

let ring = null;
/** Current and previous keys (the previous only during a rotation). Rebuilt by resetKeyring() (tests). */
export function keyring() {
  if (!ring) {
    const current = deriveKeys(config.piiEncryptionKey);
    const previous = config.piiEncryptionKeyPrevious ? deriveKeys(config.piiEncryptionKeyPrevious) : null;
    ring = { current, previous, byKid: new Map([[current.kid, current], ...(previous ? [[previous.kid, previous]] : [])]) };
  }
  return ring;
}
export const resetKeyring = (keys = null) => { ring = keys; };
/** A keyring built from explicit secrets (rotation script, tests). */
export function buildKeyring(currentSecret, previousSecret = null) {
  const current = deriveKeys(currentSecret);
  const previous = previousSecret ? deriveKeys(previousSecret) : null;
  return { current, previous, byKid: new Map([[current.kid, current], ...(previous ? [[previous.kid, previous]] : [])]) };
}

/** Database session settings (custom GUCs) the encryption triggers read: [[name, value]] (empty values left out). */
export function sessionSettings(keys = keyring()) {
  return [
    ['brokerverse.pii_kid', keys.current.kid], ['brokerverse.pii_enc_key', keys.current.enc.toString('hex')],
    ['brokerverse.pii_mac_key', keys.current.mac.toString('hex')], ['brokerverse.pii_bidx_key', keys.current.bidx.toString('hex')],
    ['brokerverse.pii_prev_kid', keys.previous?.kid || ''], ['brokerverse.pii_prev_enc_key', keys.previous ? keys.previous.enc.toString('hex') : ''],
    ['brokerverse.pii_prev_mac_key', keys.previous ? keys.previous.mac.toString('hex') : ''],
  ].filter(([, v]) => v);
}

/** The settings as the `options` start-up parameter of a connection (pg Pool / Client option). */
export const sessionOptions = (keys = keyring()) => sessionSettings(keys).map(([k, v]) => `-c ${k}=${v}`).join(' ');

/** Where encrypted identifiers are stored (migration 0277): the rotation script and the tests walk this list. */
export const PII_STORAGE = [
  { table: 'clients', column: 'tin', blindIndex: 'tin_bidx' }, { table: 'clients', column: 'extra', json: true },
  { table: 'leads', column: 'tax_number', blindIndex: 'tax_number_bidx' }, { table: 'leads', column: 'extra', json: true },
  { table: 'commission_referrers', column: 'tin', blindIndex: 'tin_bidx' }, { table: 'commission_referrers', column: 'bank_account_no', blindIndex: 'bank_account_no_bidx' },
  { table: 'bir_2307_certificates', column: 'payee_tin' },
  { table: 'quotes', column: 'doc', json: true }, { table: 'placements', column: 'doc', json: true },
  { table: 'policies', column: 'doc', json: true }, { table: 'policies', column: 'details', json: true },
  { table: 'audit_log', column: 'before_data', json: true }, { table: 'audit_log', column: 'after_data', json: true },
];

export const isPiiCipher = (v) => typeof v === 'string' && v.startsWith(PREFIX);

const macOf = (k, kid, body) => crypto.createHmac('sha256', k.mac).update(Buffer.concat([Buffer.from(kid, 'utf8'), body])).digest().subarray(0, 16);

/** Encrypt a value the way the database does (used by tests and the rotation script; the database encrypts on write). */
export function encryptPii(plain, keys = keyring()) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const k = keys.current;
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', k.enc, iv);
  const body = Buffer.concat([iv, c.update(String(plain), 'utf8'), c.final()]);
  return `${PREFIX}${k.kid}:${body.toString('base64')}:${macOf(k, k.kid, body).toString('base64')}`;
}

/** Decrypt a pii:1: value (anything else is returned unchanged). Throws when the key is unknown or the value was altered. */
export function decryptPii(value, keys = keyring()) {
  if (!isPiiCipher(value)) return value;
  const [kid, b64, mac] = value.slice(PREFIX.length).split(':');
  const k = keys.byKid.get(kid);
  if (!k) throw new Error(`personal data key ${kid} is not available (PII_ENCRYPTION_KEY / PII_ENCRYPTION_KEY_PREVIOUS)`);
  const body = Buffer.from(b64, 'base64');
  const expected = macOf(k, kid, body);
  const given = Buffer.from(mac || '', 'base64');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new Error('personal data value failed its integrity check');
  const d = crypto.createDecipheriv('aes-256-cbc', k.enc, body.subarray(0, 16));
  return Buffer.concat([d.update(body.subarray(16)), d.final()]).toString('utf8');
}

/** Decrypt without throwing: an unreadable value shows as "[encrypted]" rather than failing the whole response. */
export function revealPii(value, keys = keyring()) {
  if (!isPiiCipher(value)) return value;
  try {
    return decryptPii(value, keys);
  } catch {
    return '[encrypted]';
  }
}

/** Normalised form of an identifier for the blind index: letters and digits only, upper case. */
export const normaliseIdentifier = (v) => String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Blind index of a value (search by exact value): hex HMAC-SHA256, the same as the database's pii_blind_index(). */
export function blindIndex(value, keys = keyring()) {
  const n = normaliseIdentifier(value);
  if (!n) return null;
  return crypto.createHmac('sha256', keys.current.bidx).update(n, 'utf8').digest('hex');
}

// ------------------------------------------------------------------ masking

/** The masking rule names of the catalogue that are masked on screens and exports. */
const MASKED_RULES = { emailList: 'email', email: 'email', phone: 'phone', tin: 'identifier', idNumber: 'identifier', bankAccount: 'identifier', dob: 'dob', contact: 'contact' };
/** Marker of a masked value: two or more asterisks (a masked value sent back by a form is ignored, see stripMasked). */
export const MASK_RE = /\*{2,}/;

const maskKeepLast = (s, keep = 4) => {
  const str = String(s);
  const positions = [];
  for (let i = 0; i < str.length; i += 1) if (/[A-Za-z0-9]/.test(str[i])) positions.push(i);
  const hide = new Set(positions.slice(0, Math.max(positions.length - keep, Math.ceil(positions.length / 2))));
  return [...str].map((ch, i) => (hide.has(i) ? '*' : ch)).join('');
};
const maskEmail = (s) => String(s).replace(/([^\s@,;<>"]+)@([^\s@,;<>"]+)/g, (_, local) => `${local[0]}***@${_.split('@')[1]}`);
const maskDob = (s) => {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (m) return `${m[1]}-**-**`;
  const d = String(s).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return d ? `**/**/${d[3]}` : '****';
};

/** Mask one value by kind ('email' | 'phone' | 'identifier' | 'dob' | 'contact'). Empty values stay empty. */
export function maskValue(kind, value) {
  if (value === null || value === undefined || value === '') return value;
  if (value instanceof Date) return maskDob(value.toISOString().slice(0, 10));
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  const s = String(value);
  if (MASK_RE.test(s)) return s;
  switch (kind) {
    // keys such as to / cc also name statuses and stages: only an e-mail address is masked
    case 'email': return s.includes('@') ? maskEmail(s) : s;
    case 'phone': return /\d{5,}|\d+[ -]\d+[ -]\d+/.test(s) ? maskKeepLast(s, 4) : s;
    case 'dob': return maskDob(s);
    case 'contact': return s.includes('@') ? maskEmail(s) : /\d{4,}/.test(s) ? maskKeepLast(s, 4) : s;
    default: return maskKeepLast(s, 4);
  }
}

/** The masking kind of a JSON key (null: not masked), from the personal data catalogue. */
const kindCache = new Map();
export function maskKind(key) {
  if (key === null || key === undefined) return null;
  if (!kindCache.has(key)) {
    const rule = jsonKeyRule(String(key));
    kindCache.set(key, MASKED_RULES[rule] || null);
  }
  return kindCache.get(key);
}

/** Keys whose content is shown in full to a user allowed to act on it: the identifiers a policy issuer verifies. */
const UNMASKED_SUBTREES = new Set(['kycPrefill']);

/**
 * Prepare a value for a user: decrypt every pii:1: string; with mask, mask the personal keys (an encrypted value under
 * an unknown key is masked as an identifier). Returns a new value; the input is not changed.
 */
export function protectPayload(value, { mask = false } = {}) {
  const walk = (v, key, masking) => {
    if (typeof v === 'string') {
      const cipher = isPiiCipher(v);
      const plain = cipher ? revealPii(v) : v;
      if (!masking) return plain;
      const kind = maskKind(key) || (cipher ? 'identifier' : null);
      return kind ? maskValue(kind, plain) : plain;
    }
    if (typeof v === 'number') return masking && maskKind(key) === 'identifier' ? maskValue('identifier', v) : v;
    if (v instanceof Date) return masking && maskKind(key) === 'dob' ? maskValue('dob', v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, key, masking));
    if (v && typeof v === 'object' && !Buffer.isBuffer(v)) {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k, masking && !UNMASKED_SUBTREES.has(k));
      return out;
    }
    return v;
  };
  return walk(value, null, mask);
}

/** True when the value holds an encrypted string somewhere (a cheap check before walking a large response). */
export const holdsCipher = (json) => typeof json === 'string' && json.includes(PREFIX);

/**
 * Remove masked values from a request body: a form filled from a masked response sends the masked value back, which
 * must not overwrite the stored one. Keys of personal data whose value contains "**" are dropped (the update then
 * leaves the stored value as it is). Returns the list of dropped paths.
 */
export function stripMasked(body, path = '') {
  const dropped = [];
  if (!body || typeof body !== 'object') return dropped;
  for (const [k, v] of Object.entries(body)) {
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'string' && MASK_RE.test(v) && (maskKind(k) || /^\*+/.test(v))) {
      if (Array.isArray(body)) continue;
      delete body[k];
      dropped.push(p);
    } else if (v && typeof v === 'object') dropped.push(...stripMasked(v, p));
  }
  return dropped;
}

/** Mask the cells of a table (exports): columns [{ key, label|header }], rows objects or arrays. */
export function protectRows(columns, rows, { mask = false } = {}) {
  const kinds = columns.map((c) => (mask ? maskKind(c.key) || maskKind(c.label ?? c.header) : null));
  const cell = (v, i) => {
    if (typeof v === 'string' && isPiiCipher(v)) v = revealPii(v);
    else if (!mask || !kinds[i]) return v;
    return mask && (kinds[i] || false) ? maskValue(kinds[i], v) : v;
  };
  return rows.map((r) => {
    if (Array.isArray(r)) return r.map((v, i) => cell(v, i));
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };
    columns.forEach((c, i) => { if (c.key !== undefined && c.key in out) out[c.key] = cell(out[c.key], i); });
    for (const [k, v] of Object.entries(out)) if (typeof v === 'string' && isPiiCipher(v)) out[k] = mask ? maskValue('identifier', revealPii(v)) : revealPii(v);
    return out;
  });
}

/**
 * Decrypt, in place, the encrypted strings of a document specification (printed documents go to the client in full).
 * Only plain objects and arrays are walked; buffers and class instances are left alone.
 */
export function revealInPlace(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return value;
  seen.add(value);
  for (const k of Object.keys(value)) {
    const v = value[k];
    if (typeof v === 'string') {
      if (isPiiCipher(v)) value[k] = revealPii(v);
    } else if (v && typeof v === 'object') revealInPlace(v, seen);
  }
  return value;
}
