import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { uploadFile } from '../documents/tabular.js';
import { notify } from '../notifications/service.js';
import { reconciliationWorkbook } from './workbook.js';
import * as svc from './service.js';

/**
 * Go-Live Data Workbench (Master > Go-Live Data Load): the configuration and migration workbooks. Download a blank
 * template or the current data of this environment, upload (validated as a dry run, nothing saved), download the rows
 * in error, load, history and the reconciliation of a migration load. System Administrator only (read:data-load /
 * write:data-load, migration 0243).
 */
const { router, define } = moduleRouter('Go-Live Data Workbench', '/data-load');
const SCREEN = 'Master > Go-Live Data Load';
const canRead = [requireAuth, requirePermission('read:data-load', 'write:data-load')];
const canWrite = [requireAuth, requirePermission('write:data-load')];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendXlsx = (res, fileName, buffer) => {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};
const kitOf = (v) => {
  const kit = String(v || '').toLowerCase();
  if (!svc.KITS[kit]) throw badRequest('kit must be configuration or migration');
  return kit;
};

const sheetExample = { sheet: 'policies', name: 'Policies', read: 120, valid: 118, errors: 2, created: 118, updated: 0, unchanged: 0, proposed: 0, skipped: 0 };
const batchExample = { id: 7, kit: 'migration', fileName: 'GoLive_Migration_Workbook.xlsx', status: 'failed', cutoverDate: '2026-11-01', rowsRead: 480, rowsValid: 478, rowsError: 2,
  sheets: [sheetExample], loadedCounts: null, reconciliation: null, createdBy: 'BrokerVerse Administrator', createdAt: '2026-10-28T09:00:00Z', validatedAt: '2026-10-28T09:00:05Z' };
const errorExample = { sheet: 'policies', sheetName: 'Policies', row: 14, column: 'Issue Date', message: 'Issue Date 2026-11-02 is on or after the cutover date 2026-11-01' };

