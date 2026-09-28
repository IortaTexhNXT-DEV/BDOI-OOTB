import cron from 'node-cron';
import { many, query } from '../db/pool.js';
import * as handlers from './handlers.js';

const tasks = new Map();

/** Run one job now (used by the scheduler and by POST /schedules/:code/run). */
export async function runJob(job, triggeredBy = 'schedule') {
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

/** (Re)load every enabled job from the database and schedule it. */
export async function startScheduler(log = console) {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
  const jobs = await many('SELECT * FROM scheduled_jobs WHERE enabled');
  for (const job of jobs) {
    if (!cron.validate(job.cron)) { log.warn?.(`job ${job.code}: invalid cron ${job.cron}`); continue; }
    tasks.set(job.code, cron.schedule(job.cron, () => runJob(job).catch((e) => log.error?.(e))));
  }
  log.info?.(`scheduler: ${tasks.size} job(s) scheduled`);
  return tasks.size;
}
export const stopScheduler = () => { for (const t of tasks.values()) t.stop(); tasks.clear(); };
