import cron from 'node-cron';
import { many, pool, query } from '../db/pool.js';
import * as handlers from './handlers.js';

const tasks = new Map();

/**
 * Whether this instance runs the cron scheduler (SCHEDULER_ENABLED, default true). Set it to false on API instances
 * that must not run scheduled jobs (e.g. a dedicated web tier); "Run now" from Master > Schedules still works.
 */
export function schedulerEnabled(source = process.env) {
  const v = String(source.SCHEDULER_ENABLED ?? '').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(v);
}

/** Advisory-lock key of a job: one lock namespace for BrokerVerse jobs, one key per job code (int4 pair). */
const LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext('brokerverse.scheduled_job'), hashtext($1)) AS locked";
const UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('brokerverse.scheduled_job'), hashtext($1))";

/**
 * Run one job now (used by the scheduler and by POST /schedules/:code/run).
 *
 * Several API instances may run the scheduler. Each run takes a PostgreSQL session advisory lock keyed on the job code
 * (pg_try_advisory_lock on a dedicated connection, held until the run ends), so a job never runs twice at the same time
 * across instances. A scheduled run additionally skips when another instance already started a scheduled run of the
 * same job in the same minute (the cron slot), so an instance whose clock fires a little later does not repeat it.
 * A skipped run returns { status: 'skipped' } and records nothing.
 */
export async function runJob(job, triggeredBy = 'schedule', { firedAt = new Date() } = {}) {
  const lock = await pool.connect();
  let locked = false;
  try {
    locked = (await lock.query(LOCK_SQL, [job.code])).rows[0].locked;
    if (!locked) return { status: 'skipped', reason: `job ${job.code} is already running on another instance` };
    if (triggeredBy === 'schedule') {
      const dup = await lock.query(`SELECT 1 FROM job_runs WHERE job_id = $1 AND triggered_by = 'schedule'
        AND started_at >= date_trunc('minute', $2::timestamptz) LIMIT 1`, [job.id, firedAt]);
      if (dup.rowCount) return { status: 'skipped', reason: `job ${job.code} already ran for this schedule slot` };
    }
    return await execute(job, triggeredBy);
  } finally {
    if (locked) await lock.query(UNLOCK_SQL, [job.code]).catch(() => {});
    lock.release();
  }
}

async function execute(job, triggeredBy) {
  const run = (await query('INSERT INTO job_runs(job_id, triggered_by) VALUES ($1,$2) RETURNING id', [job.id, triggeredBy])).rows[0];
  try {
    const fn = handlers[job.handler];
    if (!fn) throw new Error(`No handler named ${job.handler}`);
    const output = await fn(job.params || {});
    await query('UPDATE job_runs SET finished_at = now(), status = \'success\', output = $2 WHERE id = $1', [run.id, JSON.stringify(output ?? {})]);
    await query('UPDATE scheduled_jobs SET last_run_at = now(), last_status = \'success\' WHERE id = $1', [job.id]);
    return { runId: run.id, status: 'success', output };
  } catch (e) {
    await query('UPDATE job_runs SET finished_at = now(), status = \'failed\', error = $2 WHERE id = $1', [run.id, e.message]);
    await query('UPDATE scheduled_jobs SET last_run_at = now(), last_status = \'failed\' WHERE id = $1', [job.id]);
    return { runId: run.id, status: 'failed', error: e.message };
  }
}

/** (Re)load every enabled job from the database and schedule it. Does nothing when SCHEDULER_ENABLED is false. */
export async function startScheduler(log = console) {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
  if (!schedulerEnabled()) {
    log.info?.('scheduler: disabled on this instance (SCHEDULER_ENABLED=false)');
    return 0;
  }
  const jobs = await many('SELECT * FROM scheduled_jobs WHERE enabled');
  for (const job of jobs) {
    if (!cron.validate(job.cron)) { log.warn?.(`job ${job.code}: invalid cron ${job.cron}`); continue; }
    tasks.set(job.code, cron.schedule(job.cron, (ctx) => runJob(job, 'schedule', { firedAt: ctx?.date || ctx?.triggeredAt || new Date() })
      .then((r) => { if (r.status === 'skipped') log.debug?.(`job ${job.code}: ${r.reason}`); })
      .catch((e) => log.error?.(e))));
  }
  log.info?.(`scheduler: ${tasks.size} job(s) scheduled`);
  return tasks.size;
}
export const stopScheduler = () => { for (const t of tasks.values()) t.stop(); tasks.clear(); };
