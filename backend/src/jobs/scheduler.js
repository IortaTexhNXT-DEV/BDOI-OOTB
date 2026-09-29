import cron from 'node-cron';
import { many, one, pool, query } from '../db/pool.js';
import * as handlers from './handlers.js';
import { businessTimeZone } from '../lib/dates.js';

const tasks = new Map();
/** State of the schedules loaded on this instance: time zone, signature of the jobs table, change-watch timer. */
const state = { timeZone: null, signature: null, watcher: null, checking: false };

/** Milliseconds between two checks for changed schedules / time zone (SCHEDULER_RELOAD_SECONDS, default 30; 0 = off). */
export function reloadIntervalMs(source = process.env) {
  const v = Number(source.SCHEDULER_RELOAD_SECONDS ?? 30);
  return Number.isFinite(v) && v > 0 ? v * 1000 : 0;
}

/**
 * Signature of what the cron timetable depends on: every job's code, cron, enabled flag, handler and parameters, plus
 * the configured time zone. One cheap query on a small table; a different signature means the schedules must be reloaded.
 */
export async function scheduleSignature() {
  const r = await one(`SELECT md5(COALESCE(string_agg(code || '|' || cron || '|' || enabled::text || '|' || handler || '|' || COALESCE(params::text, ''), ';' ORDER BY code), '')) AS sig
    FROM scheduled_jobs`);
  return `${r.sig}|${await businessTimeZone()}`;
}

/** The time zone the cron expressions are read in (general.timezone, Asia/Manila by the seed). */
export const schedulerTimeZone = async () => state.timeZone || businessTimeZone();

/** Next run of a job scheduled on this instance (null when it is not scheduled here). */
export function nextRunOf(code) {
  try { return tasks.get(code)?.getNextRun?.() || null; } catch { return null; }
}

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

/**
 * (Re)load every enabled job from the database and schedule it in the configured business time zone
 * (general.timezone, Asia/Manila by the seed): "0 6 * * *" runs at 06:00 Manila time whatever the zone of the server
 * clock (containers run on UTC). Does nothing when SCHEDULER_ENABLED is false.
 */
export async function startScheduler(log = console) {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
  if (!schedulerEnabled()) {
    log.info?.('scheduler: disabled on this instance (SCHEDULER_ENABLED=false)');
    return 0;
  }
  const timeZone = await businessTimeZone();
  state.timeZone = timeZone;
  state.signature = await scheduleSignature();
  const jobs = await many('SELECT * FROM scheduled_jobs WHERE enabled');
  for (const job of jobs) {
    if (!cron.validate(job.cron)) { log.warn?.(`job ${job.code}: invalid cron ${job.cron}`); continue; }
    tasks.set(job.code, cron.schedule(job.cron, (ctx) => runJob(job, 'schedule', { firedAt: ctx?.date || ctx?.triggeredAt || new Date() })
      .then((r) => { if (r.status === 'skipped') log.debug?.(`job ${job.code}: ${r.reason}`); })
      .catch((e) => log.error?.(e)), { timezone: timeZone, name: job.code }));
  }
  log.info?.(`scheduler: ${tasks.size} job(s) scheduled (time zone ${timeZone})`);
  return tasks.size;
}

/**
 * Reload the schedules when the jobs table or the time zone changed since they were loaded on this instance (an edit
 * made through another API instance). Returns true when it reloaded.
 */
export async function reloadIfChanged(log = console) {
  if (!schedulerEnabled() || state.checking) return false;
  state.checking = true;
  try {
    if ((await scheduleSignature()) === state.signature) return false;
    log.info?.('scheduler: schedules or time zone changed; reloading');
    await startScheduler(log);
    return true;
  } finally {
    state.checking = false;
  }
}

/** Check for schedule changes every SCHEDULER_RELOAD_SECONDS (default 30) so every instance follows an edit. */
export function watchSchedules(log = console, ms = reloadIntervalMs()) {
  if (state.watcher || !ms) return;
  state.watcher = setInterval(() => reloadIfChanged(log).catch((e) => log.warn?.(`scheduler: change check failed: ${e.message}`)), ms);
  state.watcher.unref?.();
}

export const stopScheduler = () => {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
  if (state.watcher) clearInterval(state.watcher);
  state.watcher = null;
  state.signature = null;
};
