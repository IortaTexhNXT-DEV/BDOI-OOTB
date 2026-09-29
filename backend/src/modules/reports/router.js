import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission, hasPermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { audit } from '../../lib/audit.js';
import { forbidden } from '../../lib/errors.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Reports', '/reports');
const canRead = [requireAuth, requirePermission('read:reports')];
const canWrite = [requireAuth, requirePermission('write:reports')];
/** Bearer token when present; otherwise the handler requires a signed ?token= download link. */
const optionalAuth = (req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next());

const FORMAT = z.enum(['csv', 'xlsx', 'pdf']);
const emails = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(/[,;\s]+/).filter(Boolean) : v),
  z.array(z.string().email('Recipients must be e-mail addresses')).max(50),
);
const scheduleFields = {
  name: z.string().trim().min(1).max(200).optional(),
  reportCode: z.string().trim().min(1),
  cron: z.string().trim().min(9).max(120),
  params: z.record(z.any()),
  format: FORMAT,
  recipients: emails,
  enabled: z.boolean(),
};
const withCodeAlias = (schema) => z.preprocess((b) => (b && typeof b === 'object' && !b.reportCode && (b.code || b.report_code) ? { ...b, reportCode: b.code || b.report_code } : b), schema);
const createSchedule = withCodeAlias(z.object({ ...scheduleFields, params: scheduleFields.params.default({}), format: FORMAT.default('xlsx'), recipients: emails.default([]), enabled: z.boolean().default(true) }).passthrough());
const updateSchedule = withCodeAlias(z.object(scheduleFields).partial().passthrough());
const runBody = z.object({ page: z.coerce.number().int().min(1).optional(), perPage: z.coerce.number().int().min(1).max(500).optional() }).passthrough();
const generateBody = z.object({ format: FORMAT.optional() }).passthrough();

const EXAMPLE_PARAMS = { ReportCriteria: 'Overall', FromDate: '2026-01-01', ToDate: '2026-09-30', Agent: '', Company: '', Branch: '', Client: '' };
const EXAMPLE_GEN = { id: 'rpt_1a2b3c4d5e6f7a8b', code: 'production-register', name: 'Production Register', format: 'xlsx', fileName: 'production-register_2026-01-01_2026-09-30_20260928-101500.xlsx', rowCount: 42, status: 'done', downloadUrl: 'http://localhost:8000/api/reports/generated/rpt_1a2b3c4d5e6f7a8b/download?token=eyJ...' };
const EXAMPLE_SCHEDULE = { id: 'rsch_0f1e2d3c4b5a6978', name: 'Daily production', reportCode: 'production-register', cron: '0 6 * * 1-5', params: { period: 'yesterday', ReportCriteria: 'Overall' }, format: 'xlsx', recipients: ['ops@broker.example'], enabled: true, jobCode: 'report-rsch_0f1e2d3c4b5a6978' };

/* ----- generated reports (history + download) ----- */
define({
  method: 'GET', path: '/generated', summary: 'History of generated report files (newest first)', screen: 'Reports > Generated reports', middleware: canRead, permissions: ['read:reports'],
  query: { code: 'production-register', page: 1, perPage: 20 },
  response: { success: true, data: [EXAMPLE_GEN], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const r = await svc.listGenerated(req.user, { code: req.query.code, ...pg });
    ok(res, r.rows, 'OK', pageMeta(r.total, pg));
  },
});
define({
  method: 'GET', path: '/generated/:id/download', summary: 'Download a generated report file (bearer token or signed ?token= link)', screen: 'Reports > * > Generate (download)',
  auth: false, middleware: [optionalAuth], permissions: ['read:reports (or signed link token)'], query: { token: '<signed link token from downloadUrl>' }, response: '(file: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or application/pdf)',
  handler: async (req, res) => {
    if (req.user && !hasPermission(req.user, 'read:reports') && !req.query.token) throw forbidden('Requires permission: read:reports');
    const f = await svc.getGeneratedFile(req.params.id, { user: req.user, token: req.query.token });
    res.type(f.contentType);
    res.download(f.path, f.fileName);
  },
});