define({
  method: 'GET', path: '/kits', summary: 'The two kits (configuration, migration) with their sheets in load order, columns and natural keys; the cutover date and go-live lock',
  screen: SCREEN, middleware: canRead,
  response: { success: true, data: { kits: [{ kit: 'configuration', title: 'Go-live configuration workbook', sheets: [{ key: 'users', name: 'Users', keyColumns: ['username'], columns: [] }] }], cutoverDate: '2026-11-01', locked: false } },
  handler: async (_req, res) => ok(res, await svc.kits()),
});
define({
  method: 'GET', path: '/kits/:kit/template', summary: 'Workbook of a kit (XLSX): Instructions, Lists and one sheet per object; prefill=true fills it with the current data of this environment (promotion to the next environment)',
  screen: `${SCREEN} > Download template`, middleware: canRead, query: { prefill: 'true' }, response: '(xlsx file)',
  handler: async (req, res) => {
    const prefill = String(req.query.prefill || '') === 'true';
    const { fileName, buffer } = await svc.template(kitOf(req.params.kit), { prefill, user: req.user });
    if (prefill) await audit(req, { entity: 'data_load', entityId: req.params.kit, action: 'export-current-data' });
    sendXlsx(res, fileName, buffer);
  },
});
define({
  method: 'GET', path: '/batches', summary: 'Load history: batches with status (validated, failed, loaded), who, when and counts (kit, status, paging)',
  screen: `${SCREEN} > History`, middleware: canRead, query: { kit: 'migration', page: 1, perPage: 20 }, response: { success: true, data: [batchExample], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { rows, total } = await svc.listBatches({ kit: req.query.kit || null, status: req.query.status || null }, pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'POST', path: '/batches', summary: 'Upload a workbook (multipart "file", field kit): creates a load batch and validates it without saving (all sheets in load order in one transaction that is rolled back)',
  screen: `${SCREEN} > Upload and validate`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file, kit=configuration|migration',
  response: { success: true, message: 'Validated: 2 row(s) with errors', data: { batch: batchExample, errors: [errorExample] } },
  handler: async (req, res) => {
    const kit = kitOf(req.body?.kit || req.query.kit);
    const r = await svc.createBatch({ kit, file: req.file, user: req.user });
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'validate', after: { kit, fileName: r.batch.fileName, rowsRead: r.batch.rowsRead, rowsError: r.batch.rowsError } });
    created(res, r, r.batch.rowsError ? `Validated: ${r.batch.rowsError} row(s) with errors` : 'Validated: no error');
  },
});
define({
  method: 'GET', path: '/batches/:id', summary: 'One batch: result per sheet and the errors (sheet, row, column, message)', screen: `${SCREEN} > Validation result`, middleware: canRead,
  response: { success: true, data: { batch: batchExample, errors: [errorExample], totalErrors: 1 } },
  handler: async (req, res) => {
    const batch = await svc.getBatch(req.params.id);
    const { total, errors } = await svc.batchErrors(batch.id, { limit: 2000 });
    ok(res, { batch, errors, totalErrors: total });
  },
});
define({
  method: 'POST', path: '/batches/:id/validate', summary: 'Validate a batch again (dry run), e.g. after a correction on screen or a change of the cutover date', screen: `${SCREEN} > Validation result`,
  middleware: canWrite, response: { success: true, data: { batch: batchExample, errors: [errorExample] } },
  handler: async (req, res) => {
    const r = await svc.validateBatch(req.params.id, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'validate', after: { rowsError: r.batch.rowsError } });
    ok(res, r, r.batch.rowsError ? `Validated: ${r.batch.rowsError} row(s) with errors` : 'Validated: no error');
  },
});
define({
  method: 'GET', path: '/batches/:id/errors', summary: 'The rows in error of a batch as a workbook in the kit layout with an Errors column, to fix and upload again', screen: `${SCREEN} > Download errors`,
  middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const { fileName, buffer } = await svc.errorsWorkbook(req.params.id);
    sendXlsx(res, fileName, buffer);
  },
});
define({
  method: 'POST', path: '/batches/:id/load', summary: 'Load a validated batch in one transaction (validRowsOnly: skip the rows in error). New users\' temporary passwords are returned once; a migration load returns its reconciliation',
  screen: `${SCREEN} > Load`, middleware: canWrite, request: { validRowsOnly: false },
  response: { success: true, message: 'Loaded', data: { batch: { ...batchExample, status: 'loaded' }, temporaryPasswords: [{ username: 'andrea.lim', displayName: 'Andrea Lim', temporaryPassword: '<shown once>' }], reconciliation: null } },
  handler: async (req, res) => {
    const validRowsOnly = req.body?.validRowsOnly === true || req.body?.validRowsOnly === 'true';
    const r = await svc.loadBatch(req.params.id, req.user, { validRowsOnly });
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'load', after: { kit: r.batch.kit, loadedCounts: r.batch.loadedCounts, validRowsOnly,
      newUsers: r.temporaryPasswords.map((u) => u.username) } });
    const counts = Object.values(r.batch.loadedCounts || {}).reduce((a, c) => ({ created: a.created + (c.created || 0), updated: a.updated + (c.updated || 0) }), { created: 0, updated: 0 });
    await notify({ userId: req.user.id, type: 'info', title: `Go-live ${r.batch.kit} workbook loaded`,
      message: `Batch ${r.batch.id} (${r.batch.fileName || r.batch.kit}): ${counts.created} created, ${counts.updated} updated`, link: '/master/go-live-data-load', entity: 'data_load_batch', entityId: r.batch.id });
    // temporary passwords are in the body once; never cached
    res.set('Cache-Control', 'no-store');
    ok(res, r, `Loaded: ${counts.created} created, ${counts.updated} updated`);
  },
});
define({
  method: 'GET', path: '/batches/:id/reconciliation', summary: 'Reconciliation of a migration batch (XLSX): counts and totals per sheet and the control checks (trial balance, receivables control account)',
  screen: `${SCREEN} > History > Reconciliation`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const batch = await svc.getBatch(req.params.id);
    if (!batch.reconciliation) throw badRequest('This batch has no reconciliation (migration workbook only)');
    sendXlsx(res, `GoLive_Reconciliation_Batch${batch.id}.xlsx`, reconciliationWorkbook(batch));
  },
});

export default router;
export const mount = '/data-load';
