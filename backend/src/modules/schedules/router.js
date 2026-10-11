import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import cron from 'node-cron';
import { badRequest, notFound } from '../../lib/errors.js';
import { validate, z } from '../../lib/validate.js';
import { many, one, query } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';
import { audit } from '../../lib/audit.js';
import { nextRunOf, runJob, schedulerTimeZone, startScheduler } from '../../jobs/scheduler.js';
import { assertFeature, featureOfJob, featureState } from '../features/service.js';

const { router, define } = moduleRouter('Schedules', '/schedules');
const canWrite = [requireAuth, requirePermission('write:schedules')];
const canRead = [requireAuth, requirePermission('read:schedules')];
const row = (j, timeZone = null) => ({ id: j.id, code: j.code, name: j.name, description: j.description, cron: j.cron, handler: j.handler, params: j.params, enabled: j.enabled, lastRunAt: j.last_run_at, lastStatus: j.last_status, updatedAt: j.updated_at,
  timeZone, nextRunAt: j.enabled ? nextRunOf(j.code) : null });

define({
  method: 'GET', path: '/', summary: 'Scheduled jobs (renewal notices, expiries, ageing, daily reports, e-mail outbox, housekeeping); cron expressions are read in timeZone (general.timezone)', screen: 'Master > Schedules', middleware: canRead,
  response: { success: true, timeZone: 'Asia/Manila', data: [{ code: 'renewal-notices', cron: '0 6 * * *', enabled: true, lastStatus: 'success', timeZone: 'Asia/Manila', nextRunAt: '2026-01-02T22:00:00.000Z' }] },
  handler: async (_req, res) => {
    const timeZone = await schedulerTimeZone();
    // the jobs of features this environment does not run are not part of its schedules
    const state = await featureState();
    const inEdition = (j) => !featureOfJob(j.code) || state.status(featureOfJob(j.code)) === 'on';
    ok(res, (await many('SELECT * FROM scheduled_jobs ORDER BY id')).filter(inEdition).map((j) => row(j, timeZone)), 'OK', { timeZone });
  },
});
define({
  method: 'GET', path: '/:code/runs', summary: 'Run history of a job (who started a run: triggeredBy, triggeredByName, triggeredByRoles; triggeredBy schedule for a scheduled run)', screen: 'Master > Schedules > History', middleware: canRead,
  response: { success: true, data: [{ id: 1, status: 'success', startedAt: '2026-01-01T06:00:00Z', output: { notifications: 3 }, triggeredBy: 'r.finance', triggeredByName: 'Rosa Finance', triggeredByRoles: ['TIS Finance & General Accounting'] }] },
  handler: async (req, res) => {
    const job = await one('SELECT id FROM scheduled_jobs WHERE code = $1', [req.params.code]);
    if (!job) throw notFound('Job not found');
    // triggeredBy: 'schedule' for a run of the timer, else the login name of the user who pressed Run now
    ok(res, await many(`SELECT r.id, r.started_at AS "startedAt", r.finished_at AS "finishedAt", r.status, r.output, r.error, r.triggered_by AS "triggeredBy",
        u.display_name AS "triggeredByName",
        (SELECT array_agg(ro.name ORDER BY ro.name) FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id) AS "triggeredByRoles"
      FROM job_runs r LEFT JOIN users u ON u.username = r.triggered_by WHERE r.job_id = $1 ORDER BY r.id DESC LIMIT 100`, [job.id]));
  },
});
define({
  method: 'PUT', path: '/:code', summary: 'Change a job schedule, parameters or enabled flag', screen: 'Master > Schedules > Edit', middleware: [...canWrite, validate(z.object({ cron: z.string().optional(), enabled: z.boolean().optional(), params: z.record(z.any()).optional(), name: z.string().optional(), description: z.string().optional() }))],
  request: { cron: '0 7 * * *', enabled: true }, response: { success: true },
  handler: async (req, res) => {
    const b = req.body;
    if (featureOfJob(req.params.code)) await assertFeature(featureOfJob(req.params.code), { write: true });
    // an invalid expression would be saved and the job would silently drop out of the timetable
    if (b.cron !== undefined && !cron.validate(String(b.cron).trim())) {
      throw badRequest('Validation failed', [{ path: 'cron', message: `"${b.cron}" is not a valid schedule (five fields: minute hour day month weekday, e.g. 0 6 * * *)` }]);
    }
    const r = await query('UPDATE scheduled_jobs SET cron = COALESCE($2, cron), enabled = COALESCE($3, enabled), params = COALESCE($4, params), name = COALESCE($5, name), description = COALESCE($6, description), updated_at = now() WHERE code = $1 RETURNING *', [req.params.code, b.cron, b.enabled, b.params ? JSON.stringify(b.params) : null, b.name, b.description]);
    if (!r.rowCount) throw notFound('Job not found');
    await startScheduler(req.log);
    await audit(req, { entity: 'scheduled_job', entityId: req.params.code, action: 'update', after: b });
    ok(res, row(r.rows[0], await schedulerTimeZone()), 'Schedule updated');
  },
});
define({
  method: 'POST', path: '/:code/run', summary: 'Run a job now', screen: 'Master > Schedules > Run now', middleware: canWrite,
  response: { success: true, data: { runId: 1, status: 'success', output: { notifications: 3 } } },
  handler: async (req, res) => {
    const job = await one('SELECT * FROM scheduled_jobs WHERE code = $1', [req.params.code]);
    if (!job) throw notFound('Job not found');
    if (featureOfJob(job.code)) await assertFeature(featureOfJob(job.code), { write: true });
    const result = await runJob(job, req.user.username);
    await audit(req, { entity: 'scheduled_job', entityId: job.code, action: 'run', after: result });
    ok(res, result, `Job ${result.status}`);
  },
});
export default router;
export const mount = '/schedules';
