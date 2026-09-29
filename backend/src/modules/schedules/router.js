import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requireRole } from '../../lib/auth.js';
import { notFound } from '../../lib/errors.js';
import { validate, z } from '../../lib/validate.js';
import { many, one, query } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';
import { audit } from '../../lib/audit.js';
import { nextRunOf, runJob, schedulerTimeZone, startScheduler } from '../../jobs/scheduler.js';

const { router, define } = moduleRouter('Schedules', '/schedules');
const admin = [requireAuth, requireRole('accounting')];
const row = (j, timeZone = null) => ({ id: j.id, code: j.code, name: j.name, description: j.description, cron: j.cron, handler: j.handler, params: j.params, enabled: j.enabled, lastRunAt: j.last_run_at, lastStatus: j.last_status, updatedAt: j.updated_at,
  timeZone, nextRunAt: j.enabled ? nextRunOf(j.code) : null });

define({
  method: 'GET', path: '/', summary: 'Scheduled jobs (renewal notices, expiries, ageing, daily reports, e-mail outbox, housekeeping); cron expressions are read in timeZone (general.timezone)', screen: 'Master > Schedules', middleware: [requireAuth],
  response: { success: true, timeZone: 'Asia/Manila', data: [{ code: 'renewal-notices', cron: '0 6 * * *', enabled: true, lastStatus: 'success', timeZone: 'Asia/Manila', nextRunAt: '2026-01-02T22:00:00.000Z' }] },
  handler: async (_req, res) => {
    const timeZone = await schedulerTimeZone();
    ok(res, (await many('SELECT * FROM scheduled_jobs ORDER BY id')).map((j) => row(j, timeZone)), 'OK', { timeZone });
  },
});
define({
  method: 'GET', path: '/:code/runs', summary: 'Run history of a job', screen: 'Master > Schedules > History', middleware: [requireAuth],
  response: { success: true, data: [{ id: 1, status: 'success', startedAt: '2026-01-01T06:00:00Z', output: { notifications: 3 } }] },
  handler: async (req, res) => {
    const job = await one('SELECT id FROM scheduled_jobs WHERE code = $1', [req.params.code]);
    if (!job) throw notFound('Job not found');
    ok(res, await many('SELECT id, started_at AS "startedAt", finished_at AS "finishedAt", status, output, error, triggered_by AS "triggeredBy" FROM job_runs WHERE job_id = $1 ORDER BY id DESC LIMIT 100', [job.id]));
  },
});
define({
  method: 'PUT', path: '/:code', summary: 'Change a job schedule, parameters or enabled flag', screen: 'Master > Schedules > Edit', middleware: [...admin, validate(z.object({ cron: z.string().optional(), enabled: z.boolean().optional(), params: z.record(z.any()).optional(), name: z.string().optional(), description: z.string().optional() }))],
  request: { cron: '0 7 * * *', enabled: true }, response: { success: true },
  handler: async (req, res) => {
    const b = req.body;
    const r = await query('UPDATE scheduled_jobs SET cron = COALESCE($2, cron), enabled = COALESCE($3, enabled), params = COALESCE($4, params), name = COALESCE($5, name), description = COALESCE($6, description), updated_at = now() WHERE code = $1 RETURNING *', [req.params.code, b.cron, b.enabled, b.params ? JSON.stringify(b.params) : null, b.name, b.description]);
    if (!r.rowCount) throw notFound('Job not found');
    await startScheduler(req.log);
    await audit(req, { entity: 'scheduled_job', entityId: req.params.code, action: 'update', after: b });
    ok(res, row(r.rows[0], await schedulerTimeZone()), 'Schedule updated');
  },
});
define({
  method: 'POST', path: '/:code/run', summary: 'Run a job now', screen: 'Master > Schedules > Run now', middleware: admin,
  response: { success: true, data: { runId: 1, status: 'success', output: { notifications: 3 } } },
  handler: async (req, res) => {
    const job = await one('SELECT * FROM scheduled_jobs WHERE code = $1', [req.params.code]);
    if (!job) throw notFound('Job not found');
    const result = await runJob(job, req.user.username);
    await audit(req, { entity: 'scheduled_job', entityId: job.code, action: 'run', after: result });
    ok(res, result, `Job ${result.status}`);
  },
});
export default router;
export const mount = '/schedules';
