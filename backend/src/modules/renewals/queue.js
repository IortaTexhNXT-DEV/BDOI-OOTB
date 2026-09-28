/**
 * PostgreSQL-backed job queue (table job_queue), processed asynchronously in-process.
 * Jobs are claimed with FOR UPDATE SKIP LOCKED so several app instances can share the queue safely.
 */
import { many, one, query } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';

const handlers = new Map();
let running = false;

/** Register the function that runs a job type: fn(payload, { progress }, job) -> result. */
export const registerJobType = (type, fn) => handlers.set(type, fn);

export const jobApi = (j) => ({
  id: String(j.id), jobId: String(j.id), queue: j.queue, type: j.job_type, status: j.status,
  progress: { total: 0, processed: 0, succeeded: 0, failed: 0, ...(j.progress || {}) },
  result: j.result, error: j.error, attempts: j.attempts, createdBy: j.created_by,
  createdAt: j.created_at, startedAt: j.started_at, finishedAt: j.finished_at,
});

/** Insert a waiting job and start processing it in the background. */
export async function enqueue(queue, type, payload, { userId = null, total = 0 } = {}) {
  const r = await one(`INSERT INTO job_queue(queue, job_type, payload, progress, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [queue, type, JSON.stringify(payload), JSON.stringify({ total, processed: 0, succeeded: 0, failed: 0 }), userId]);
  kick();
  return jobApi(r);
}

export async function getJob(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Job not found');
  const j = await one('SELECT * FROM job_queue WHERE id = $1', [id]);
  if (!j) throw notFound('Job not found');
  return jobApi(j);
}

export async function queueStats(queue) {
  const rows = await many('SELECT status, count(*)::int AS n FROM job_queue WHERE ($1::text IS NULL OR queue = $1) GROUP BY status', [queue || null]);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const stats = { waiting: by.waiting || 0, processing: by.processing || 0, completed: by.completed || 0, failed: by.failed || 0 };
  return { ...stats, active: stats.processing, delayed: 0, total: stats.waiting + stats.processing + stats.completed + stats.failed, running };
}

const claimNext = () => one(`UPDATE job_queue SET status = 'processing', started_at = now(), attempts = attempts + 1
  WHERE id = (SELECT id FROM job_queue WHERE status = 'waiting' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);

async function runOne(job) {
  const fn = handlers.get(job.job_type);
  const progress = (p) => query('UPDATE job_queue SET progress = progress || $2::jsonb WHERE id = $1', [job.id, JSON.stringify(p)]);
  try {
    if (!fn) throw new Error(`No handler for job type ${job.job_type}`);
    const result = await fn(job.payload || {}, { progress }, job);
    await query('UPDATE job_queue SET status = \'completed\', result = $2, finished_at = now() WHERE id = $1', [job.id, JSON.stringify(result ?? {})]);
  } catch (e) {
    await query('UPDATE job_queue SET status = \'failed\', error = $2, finished_at = now() WHERE id = $1', [job.id, e.message]);
  }
}

/** Process waiting jobs (up to max). Safe to call repeatedly; a second concurrent call in this process returns at once. */
export async function processQueue({ max = 100 } = {}) {
  if (running) return { processed: 0, busy: true };
  running = true;
  let processed = 0;
  try {
    while (processed < max) {
      const job = await claimNext();
      if (!job) break;
      processed += 1;
      await runOne(job);
    }
  } finally {
    running = false;
  }
  // A job enqueued while this loop was finishing would otherwise wait for the next kick.
  if (await one('SELECT 1 AS x FROM job_queue WHERE status = \'waiting\' LIMIT 1 FOR UPDATE SKIP LOCKED')) kick();
  return { processed };
}

/** Schedule processing on the next tick (errors are recorded on the job rows, never thrown). */
export function kick() {
  if (running) return;
  setImmediate(() => { processQueue().catch(() => {}); });
}

/** Requeue jobs stuck in processing (e.g. after a restart). */
export async function requeueStale(minutes = 15) {
  const r = await query(`UPDATE job_queue SET status = 'waiting' WHERE status = 'processing' AND started_at < now() - ($1 || ' minutes')::interval`, [String(minutes)]);
  return r.rowCount;
}
