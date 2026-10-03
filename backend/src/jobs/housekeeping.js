/**
 * Housekeeping (scheduled job "housekeeping", daily): deletes operational rows past their retention period. Every
 * period is a setting in System Settings > Housekeeping (days; 0 = keep forever). Deletes run in batches so a large
 * backlog never holds long locks. The audit trail is not purged unless housekeeping.audit_log_days is set, and then
 * never below the 7-year statutory minimum (BIR / Insurance Commission record keeping).
 */
import { query } from '../db/pool.js';
import { getSetting } from '../lib/settings.js';

/** Statutory minimum retention of the audit trail: 7 years. */
export const AUDIT_MIN_DAYS = 2557;
const BATCH = 5000;

/**
 * What is purged: setting key, default days, table and the condition ($1 = cut-off timestamp). Rows qualify only when
 * the condition holds, e.g. only read notifications, only sent e-mails, only expired / revoked refresh tokens.
 */
export const RULES = [
  { key: 'housekeeping.job_runs_days', days: 90, table: 'job_runs', where: 'started_at < $1' },
  { key: 'housekeeping.email_outbox_sent_days', days: 180, table: 'email_outbox', where: "status = 'sent' AND COALESCE(sent_at, created_at) < $1" },
  { key: 'housekeeping.email_outbox_failed_days', days: 730, table: 'email_outbox', where: "status = 'failed' AND created_at < $1", name: 'email_outbox_failed' },
  { key: 'housekeeping.login_history_days', days: 365, table: 'login_history', where: 'at < $1' },
  { key: 'housekeeping.refresh_tokens_days', days: 30, table: 'refresh_tokens', where: '(revoked_at IS NOT NULL OR expires_at < now()) AND COALESCE(revoked_at, expires_at) < $1' },
  { key: 'housekeeping.password_resets_days', days: 7, table: 'password_resets', where: '(used_at IS NOT NULL OR expires_at < now()) AND COALESCE(used_at, expires_at) < $1' },
  { key: 'housekeeping.notifications_read_days', days: 180, table: 'notifications', where: 'is_read AND COALESCE(read_at, created_at) < $1' },
  { key: 'housekeeping.job_queue_done_days', days: 30, table: 'job_queue', where: "status = 'completed' AND COALESCE(finished_at, created_at) < $1" },
];

const tableExists = async (t) => (await query('SELECT to_regclass($1) AS t', [`public.${t}`])).rows[0].t !== null;

/** Delete in batches of BATCH rows; returns the number deleted. */
async function purge(table, where, cutoff) {
  let total = 0;
  for (;;) {
    const r = await query(`DELETE FROM ${table} WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${where} LIMIT ${BATCH})`, [cutoff]);
    total += r.rowCount;
    if (r.rowCount < BATCH) return total;
  }
}

const days = async (key, fallback) => {
  const v = Number(await getSetting(key, fallback));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
};

/** Run every retention rule. `now` is for tests. Returns { deleted: { table: n }, kept: [tables kept forever] }. */
export async function housekeeping(_params = {}, { now = new Date() } = {}) {
  const deleted = {};
  const kept = [];
  const cutoffOf = (d) => new Date(now.getTime() - d * 86400000);
  for (const r of RULES) {
    const name = r.name || r.table;
    const d = await days(r.key, r.days);
    if (!d) { kept.push(name); continue; }
    if (!(await tableExists(r.table))) continue;
    deleted[name] = await purge(r.table, r.where, cutoffOf(d));
  }
  const auditDays = await days('housekeeping.audit_log_days', 0);
  if (auditDays) deleted.audit_log = await purge('audit_log', 'at < $1', cutoffOf(Math.max(auditDays, AUDIT_MIN_DAYS)));
  else kept.push('audit_log');
  return { deleted, kept };
}
