import { moduleRouter } from '../../lib/registry.js';
import { hasPermission, requireAuth, requirePermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { uploadFile } from '../documents/tabular.js';
import { migrationImportOpen } from '../../lib/goLiveLock.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { config } from '../../config.js';
import { notify } from '../notifications/service.js';
import { dependentsWorkbook, reconciliationWorkbook } from './workbook.js';
import * as svc from './service.js';
import * as jobs from './jobs.js';
import * as approval from './approval.js';
import * as undo from './undo.js';
import * as golive from './golive.js';
import * as cmp from './comparisons.js';
import * as maps from './maps.js';
import * as naming from './naming.js';
import { afterBatchChange } from './reconciliation.js';
import { defineReconciliationRoutes } from './reconciliationRoutes.js';
import { defineRunRoutes } from './runRoutes.js';

/**
 * Data Migration & Go-Live: the configuration and migration workbooks (the go-live scripts, npm run rehearsal:golive
 * and npm run compare:environments, call it too). Download a blank template or the current data of this environment,
 * the whole kit or some of its objects; upload (validated as a dry run in a job, nothing saved: each row New, Changed,
 * Unchanged, Duplicate or Error), review the rows, resolve the duplicates, download the rows in error, submit, approval
 * by a second user (the load runs as a job), history, undo of a migration load (approved, a job) and the reconciliation
 * of the migration loads of a run (lines, tie-outs, differences, sign-off, report; reconciliationRoutes.js); the mock runs,
 * the cutover checklist, defects, evidence files and the evidence pack, the Go / No-Go decision, the overview and the
 * hypercare figures (runRoutes.js); the cutover date and the two-person go-live lock with its scoped, time-boxed unlock; the value
 * maps of the legacy code tables; the document file naming check; the environment comparison (an export of another
 * environment compared with this one, or two exports with each other: never loads). Administrators and the roles
 * granted read:data-load / write:data-load / approve:data-load (migrations 0244, 0247 and 0440); the downloads and the
 * review are masked for users without view:pii; the uploaded workbook is released only with write:data-load and view:pii.
 */
const { router, define } = moduleRouter('Data Migration & Go-Live', '/data-load');
const SCREEN = 'API (go-live scripts)';
const WORKSPACE = 'Master > System Configuration > Data Migration & Go-Live';
const canRead = [requireAuth, requirePermission('read:data-load', 'write:data-load')];
const canWrite = [requireAuth, requirePermission('write:data-load')];
const canApprove = [requireAuth, requirePermission('approve:data-load')];
const canWriteOrApprove = [requireAuth, requirePermission('write:data-load', 'approve:data-load')];
/** The value maps serve the migration loads: closed with them once go-live is locked (unless an unlock reopens them). */
const mapsOpen = migrationImportOpen('migration');
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

const sheetExample = { sheet: 'policies-motor', name: 'Policies - Motor', read: 120, valid: 117, errors: 2, held: 0, created: 110, updated: 4, unchanged: 3, proposed: 0, ignored: 0, skipped: 0, duplicate: 1, message: null };
const batchExample = { id: 7, loadNumber: 'MIG-000007', kit: 'migration', legacySystem: 'TISPH Excel', fileName: 'GoLive_Migration_Workbook.xlsx', status: 'failed', cutoverDate: '2026-11-01', rowsRead: 480, rowsValid: 477, rowsError: 2,
  rowsNew: 470, rowsChanged: 4, rowsUnchanged: 3, rowsDuplicate: 1, fileSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', validateMs: 5400, loadMs: null,
  sameFileAs: null, sheets: [sheetExample], loadedCounts: null, reconciliation: null, createdBy: 'BrokerVerse Administrator', createdAt: '2026-10-28T09:00:00Z', validatedAt: '2026-10-28T09:00:05Z' };
const errorExample = { sheet: 'policies-motor', sheetName: 'Policies - Motor', row: 14, column: 'Issue Date', message: 'Issue Date 2026-11-02 is on or after the cutover date 2026-11-01' };
const reviewRowExample = { id: 9012, sheet: 'clients', sheetName: 'Clients', row: 12, key: 'C-000881', result: 'changed', values: { clientCode: 'C-000881', email: 'andrea.lim@example.ph' },
  changes: [{ column: 'email', header: 'Email', old: 'a.lim@example.ph', new: 'andrea.lim@example.ph' }], duplicates: [], errors: [], warnings: [],
  resolution: null, resolutionReason: null, resolvedBy: null, resolvedAt: null, record: null };
const duplicateRowExample = { ...reviewRowExample, id: 9013, row: 13, key: 'C-000990', result: 'duplicate', changes: [],
  duplicates: [{ rule: 'tin', label: 'Same TIN', kind: 'stored', recordId: 'cli_1a2b3c4d5e6f7a8b', number: 'C-000881', name: 'Andrea Lim' }] };

define({
  method: 'GET', path: '/kits', summary: 'The two kits (configuration, migration) with their sheets in load order, columns and natural keys; the cutover date, the go-live lock, the settings of the workspace and the document file naming convention',
  screen: SCREEN, middleware: canRead,
  response: { success: true, data: { kits: [{ kit: 'configuration', title: 'Go-live configuration workbook', sheets: [{ key: 'users', name: 'Users', keyColumns: ['username'], columns: [] }] }], cutoverDate: '2026-11-01', locked: false,
    settings: { legacySystemName: 'Legacy', loadApprovalRequired: true, dashboardDefaultOrigin: 'issued', unlockWindowDays: 7, unlockMaxHours: 4 },
    naming: { pattern: '<RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>', example: 'POL_PC-MLY-2026-000101_POLSCH_20260225.pdf',
      recordTypes: [{ code: 'POL', label: 'Policy' }], documentTypes: ['POLSCH', 'COC'], extensions: ['pdf', 'jpg'] } } },
  handler: async (_req, res) => ok(res, await svc.kits()),
});
define({
  method: 'GET', path: '/kits/:kit/template', summary: 'Workbook of a kit (XLSX): Instructions, Lists, one sheet per object (the migration kit has one policy sheet per product) and the hidden Control sheet; objects: some of the objects only (comma list of keys); prefill=true fills it with the current data of this environment, masked for a user without view:pii',
  screen: `${WORKSPACE} > Templates`, middleware: canRead, query: { prefill: 'true', objects: 'policies-motor,open-items' }, response: '(xlsx file)',
  handler: async (req, res) => {
    const prefill = String(req.query.prefill || '') === 'true';
    const objects = String(req.query.objects || '').split(',').map((x) => x.trim()).filter(Boolean);
    const { fileName, buffer } = await svc.template(kitOf(req.params.kit), { prefill, user: req.user, objects });
    if (prefill) await audit(req, { entity: 'data_load', entityId: req.params.kit, action: 'export-current-data', after: objects.length ? { objects } : null });
    sendXlsx(res, fileName, buffer);
  },
});

// ------------------------------------------------------------------ value maps

const mapExample = { id: 4, object: 'insurer', objectLabel: 'Insurer', legacyValue: 'Malayan Ins. Co., Inc.', targetCode: 'MALAYAN', note: 'Legacy insurer table',
  createdBy: 'Andrea Lim', createdAt: '2026-10-28T09:00:00Z', updatedBy: 'Andrea Lim', updatedAt: '2026-10-28T09:00:00Z' };
const mapBody = (b) => ({ object: b?.object, legacyValue: b?.legacyValue, targetCode: b?.targetCode, note: b?.note });

define({
  method: 'GET', path: '/value-maps', summary: 'Value maps of the legacy code tables: legacy value -> BrokerVerse code per object (insurer, product, branch, user, channel, client, payment-status, claim-status, vehicle-type); filters object, search; paging',
  screen: `${WORKSPACE} > Templates > Value Maps`, middleware: canRead, query: { object: 'insurer', search: 'malayan', page: 1, perPage: 50 },
  response: { success: true, data: [mapExample], total: 1, page: 1, perPage: 50, totalPages: 1, objects: [{ key: 'insurer', label: 'Insurer' }] },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await maps.listMaps({ object: req.query.object || null, search: req.query.search || null }, pg);
    ok(res, rows, 'OK', { ...pageMeta(total, pg), objects: maps.MAP_OBJECT_KEYS.map((k) => ({ key: k, label: maps.MAP_OBJECTS[k].label })) });
  },
});
define({
  method: 'GET', path: '/value-maps/workbook', summary: 'The value maps as one sheet (XLSX), to change and upload again',
  screen: `${WORKSPACE} > Templates > Value Maps > Download`, middleware: canRead, response: '(xlsx file)',
  handler: async (_req, res) => sendXlsx(res, 'Value_Maps.xlsx', await maps.mapsWorkbook()),
});
define({
  method: 'POST', path: '/value-maps/upload', summary: 'Upload the Value Maps sheet: each row adds a map or changes the map of the same legacy value; all or nothing (the rows in error are listed)',
  screen: `${WORKSPACE} > Templates > Value Maps > Upload`, middleware: [...canWrite, mapsOpen, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Value maps loaded: 3 added, 1 changed', data: { created: 3, updated: 1, errors: [] } },
  handler: async (req, res) => {
    if (!req.file?.buffer?.length) throw badRequest('Upload the value maps workbook (.xlsx) in the "file" field');
    const r = await maps.uploadMaps(req.file.buffer, req.user);
    if (r.errors.length) return res.status(400).json({ success: false, message: `${r.errors.length} row(s) in error: nothing was loaded`, data: r });
    await audit(req, { entity: 'migration_value_map', entityId: 'upload', action: 'upload', after: { fileName: req.file.originalname || null, created: r.created, updated: r.updated } });
    return ok(res, r, `Value maps loaded: ${r.created} added, ${r.updated} changed`);
  },
});
define({
  method: 'GET', path: '/value-maps/:id', summary: 'One value map', screen: `${WORKSPACE} > Templates > Value Maps`, middleware: canRead,
  response: { success: true, data: mapExample },
  handler: async (req, res) => ok(res, await maps.getMap(req.params.id)),
});
define({
  method: 'POST', path: '/value-maps', summary: 'Add a value map (or change the target of the map of the same legacy value); the code is checked against its master',
  screen: `${WORKSPACE} > Templates > Value Maps > Add`, middleware: [...canWrite, mapsOpen], request: { object: 'insurer', legacyValue: 'Malayan Ins. Co., Inc.', targetCode: 'MALAYAN', note: 'Legacy insurer table' },
  response: { success: true, message: 'Value map saved', data: mapExample },
  handler: async (req, res) => {
    const r = await maps.saveMap(mapBody(req.body), req.user);
    const m = await maps.getMap(r.id);
    await audit(req, { entity: 'migration_value_map', entityId: m.id, action: r.created ? 'create' : 'update', after: m });
    created(res, m, 'Value map saved');
  },
});
define({
  method: 'PUT', path: '/value-maps/:id', summary: 'Change a value map', screen: `${WORKSPACE} > Templates > Value Maps > Edit`, middleware: [...canWrite, mapsOpen],
  request: { legacyValue: 'Malayan Ins. Co., Inc.', targetCode: 'MALAYAN', note: 'Legacy insurer table' }, response: { success: true, message: 'Value map saved', data: mapExample },
  handler: async (req, res) => {
    const { before, after } = await maps.updateMap(req.params.id, { legacyValue: req.body?.legacyValue, targetCode: req.body?.targetCode, note: req.body?.note }, req.user);
    await audit(req, { entity: 'migration_value_map', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Value map saved');
  },
});
define({
  method: 'DELETE', path: '/value-maps/:id', summary: 'Remove a value map (rows already loaded keep their records)', screen: `${WORKSPACE} > Templates > Value Maps > Remove`, middleware: [...canWrite, mapsOpen],
  response: { success: true, message: 'Value map removed', data: mapExample },
  handler: async (req, res) => {
    const before = await maps.deleteMap(req.params.id);
    await audit(req, { entity: 'migration_value_map', entityId: before.id, action: 'delete', before });
    ok(res, before, 'Value map removed');
  },
});

// ------------------------------------------------------------------ document file naming convention

const nameCheckExample = { token: 'rpt_4f2a9c1d0e7b3a55', fileName: 'Legacy_Files.xlsx', summary: { names: 2, valid: 1, invalid: 1, recordFound: 1, recordMissing: 0 },
  results: [{ name: 'POL_PC-MLY-2026-000101_POLSCH_20260225.pdf', valid: true, reason: null, recordType: 'POL', recordTypeLabel: 'Policy', recordNumber: 'PC-MLY-2026-000101',
    documentType: 'POLSCH', date: '2026-02-25', recordFound: true }, { name: 'scan001.pdf', valid: false, reason: 'The name must have the parts <RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>' }] };

define({
  method: 'POST', path: '/document-names/check', summary: 'Check a list of legacy document file names against the naming convention (write:data-load; multipart "file": .xlsx or .csv with the names in the first column or a File Name column, or .txt with one name per line; never the files): valid or invalid with the reason, and whether the record it names is in BrokerVerse',
  screen: `${WORKSPACE} > Templates > Document Naming`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Checked 2 name(s): 1 invalid', data: nameCheckExample },
  handler: async (req, res) => {
    const r = await naming.checkUpload(req.file, req.user);
    ok(res, r, `Checked ${r.summary.names} name(s): ${r.summary.invalid} invalid`);
  },
});
define({
  method: 'GET', path: '/document-names/check/:token/workbook', summary: 'Result of a document name check (XLSX): summary and one row per name; only for the user who ran the check',
  screen: `${WORKSPACE} > Templates > Document Naming > Download`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const { fileName, buffer } = await naming.checkWorkbook(req.params.token, req.user);
    sendXlsx(res, fileName, buffer);
  },
});
// ------------------------------------------------------------------ environment comparison

/** Two workbooks at most: file (the export of the other environment, or file A) and fileB (optional). */
const compareUpload = memoryUpload({ maxBytes: config.importMaxBytes, files: 2 }).fields([{ name: 'file', maxCount: 1 }, { name: 'fileB', maxCount: 1 }]);
const flag = (v) => v === true || String(v || '').toLowerCase() === 'true';
const comparisonExample = {
  id: 3, kit: 'configuration', mode: 'environment', fileName: 'GoLive_Configuration_Workbook_2026-10-28.xlsx', fileBName: null, environment: 'Production',
  options: { includeNumbering: false }, verdict: 'differences', verdictText: 'Differences found', labels: { file: 'File', here: 'This environment (Production)' },
  totals: { inFile: 412, here: 413, identical: 409, different: 1, onlyInFile: 1, onlyHere: 2, environmentSpecific: 2 },
  sheets: [{ sheet: 'users', name: 'Users', inFile: 12, here: 13, identical: 10, different: 1, onlyInFile: 0, onlyHere: 1, environmentSpecific: 0, notes: [] }],
  createdBy: 'BrokerVerse Administrator', createdAt: '2026-10-28T09:00:00Z',
};
const comparisonRowExample = { sheet: 'users', sheetName: 'Users', key: 'andrea.lim', status: 'different', rowFile: 7, rowHere: null,
  file: { username: 'andrea.lim', email: 'andrea.lim@broker.ph' }, here: { username: 'andrea.lim', email: 'a.lim@broker.ph' },
  differences: [{ column: 'email', header: 'Email', file: 'andrea.lim@broker.ph', here: 'a.lim@broker.ph' }] };

define({
  method: 'POST', path: '/compare', summary: 'Compare environments (never loads): the configuration workbook exported from another environment ("Current data") compared with this environment, or with a second workbook (fileB: file A vs file B, this environment not read). Result per sheet: identical, different (field-level differences), only in the file, only here; environment-specific values apart',
  screen: `${SCREEN} > Compare environments`, middleware: [...canRead, compareUpload], request: 'multipart/form-data file [, fileB], includeNumbering=true|false',
  response: { success: true, message: 'Differences found', data: comparisonExample },
  handler: async (req, res) => {
    const file = req.files?.file?.[0];
    const fileB = req.files?.fileB?.[0] || null;
    if (String(req.body?.kit || 'configuration') !== 'configuration') throw badRequest('Only the configuration workbook is compared between environments');
    const c = await cmp.createComparison({ file, fileB, options: { includeNumbering: flag(req.body?.includeNumbering) }, user: req.user });
    await audit(req, { entity: 'data_load_comparison', entityId: c.id, action: 'compare', after: { mode: c.mode, fileName: c.fileName, fileBName: c.fileBName, verdict: c.verdict, totals: c.totals, options: c.options } });
    created(res, c, c.verdictText);
  },
});
define({
  method: 'GET', path: '/compare', summary: 'Environment comparisons made, newest first (paging)', screen: `${SCREEN} > Compare environments`, middleware: canRead,
  query: { page: 1, perPage: 20 }, response: { success: true, data: [comparisonExample], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { rows, total } = await cmp.listComparisons(pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'GET', path: '/compare/:id', summary: 'One comparison: verdict, counts per sheet, environment-specific values and the rules that set them apart',
  screen: `${SCREEN} > Compare environments`, middleware: canRead,
  response: { success: true, data: { ...comparisonExample, environmentSpecific: [{ sheet: 'settings', sheetName: 'Settings', key: 'general.frontend_url', column: 'value', header: 'Value', file: 'https://uat.broker.example', here: 'https://brokerverse.tisph.example', rule: 'urls-hosts', reason: 'Every environment has its own addresses' }],
    rules: [{ id: 'urls-hosts', sheet: 'settings', label: 'Settings holding a URL or host (e.g. general.frontend_url)', reason: 'Every environment has its own addresses', applied: true }] } },
  handler: async (req, res) => ok(res, await cmp.getComparison(req.params.id)),
});
define({
  method: 'GET', path: '/compare/:id/rows', summary: 'Rows of a comparison with their field-level differences (filters sheet, status = different, only-in-file, only-here, identical (comma list; default all but identical), search; paging)',
  screen: `${SCREEN} > Compare environments`, middleware: canRead, query: { sheet: 'users', status: 'different,only-here', search: 'lim', page: 1, perPage: 50 },
  response: { success: true, data: [comparisonRowExample], total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await cmp.comparisonRows(req.params.id, { sheet: req.query.sheet || null, status: req.query.status || null, search: req.query.search || null }, pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'GET', path: '/compare/:id/workbook', summary: 'Comparison workbook (XLSX): Summary with the counts per sheet and the verdict (Mirrored / Differences found), one sheet per object with a Difference column (only in the file green, only here amber, changed cells highlighted), environment-specific values and rules',
  screen: `${SCREEN} > Compare environments > Download`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const { fileName, buffer } = await cmp.comparisonFile(req.params.id);
    sendXlsx(res, fileName, buffer);
  },
});

// ------------------------------------------------------------------ loads: upload, validation, approval, load, undo

const progressExample = { stage: 'running', step: 'load', sheet: 'Policies - Motor', done: 1500, total: 4800, behind: null, at: '2026-10-28T09:01:10Z' };
const pendingBatchExample = { ...batchExample, status: 'pending-approval', submittedBy: 'Andrea Lim', submittedAt: '2026-10-28T09:10:00Z', expiresAt: '2026-10-31T09:10:00Z' };
const jobExample = { id: '412', jobId: '412', queue: 'data-load', type: 'data-load.load', status: 'waiting', progress: { total: 480, processed: 0, succeeded: 0, failed: 0 } };
const accepted = (res, data, message) => res.status(202).json({ success: true, message, data });

define({
  method: 'GET', path: '/batches', summary: 'Load history: load number, kit, run, file, legacy system, counts per result, status, uploaded / submitted / approved / loaded / undone by and at, timings; filters kit, status (comma list), runId, from, to (created); paging',
  screen: `${WORKSPACE} > Loads`, middleware: canRead, query: { kit: 'migration', status: 'loaded,undone', runId: 3, from: '2026-10-01', to: '2026-10-31', page: 1, perPage: 20 },
  response: { success: true, data: [batchExample], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { rows, total } = await svc.listBatches({ kit: req.query.kit || null, status: req.query.status || null, runId: req.query.runId || null, from: req.query.from || null, to: req.query.to || null }, pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'POST', path: '/batches', summary: 'Upload a workbook (multipart "file", field kit): creates the load (MIG- / CFG- number), keeps the file and its SHA-256 and starts its validation as a job (dry run: all sheets in load order in one transaction that is rolled back); 202 with the batch (validating) and the job; follow GET /batches/:id',
  screen: `${WORKSPACE} > Loads > Upload`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file, kit=configuration|migration, runId (the run of the load: planned or running), legacySystem (migration: the source shown on the migrated records; the default legacy system when empty)',
  response: { success: true, message: 'Validating MIG-000007', data: { batch: { ...batchExample, status: 'validating', progress: { ...progressExample, step: 'validate' } }, job: { ...jobExample, type: 'data-load.validate' } } },
  handler: async (req, res) => {
    const kit = kitOf(req.body?.kit || req.query.kit);
    const batch = await svc.createBatch({ kit, file: req.file, user: req.user, legacySystem: req.body?.legacySystem || null, runId: req.body?.runId ?? null, req });
    const job = await jobs.startJob('validate', batch, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'upload', after: { loadNumber: batch.loadNumber, kit, fileName: batch.fileName, rowsRead: batch.rowsRead, fileSha256: batch.fileSha256 } });
    accepted(res, { batch: await svc.getBatch(batch.id), job }, `Validating ${batch.loadNumber}`);
  },
});
define({
  method: 'GET', path: '/batches/:id', summary: 'One load: status, result per sheet, the errors (sheet, row, column, message), the progress of its job (sheet, rows done and total), its place in the queue and the users who may not decide on it (makers: load, undo)',
  screen: `${WORKSPACE} > Loads > Load`, middleware: canRead,
  response: { success: true, data: { batch: { ...batchExample, status: 'running', progress: progressExample }, errors: [errorExample], totalErrors: 1, queue: { jobStatus: 'processing', ahead: 0, behind: null },
    makers: { load: ['usr_7a1c'], undo: [] } } },
  handler: async (req, res) => {
    const batch = await svc.getBatch(req.params.id);
    const { total, errors } = await svc.batchErrors(batch.id, { limit: 2000 });
    ok(res, { batch, errors, totalErrors: total, queue: await jobs.queueInfo(batch), makers: await approval.makersOf(batch) });
  },
});
define({
  method: 'GET', path: '/batches/:id/file', summary: 'The workbook of a load as it was uploaded (personal data in clear): write:data-load and view:pii; each download is recorded in the audit trail',
  screen: `${WORKSPACE} > Loads > Load > Uploaded file`, middleware: canWrite, response: '(xlsx file)',
  handler: async (req, res) => {
    if (!hasPermission(req.user, 'view:pii')) throw forbidden('The uploaded workbook holds personal data in clear: it is released only to users who may view personal data');
    const { fileName, buffer } = await svc.batchFile(req.params.id);
    const batch = await svc.getBatch(req.params.id);
    await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'download-file', after: { loadNumber: batch.loadNumber, fileName, fileSha256: batch.fileSha256 } });
    res.set('Cache-Control', 'no-store');
    sendXlsx(res, fileName, buffer);
  },
});
define({
  method: 'POST', path: '/batches/:id/validate', summary: 'Validate a load again (dry run, as a job), e.g. after a change of the value maps or of the cutover date, or to resume a load that failed, was rejected, withdrawn or expired; 202 with the job',
  screen: `${WORKSPACE} > Loads > Load > Validate again`, middleware: canWrite,
  response: { success: true, message: 'Validating MIG-000007', data: { batch: { ...batchExample, status: 'validating' }, job: { ...jobExample, type: 'data-load.validate' } } },
  handler: async (req, res) => {
    const batch = await svc.beginValidation(req.params.id, { req });
    const job = await jobs.startJob('validate', batch, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: batch.id, action: 'validate', after: { loadNumber: batch.loadNumber, jobId: job.id } });
    accepted(res, { batch: await svc.getBatch(batch.id), job }, `Validating ${batch.loadNumber}`);
  },
});
define({
  method: 'GET', path: '/batches/:id/errors', summary: 'The rows in error and the unresolved duplicates of a batch as a workbook in the kit layout with an Errors column, to fix and upload again (masked for a user without view:pii)',
  screen: `${WORKSPACE} > Loads > Download errors`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const { fileName, buffer } = await svc.errorsWorkbook(req.params.id, req.user);
    sendXlsx(res, fileName, buffer);
  },
});
define({
  method: 'GET', path: '/batches/:id/rows', summary: 'Review of a validation: the rows of a batch with their result (new, changed, unchanged, duplicate, error), the changed columns old -> new, duplicates, errors and warnings; filters sheet, result, search; paging; masked for a user without view:pii',
  screen: `${WORKSPACE} > Loads > Review`, middleware: canRead, query: { sheet: 'clients', result: 'changed', search: 'lim', page: 1, perPage: 50 },
  response: { success: true, data: [reviewRowExample], total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await svc.batchRows(req.params.id, { sheet: req.query.sheet || null, result: req.query.result || null, search: req.query.search || null }, pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'GET', path: '/batches/:id/duplicates', summary: 'Duplicate rows of a batch with the records they match (in the file or in BrokerVerse) and their resolution; filter rule (tin, name-birth-date, company-name, vehicle, coc, policy-number, insurer-variant, master-name)',
  screen: `${WORKSPACE} > Loads > Duplicates`, middleware: canRead, query: { rule: 'tin', page: 1, perPage: 50 },
  response: { success: true, data: [duplicateRowExample], total: 1, page: 1, perPage: 50, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await svc.batchDuplicates(req.params.id, { rule: req.query.rule || null }, pg);
    ok(res, rows, 'OK', pageMeta(total, pg));
  },
});
define({
  method: 'POST', path: '/batches/:id/resolutions', summary: 'Resolve duplicate rows (rows: ids, or rule: every row of that rule): load-as-new, use-existing (no record created; a client code or insurer value is mapped to the existing record for later loads), insurer-suffix (policy number of another insurer, loaded as number/INSURER), or null to clear; reason required. The batch is validated again (a job, 202)',
  screen: `${WORKSPACE} > Loads > Duplicates > Resolve`, middleware: canWrite, request: { rows: [9013], resolution: 'use-existing', targetCode: 'C-000881', reason: 'Same client as in BrokerVerse (TIN verified)' },
  response: { success: true, message: 'Resolved 1 row(s)', data: { resolved: 1, maps: 1, rows: [9013], batch: { ...batchExample, status: 'validating' }, job: { ...jobExample, type: 'data-load.validate' } } },
  handler: async (req, res) => {
    const b = req.body || {};
    const r = await svc.resolveDuplicates(req.params.id, { rows: b.rows || null, rule: b.rule || null, resolution: b.resolution ?? null, targetCode: b.targetCode || null, reason: b.reason }, req.user, { req });
    const job = await jobs.startJob('validate', r.batch, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'resolve-duplicate',
      after: { loadNumber: r.batch.loadNumber, rows: r.rows, rule: b.rule || null, resolution: b.resolution ?? null, targetCode: b.targetCode || null, reason: b.reason, maps: r.maps } });
    accepted(res, { ...r, batch: await svc.getBatch(r.batch.id), job }, `Resolved ${r.resolved} row(s)`);
  },
});
define({
  method: 'POST', path: '/batches/:id/submit', summary: 'Submit a validated load for approval by a second user (validRowsOnly: a load with rows in error, its valid rows only); refused with rows in error, unresolved duplicates, value maps or cutover date changed since the validation, or a stored file that is not the file validated',
  screen: `${WORKSPACE} > Loads > Load > Submit`, middleware: canWrite, request: { validRowsOnly: false },
  response: { success: true, message: 'MIG-000007 submitted for approval', data: pendingBatchExample },
  handler: async (req, res) => {
    const b = await approval.submit(req.params.id, req.user, { validRowsOnly: flag(req.body?.validRowsOnly), req });
    ok(res, b, `${b.loadNumber} submitted for approval`);
  },
});
define({
  method: 'POST', path: '/batches/:id/withdraw', summary: 'Withdraw a load waiting for approval (its submitter or uploader)',
  screen: `${WORKSPACE} > Loads > Load > Withdraw`, middleware: canWrite, response: { success: true, message: 'MIG-000007 withdrawn', data: { ...batchExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const b = await approval.withdraw(req.params.id, req.user, { req });
    ok(res, b, `${b.loadNumber} withdrawn`);
  },
});
define({
  method: 'POST', path: '/batches/:id/approve', summary: 'Approve a load (approve:data-load; never its uploader, submitter or a user who resolved one of its duplicates): the load runs as a job with the approver as the executing user, all or nothing; 202 with the job. Refused when the file, the value maps or the cutover date changed since the validation (validate again), after the approval expiry, and when the load is already running or loaded (409)',
  screen: `${WORKSPACE} > Loads > Load > Approve`, middleware: canApprove,
  response: { success: true, message: 'MIG-000007 approved: loading', data: { batch: { ...batchExample, status: 'running', decision: 'approved' }, job: jobExample } },
  handler: async (req, res) => {
    const r = await approval.approve(req.params.id, req.user, { req });
    accepted(res, r, `${r.batch.loadNumber} approved: loading`);
  },
});
define({
  method: 'POST', path: '/batches/:id/reject', summary: 'Reject a load waiting for approval with a reason of the Reason Codes master (context data_load_reject) and remarks (a note when the reason needs one); not by its makers',
  screen: `${WORKSPACE} > Loads > Load > Reject`, middleware: canApprove, request: { reasonCode: 'DLR-TOTALS', remarks: 'Gross premium of Motor differs from the legacy listing' },
  response: { success: true, message: 'MIG-000007 rejected', data: { ...batchExample, status: 'rejected', decision: 'rejected', decisionReasonCode: 'DLR-TOTALS' } },
  handler: async (req, res) => {
    const b = await approval.reject(req.params.id, req.user, { reasonCode: req.body?.reasonCode, remarks: req.body?.remarks, req });
    ok(res, b, `${b.loadNumber} rejected`);
  },
});
define({
  method: 'POST', path: '/batches/:id/load', summary: 'Load a validated batch at once, in the request (validRowsOnly: skip the rows in error), only where no approval is required (migration.load_approval_required off, outside production and pre-production: the rehearsal); 409 otherwise. New users\' temporary passwords are returned once; a migration load returns its reconciliation and writes one audit entry per record it creates or changes',
  screen: `${SCREEN} > Load`, middleware: canWrite, request: { validRowsOnly: false },
  response: { success: true, message: 'Loaded', data: { batch: { ...batchExample, status: 'loaded' }, temporaryPasswords: [{ username: 'andrea.lim', displayName: 'Andrea Lim', temporaryPassword: '<shown once>' }], reconciliation: null } },
  handler: async (req, res) => {
    const validRowsOnly = flag(req.body?.validRowsOnly);
    const r = await svc.loadDirect(req.params.id, req.user, { validRowsOnly, req });
    await afterBatchChange(r.batch, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'load', after: { loadNumber: r.batch.loadNumber, kit: r.batch.kit, loadedCounts: r.batch.loadedCounts, validRowsOnly,
      newUsers: r.temporaryPasswords.map((u) => u.username) } });
    const counts = Object.values(r.batch.loadedCounts || {}).reduce((a, c) => ({ created: a.created + (c.created || 0), updated: a.updated + (c.updated || 0) }), { created: 0, updated: 0 });
    await notify({ userId: req.user.id, type: 'info', title: `${r.batch.loadNumber} loaded`,
      message: `${r.batch.fileName || r.batch.kit}: ${counts.created} created, ${counts.updated} updated`, entity: 'data_load_batch', entityId: r.batch.id });
    // temporary passwords are in the body once; never cached
    res.set('Cache-Control', 'no-store');
    ok(res, r, `Loaded: ${counts.created} created, ${counts.updated} updated`);
  },
});
define({
  method: 'GET', path: '/batches/:id/reconciliation', summary: 'Reconciliation of a migration batch (XLSX): counts and totals per sheet and the control checks (trial balance, receivables control account)',
  screen: `${WORKSPACE} > Loads > Load > Reconciliation`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const batch = await svc.getBatch(req.params.id);
    if (!batch.reconciliation) throw badRequest('This batch has no reconciliation (migration workbook only)');
    sendXlsx(res, `GoLive_Reconciliation_${batch.loadNumber}.xlsx`, reconciliationWorkbook(batch));
  },
});

const dependentExample = { object: 'policy', key: 'PC-MLY-2026-000101', dependent: 'Receipts', count: 1 };
define({
  method: 'GET', path: '/batches/:id/dependents', summary: 'What stops the undo of a migration load: business entered since on its records (receipts, credits, collection actions, deposited cheques, endorsements, claims, renewals, documents, CTPL authentication sent to the LTO) and later loads that refer to or changed its records',
  screen: `${WORKSPACE} > Loads > Load > Undo`, middleware: canRead, response: { success: true, data: [dependentExample] },
  handler: async (req, res) => ok(res, await undo.dependents(await svc.getBatch(req.params.id))),
});
define({
  method: 'GET', path: '/batches/:id/dependents/workbook', summary: 'The records that stop the undo of a load (XLSX)',
  screen: `${WORKSPACE} > Loads > Load > Undo > Download`, middleware: canRead, response: '(xlsx file)',
  handler: async (req, res) => {
    const batch = await svc.getBatch(req.params.id);
    sendXlsx(res, `${batch.loadNumber}_Undo_Dependents.xlsx`, dependentsWorkbook(batch, await undo.dependents(batch)));
  },
});
define({
  method: 'POST', path: '/batches/:id/undo-request', summary: 'Request the undo of a loaded migration load, with a reason; refused after the go-live lock and while records depend on it (business entered since, later loads)',
  screen: `${WORKSPACE} > Loads > Load > Undo`, middleware: canWrite, request: { reason: 'Wrong legacy extract loaded in Mock 2' },
  response: { success: true, message: 'Undo of MIG-000007 requested', data: { ...batchExample, status: 'undo-pending', undoReason: 'Wrong legacy extract loaded in Mock 2' } },
  handler: async (req, res) => {
    const b = await approval.requestUndo(req.params.id, req.user, { reason: req.body?.reason, req });
    ok(res, b, `Undo of ${b.loadNumber} requested`);
  },
});
define({
  method: 'POST', path: '/batches/:id/undo-approve', summary: 'Approve the undo of a load (approve:data-load, not its requester): the undo runs as a job in one transaction, the objects in reverse load order (records removed, changed records and opening balances restored); 202 with the job',
  screen: `${WORKSPACE} > Loads > Load > Undo > Approve`, middleware: canApprove,
  response: { success: true, message: 'Undo of MIG-000007 approved: undoing', data: { batch: { ...batchExample, status: 'undoing' }, job: { ...jobExample, type: 'data-load.undo' } } },
  handler: async (req, res) => {
    const r = await approval.approveUndo(req.params.id, req.user, { req });
    accepted(res, r, `Undo of ${r.batch.loadNumber} approved: undoing`);
  },
});
define({
  method: 'POST', path: '/batches/:id/undo-reject', summary: 'Reject the undo of a load with remarks (not its requester): the load stays',
  screen: `${WORKSPACE} > Loads > Load > Undo > Reject`, middleware: canApprove, request: { remarks: 'Correct the two policies with a new load instead' },
  response: { success: true, message: 'Undo of MIG-000007 rejected', data: { ...batchExample, status: 'loaded' } },
  handler: async (req, res) => {
    const b = await approval.rejectUndo(req.params.id, req.user, { remarks: req.body?.remarks, req });
    ok(res, b, `Undo of ${b.loadNumber} rejected`);
  },
});
define({
  method: 'POST', path: '/batches/:id/undo-withdraw', summary: 'Withdraw an undo request (its requester)',
  screen: `${WORKSPACE} > Loads > Load > Undo > Withdraw`, middleware: canWrite, response: { success: true, message: 'Undo of MIG-000007 withdrawn', data: { ...batchExample, status: 'loaded' } },
  handler: async (req, res) => {
    const b = await approval.withdrawUndo(req.params.id, req.user, { req });
    ok(res, b, `Undo of ${b.loadNumber} withdrawn`);
  },
});

// ------------------------------------------------------------------ go-live: cutover date, lock and unlock

const lockRequestExample = { id: 3, action: 'unlock', actionLabel: 'Go-live unlock', status: 'pending', reason: 'Late legacy claim found on day 2', decisionRef: null, scope: ['migration'],
  scopeLabels: ['Migration workbook'], hours: 4, expiresAt: null, relockedAt: null, decisionId: null, requestedBy: 'Andrea Lim', requestedAt: '2026-11-03T02:00:00Z',
  decidedBy: null, decidedAt: null, decisionRemarks: null, settings: [] };
const goLiveExample = { cutoverDate: '2026-11-01', locked: true, lockedAt: '2026-11-01T14:00:00Z', lockRequestId: 2, unlock: null, unlockWindowEndsAt: '2026-11-08T14:00:00Z', unlockMaxHours: 4,
  pendingRequest: lockRequestExample, conditions: [{ code: 'go-decision', label: 'Go decision of the production run', met: true, detail: null }],
  scopes: [{ key: 'migration', label: 'Migration workbook' }], settings: { loadApprovalRequired: true, kpiIncludeMigrated: false, commissionIncludeMigrated: false, incentiveIncludeMigrated: false, sapGlIncludeOpening: false } };

define({
  method: 'GET', path: '/golive', summary: 'Go-Live tab: cutover date, go-live lock (when, by which request), the unlock in force (imports reopened, until when), the request waiting, the conditions of the lock and the settings of the workspace',
  screen: `${WORKSPACE} > Go-Live`, middleware: canRead, response: { success: true, data: goLiveExample },
  handler: async (_req, res) => ok(res, await golive.goLive()),
});
define({
  method: 'PUT', path: '/golive/cutover-date', summary: 'Set the cutover date (first day of live transactions); refused once go-live is locked and while a migration load is loaded or in progress (undo it first)',
  screen: `${WORKSPACE} > Go-Live > Cutover date`, middleware: canWrite, request: { cutoverDate: '2026-11-01' }, response: { success: true, message: 'Cutover date saved', data: goLiveExample },
  handler: async (req, res) => ok(res, await golive.setCutoverDate(req.body?.cutoverDate, req.user, req), 'Cutover date saved'),
});
define({
  method: 'PUT', path: '/golive/settings', summary: 'Request a change of the settings of the workspace, with a reason (write or approve:data-load), approved by another user on the lock requests (approve:data-load): approval of each load by a second user (stays on in production and pre-production), migrated policies in dashboards and KPIs, commission and incentives, opening balances sent to SAP once, the dashboards\' default view, duplicate checks, unlock hours and window, evidence retention, document types. Approval of loads, the SAP opening file and the duplicate checks no longer change once go-live is locked',
  screen: `${WORKSPACE} > Go-Live > Settings`, middleware: canWriteOrApprove, request: { settings: { kpiIncludeMigrated: true }, reason: 'Steering committee: count migrated renewals in the KPIs' },
  response: { success: true, message: 'Go-live settings change requested', data: { ...lockRequestExample, action: 'settings', actionLabel: 'Go-live settings change', scope: [], scopeLabels: [], hours: null,
    settings: [{ field: 'kpiIncludeMigrated', label: 'Migrated policies in dashboards and KPIs', before: false, after: true }] } },
  handler: async (req, res) => created(res, await golive.requestSettings(req.body, req.user, req), 'Go-live settings change requested'),
});
define({
  method: 'GET', path: '/golive/lock-requests', summary: 'Requests to lock go-live or to lift the lock for named imports, newest first (filter status)',
  screen: `${WORKSPACE} > Go-Live`, middleware: canRead, query: { status: 'pending' }, response: { success: true, data: [lockRequestExample] },
  handler: async (req, res) => ok(res, await golive.listLockRequests({ status: req.query.status || null })),
});
define({
  method: 'POST', path: '/golive/lock-requests', summary: 'Request the go-live lock (needs the Go decision of the production run, its reconciliation signed, its restore point and no load in progress) or an unlock (scope: imports to reopen of migration, policies-go-live, opening-items, opening-balances; hours up to migration.unlock_max_hours; decisionRef: steering committee decision, required after migration.unlock_window_days); approved by another user',
  screen: `${WORKSPACE} > Go-Live > Lock / Unlock`, middleware: canWrite, request: { action: 'unlock', reason: 'Late legacy claim found on day 2', scope: ['migration'], hours: 4, decisionRef: null },
  response: { success: true, message: 'Go-live unlock requested', data: lockRequestExample },
  handler: async (req, res) => {
    const r = await golive.requestLock(req.body, req.user, req);
    created(res, r, `${r.actionLabel} requested`);
  },
});
define({
  method: 'POST', path: '/golive/lock-requests/:id/approve', summary: 'Approve a lock, unlock or settings request (approve:data-load, not its requester); the conditions are checked again. A lock switches golive.locked on; an unlock reopens its imports for its hours, then relocks by itself; a settings request writes its settings',
  screen: `${WORKSPACE} > Go-Live > Approve`, middleware: canApprove, response: { success: true, message: 'Go-live unlock approved', data: { ...lockRequestExample, status: 'approved', expiresAt: '2026-11-03T06:05:00Z' } },
  handler: async (req, res) => {
    const r = await golive.approveLock(req.params.id, req.user, req);
    ok(res, r, `${r.actionLabel} approved`);
  },
});
define({
  method: 'POST', path: '/golive/lock-requests/:id/reject', summary: 'Reject a lock or unlock request with remarks (not its requester)',
  screen: `${WORKSPACE} > Go-Live > Reject`, middleware: canApprove, request: { remarks: 'Fix forward with a correcting journal instead' },
  response: { success: true, message: 'Go-live unlock rejected', data: { ...lockRequestExample, status: 'rejected' } },
  handler: async (req, res) => {
    const r = await golive.rejectLock(req.params.id, req.user, { remarks: req.body?.remarks }, req);
    ok(res, r, `${r.actionLabel} rejected`);
  },
});
define({
  method: 'POST', path: '/golive/lock-requests/:id/withdraw', summary: 'Withdraw a lock, unlock or settings request (its requester)',
  screen: `${WORKSPACE} > Go-Live > Withdraw`, middleware: canWriteOrApprove, response: { success: true, message: 'Go-live unlock withdrawn', data: { ...lockRequestExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const r = await golive.withdrawLock(req.params.id, req.user, req);
    ok(res, r, `${r.actionLabel} withdrawn`);
  },
});

defineReconciliationRoutes(define, { canRead, canWrite, canApprove, canWriteOrApprove, WORKSPACE, sendXlsx });
defineRunRoutes(define, { canRead, canWrite, canApprove, canWriteOrApprove, WORKSPACE, sendXlsx });

export default router;
export const mount = '/data-load';
