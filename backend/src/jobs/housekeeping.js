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
  // integration framework: only messages that are finished (sent, failed for good, cancelled, skipped); a queued, processing
  // or retrying message is never deleted. Attempts go with their message (ON DELETE CASCADE) and, when their own period is
  // shorter, on their own once the message is finished.
  { key: 'housekeeping.integration_outbox_days', days: 180, table: 'integration_outbox', where: "status IN ('sent', 'failed', 'cancelled', 'skipped') AND COALESCE(sent_at, updated_at, created_at) < $1" },
  { key: 'housekeeping.integration_attempts_days', days: 180, table: 'integration_attempts', where: "at < $1 AND EXISTS (SELECT 1 FROM integration_outbox o WHERE o.id = integration_attempts.outbox_id AND o.status IN ('sent', 'failed', 'cancelled', 'skipped'))" },
  { key: 'housekeeping.integration_inbox_days', days: 180, table: 'integration_inbox', where: "status IN ('processed', 'ignored', 'failed') AND COALESCE(processed_at, received_at) < $1" },
  // BIR EIS: the acknowledgement of each e-invoice is tax evidence, kept 10 years by default (BIR record keeping); a queued or
  // sending submission is never deleted
  { key: 'housekeeping.eis_submissions_days', days: 3653, table: 'eis_submissions', where: "status IN ('accepted', 'rejected', 'failed', 'manual') AND COALESCE(accepted_at, submitted_at, updated_at) < $1" },
  // AML screening provider calls: finished requests only (the screening itself stays in aml_screenings); 5 years by default
  // (AMLA record keeping)
  { key: 'housekeeping.aml_provider_requests_days', days: 1827, table: 'aml_provider_requests', where: "status IN ('succeeded', 'failed', 'abandoned') AND updated_at < $1" },
  // go-live workbench: the rows of a batch that was loaded or failed validation; the batch row (counts, sheets, result) stays.
  // The rows of a validated batch are kept: it can still be loaded
  { key: 'housekeeping.data_load_rows_days', days: 365, table: 'data_load_rows', where: "batch_id IN (SELECT id FROM data_load_batches b WHERE b.status IN ('loaded', 'failed') AND COALESCE(b.loaded_at, b.validated_at, b.created_at) < $1)" },
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