/* ----- schedules ----- */
define({
  method: 'GET', path: '/schedules', summary: 'Report schedules (e-mailed reports)', screen: 'Reports > Schedules', middleware: canRead, permissions: ['read:reports'],
  query: { reportCode: 'production-register' }, response: { success: true, data: [EXAMPLE_SCHEDULE] },
  handler: async (req, res) => ok(res, await svc.listSchedules(req.user, { reportCode: req.query.reportCode })),
});
define({
  method: 'GET', path: '/schedules/:id', summary: 'One report schedule', screen: 'Reports > Schedules > View', middleware: canRead, permissions: ['read:reports'],
  response: { success: true, data: EXAMPLE_SCHEDULE },
  handler: async (req, res) => {
    const s = await svc.getSchedule(req.params.id);
    await svc.getDefinition(s.report_code, req.user);
    ok(res, (await svc.listSchedules(req.user, { reportCode: s.report_code })).find((x) => x.id === s.id));
  },
});
define({
  method: 'POST', path: '/schedules', summary: 'Create a report schedule (adds a scheduledReport job to scheduled_jobs)', screen: 'Reports > Schedules > Add',
  permissions: ['write:reports'], middleware: [...canWrite, validate(createSchedule)],
  request: { name: 'Daily production', reportCode: 'production-register', cron: '0 6 * * 1-5', params: { period: 'yesterday', ReportCriteria: 'Overall' }, format: 'xlsx', recipients: ['ops@broker.example'], enabled: true },
  response: { success: true, message: 'Created', data: EXAMPLE_SCHEDULE },
  handler: async (req, res) => {
    const s = await svc.createSchedule(req.user, req.body);
    await audit(req, { entity: 'report_schedule', entityId: s.id, action: 'create', after: s });
    await svc.reloadScheduler(req.log);
    created(res, (await svc.listSchedules(req.user, { reportCode: s.report_code })).find((x) => x.id === s.id), 'Report schedule created');
  },
});
define({
  method: 'PUT', path: '/schedules/:id', summary: 'Update a report schedule (cron, parameters, format, recipients, enabled)', screen: 'Reports > Schedules > Edit',
  permissions: ['write:reports'], middleware: [...canWrite, validate(updateSchedule)], request: { cron: '0 7 * * *', recipients: ['finance@broker.example'], enabled: false },
  response: { success: true, message: 'Report schedule updated', data: { ...EXAMPLE_SCHEDULE, cron: '0 7 * * *', enabled: false } },
  handler: async (req, res) => {
    const { before, after } = await svc.updateSchedule(req.user, req.params.id, req.body);
    await audit(req, { entity: 'report_schedule', entityId: req.params.id, action: 'update', before, after });
    await svc.reloadScheduler(req.log);
    ok(res, (await svc.listSchedules(req.user, { reportCode: after.report_code })).find((x) => x.id === after.id), 'Report schedule updated');
  },
});
define({
  method: 'DELETE', path: '/schedules/:id', summary: 'Delete a report schedule (and its scheduled job)', screen: 'Reports > Schedules > Delete', middleware: canWrite, permissions: ['write:reports'],
  response: { success: true, message: 'Report schedule deleted', data: { id: 'rsch_0f1e2d3c4b5a6978' } },
  handler: async (req, res) => {
    const s = await svc.deleteSchedule(req.user, req.params.id);
    await audit(req, { entity: 'report_schedule', entityId: s.id, action: 'delete', before: s });
    await svc.reloadScheduler(req.log);
    ok(res, { id: s.id }, 'Report schedule deleted');
  },
});
define({
  method: 'POST', path: '/schedules/:id/run', summary: 'Run a report schedule now (generate + e-mail recipients)', screen: 'Reports > Schedules > Run now', middleware: canWrite, permissions: ['write:reports'],
  response: { success: true, data: { reportId: 'rpt_1a2b3c4d5e6f7a8b', code: 'production-register', format: 'xlsx', rows: 42, emailed: 1 } },
  handler: async (req, res) => {
    const s = await svc.getSchedule(req.params.id);
    await svc.getDefinition(s.report_code, req.user);
    const out = await svc.scheduledReport({ scheduleId: s.id });
    await audit(req, { entity: 'report_schedule', entityId: s.id, action: 'run', after: out });
    ok(res, out, 'Report schedule run');
  },
});

