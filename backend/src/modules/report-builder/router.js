/** Report Builder API (/report-builder): Reports > Report Builder (ad hoc reports, saved and shared reports, Excel export, BI extract). */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission, requireRole, ADMIN_ROLE } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { scopeOf } from '../../lib/scope.js';
import { sendTable } from '../documents/tabular.js';
import { catalogue } from './datasets.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Report builder', '/report-builder');
const SCREEN = 'Reports > Report Builder';
const canRead = [requireAuth, requirePermission('read:reports')];
const canWrite = [requireAuth, requirePermission('write:reports', 'read:reports')];
const admin = [requireAuth, requireRole(ADMIN_ROLE)];

const filter = z.object({ column: z.string().min(1).max(60), op: z.string().min(1).max(20), value: z.any().optional(), value2: z.any().optional() });
const definition = z.object({
  dataset: z.string().min(1).max(40), columns: z.array(z.string().min(1).max(60)).max(60).optional(), filters: z.array(filter).max(30).optional(),
  groupBy: z.array(z.string().min(1).max(60)).max(5).optional(), sort: z.array(z.object({ column: z.string().min(1).max(60), dir: z.enum(['asc', 'desc']).optional() })).max(5).optional(),
});
const savedBody = definition.extend({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional().nullable(), sharedRoles: z.array(z.string().min(1)).max(20).optional() });
const example = { dataset: 'policies', columns: ['insurer', 'grossPremium', 'commission', 'policies'], filters: [{ column: 'issueDate', op: 'between', value: '2026-01-01', value2: '2026-09-30' }], groupBy: ['insurer'], sort: [{ column: 'grossPremium', dir: 'desc' }] };
const result = { columns: [{ key: 'insurer', label: 'Insurer', type: 'text' }, { key: 'grossPremium', label: 'Gross Premium', type: 'money' }], rows: [{ insurer: 'Malayan Insurance Co., Inc.', grossPremium: 1250400.5 }], totals: { grossPremium: 1250400.5 }, total: 1 };

const run = async (req, def, opts = {}) => {
  svc.assertDataset(req.user, def.dataset);
  return svc.runReport(def, { scope: await scopeOf(req), ...opts });
};
const fileName = (s) => String(s || 'report').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report';

