/**
 * Housekeeping (scheduled job "housekeeping", daily): deletes operational rows past their retention period. Every
 * period is a setting in System Settings > Housekeeping (days; 0 = keep forever). Deletes run in batches so a large
 * backlog never holds long locks. The audit trail is not purged unless housekeeping.audit_log_days is set, and then
 * never below the 7-year statutory minimum (BIR / Insurance Commission record keeping).
 *
 * Data loads (Data Migration & Go-Live): the batch record (counts, sheets, result, file SHA-256) always stays. The rows
 * and the uploaded workbook of a migration load of the production run that was loaded or undone are evidence of the
 * cutover: kept migration.evidence_retention_years after the go-live lock (kept while go-live is not locked; 0 = for
 * ever). The rows of every other finished load (failed, rejected, withdrawn, expired, loaded, undone: configuration
 * loads and mock runs) go after housekeeping.data_load_rows_days, their workbooks after housekeeping.data_load_files_days.
 * A load still validated, waiting for approval or in progress is never touched. Each purge is audited per load
 * (data_load_batch purge-rows / purge-file).
 */
import { query, withTransaction } from '../db/pool.js';
import { getSetting } from '../lib/settings.js';
import { auditMany } from '../lib/audit.js';
import { deleteObject } from '../modules/uploads/storage.js';

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

/** The audit trail is append-only (trigger audit_log_append_only); only this purge, past the statutory minimum, may delete from it. */
async function purgeAudit(cutoff) {
  return withTransaction(async (db) => {
    // the bypass writes its own entry first (tool, reason, user) and the closing one with the rows deleted (migration 0596)
    await db.query('SELECT audit_bypass_begin($1, $2, $3)', ['housekeeping', `audit trail retention: entries before ${new Date(cutoff).toISOString().slice(0, 10)}`, 'system']);
    let total = 0;
    for (;;) {
      const r = await db.query(`DELETE FROM audit_log WHERE ctid IN (SELECT ctid FROM audit_log WHERE at < $1 AND entity <> 'audit_bypass' LIMIT ${BATCH})`, [cutoff]);
      total += r.rowCount;
      if (r.rowCount < BATCH) break;
    }
    await db.query('SELECT audit_bypass_end()');
    return total;
  });
}

const days = async (key, fallback) => {
  const v = Number(await getSetting(key, fallback));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
};

/** Statuses of a load that is finished: its rows and workbook may go once their retention period is over. */
const FINISHED_LOADS = ['loaded', 'failed', 'rejected', 'withdrawn', 'expired', 'undone'];

/**
 * Retention of the rows and uploaded workbooks of data loads. Returns { data_load_rows, data_load_files } (number
 * deleted, null when the setting keeps them for ever).
 */
export async function dataLoadRetention(now = new Date()) {
  const rowDays = await days('housekeeping.data_load_rows_days', 365);
  const fileDays = await days('housekeeping.data_load_files_days', 365);
  const years = Math.max(0, Math.floor(Number(await getSetting('migration.evidence_retention_years', 10)) || 0));
  const lockedAt = (await getSetting('golive.locked', false)) === true ? Date.parse(String((await getSetting('golive.locked_at', '')) || '')) : NaN;
  // the evidence of the production run goes once go-live is locked and its retention years are over
  const evidenceEnds = years && !Number.isNaN(lockedAt) ? new Date(lockedAt).setUTCFullYear(new Date(lockedAt).getUTCFullYear() + years) : null;
  const evidenceExpired = evidenceEnds !== null && evidenceEnds <= now.getTime();
  const before = (d) => (d ? now.getTime() - d * 86400000 : null);
  const batches = (await query(`SELECT b.id, b.load_number, b.file_key, b.file_sha256, COALESCE(b.undone_at, b.loaded_at, b.decided_at, b.validated_at, b.created_at) AS at,
      (b.kit = 'migration' AND b.status IN ('loaded', 'undone') AND EXISTS (SELECT 1 FROM migration_runs r WHERE r.id = b.run_id AND r.kind = 'production' AND r.status <> 'cancelled')) AS evidence,
      EXISTS (SELECT 1 FROM data_load_rows d WHERE d.batch_id = b.id) AS has_rows
    FROM data_load_batches b WHERE b.status = ANY($1) AND (b.file_key IS NOT NULL OR EXISTS (SELECT 1 FROM data_load_rows d WHERE d.batch_id = b.id)) ORDER BY b.id`,
  [FINISHED_LOADS])).rows;
  const expired = (b, d) => (b.evidence ? evidenceExpired : before(d) !== null && new Date(b.at).getTime() < before(d));
  const out = { data_load_rows: rowDays ? 0 : null, data_load_files: fileDays ? 0 : null };
  const entries = [];
  for (const b of batches) {
    if (b.has_rows && expired(b, rowDays)) {
      const n = (await query('DELETE FROM data_load_rows WHERE batch_id = $1', [b.id])).rowCount;
      if (out.data_load_rows !== null) out.data_load_rows += n;
      entries.push({ entity: 'data_load_batch', entityId: b.id, action: 'purge-rows', after: { loadNumber: b.load_number, rows: n, evidence: b.evidence } });
    }
    if (b.file_key && expired(b, fileDays)) {
      await deleteObject(b.file_key);
      await query('UPDATE data_load_batches SET file_key = NULL WHERE id = $1', [b.id]);
      if (out.data_load_files !== null) out.data_load_files += 1;
      entries.push({ entity: 'data_load_batch', entityId: b.id, action: 'purge-file', after: { loadNumber: b.load_number, fileSha256: b.file_sha256, evidence: b.evidence } });
    }
  }
  await auditMany(null, entries);
  return out;
}

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
  const loads = await dataLoadRetention(now);
  for (const k of ['data_load_rows', 'data_load_files']) {
    if (loads[k] === null) kept.push(k);
    else deleted[k] = loads[k];
  }
  const auditDays = await days('housekeeping.audit_log_days', 0);
  if (auditDays) deleted.audit_log = await purgeAudit(cutoffOf(Math.max(auditDays, AUDIT_MIN_DAYS)));
  else kept.push('audit_log');
  return { deleted, kept };
}
