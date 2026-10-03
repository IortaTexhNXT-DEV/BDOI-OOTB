/**
 * Password policy from settings (group "security"): minimum length, character classes, history (refuse the last N
 * passwords) and maximum age. Enforced on change-password, reset-password, administrator set / reset and user create.
 */
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { badRequest } from './errors.js';
import { getSetting } from './settings.js';

export async function passwordPolicy() {
  return {
    minLength: Number(await getSetting('security.password_min_length', await getSetting('limits.password_min_length', 8))) || 8,
    requireUpper: (await getSetting('security.password_require_upper', true)) !== false,
    requireLower: (await getSetting('security.password_require_lower', true)) !== false,
    requireDigit: (await getSetting('security.password_require_digit', true)) !== false,
    requireSymbol: (await getSetting('security.password_require_symbol', true)) !== false,
    historyCount: Math.max(0, Number(await getSetting('security.password_history_count', 5)) || 0),
    maxAgeDays: Math.max(0, Number(await getSetting('security.password_max_age_days', 90)) || 0),
  };
}

/** Policy problems of a candidate password (empty when it complies). */
export function policyProblems(password, p) {
  const pw = String(password ?? '');
  const problems = [];
  if (pw.length < p.minLength) problems.push(`be at least ${p.minLength} characters`);
  if (p.requireUpper && !/[A-Z]/.test(pw)) problems.push('contain an upper-case letter');
  if (p.requireLower && !/[a-z]/.test(pw)) problems.push('contain a lower-case letter');
  if (p.requireDigit && !/[0-9]/.test(pw)) problems.push('contain a digit');
  if (p.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) problems.push('contain a symbol');
  return problems;
}

/**
 * Throw 400 when the password breaks the policy or (for an existing user) matches the current password or one of the
 * last N passwords.
 */
export async function assertPasswordAllowed(password, { userId = null, db = { query } } = {}) {
  const p = await passwordPolicy();
  const problems = policyProblems(password, p);
  if (problems.length) {
    throw badRequest(`Password must ${problems.join(', ')}`, problems.map((m) => ({ path: 'password', message: `Password must ${m}` })));
  }
  if (userId && p.historyCount > 0) {
    const current = (await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])).rows[0]?.password_hash;
    const past = (await db.query('SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2', [userId, p.historyCount])).rows.map((r) => r.password_hash);
    for (const h of [current, ...past].filter(Boolean)) {
      if (await bcrypt.compare(String(password), h)) {
        const msg = `Password was used recently; choose one that is not among your last ${p.historyCount} passwords`;
        throw badRequest(msg, [{ path: 'password', message: msg }]);
      }
    }
  }
}

/**
 * Store a new password: hash, password_changed_at, history row (history trimmed to what the policy needs).
 * `extraSql` adds assignments such as "must_change_password = false".
 */
export async function savePassword(userId, password, { db = { query }, extraSql = '' } = {}) {
  const hash = await bcrypt.hash(String(password), 10);
  const r = await db.query(`UPDATE users SET password_hash = $2, password_changed_at = now()${extraSql ? `, ${extraSql}` : ''}, updated_at = now() WHERE id = $1 RETURNING id`, [userId, hash]);
  if (!r.rowCount) return null;
  await recordHistory(userId, hash, db);
  return hash;
}

/** Add a hash to the password history and keep only the most recent entries. */
export async function recordHistory(userId, hash, db = { query }) {
  await db.query('INSERT INTO password_history(user_id, password_hash) VALUES ($1,$2)', [userId, hash]);
  const keep = Math.max(24, (await passwordPolicy()).historyCount);
  await db.query(`DELETE FROM password_history WHERE user_id = $1 AND id NOT IN
    (SELECT id FROM password_history WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2)`, [userId, keep]);
}

/** True when the password is older than security.password_max_age_days (0 = never expires). */
export async function passwordExpired(user) {
  const { maxAgeDays } = await passwordPolicy();
  if (!maxAgeDays || !user?.password_changed_at) return false;
  return Date.now() - new Date(user.password_changed_at).getTime() > maxAgeDays * 86400000;
}