define({
  method: 'GET', path: '/datasets', summary: 'Datasets the user may report on, with their columns, types and filter operators', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [{ key: 'policies', label: 'Policies', columns: [{ key: 'policyNumber', label: 'Policy No.', type: 'text', operators: ['eq', 'contains'] }] }] },
  handler: async (req, res) => res.json({ success: true, data: catalogue().filter((d) => { try { svc.assertDataset(req.user, d.key); return true; } catch { return false; } }) }),
});
define({
  method: 'POST', path: '/run', summary: 'Run a report definition on screen (preview rows, totals, row count); a scoped user sees their own book only', screen: `${SCREEN} > Run`,
  middleware: [...canRead, validate(definition)], request: example, response: { success: true, data: result },
  handler: async (req, res) => {
    const limit = Number(await getSetting('report_builder.preview_rows', 200)) || 200;
    res.json({ success: true, data: await run(req, req.body, { limit }) });
  },
});
define({
  method: 'POST', path: '/export', summary: 'Export a report definition to Excel (XLSX, or CSV with format=csv)', screen: `${SCREEN} > Export to Excel`, middleware: [...canRead, validate(definition.extend({ name: z.string().max(120).optional() }))],
  request: { ...example, name: 'Premium by insurer' }, query: { format: 'xlsx' }, response: 'binary file',
  handler: async (req, res) => {
    const out = await run(req, req.body);
    await audit(req, { entity: 'report_builder', entityId: req.body.dataset, action: 'export', after: { name: req.body.name || null, rows: out.rows.length, definition: req.body } });
    const rows = out.rows.map((r) => out.columns.map((c) => r[c.key]));
    if (Object.keys(out.totals).length) rows.push(out.columns.map((c, i) => (c.key in out.totals ? out.totals[c.key] : i === 0 ? 'Total' : '')));
    await sendTable(res, { header: out.columns.map((c) => c.label), rows, fileBase: fileName(req.body.name || req.body.dataset), format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Report' });
  },
});
define({
  method: 'GET', path: '/reports', summary: 'Saved reports the user may see (own, shared with one of their roles)', screen: `${SCREEN} > Saved Reports`, middleware: canRead,
  response: { success: true, data: [{ id: 'rbr_1', name: 'Premium by insurer', ...example, sharedRoles: ['sales'], ownerName: 'Ana Garcia' }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listSaved(req.user) }),
});
define({
  method: 'POST', path: '/reports', summary: 'Save a report (private, or shared with roles)', screen: `${SCREEN} > Save`, middleware: [...canWrite, validate(savedBody)],
  request: { name: 'Premium by insurer', ...example, sharedRoles: ['sales'] }, response: { success: true, data: { id: 'rbr_1', name: 'Premium by insurer' } },
  handler: async (req, res) => {
    const r = await svc.createSaved(req.body, req.user);
    await audit(req, { entity: 'report_builder_report', entityId: r.id, action: 'create', after: r });
    res.status(201).json({ success: true, message: 'Report saved', data: r });
  },
});
define({
  method: 'PUT', path: '/reports/:id', summary: 'Change a saved report (owner or administrator)', screen: `${SCREEN} > Save`, middleware: [...canWrite, validate(savedBody.partial())],
  request: { sharedRoles: ['sales', 'operations'] }, response: { success: true, data: { id: 'rbr_1' } },
  handler: async (req, res) => {
    const { before, after } = await svc.updateSaved(req.params.id, req.body, req.user);
    await audit(req, { entity: 'report_builder_report', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Report saved', data: after });
  },
});
define({
  method: 'DELETE', path: '/reports/:id', summary: 'Delete a saved report (owner or administrator)', screen: `${SCREEN} > Delete`, middleware: canWrite, response: { success: true, data: { id: 'rbr_1' } },
  handler: async (req, res) => {
    const r = await svc.deleteSaved(req.params.id, req.user);
    await audit(req, { entity: 'report_builder_report', entityId: r.id, action: 'delete', before: r });
    res.json({ success: true, message: 'Report deleted', data: r });
  },
});
define({
  method: 'POST', path: '/reports/:id/run', summary: 'Run a saved report on screen', screen: `${SCREEN} > Saved Reports > Run`, middleware: canRead, response: { success: true, data: result },
  handler: async (req, res) => {
    const r = svc.savedOut(await svc.getSaved(req.params.id, req.user));
    const limit = Number(await getSetting('report_builder.preview_rows', 200)) || 200;
    const out = await run(req, r, { limit });
    await svc.touchRun(r.id);
    res.json({ success: true, data: { report: r, ...out } });
  },
});
define({
  method: 'GET', path: '/reports/:id/export', summary: 'Export a saved report to Excel (XLSX, or CSV with format=csv)', screen: `${SCREEN} > Saved Reports > Export`, middleware: canRead,
  query: { format: 'xlsx' }, response: 'binary file',
  handler: async (req, res) => {
    const r = svc.savedOut(await svc.getSaved(req.params.id, req.user));
    const out = await run(req, r);
    await svc.touchRun(r.id);
    await audit(req, { entity: 'report_builder_report', entityId: r.id, action: 'export', after: { rows: out.rows.length } });
    const rows = out.rows.map((x) => out.columns.map((c) => x[c.key]));
    if (Object.keys(out.totals).length) rows.push(out.columns.map((c, i) => (c.key in out.totals ? out.totals[c.key] : i === 0 ? 'Total' : '')));
    await sendTable(res, { header: out.columns.map((c) => c.label), rows, fileBase: fileName(r.name), format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Report' });
  },
});
define({
  method: 'GET', path: '/bi-extract/runs', summary: 'BI extract runs: folder, files (one CSV per dataset), rows, status', screen: `${SCREEN} > BI Extract`, middleware: admin,
  response: { success: true, data: [{ id: 3, status: 'done', folder: 'bi-extract/2026-10-04', files: [{ dataset: 'policies', key: 'bi-extract/2026-10-04/policies.csv', rows: 1820 }], rowsTotal: 6420 }] },
  handler: async (_req, res) => res.json({ success: true, data: await svc.listBiRuns() }),
});
define({
  method: 'POST', path: '/bi-extract/run', summary: 'Run the BI extract now (same as the bi-extract job): one CSV per dataset in the storage folder', screen: `${SCREEN} > BI Extract > Run Now`, middleware: admin,
  response: { success: true, data: { id: 4, status: 'done', folder: 'bi-extract/2026-10-04', rowsTotal: 6420 } },
  handler: async (req, res) => {
    const out = await svc.runBiExtract({ trigger: 'manual', userId: req.user.id });
    await audit(req, { entity: 'bi_extract', entityId: out.id, action: 'run', after: { folder: out.folder, files: out.files.length, rows: out.rowsTotal } });
    res.json({ success: true, message: `BI extract written to ${out.folder}`, data: out });
  },
});

export default router;
export const mount = '/report-builder';
