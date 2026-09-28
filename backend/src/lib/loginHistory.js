/** Sign-in attempt log (login_history): every password and two-factor attempt, successful or not. */
import { query } from '../db/pool.js';
import { pageMeta, paging } from './respond.js';

export async function recordLogin(req, { userId = null, username = null, success, reason, method = 'password' }) {
  await query('INSERT INTO login_history(user_id, username, ip, user_agent, success, reason, method) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [userId, username == null ? null : String(username).slice(0, 200), req.ip || null, String(req.get?.('user-agent') || '').slice(0, 500) || null, !!success, reason || null, method]);
}

const row = (r) => ({ id: r.id, at: r.at, userId: r.user_id, username: r.username, displayName: r.display_name || null, ip: r.ip, userAgent: r.user_agent, success: r.success, reason: r.reason, method: r.method });

/** Paged history for one user (success=true|false filter, from/to dates). */
export async function loginHistory(userId, q = {}) {
  const pg = paging(q, { page: 1, perPage: 20 });
  const params = [userId, q.success === undefined || q.success === '' ? null : String(q.success) === 'true', q.from || null, q.to || null];
  const where = 'h.user_id = $1 AND ($2::boolean IS NULL OR h.success = $2) AND ($3::date IS NULL OR h.at >= $3::date) AND ($4::date IS NULL OR h.at < $4::date + 1)';
  const total = (await query(`SELECT count(*)::int AS n FROM login_history h WHERE ${where}`, params)).rows[0].n;
  const rows = (await query(`SELECT h.*, u.display_name FROM login_history h LEFT JOIN users u ON u.id = h.user_id WHERE ${where}
    ORDER BY h.at DESC, h.id DESC LIMIT $5 OFFSET $6`, [...params, pg.limit, pg.offset])).rows;
  return { items: rows.map(row), ...pageMeta(total, pg) };
}
