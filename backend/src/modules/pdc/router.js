/**
 * Post-dated cheque register (Accounts > Post-Dated Cheques): register cheques received against bills, the deposit due
 * list, deposit (creates and posts the official receipt), cleared, bounced (receipt cancelled), replacement, return.
 * read:receipts to view, write:receipts to act (Accounting).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Post-Dated Cheques', '/pdc');
const read = [requireAuth, requirePermission('read:receipts')];
const write = [requireAuth, requirePermission('write:receipts')];
const S = 'Accounts > Post-Dated Cheques';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tx = (fn) => withTransaction(fn);
const example = { id: 'pdc_1', pdcNumber: 'PDC-2026-00001', clientName: 'ABC Trading Corp.', policyNumber: 'POL-2026-00011', billNumber: 'INV-2026-00031', bankName: 'BDO Unibank',
  chequeNumber: '0001234', chequeDate: '2026-11-15', amount: 12525, status: 'on-hand', storageLocation: 'Vault A, folder 11', dueInDays: 42 };
const HEADER = [{ key: 'pdcNumber', label: 'PDC No.' }, { key: 'clientName', label: 'Client' }, { key: 'policyNumber', label: 'Policy' }, { key: 'billNumber', label: 'Bill' },
  { key: 'bankName', label: 'Bank' }, { key: 'chequeNumber', label: 'Cheque No.' }, { key: 'chequeDate', label: 'Cheque Date', type: 'date' }, { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'status', label: 'Status' }, { key: 'storageLocation', label: 'Kept In' }, { key: 'receiptNumber', label: 'Receipt' }, { key: 'depositedOn', label: 'Deposited', type: 'date' }];

define({
  method: 'GET', path: '/', summary: 'Post-dated cheque register (status on-hand | deposited | cleared | bounced | replaced | returned | cancelled | open | all, dueBy, clientId, policyId, search; format=xlsx or csv)',
  screen: S, middleware: read, query: { status: 'on-hand' }, response: { success: true, data: { asOf: '2026-10-04', summary: { onHand: 3, onHandAmount: 37575, dueNow: 1, dueNowAmount: 12525, bounced: 0 }, rows: [example] } },
  handler: async (req, res) => {
    const r = await svc.listPdcs(pool, req.query);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      await sendTable(res, { header: HEADER.map((h) => h.label), rows: r.rows.map((x) => HEADER.map((h) => x[h.key] ?? '')), fileBase: `post-dated-cheques-${r.asOf}`, format: req.query.format, sheetName: 'Post-dated cheques' });
      return;
    }
    ok(res, r);
  },
});
define({
  method: 'GET', path: '/deposit-due', summary: 'Cheques on hand due for deposit within pdc.due_window_days', screen: `${S} > Deposit due`, middleware: read,
  response: { success: true, data: { asOf: '2026-10-04', windowDays: 3, total: 12525, rows: [example] } },
  handler: async (_req, res) => ok(res, await svc.depositDue(pool)),
});
define({
  method: 'GET', path: '/:id', summary: 'One post-dated cheque', screen: S, middleware: read, response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getPdc(pool, req.params.id)),
});
const chequeBody = { bankId: z.number().int().optional().nullable(), draweeBank: z.string().max(120).optional().nullable(), branch: z.string().max(120).optional().nullable(),
  chequeNumber: z.string().min(1).max(40), chequeDate: date, amount: z.number().positive().optional(), receivedDate: date.optional(), storageLocation: z.string().max(200).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable() };
define({
  method: 'POST', path: '/', summary: 'Register a post-dated cheque on hand against a bill (receivableId) or a policy (policyId); nothing is posted until it is deposited',
  screen: `${S} > Register`, middleware: [...write, validate(z.object({ ...chequeBody, amount: z.number().positive(), receivableId: z.string().optional(), policyId: z.string().optional() }))],
  request: { receivableId: 'rcv_1', bankId: 3, chequeNumber: '0001234', chequeDate: '2026-11-15', amount: 12525, storageLocation: 'Vault A, folder 11' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await tx((db) => svc.registerPdc(db, req.body, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.id, action: 'create', after: r });
    created(res, r, `Cheque ${r.chequeNumber} registered as ${r.pdcNumber}`);
  },
});
define({
  method: 'POST', path: '/:id/deposit', summary: 'Deposit a cheque on or after its date: creates and posts the official receipt (receipt.apply) on the bank account deposited to',
  screen: `${S} > Deposit`, middleware: [...write, validate(z.object({ depositAccount: z.string().max(60).optional(), depositDate: date.optional() }))],
  request: { depositAccount: 'ACC-OPS-001', depositDate: '2026-11-15' }, response: { success: true, data: { pdc: { ...example, status: 'deposited', receiptNumber: 'OR-2026-00112' }, receiptNumber: 'OR-2026-00112' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.depositPdc(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.pdc.id, action: 'deposit', after: { status: r.pdc.status, receiptNumber: r.receiptNumber, depositAccount: r.pdc.depositAccount } });
    ok(res, r, `Cheque deposited; receipt ${r.receiptNumber} posted`);
  },
});
define({
  method: 'POST', path: '/:id/clear', summary: 'Record that the bank cleared a deposited cheque', screen: S, middleware: [...write, validate(z.object({ clearedOn: date.optional() }))],
  request: { clearedOn: '2026-11-17' }, response: { success: true, data: { ...example, status: 'cleared' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.clearPdc(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.id, action: 'clear', after: { status: r.status, clearedOn: r.clearedOn } });
    ok(res, r, 'Cheque cleared');
  },
});
define({
  method: 'POST', path: '/:id/bounce', summary: 'Record a bounced cheque: its receipt is cancelled (journal reversed, bill open again), Accounting and the client are told',
  screen: `${S} > Bounced`, middleware: [...write, validate(z.object({ reason: z.string().min(1).max(300), bouncedOn: date.optional(), bounceCharge: z.number().min(0).optional() }))],
  request: { reason: 'DAIF (drawn against insufficient funds)', bouncedOn: '2026-11-17', bounceCharge: 500 }, response: { success: true, data: { pdc: { ...example, status: 'bounced' }, emailedTo: 'client@example.ph' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.bouncePdc(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.pdc.id, action: 'bounce', after: { status: r.pdc.status, reason: req.body.reason, receiptNumber: r.pdc.receiptNumber } });
    ok(res, r, `Cheque ${r.pdc.chequeNumber} marked bounced`);
  },
});
define({
  method: 'POST', path: '/:id/replace', summary: 'Replace a bounced (or on-hand) cheque by a new cheque for the same bill or policy', screen: `${S} > Replace`, middleware: [...write, validate(z.object(chequeBody))],
  request: { bankId: 3, chequeNumber: '0005678', chequeDate: '2026-11-25', amount: 12525 }, response: { success: true, data: { replaced: { ...example, status: 'replaced' }, pdc: { ...example, pdcNumber: 'PDC-2026-00002' } } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.replacePdc(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.replaced.id, action: 'replace', after: { replacedBy: r.pdc.pdcNumber } });
    created(res, r, `Cheque replaced by ${r.pdc.pdcNumber}`);
  },
});
for (const [path, kind, label] of [['/:id/return', 'returned', 'Return an unused cheque on hand to the client'], ['/:id/cancel', 'cancelled', 'Cancel a cheque registered in error']]) {
  define({
    method: 'POST', path, summary: `${label} (reason required)`, screen: S, middleware: [...write, validate(z.object({ reason: z.string().min(1).max(500) }))],
    request: { reason: kind === 'returned' ? 'Policy cancelled; cheque returned to the client' : 'Entered twice' }, response: { success: true, data: { ...example, status: kind } },
    handler: async (req, res) => {
      const r = await tx((db) => svc.closePdc(db, req.params.id, kind, req.body.reason, req.user));
      await audit(req, { entity: 'post_dated_cheque', entityId: r.id, action: kind === 'returned' ? 'return' : 'cancel', after: { status: r.status, reason: req.body.reason } });
      ok(res, r, `Cheque ${kind}`);
    },
  });
}

export default router;
export const mount = '/pdc';
