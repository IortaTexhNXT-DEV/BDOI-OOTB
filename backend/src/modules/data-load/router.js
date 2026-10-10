import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { uploadFile } from '../documents/tabular.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { config } from '../../config.js';
import { notify } from '../notifications/service.js';
import { reconciliationWorkbook } from './workbook.js';
import * as svc from './service.js';
import * as cmp from './comparisons.js';
import * as maps from './maps.js';
import * as naming from './naming.js';

/**
 * Data Migration & Go-Live: the configuration and migration workbooks (the go-live scripts, npm run rehearsal:golive
 * and npm run compare:environments, call it too). Download a blank template or the current data of this environment,
 * the whole kit or some of its objects; upload (validated as a dry run, nothing saved: each row New, Changed, Unchanged,
 * Duplicate or Error), review the rows, resolve the duplicates, download the rows in error, load, history and the
 * reconciliation of a migration load; the value maps of the legacy code tables; the document file naming check; the
 * environment comparison (an export of another environment compared with this one, or two exports with each other:
 * never loads). Administrators only (read:data-load / write:data-load, migrations 0244, 0247 and 0440); the downloads
 * and the review are masked for users without view:pii.
 */
const { router, define } = moduleRouter('Go-Live Data Workbench', '/data-load');
const SCREEN = 'API (go-live scripts)';
const WORKSPACE = 'Master > System Configuration > Data Migration & Go-Live';
const canRead = [requireAuth, requirePermission('read:data-load', 'write:data-load')];
const canWrite = [requireAuth, requirePermission('write:data-load')];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendXlsx = (res, fileName, buffer) => {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};
/** Message of a validation: rows in error and duplicates to resolve. */
const validated = (b) => {
  const parts = [b.rowsError ? `${b.rowsError} row(s) with errors` : null, b.rowsDuplicate ? `${b.rowsDuplicate} duplicate(s) to resolve` : null].filter(Boolean);
  return parts.length ? `Validated: ${parts.join(', ')}` : 'Validated: no error';
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
  method: 'GET', path: '/kits', summary: 'The two kits (configuration, migration) with their sheets in load order, columns and natural keys; the cutover date, the go-live lock and the settings of the workspace',
  screen: SCREEN, middleware: canRead,
  response: { success: true, data: { kits: [{ kit: 'configuration', title: 'Go-live configuration workbook', sheets: [{ key: 'users', name: 'Users', keyColumns: ['username'], columns: [] }] }], cutoverDate: '2026-11-01', locked: false,
    settings: { legacySystemName: 'Legacy', loadApprovalRequired: true, dashboardDefaultOrigin: 'issued', unlockWindowDays: 7, unlockMaxHours: 4 } } },
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
  screen: `${WORKSPACE} > Templates > Value Maps > Upload`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
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
  screen: `${WORKSPACE} > Templates > Value Maps > Add`, middleware: canWrite, request: { object: 'insurer', legacyValue: 'Malayan Ins. Co., Inc.', targetCode: 'MALAYAN', note: 'Legacy insurer table' },
  response: { success: true, message: 'Value map saved', data: mapExample },
  handler: async (req, res) => {
    const r = await maps.saveMap(mapBody(req.body), req.user);
    const m = await maps.getMap(r.id);
    await audit(req, { entity: 'migration_value_map', entityId: m.id, action: r.created ? 'create' : 'update', after: m });
    created(res, m, 'Value map saved');
  },
});
define({
  method: 'PUT', path: '/value-maps/:id', summary: 'Change a value map', screen: `${WORKSPACE} > Templates > Value Maps > Edit`, middleware: canWrite,
  request: { legacyValue: 'Malayan Ins. Co., Inc.', targetCode: 'MALAYAN', note: 'Legacy insurer table' }, response: { success: true, message: 'Value map saved', data: mapExample },
  handler: async (req, res) => {
    const { before, after } = await maps.updateMap(req.params.id, { legacyValue: req.body?.legacyValue, targetCode: req.body?.targetCode, note: req.body?.note }, req.user);
    await audit(req, { entity: 'migration_value_map', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Value map saved');
  },
});
define({
  method: 'DELETE', path: '/value-maps/:id', summary: 'Remove a value map (rows already loaded keep their records)', screen: `${WORKSPACE} > Templates > Value Maps > Remove`, middleware: canWrite,
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
  method: 'POST', path: '/document-names/check', summary: 'Check a list of legacy document file names against the naming convention (multipart "file": .xlsx or .csv with the names in the first column or a File Name column, or .txt with one name per line; never the files): valid or invalid with the reason, and whether the record it names is in BrokerVerse',
  screen: `${WORKSPACE} > Templates > Document Naming`, middleware: [...canRead, uploadFile], request: 'multipart/form-data file',
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
  response: { success: true, data: { ...comparisonExample, environmentSpecific: [{ sheet: 'settings', sheetName: 'Settings', key: 'golive.cutover_date', column: 'value', header: 'Value', file: '', here: '2026-11-01', rule: 'cutover-date', reason: 'Each environment has its own cutover date' }],
    rules: [{ id: 'cutover-date', sheet: 'settings', label: 'Cutover date (golive.cutover_date)', reason: 'Each environment has its own cutover date', applied: true }] } },
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
  screen: `${SCREEN} > Upload and validate`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file, kit=configuration|migration, legacySystem (migration: the source shown on the migrated records; the default legacy system when empty)',
  response: { success: true, message: 'Validated: 2 row(s) with errors', data: { batch: batchExample, errors: [errorExample] } },
  handler: async (req, res) => {
    const kit = kitOf(req.body?.kit || req.query.kit);
    const r = await svc.createBatch({ kit, file: req.file, user: req.user, legacySystem: req.body?.legacySystem || null });
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'validate', after: { kit, fileName: r.batch.fileName, rowsRead: r.batch.rowsRead, rowsError: r.batch.rowsError } });
    created(res, r, validated(r.batch));
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
    ok(res, r, validated(r.batch));
  },
});
define({
  method: 'GET', path: '/batches/:id/errors', summary: 'The rows in error and the unresolved duplicates of a batch as a workbook in the kit layout with an Errors column, to fix and upload again (masked for a user without view:pii)',
  screen: `${SCREEN} > Download errors`, middleware: canRead, response: '(xlsx file)',
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
  method: 'POST', path: '/batches/:id/resolutions', summary: 'Resolve duplicate rows (rows: ids, or rule: every row of that rule): load-as-new, use-existing (no record created; a client code or insurer value is mapped to the existing record for later loads), insurer-suffix (policy number of another insurer, loaded as number/INSURER), or null to clear; reason required. The batch is validated again',
  screen: `${WORKSPACE} > Loads > Duplicates > Resolve`, middleware: canWrite, request: { rows: [9013], resolution: 'use-existing', targetCode: 'C-000881', reason: 'Same client as in BrokerVerse (TIN verified)' },
  response: { success: true, message: 'Resolved 1 row(s)', data: { resolved: 1, maps: 1, rows: [9013], batch: batchExample, errors: [] } },
  handler: async (req, res) => {
    const b = req.body || {};
    const r = await svc.resolveDuplicates(req.params.id, { rows: b.rows || null, rule: b.rule || null, resolution: b.resolution ?? null, targetCode: b.targetCode || null, reason: b.reason }, req.user);
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'resolve-duplicate',
      after: { loadNumber: r.batch.loadNumber, rows: r.rows, rule: b.rule || null, resolution: b.resolution ?? null, targetCode: b.targetCode || null, reason: b.reason, maps: r.maps } });
    ok(res, r, `Resolved ${r.resolved} row(s)`);
  },
});
define({
  method: 'POST', path: '/batches/:id/load', summary: 'Load a validated batch in one transaction (validRowsOnly: skip the rows in error). New users\' temporary passwords are returned once; a migration load returns its reconciliation and writes one audit entry per record it creates or changes (values before and after, load number)',
  screen: `${SCREEN} > Load`, middleware: canWrite, request: { validRowsOnly: false },
  response: { success: true, message: 'Loaded', data: { batch: { ...batchExample, status: 'loaded' }, temporaryPasswords: [{ username: 'andrea.lim', displayName: 'Andrea Lim', temporaryPassword: '<shown once>' }], reconciliation: null } },
  handler: async (req, res) => {
    const validRowsOnly = req.body?.validRowsOnly === true || req.body?.validRowsOnly === 'true';
    const r = await svc.loadBatch(req.params.id, req.user, { validRowsOnly, req });
    await audit(req, { entity: 'data_load_batch', entityId: r.batch.id, action: 'load', after: { kit: r.batch.kit, loadedCounts: r.batch.loadedCounts, validRowsOnly,
      newUsers: r.temporaryPasswords.map((u) => u.username) } });
    const counts = Object.values(r.batch.loadedCounts || {}).reduce((a, c) => ({ created: a.created + (c.created || 0), updated: a.updated + (c.updated || 0) }), { created: 0, updated: 0 });
    await notify({ userId: req.user.id, type: 'info', title: `Go-live ${r.batch.kit} workbook loaded`,
      message: `Batch ${r.batch.id} (${r.batch.fileName || r.batch.kit}): ${counts.created} created, ${counts.updated} updated`, entity: 'data_load_batch', entityId: r.batch.id });
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
