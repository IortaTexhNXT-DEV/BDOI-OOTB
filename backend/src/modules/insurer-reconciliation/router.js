/**
 * Insurer statement reconciliation (Accounts > Insurer Reconciliation; formats under Master > Finance > Insurer Statement
 * Formats): import an insurer's statement of account, auto / manual matching to the broker's records, differences
 * report, resolutions, approval and export.
 * Permissions: read:remittance to view; write:remittance to import, match, resolve and submit;
 * approve:insurer-reconciliation (Accounting Manager) to approve or reject (maker-checker: not the preparer).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { printFormat } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { toCsv, uploadFile } from '../documents/tabular.js';
import { printContext, renderPdf, sendPdf } from '../documents/pdf.js';
import { excelBrand } from '../reports/service.js';
import * as st from './statements.js';
import * as mt from './matching.js';
import * as rc from './reconcile.js';
import { formatMoney } from '../../lib/money.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';

const { router, define } = moduleRouter('Insurer Reconciliation', '/insurer-reconciliation');
const read = [requireAuth, requirePermission('read:remittance')];
const write = [requireAuth, requirePermission('write:remittance')];
const approve = [requireAuth, requirePermission('approve:insurer-reconciliation')];
const readMaster = [requireAuth, requirePermission('read:remittance', 'read:masters')];
const writeMaster = [requireAuth, requirePermission('write:remittance', 'write:masters')];
const S = 'Accounts > Insurer Reconciliation';
const F = 'Master > Finance > Insurer Statement Formats';
const tx = (fn) => withTransaction(fn);
const statementLink = (st) => `/accounts/insurer-reconciliation/statements/${st.id}`;
const statementPeriod = (st) => [st.periodFrom, st.periodTo].filter(Boolean).map((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10))).join(' to ');

const formatExample = { code: 'MALAYAN-SOA', name: 'Malayan statement of account', insurerId: 1, fileType: 'xlsx', skipRows: 2, hasHeader: true,
  columns: { policyNo: 'policy no', insured: 'assured', date: 'date', grossPremium: 'gross premium', commission: 'commission', taxes: 'taxes', amountPaid: 'amount received' }, dateFormat: 'MM/DD/YYYY' };
const stExample = { id: 'isr_1', statementNumber: 'ISR-2026-00001', insurerName: 'Malayan Insurance Co., Inc.', statementType: 'premium', statementRef: 'SOA-0926',
  periodFrom: '2026-09-01', periodTo: '2026-09-30', tolerance: 1, lineCount: 12, status: 'draft' };

// ---------- formats ----------
define({
  method: 'GET', path: '/formats', summary: 'Insurer statement formats (column mapping per insurer); insurerId limits to the insurer\'s own formats and the generic ones; all=true includes inactive',
  screen: F, middleware: readMaster, query: { insurerId: 1 }, response: { success: true, data: [formatExample] },
  handler: async (req, res) => ok(res, await st.listFormats(pool, { insurerId: req.query.insurerId, all: req.query.all === 'true' })),
});
const FORMAT = z.object({ code: z.string().optional(), name: z.string().optional(), insurerId: z.union([z.number(), z.string()]).nullable().optional(), description: z.string().nullable().optional(),
  fileType: z.enum(['any', 'csv', 'xlsx']).optional(), skipRows: z.number().int().min(0).max(100).optional(), hasHeader: z.boolean().optional(),
  columns: z.record(z.union([z.string(), z.number()])).optional(), dateFormat: z.string().optional(), skipPattern: z.string().nullable().optional(), active: z.boolean().optional() });
define({
  method: 'POST', path: '/formats', summary: 'Add an insurer statement format', screen: F, middleware: [...writeMaster, validate(FORMAT)], request: formatExample, response: { success: true, data: formatExample },
  handler: async (req, res) => {
    const r = await tx((db) => st.saveFormat(db, null, req.body, req.user));
    await audit(req, { entity: 'insurer_statement_format', entityId: r.after.code, action: 'create', after: r.after });
    created(res, r.after, `Format ${r.after.code} added`);
  },
});
define({
  method: 'PUT', path: '/formats/:code', summary: 'Change an insurer statement format (columns, date format, rows to skip, active)', screen: F, middleware: [...writeMaster, validate(FORMAT)],
  request: { columns: formatExample.columns, active: true }, response: { success: true, data: formatExample },
  handler: async (req, res) => {
    const r = await tx((db) => st.saveFormat(db, req.params.code, req.body, req.user));
    await audit(req, { entity: 'insurer_statement_format', entityId: r.after.code, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, `Format ${r.after.code} saved`);
  },
});

// ---------- statements ----------
define({
  method: 'GET', path: '/statements', summary: 'Imported insurer statements (insurerId, status, statementType, from / to)', screen: S, middleware: read,
  query: { insurerId: 1, status: 'draft' }, response: { success: true, data: [stExample] },
  handler: async (req, res) => ok(res, await rc.listStatements(pool, req.query)),
});
define({
  method: 'POST', path: '/statements/preview', summary: 'Parse an insurer statement file (CSV / XLSX) with a format and show the lines, totals and the rows that cannot be read; nothing is saved',
  screen: `${S} > Import statement`, middleware: [...write, uploadFile], request: { file: '(multipart) statement.xlsx', insurerId: 1, formatCode: 'GENERIC' },
  response: { success: true, data: { format: 'GENERIC', lines: [{ lineNo: 1, policyNo: 'POL-2026-00001', grossPremium: 12525, commission: 1500 }], errors: [], totals: { count: 1 } } },
  handler: async (req, res) => ok(res, await st.previewStatement(pool, req.file, req.body || {})),
});
define({
  method: 'POST', path: '/statements/import', summary: 'Import an insurer statement (premium remittance confirmation or commission statement) and auto-match it to the broker\'s records',
  screen: `${S} > Import statement`, middleware: [...write, uploadFile],
  request: { file: '(multipart) statement.xlsx', insurerId: 1, statementType: 'premium', periodFrom: '2026-09-01', periodTo: '2026-09-30', statementRef: 'SOA-0926', formatCode: 'GENERIC', tolerance: 1 },
  response: { success: true, data: { ...stExample, summary: { matched: 10, differences: 1, missingInBroker: 1, missingInInsurer: 0 } } },
  handler: async (req, res) => {
    const out = await tx(async (db) => {
      const id = await st.importStatement(db, req.file, req.body || {}, req.user);
      await mt.autoMatch(db, id, req.user);
      return rc.getStatement(db, id);
    });
    await audit(req, { entity: 'insurer_statement', entityId: out.id, action: 'import', after: { statementNumber: out.statementNumber, lineCount: out.lineCount, summary: out.summary } });
    created(res, out, `${out.statementNumber} imported: ${out.summary.matched} matched, ${out.summary.differences} with differences, ${out.summary.missingInBroker} not found`);
  },
});
define({
  method: 'GET', path: '/statements/:id', summary: 'Statement with its lines, matches, differences report and resolutions', screen: S, middleware: read,
  response: { success: true, data: { ...stExample, summary: {}, lines: [], missingInBroker: [], missingInInsurer: [], amountDifferences: [] } },
  handler: async (req, res) => ok(res, await rc.getStatement(pool, req.params.id)),
});
define({
  method: 'POST', path: '/statements/:id/auto-match', summary: 'Run the automatic matching again on the unmatched lines (policy number, then amount and insured)', screen: S, middleware: write,
  response: { success: true, data: { matched: 10, differences: 1, unmatched: 1 } },
  handler: async (req, res) => ok(res, await tx((db) => mt.autoMatch(db, req.params.id, req.user)), 'Automatic matching done'),
});
define({
  method: 'GET', path: '/statements/:id/candidates', summary: 'Broker records of the insurer a line can be matched to (search on policy number or insured)', screen: `${S} > Manual match`, middleware: read,
  query: { search: 'POL-2026' }, response: { success: true, data: [{ type: 'remittance_line', id: '12', policyNumber: 'POL-2026-00001', grossPremium: 12525, commission: 1500, amount: 11025 }] },
  handler: async (req, res) => {
    const s = await mt.statementRow(pool, req.params.id);
    ok(res, (await mt.brokerRecords(pool, s, { search: req.query.search || null })).slice(0, 200));
  },
});
define({
  method: 'POST', path: '/statements/:id/lines/:lineId/match', summary: 'Match a statement line by hand to a broker record', screen: `${S} > Manual match`,
  middleware: [...write, validate(z.object({ brokerType: z.enum(['remittance_line', 'debit_note_line', 'policy']), brokerId: z.union([z.string(), z.number()]) }))],
  request: { brokerType: 'policy', brokerId: 'pol_1' }, response: { success: true, data: { lineId: 3, status: 'matched' } },
  handler: async (req, res) => {
    const r = await tx((db) => mt.manualMatch(db, req.params.id, req.params.lineId, req.body, req.user));
    await audit(req, { entity: 'insurer_statement', entityId: req.params.id, action: 'match', after: r });
    ok(res, r, `Line matched (${r.status})`);
  },
});
define({
  method: 'DELETE', path: '/statements/:id/lines/:lineId/match', summary: 'Undo the match of a statement line', screen: S, middleware: write, response: { success: true, data: null },
  handler: async (req, res) => {
    await tx((db) => mt.unmatch(db, req.params.id, req.params.lineId));
    await audit(req, { entity: 'insurer_statement', entityId: req.params.id, action: 'unmatch', after: { lineId: req.params.lineId } });
    ok(res, null, 'Match removed');
  },
});
define({
  method: 'POST', path: '/statements/:id/resolutions', summary: 'Resolve a difference (lineId, or brokerType + brokerId for a record missing on the statement) with a note or an adjustment (posted on approval)',
  screen: `${S} > Resolve`, middleware: [...write, validate(z.object({ lineId: z.union([z.number(), z.string()]).optional(), brokerType: z.string().optional(), brokerId: z.union([z.string(), z.number()]).optional(),
    kind: z.enum(['note', 'adjustment']), note: z.string().max(1000), premiumAdjustment: z.number().optional(), commissionAdjustment: z.number().optional() }))],
  request: { lineId: 3, kind: 'adjustment', note: 'Insurer applied the corrected rate', premiumAdjustment: 150, commissionAdjustment: 0 },
  response: { success: true, data: { id: 1, kind: 'adjustment', premiumAdjustment: 150, commissionAdjustment: 0 } },
  handler: async (req, res) => {
    const r = await tx((db) => mt.resolve(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'insurer_statement', entityId: req.params.id, action: 'resolve', after: r });
    created(res, r, 'Difference resolved');
  },
});
define({
  method: 'DELETE', path: '/statements/:id/resolutions/:resolutionId', summary: 'Remove a resolution (draft statements only)', screen: `${S} > Resolve`, middleware: write, response: { success: true, data: null },
  handler: async (req, res) => {
    await tx((db) => mt.removeResolution(db, req.params.id, req.params.resolutionId));
    await audit(req, { entity: 'insurer_statement', entityId: req.params.id, action: 'unresolve', after: { resolutionId: req.params.resolutionId } });
    ok(res, null, 'Resolution removed');
  },
});
define({
  method: 'POST', path: '/statements/:id/submit', summary: 'Submit the reconciliation for approval (every difference resolved when insurer_reconciliation.require_resolved)', screen: S, middleware: write,
  response: { success: true, data: { ...stExample, status: 'submitted' } },
  handler: async (req, res) => {
    const r = await tx((db) => rc.submit(db, req.params.id, req.user));
    await audit(req, { entity: 'insurer_statement', entityId: r.after.id, action: 'submit', before: r.before, after: { status: r.after.status } });
    const st = r.after;
    await notifyApprovers({ audience: 'approve:insurer-reconciliation', document: 'Insurer reconciliation', number: st.statementNumber, by: req.user.username,
      detail: [st.insurerName, statementPeriod(st), `paid ${await formatMoney(st.totals.amountPaid)}`].filter(Boolean).join(', '), link: statementLink(st), entity: 'insurer_statement', entityId: st.id });
    ok(res, r.after, `${r.after.statementNumber} submitted for approval`);
  },
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/statements/:id/${action}`,
    summary: action === 'approve' ? 'Approve the reconciliation: posts the adjustment journals (posting rule insurer_statement.adjustment) and locks it; not the preparer'
      : 'Reject the reconciliation back to draft (reason required)',
    screen: S, middleware: [...approve, validate(z.object({ remarks: z.string().max(1000).optional() }))], request: { remarks: action === 'approve' ? 'Agreed with the insurer' : 'Line 4 needs the endorsement' },
    response: { success: true, data: { ...stExample, status: action === 'approve' ? 'approved' : 'draft' } },
    handler: async (req, res) => {
      const r = await tx((db) => rc.decide(db, req.params.id, action, req.body?.remarks, req.user));
      await audit(req, { entity: 'insurer_statement', entityId: r.after.id, action, before: r.before, after: { status: r.after.status, remarks: req.body?.remarks || null, journals: r.journals } });
      await notifyDecision({ userId: r.submittedBy, decidedBy: req.user.id, document: 'Insurer reconciliation', number: r.after.statementNumber, approved: action === 'approve',
        by: req.user.username, reason: action === 'reject' ? req.body?.remarks : null, link: statementLink(r.after), entity: 'insurer_statement', entityId: r.after.id });
      ok(res, r.after, `${r.after.statementNumber} ${action === 'approve' ? 'approved' : 'rejected'}`);
    },
  });
}
define({
  method: 'POST', path: '/statements/:id/cancel', summary: 'Cancel a draft statement imported in error', screen: S, middleware: [...write, validate(z.object({ reason: z.string().max(500).optional() }))],
  request: { reason: 'Wrong insurer' }, response: { success: true, data: { status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tx((db) => rc.cancel(db, req.params.id, req.body?.reason, req.user));
    await audit(req, { entity: 'insurer_statement', entityId: r.after.id, action: 'cancel', before: r.before, after: r.after });
    ok(res, r.after, `${r.after.statementNumber} cancelled`);
  },
});
define({
  method: 'GET', path: '/statements/:id/report', summary: 'Differences report download: format=xlsx (default), csv or pdf', screen: `${S} > Differences report`, middleware: read,
  query: { format: 'xlsx' }, response: '(application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | text/csv | application/pdf)',
  handler: async (req, res) => {
    const s = await rc.getStatement(pool, req.params.id);
    const base = `insurer-reconciliation-${s.statementNumber}`;
    const format = String(req.query.format || 'xlsx').toLowerCase();
    if (format === 'pdf') {
      sendPdf(res, await renderPdf(rc.reportPdfSpec(s, await printFormat())), `${base}.pdf`, req.query.download ? 'attachment' : 'inline');
      return;
    }
    const rows = rc.reportRows(s);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
      res.send(`\ufeff${toCsv(rc.REPORT_HEADER, rows)}`);
      return;
    }
    const money = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const sum = s.summary;
    const buf = writeXlsx({ title: `Insurer statement reconciliation ${s.statementNumber}`, brand: excelBrand(await printContext()), sheets: [
      { name: 'Reconciliation', columns: rc.REPORT_HEADER.map((h, i) => ({ header: h, type: money.has(i) ? 'money' : 'text', width: i === 16 ? 60 : 16 })), rows },
      { name: 'Summary', columns: [{ header: 'Item', width: 40 }, { header: 'Value', width: 20, type: 'auto' }], rows: [
        ['Insurer', s.insurerName], ['Statement', `${s.statementTypeLabel} ${s.statementRef || ''}`.trim()], ['Period', `${s.periodFrom} to ${s.periodTo}`], ['Status', s.status],
        ['Lines', sum.lines], ['Matched', sum.matched], ['Amount differences', sum.differences], ['Not found at the broker', sum.missingInBroker],
        ['Missing on the insurer statement', sum.missingInInsurer], ['Unresolved', sum.unresolved], ['Premium adjustments', sum.adjustments.premium], ['Commission adjustments', sum.adjustments.commission]] },
    ] });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    res.send(buf);
  },
});

export default router;
export const mount = '/insurer-reconciliation';
