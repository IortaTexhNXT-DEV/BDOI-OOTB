/**
 * Jobs of the data loads. Validation, load and undo of a batch run on the job queue (renewals/queue.js: job types
 * data-load.validate, data-load.load, data-load.undo, queue data-load), never in the request: the web proxy cuts a
 * request at 60 seconds. The request moves the batch (compare-and-set of its status), records the job on it (job_id) and
 * answers 202; the screen follows GET /data-load/batches/:id (progress: stage, sheet, rows done and total, written every
 * 500 rows outside the job's transaction; queue: the jobs ahead).
 *
 * Each job is one transaction, under the load lock (one validation, load or undo at a time; a job waiting for it shows
 * the load it waits behind) and with the statement and idle limits of migration.job_statement_timeout_minutes. A job
 * that stops (deployment, crash) leaves nothing: its transaction is rolled back. The sweep (scheduled job
 * data-load-sweep, every 5 minutes) finds the batches whose job is no longer running, or has written no progress for
 * migration.job_stale_minutes, and marks them failed (an undo: loaded again) with "Interrupted: nothing was saved"; a job
 * is never run twice (requeue: false, and a second attempt stops at once). The sweep also expires the loads waiting for
 * approval longer than migration.approval_expiry_hours.
 */
import { many, one, outsideTransaction, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { audit, auditMany } from '../../lib/audit.js';
import { notifyDecision } from '../notifications/approvals.js';
import { enqueue, kick, registerJobType } from '../renewals/queue.js';
import * as svc from './service.js';
import { undoBatch } from './undo.js';

export const QUEUE = 'data-load';
export const JOB_TYPES = { validate: 'data-load.validate', load: 'data-load.load', undo: 'data-load.undo' };
/** Status of a batch while its job of each kind runs, and the status an interrupted job leaves it in. */
const RUNNING = { validate: 'validating', load: 'running', undo: 'undoing' };
const INTERRUPTED_TO = { validating: 'failed', running: 'failed', undoing: 'loaded' };
const STEP_LABELS = { validate: 'Validation', load: 'Load', undo: 'Undo' };

/** The user a job runs as (the uploader for a validation, the approver for a load or an undo). */
const jobUser = (u) => ({ id: u.id, username: u.username, roles: u.roles || [], permissions: u.permissions || [] });
const linkOf = (id) => `/master/configuration/go-live/loads/${id}`;

/** Write the progress of a job on its batch and its job row, outside the job's transaction. */
async function writeProgress(batchId, jobId, p) {
  await outsideTransaction(async () => {
    await query('UPDATE data_load_batches SET progress = COALESCE(progress, \'{}\'::jsonb) || $2::jsonb WHERE id = $1', [batchId, JSON.stringify({ ...p, at: new Date().toISOString() })]);
    if (p.total !== undefined) await query('UPDATE job_queue SET progress = progress || $2::jsonb WHERE id = $1', [jobId, JSON.stringify({ total: p.total, processed: p.done || 0 })]);
  });
}
const reporters = (kind, batchId, jobId) => ({
  onProgress: ({ sheet, done, total }) => writeProgress(batchId, jobId, { stage: 'running', step: kind, sheet, done, total, behind: null }),
  onWait: (behind) => writeProgress(batchId, jobId, { stage: 'queued', step: kind, behind }),
});

/**
 * Enqueue the job of a batch the caller has just moved to its running status: the job is recorded on the batch before
 * it may start. Returns the job ({ id, jobId, status ... }).
 */
export async function startJob(kind, batch, user, extra = {}) {
  const job = await enqueue(QUEUE, JOB_TYPES[kind], { batchId: batch.id, user: jobUser(user), ...extra }, { userId: user.id, total: batch.rowsRead || 0, start: false });
  await query('UPDATE data_load_batches SET job_id = $2, progress = $3 WHERE id = $1 AND status = $4',
    [batch.id, Number(job.id), JSON.stringify({ stage: 'queued', step: kind, done: 0, total: batch.rowsRead || 0, at: new Date().toISOString() }), RUNNING[kind]]);
  kick();
  return job;
}

/** Where the job of a running batch stands: { jobStatus, ahead (jobs before it), behind (load number it waits for) }; null when none runs. */
export async function queueInfo(batch) {
  if (!batch.jobId || !Object.values(RUNNING).includes(batch.status)) return null;
  const j = await one('SELECT status FROM job_queue WHERE id = $1', [batch.jobId]);
  if (!j) return null;
  const ahead = j.status === 'waiting' ? (await one('SELECT count(*)::int AS n FROM job_queue WHERE status IN (\'waiting\', \'processing\') AND id < $1', [batch.jobId])).n : 0;
  const busy = ahead ? await one(`SELECT b.load_number FROM data_load_batches b JOIN job_queue q ON q.id = b.job_id WHERE q.status = 'processing' AND b.id <> $1 ORDER BY q.id LIMIT 1`, [batch.id]) : null;
  return { jobStatus: j.status, ahead, behind: batch.progress?.behind || busy?.load_number || null };
}

/** A second attempt of a job (its first run stopped): the batch is marked interrupted, nothing runs again. */
async function secondAttempt(kind, batchId, job) {
  if (job.attempts <= 1) return false;
  const status = RUNNING[kind];
  if (await svc.stopBatch(batchId, status, INTERRUPTED_TO[status], svc.INTERRUPTED, job.id)) {
    await auditMany(null, [{ entity: 'data_load_batch', entityId: batchId, action: 'interrupted', after: { step: STEP_LABELS[kind], jobId: String(job.id) } }]);
  }
  return true;
}

/** Tell the maker how the job of a batch ended (validation: the uploader; load and undo: the submitter or requester). */
async function tell(batch, userId, decidedBy, word, ok, message) {
  await notifyDecision({ userId, decidedBy, document: 'Data load', number: batch.loadNumber, approved: ok, status: word, by: 'the system', message,
    link: linkOf(batch.id), entity: 'data_load_batch', entityId: batch.id });
}

async function validateJob(payload, _ctx, job) {
  if (await secondAttempt('validate', payload.batchId, job)) return { interrupted: true };
  try {
    const r = await svc.validateBatch(payload.batchId, payload.user, { jobId: job.id, ...reporters('validate', payload.batchId, job.id) });
    if (!r) return { superseded: true };
    return { batchId: r.batch.id, status: r.batch.status, rowsError: r.batch.rowsError, rowsDuplicate: r.batch.rowsDuplicate };
  } catch (e) {
    const b = await svc.getBatch(payload.batchId);
    await tell(b, b.createdById, null, 'validation stopped', false, b.message || e.message);
    throw e;
  }
}

async function loadJob(payload, _ctx, job) {
  if (await secondAttempt('load', payload.batchId, job)) return { interrupted: true };
  const by = { user: payload.user };
  try {
    const r = await svc.loadBatch(payload.batchId, payload.user, { validRowsOnly: !!payload.validRowsOnly, req: by, jobId: job.id, ...reporters('load', payload.batchId, job.id) });
    const counts = Object.values(r.batch.loadedCounts || {}).reduce((a, c) => ({ created: a.created + (c.created || 0), updated: a.updated + (c.updated || 0) }), { created: 0, updated: 0 });
    await audit(by, { entity: 'data_load_batch', entityId: r.batch.id, action: 'load', after: { loadNumber: r.batch.loadNumber, kit: r.batch.kit, loadedCounts: r.batch.loadedCounts,
      validRowsOnly: r.batch.validRowsOnly, loadMs: r.batch.loadMs } });
    await tell(r.batch, r.batch.submittedById || r.batch.createdById, payload.user.id, 'loaded', true, `${counts.created} created, ${counts.updated} updated`);
    return { batchId: r.batch.id, status: r.batch.status, ...counts };
  } catch (e) {
    const b = await svc.getBatch(payload.batchId);
    await tell(b, b.submittedById || b.createdById, payload.user.id, 'not loaded', false, b.message || e.message);
    throw e;
  }
}

async function undoJob(payload, _ctx, job) {
  if (await secondAttempt('undo', payload.batchId, job)) return { interrupted: true };
  try {
    const r = await undoBatch(payload.batchId, payload.user, { jobId: job.id, ...reporters('undo', payload.batchId, job.id) });
    await tell(r.batch, r.batch.undoRequestedById, payload.user.id, 'undone', true, `${r.removed} record(s) removed, ${r.restored} restored`);
    return { batchId: r.batch.id, status: r.batch.status, removed: r.removed, restored: r.restored };
  } catch (e) {
    const b = await svc.getBatch(payload.batchId);
    await tell(b, b.undoRequestedById, payload.user.id, 'not undone', false, b.message || e.message);
    throw e;
  }
}

registerJobType(JOB_TYPES.validate, validateJob, { requeue: false });
registerJobType(JOB_TYPES.load, loadJob, { requeue: false });
registerJobType(JOB_TYPES.undo, undoJob, { requeue: false });

/**
 * The sweep: batches whose job stopped are marked interrupted (failed, or loaded again after an undo), their job failed;
 * loads waiting for approval past their expiry expire. Returns { interrupted, expired }.
 */
export async function sweep() {
  const stale = Math.max(1, Number(await getSetting('migration.job_stale_minutes', 15)) || 15);
  const stuck = await many(`SELECT b.id, b.status, b.job_id FROM data_load_batches b LEFT JOIN job_queue q ON q.id = b.job_id
    WHERE b.status IN ('validating', 'running', 'undoing')
      AND (q.status IN ('completed', 'failed')
        OR (q.id IS NULL AND COALESCE((b.progress->>'at')::timestamptz, b.created_at) < now() - make_interval(mins => $1::int))
        OR (q.status = 'processing' AND COALESCE((b.progress->>'at')::timestamptz, q.started_at) < now() - make_interval(mins => $1::int)))`, [stale]);
  const entries = [];
  for (const b of stuck) {
    if (!await svc.stopBatch(b.id, b.status, INTERRUPTED_TO[b.status], svc.INTERRUPTED)) continue;
    if (b.job_id) await query('UPDATE job_queue SET status = \'failed\', error = $2, finished_at = now() WHERE id = $1 AND status IN (\'waiting\', \'processing\')', [b.job_id, svc.INTERRUPTED]);
    entries.push({ entity: 'data_load_batch', entityId: b.id, action: 'interrupted', after: { status: b.status, jobId: b.job_id == null ? null : String(b.job_id) } });
  }
  const expired = await many(`UPDATE data_load_batches SET status = 'expired', message = 'Not approved in time: validate the load again and submit it' WHERE status = 'pending-approval'
    AND expires_at < now() RETURNING id, load_number, submitted_by`);
  for (const b of expired) {
    entries.push({ entity: 'data_load_batch', entityId: b.id, action: 'expire', after: { loadNumber: b.load_number } });
    await notifyDecision({ userId: b.submitted_by, document: 'Data load', number: b.load_number, approved: false, status: 'expired', by: 'the system',
      message: 'Not approved in time: validate the load again and submit it', link: linkOf(b.id), entity: 'data_load_batch', entityId: b.id });
  }
  await auditMany(null, entries);
  return { interrupted: entries.filter((e) => e.action === 'interrupted').length, expired: expired.length };
}