/* ----- filter options ----- */
// Report filters must not depend on user administration (GET /users needs read:users): every report reader may list the
// agents a report can be filtered by.
define({
  method: 'GET', path: '/filters/agents', summary: 'Producers a report Agent filter can use (active users holding a commission-earning role, commission.eligible_roles), as { label, value }',
  screen: 'Reports > * (Agent filter)', middleware: canRead, permissions: ['read:reports'],
  response: { success: true, data: [{ label: 'Maria Santos', value: 'usr_1', code: 'AE001' }] },
  handler: async (_req, res) => ok(res, await svc.agentFilterOptions()),
});

/* ----- catalogue, run and generate ----- */
define({
  method: 'GET', path: '/', summary: 'Report catalogue visible to the caller (by role and permission)', screen: 'Reports (menu) > Operational Reports / Financial Reports', middleware: canRead, permissions: ['read:reports'],
  query: { category: 'operational' },
  response: { success: true, data: [{ code: 'production-register', name: 'Production Register', category: 'operational', screen: 'Reports > Operational Reports > Production', criteria: ['Overall', 'Agent', 'Principal Insurer', 'Branch'], formats: ['csv', 'xlsx', 'pdf'] }] },
  handler: async (req, res) => ok(res, await svc.listCatalogue(req.user, { category: req.query.category, search: req.query.search })),
});
define({
  method: 'GET', path: '/:code', summary: 'Report definition: parameters (JSON schema of the filter form), columns, criteria, formats', screen: 'Reports > * (filter form)', middleware: canRead, permissions: ['read:reports'],
  response: { success: true, data: { code: 'production-register', name: 'Production Register', parameters: { type: 'object', required: ['ReportCriteria'] }, columns: [{ key: 'policyNumber', label: 'Policy No.', type: 'text' }] } },
  handler: async (req, res) => ok(res, await svc.describe(req.params.code, req.user)),
});
define({
  method: 'POST', path: '/:code/run', summary: 'Run a report for on-screen display: paged rows, totals, summary and criteria groups', screen: 'Reports > * > Generate (preview)',
  permissions: ['read:reports'], middleware: [...canRead, validate(runBody)], request: { ...EXAMPLE_PARAMS, page: 1, perPage: 50 },
  response: { success: true, data: { report: { code: 'production-register', name: 'Production Register' }, columns: [{ key: 'policyNumber', label: 'Policy No.' }], rows: [{ policyNumber: 'POL-2026-00001', premium: 12500 }], totals: { premium: 12500 }, summary: { newBusiness: 1 }, groups: null, params: { from: '2026-01-01', to: '2026-09-30', criteria: 'Overall', filters: {} } }, total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging({ ...req.query, ...req.body }, { page: 1, perPage: Number(await svc.defaultPageSize()) });
    const params = { ...req.body };
    delete params.page;
    delete params.perPage;
    const r = await svc.runReport(req.params.code, params, { user: req.user, page: pg.page, perPage: pg.perPage });
    const { total, ...data } = r;
    ok(res, data, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'POST', path: '/:code/generate', summary: 'Generate a report file (csv, xlsx or pdf) into storage and return its download link', screen: 'Reports > * > Generate',
  permissions: ['read:reports'], middleware: [...canRead, validate(generateBody)], request: { ...EXAMPLE_PARAMS, format: 'xlsx' },
  response: { success: true, message: 'Report generated', data: EXAMPLE_GEN },
  handler: async (req, res) => {
    const out = await svc.generateReport(req.params.code, req.body, 'user', { user: req.user });
    await audit(req, { entity: 'generated_report', entityId: out.id, action: 'generate', after: { code: out.code, format: out.format, params: out.params, rowCount: out.rowCount } });
    created(res, out, 'Report generated');
  },
});

export default router;
export const mount = '/reports';
