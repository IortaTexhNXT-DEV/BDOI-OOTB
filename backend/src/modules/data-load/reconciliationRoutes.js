/**
 * Routes of the Reconciliation tab of Data Migration & Go-Live (reconciliation.js) and of the one-time SAP opening file of
 * the Go-Live tab (sapOpening.js), declared on the data-load router (router.js).
 */
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { uploadFile } from '../documents/tabular.js';
import * as recon from './reconciliation.js';
import * as sap from './sapOpening.js';

const lineExample = { id: 41, kind: 'measure', object: 'Policies', measure: 'gross premium', group: 'MOTOR', label: null, sides: { system: 'BrokerVerse', other: 'Legacy' },
  systemValue: 1250000, legacyValue: 1250000, legacySource: 'workbook', difference: 0, tolerance: 0, toleranceReason: null, accounts: [], status: 'matched', updatedBy: null, updatedAt: null };
const tieoutExample = { ...lineExample, id: 77, kind: 'tieout', object: 'Tie-out', measure: 'premiums-receivable', group: null, label: 'Premiums receivable',
  sides: { system: 'GL opening balance', other: 'Open items loaded' }, systemValue: 845300, legacyValue: 845300, legacySource: null, accounts: ['1202001'] };
const differenceExample = { id: 9, kind: 'extra', lineId: null, batchId: null, loadNumber: null, sheet: 'Open Items', row: null, recordKey: 'DN-OLD-77',
  description: 'Open Items DN-OLD-77: migrated outside the loads of this reconciliation (no load: single-object import)', amount: null, status: 'open', explanation: null, action: null,
  owner: null, acceptedBy: null, acceptedAt: null };
const reconExample = { id: 7, reconNumber: 'REC-000007', runId: 3, allBatches: true, cutoverDate: '2026-11-01', openingBalancesAsAt: '2026-10-31', status: 'open', computedAt: '2026-11-01T02:10:00Z',
  createdBy: 'Andrea Lim', createdAt: '2026-11-01T02:10:00Z', signedAt: null, supersededAt: null, supersededBy: null, signedReport: false, reportSha256: null,
  batches: [{ id: 12, loadNumber: 'MIG-000012', legacySystem: 'TISPH Excel', loadedAt: '2026-11-01T01:55:00Z', status: 'loaded' }], lines: [lineExample, tieoutExample],
  differences: [differenceExample], signoffs: [{ slot: 'data-owner', label: 'Data owner', signedBy: null, signedAt: null, remarks: null }, { slot: 'finance-head', label: 'Finance Head', signedBy: null, signedAt: null, remarks: null }],
  makers: ['usr_7a1c'],
  summary: { lines: 2, matched: 2, differences: 1, openDifferences: 1, missingLegacy: [], signed: 0, slots: 2 } };
const tieoutDefinition = { key: 'premiums-receivable', label: 'Premiums receivable', source: 'open-items', accounts: ['1202001'], measure: null, tolerance: 0 };
const sapStateExample = { enabled: true, locked: true, journal: { id: 'jv_8f0c', journalNumber: 'OBJ-2026-0001', asAt: '2026-10-31', totalDebit: 18450000, totalCredit: 18450000, sapExportedAt: null },
  pendingRequest: { id: 2, status: 'pending', reason: 'SAP takes the opening position from BrokerVerse', requestedBy: 'Andrea Lim', requestedAt: '2026-11-01T15:00:00Z', exportId: null },
  requests: [], run: null };

/** Declare the routes: define of the data-load router, its permission chains, the workspace screen name and the XLSX sender. */
export function defineReconciliationRoutes(define, { canRead, canWrite, canApprove, canWriteOrApprove, WORKSPACE, sendXlsx }) {
  const SCREEN = `${WORKSPACE} > Reconciliation`;
  define({
    method: 'GET', path: '/reconciliations', summary: 'Reconciliations of the migration loads, newest first (filters runId, status: open, signed, superseded) with their loads, open differences and who signed',
    screen: SCREEN, middleware: canRead, query: { runId: 3, status: 'open', page: 1, perPage: 50 },
    response: { success: true, data: [{ id: 7, reconNumber: 'REC-000007', runId: 3, loads: ['MIG-000012'], cutoverDate: '2026-11-01', status: 'open', openDifferences: 1, signedBy: null,
      createdBy: 'Andrea Lim', createdAt: '2026-11-01T02:10:00Z' }], total: 1, page: 1, perPage: 50, totalPages: 1 },
    handler: async (req, res) => {
      const pg = paging(req.query, { page: 1, perPage: 50 });
      const { rows, total } = await recon.listReconciliations({ runId: req.query.runId || null, status: req.query.status || null }, pg);
      ok(res, rows, 'OK', pageMeta(total, pg));
    },
  });
  define({
    method: 'POST', path: '/reconciliations', summary: 'Create the reconciliation of a run: every loaded migration load of the run (refreshed on recompute) or the loads chosen (batchIds); lines counted on the records of those loads, legacy figures from their Control Totals sheets, checks, sub-ledger tie-outs and the differences',
    screen: SCREEN, middleware: canWrite, request: { runId: 3, batchIds: [12, 13] }, response: { success: true, message: 'REC-000007 created', data: reconExample },
    handler: async (req, res) => {
      const r = await recon.createReconciliation(req.body, req.user, req);
      created(res, r, `${r.reconNumber} created`);
    },
  });
  define({
    method: 'PUT', path: '/settings/tieouts', summary: 'Sub-ledger tie-outs of the reconciliation (approve:data-load): key, label, source (open-items, pdc, listing with its measure, bank, sap), GL accounts and tolerance',
    screen: `${SCREEN} > Tie-outs`, middleware: canApprove, request: { tieouts: [tieoutDefinition] }, response: { success: true, message: 'Tie-outs saved', data: [tieoutDefinition] },
    handler: async (req, res) => ok(res, await recon.saveTieouts(req.body?.tieouts, req.user, req), 'Tie-outs saved'),
  });
  define({
    method: 'GET', path: '/reconciliations/:id', summary: 'A reconciliation: its loads, lines (BrokerVerse and legacy value, difference, tolerance, status), checks and tie-outs with their accounts, differences, sign-offs, summary and the users who uploaded, submitted or approved its loads (makers: they neither accept nor sign)',
    screen: SCREEN, middleware: canRead, response: { success: true, data: reconExample },
    handler: async (req, res) => ok(res, await recon.getReconciliation(req.params.id)),
  });
  define({
    method: 'GET', path: '/reconciliations/:id/tieouts', summary: 'The sub-ledger tie-outs: their definitions and the tie-out lines of the reconciliation (both sides, accounts, difference)',
    screen: `${SCREEN} > Tie-outs`, middleware: canRead, response: { success: true, data: { definitions: [tieoutDefinition], lines: [tieoutExample] } },
    handler: async (req, res) => {
      const r = await recon.getReconciliation(req.params.id);
      ok(res, { definitions: await recon.tieoutDefinitions(), lines: r.lines.filter((l) => l.kind === 'tieout') });
    },
  });
  define({
    method: 'POST', path: '/reconciliations/:id/recompute', summary: 'Compute an open reconciliation again (none of its slots signed): the figures of the records and of the Control Totals sheets; legacy figures entered on screen or uploaded are kept',
    screen: SCREEN, middleware: canWrite, response: { success: true, message: 'REC-000007 recomputed', data: reconExample },
    handler: async (req, res) => {
      const r = await recon.recompute(req.params.id, req.user, req);
      ok(res, r, `${r.reconNumber} recomputed`);
    },
  });
  define({
    method: 'PUT', path: '/reconciliations/:id/lines/:lineId', summary: 'Enter the legacy figure of a line (write:data-load; legacyValue, null clears it) or its tolerance (a tolerance other than zero: approve:data-load, toleranceReason required, not a user who loaded the batches; a count is always exact)',
    screen: `${SCREEN} > Lines`, middleware: canWriteOrApprove, request: { legacyValue: 1250000, tolerance: 0.5, toleranceReason: 'Legacy system rounds each instalment' },
    response: { success: true, message: 'Line saved', data: reconExample },
    handler: async (req, res) => ok(res, await recon.updateLine(req.params.id, req.params.lineId, req.body, req.user, req), 'Line saved'),
  });
  define({
    method: 'POST', path: '/reconciliations/:id/legacy', summary: 'Upload legacy figures (multipart "file"): a workbook with the Control Totals sheet (Object, Measure, Group, Legacy Value); all or nothing, each row sets the legacy figure of its line',
    screen: `${SCREEN} > Upload control totals`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
    response: { success: true, message: 'Legacy figures loaded', data: reconExample },
    handler: async (req, res) => {
      if (!req.file?.buffer?.length) throw badRequest('Upload the workbook with the Control Totals sheet (.xlsx) in the "file" field');
      ok(res, await recon.uploadLegacy(req.params.id, req.file.buffer, req.user, req), 'Legacy figures loaded');
    },
  });
  define({
    method: 'PUT', path: '/reconciliations/:id/differences/:diffId', summary: 'Explain a difference: explanation, action, owner and status (explained or fixed)',
    screen: `${SCREEN} > Differences`, middleware: canWrite, request: { explanation: 'Bill keyed twice in the legacy system', action: 'Cancel DN-OLD-77 in BrokerVerse', owner: 'Credit and Collection', status: 'explained' },
    response: { success: true, message: 'Difference explained', data: reconExample },
    handler: async (req, res) => ok(res, await recon.explainDifference(req.params.id, req.params.diffId, req.body, req.user, req), 'Difference explained'),
  });
  define({
    method: 'POST', path: '/reconciliations/:id/differences/:diffId/accept', summary: 'Accept a difference (approve:data-load; never a user who uploaded, submitted or approved a load of the reconciliation); it needs its explanation',
    screen: `${SCREEN} > Differences`, middleware: canApprove, request: { explanation: 'Accepted: cancelled in the legacy system after the extract' },
    response: { success: true, message: 'Difference accepted', data: reconExample },
    handler: async (req, res) => ok(res, await recon.acceptDifference(req.params.id, req.params.diffId, req.body, req.user, req), 'Difference accepted'),
  });
  define({
    method: 'POST', path: '/reconciliations/:id/signoffs/:slot', summary: 'Sign a slot of the reconciliation with a remark (approve:data-load; not a user who uploaded, submitted or approved one of its loads, nor one who signed another slot; no open difference and every total with its legacy figure). The last slot makes it Signed and keeps its PDF with the SHA-256',
    screen: `${SCREEN} > Sign-off`, middleware: canApprove, request: { remarks: 'Policies and open items agree with the legacy listing of 31/10/2026' },
    response: { success: true, message: 'Data owner signed', data: reconExample },
    handler: async (req, res) => {
      const r = await recon.signSlot(req.params.id, req.params.slot, req.body || {}, req.user, req);
      ok(res, r, `${r.signoffs.find((s) => s.slot === req.params.slot)?.label || 'Sign-off'} signed`);
    },
  });
  define({
    method: 'GET', path: '/reconciliations/:id/report', summary: 'The reconciliation report: format=pdf (letterhead) or xlsx (Summary, Lines, Checks, Differences, Sign-offs), built when downloaded; version=signed: the PDF kept when the last slot signed (X-Content-SHA256)',
    screen: `${SCREEN} > Report`, middleware: canRead, query: { format: 'pdf', version: 'signed' }, response: '(application/pdf or xlsx file)',
    handler: async (req, res) => {
      const format = String(req.query.format || 'pdf').toLowerCase();
      if (!['pdf', 'xlsx'].includes(format)) throw badRequest('format must be pdf or xlsx');
      if (String(req.query.version || '') === 'signed') {
        const f = await recon.signedReport(req.params.id);
        await audit(req, { entity: 'migration_reconciliation', entityId: Number(req.params.id), action: 'download', after: { version: 'signed', sha256: f.sha256 } });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${f.fileName}"`);
        res.setHeader('X-Content-SHA256', f.sha256);
        return res.send(f.buffer);
      }
      const r = await recon.getReconciliation(req.params.id);
      if (format === 'xlsx') return sendXlsx(res, `${r.reconNumber}_Reconciliation.xlsx`, recon.reportWorkbook(r));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${r.reconNumber}_Reconciliation.pdf"`);
      return res.send(await recon.reportPdf(r));
    },
  });

  // ------------------------------------------------------------------ one-time SAP opening file

  const SAP_SCREEN = `${WORKSPACE} > Go-Live > SAP opening file`;
  define({
    method: 'GET', path: '/golive/sap-opening-file', summary: 'The one-time SAP opening file: whether BrokerVerse sends it (migration.sap_gl_include_opening), the opening balance journal, the requests and, once generated, its SAP GL run and files',
    screen: SAP_SCREEN, middleware: canRead, response: { success: true, data: sapStateExample },
    handler: async (_req, res) => ok(res, await sap.sapOpeningState()),
  });
  define({
    method: 'POST', path: '/golive/sap-opening-file', summary: 'Request the SAP opening file of the opening balance journal, with a reason; generated on the approval of another user, once',
    screen: SAP_SCREEN, middleware: canWrite, request: { reason: 'SAP takes the opening position from BrokerVerse' },
    response: { success: true, message: 'SAP opening file requested', data: sapStateExample },
    handler: async (req, res) => created(res, await sap.requestSapOpening(req.body || {}, req.user, req), 'SAP opening file requested'),
  });
  define({
    method: 'POST', path: '/golive/sap-opening-file/approve', summary: 'Approve the request (approve:data-load, not its requester; go-live locked): the file is written to the SAP pick-up folder in the layout of the daily file (a run of trigger opening) and the journal marked sent; refused once generated',
    screen: SAP_SCREEN, middleware: canApprove, response: { success: true, message: 'SAP opening file generated', data: { ...sapStateExample, pendingRequest: null } },
    handler: async (req, res) => ok(res, await sap.approveSapOpening(req.user, req), 'SAP opening file generated'),
  });
  define({
    method: 'POST', path: '/golive/sap-opening-file/reject', summary: 'Reject the request with remarks (approve:data-load, not its requester)',
    screen: SAP_SCREEN, middleware: canApprove, request: { remarks: 'SAP loads its own cutover balances' }, response: { success: true, message: 'SAP opening file rejected', data: sapStateExample },
    handler: async (req, res) => ok(res, await sap.rejectSapOpening(req.body || {}, req.user, req), 'SAP opening file rejected'),
  });
  define({
    method: 'POST', path: '/golive/sap-opening-file/withdraw', summary: 'Withdraw the request (its requester)',
    screen: SAP_SCREEN, middleware: canWrite, response: { success: true, message: 'SAP opening file request withdrawn', data: sapStateExample },
    handler: async (req, res) => ok(res, await sap.withdrawSapOpening(req.user, req), 'SAP opening file request withdrawn'),
  });
  define({
    method: 'GET', path: '/golive/sap-opening-file/files/:kind', summary: 'One file of the generated SAP opening file (kind header or line), as written to the SAP pick-up folder',
    screen: SAP_SCREEN, middleware: canRead, response: '(text file)',
    handler: async (req, res) => {
      const f = await sap.sapOpeningFile(req.params.kind);
      await audit(req, { entity: 'sap_opening_file', entityId: req.params.kind, action: 'download', after: { fileName: f.fileName } });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${f.fileName}"`);
      res.send(Buffer.from(f.content, f.encoding));
    },
  });
}
