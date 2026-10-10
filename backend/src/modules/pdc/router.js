/**
 * Post-dated cheque log (Accounts > Post-Dated Cheques, TIS-BRD-COLL-05): encode sets against the instalment plan,
 * forward to the Insurance Partner with a transmittal, the partner's receipt and maturity advices, cancellation with a
 * second user's approval, replacement and return; deposit, cleared and bounced for cheques payable to TISPH.
 * read:pdc to view, write:pdc to act, approve:pdc to decide a cancellation; Partner cleared also needs write:receipts
 * (it raises the acknowledgement receipt).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { pdcAcknowledgementDoc } from '../documents/templates.js';
import * as svc from './service.js';
import * as life from './lifecycle.js';

const { router, define } = moduleRouter('Post-Dated Cheques', '/pdc');
const read = [requireAuth, requirePermission('read:pdc')];
const write = [requireAuth, requirePermission('write:pdc')];
const approve = [requireAuth, requirePermission('approve:pdc')];
const S = 'Accounts > Post-Dated Cheques';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tx = (fn) => withTransaction(fn);
const example = { id: 'pdc_1', pdcNumber: 'PDC-2026-00121', setNumber: 'PCS-2026-00031', clientName: 'Andrea Villanueva', policyNumber: 'POL-2026-90004', billNumber: 'INV-2026-00104',
  instalmentText: '1 of 4', payee: 'insurance-partner', insurerName: 'Standard Insurance Co., Inc.', bankName: 'BPI', chequeNumber: '0045121', chequeDate: '2026-10-15', amount: 12787.5,
  status: 'warehoused', statusText: 'Warehoused', custodyText: 'Standard Insurance Co., Inc.', ageing: { code: 'current', label: 'Current', days: -6 }, receiptNumber: null };
const HEADER = [{ key: 'pdcNumber', label: 'PDC No.' }, { key: 'setNumber', label: 'Set' }, { key: 'clientName', label: 'Client' }, { key: 'policyNumber', label: 'Policy' },
  { key: 'billNumber', label: 'Bill' }, { key: 'instalmentText', label: 'Instalment' }, { key: 'payeeText', label: 'Payee' }, { key: 'insurerName', label: 'Insurance Partner' },
  { key: 'bankName', label: 'Drawee Bank' }, { key: 'branch', label: 'Branch' }, { key: 'accountNumber', label: 'Account No.' }, { key: 'brstn', label: 'BRSTN' },
  { key: 'chequeNumber', label: 'Cheque No.' }, { key: 'chequeDate', label: 'Cheque Date', type: 'date' }, { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'receivedDate', label: 'Received', type: 'date' }, { key: 'custodyText', label: 'Custody' }, { key: 'statusText', label: 'Status' }, { key: 'ageingText', label: 'Ageing' },
  { key: 'transmittalNumber', label: 'Transmittal' }, { key: 'forwardedOn', label: 'Forwarded', type: 'date' }, { key: 'warehousedOn', label: 'Warehoused', type: 'date' },
  { key: 'collectedOn', label: 'Collected', type: 'date' }, { key: 'partnerReference', label: 'Partner Reference' }, { key: 'receiptNumber', label: 'AR' },
  { key: 'depositedOn', label: 'Deposited', type: 'date' }, { key: 'bounceReason', label: 'Bounce Reason' }, { key: 'cancelReason', label: 'Cancellation Reason' }, { key: 'remarks', label: 'Remarks' }];
const exportRow = (x) => ({ ...x, ageingText: x.ageing?.label || '', cancelReason: x.cancellation?.reason || '' });
const snapshot = (p) => ({ status: p.statusText, custody: p.custodyText, transmittal: p.transmittalNumber, receipt: p.receiptNumber });
const logCheque = (req, p, action, before, extra = {}) => audit(req, { entity: 'post_dated_cheque', entityId: p.id, action, before: before ? snapshot(before) : null,
  after: { ...snapshot(p), ...extra } });

define({
  method: 'GET', path: '/', summary: 'PDC tracking log: tab open | at-tis | with-partners | awaiting | bounced | cancellation-pending | closed | deposit-due | all (or status), insurerId, payee, chequeFrom/chequeTo, receivedFrom/receivedTo, policyId, setId, search; format=xlsx or csv',
  screen: S, middleware: read, query: { tab: 'with-partners' }, response: { success: true, data: { asOf: '2026-10-16', summary: { atTis: 3, withPartners: 4, awaiting: 1, bounced: 0 },
    counts: { open: 7 }, ageing: { buckets: [30, 60, 90], amounts: { current: 38362.5, b1: 12787.5 } }, rows: [example] } },
  handler: async (req, res) => {
    const r = await svc.listPdcs(pool, req.query);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      await sendTable(res, { header: HEADER.map((h) => h.label), rows: r.rows.map(exportRow).map((x) => HEADER.map((h) => x[h.key] ?? '')), fileBase: `post-dated-cheques-${r.asOf}`,
        format: req.query.format, sheetName: 'Post-dated cheques' });
      return;
    }
    ok(res, r);
  },
});
define({
  method: 'GET', path: '/deposit-due', summary: 'Cheques payable to TISPH received at TIS and due for deposit within pdc.due_window_days', screen: `${S} > Deposit due`, middleware: read,
  response: { success: true, data: { asOf: '2026-10-04', windowDays: 3, total: 12525, rows: [example] } },
  handler: async (_req, res) => ok(res, await svc.depositDue(pool)),
});
define({
  method: 'GET', path: '/follow-up', summary: 'Cheques that need follow-up with the Insurance Partner (forwarded not received, matured without advice, pull-outs not returned)', screen: `${S} > Follow-up`,
  middleware: read, response: { success: true, data: { asOf: '2026-11-19', forwardAckDays: 5, confirmationGraceDays: 3, rows: [{ ...example, followUpReason: '4 days past date, no maturity advice' }] } },
  handler: async (_req, res) => ok(res, await life.followUpList(pool)),
});
define({
  method: 'GET', path: '/encode', summary: 'Encode PDCs: the policy (policy=number), its open bills and the unpaid instalments of the bill picked (bill=), with the payee proposed',
  screen: `${S} > Encode PDCs`, middleware: write, query: { policy: 'POL-2026-90004' },
  response: { success: true, data: { policyNumber: 'POL-2026-90004', clientName: 'Andrea Villanueva', insurerName: 'Standard Insurance Co., Inc.', billNumber: 'INV-2026-00104', planned: true,
    instalmentCount: 4, rows: [{ seq: 1, dueDate: '2026-10-15', amount: 12787.5 }], defaultPayee: 'insurance-partner', maxCheques: 12 } },
  handler: async (req, res) => ok(res, await life.encodeOptions(pool, req.query)),
});

const row = z.object({ seq: z.number().int().positive().nullable().optional(), bankId: z.number().int().optional().nullable(), draweeBank: z.string().max(120).optional().nullable(),
  branch: z.string().max(120).optional().nullable(), accountNumber: z.string().max(40).optional().nullable(), brstn: z.string().max(20).optional().nullable(),
  chequeNumber: z.string().max(20), chequeDate: date.optional().nullable(), remarks: z.string().max(500).optional().nullable() });
define({
  method: 'GET', path: '/sets', summary: 'PDC sets (status open | closed | cancelled, policyId)', screen: S, middleware: read,
  response: { success: true, data: [{ setNumber: 'PCS-2026-00031', policyNumber: 'POL-2026-90004', payee: 'insurance-partner', status: 'open' }] },
  handler: async (req, res) => ok(res, await life.listSets(pool, req.query)),
});
define({
  method: 'GET', path: '/sets/:id', summary: 'A PDC set with its cheques per instalment (the cheque paying it now and the ones it replaced), count, total and end of term', screen: `${S} > Set`,
  middleware: read, response: { success: true, data: { setNumber: 'PCS-2026-00031', status: 'open', chequeCount: 4, total: 51150, lastChequeDate: '2027-01-15', instalments: [{ seq: 1, current: example, earlier: [] }] } },
  handler: async (req, res) => ok(res, await life.getSet(pool, req.params.id)),
});
define({
  method: 'GET', path: '/sets/:id/acknowledgement', summary: 'Acknowledgement receipt (PDF) of the post-dated cheques of a set, given to the client on receipt; no journal is posted',
  screen: `${S} > Set > Print acknowledgement`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const set = await life.getSet(pool, req.params.id);
    sendPdf(res, buildPdf(await pdcAcknowledgementDoc(set)), `pdc-acknowledgement-${set.setNumber}.pdf`);
  },
});
define({
  method: 'POST', path: '/sets', summary: 'Encode PDCs: one set (PCS-) and one cheque per row against the unpaid instalments of a bill, Received at TIS; nothing is posted',
  screen: `${S} > Encode PDCs`, middleware: [...write, validate(z.object({ policyNumber: z.string().min(1).max(60), billId: z.string().min(1).max(60), payee: z.enum(svc.PAYEES).optional(),
    receivedDate: date.optional(), storageLocation: z.string().max(60).optional().nullable(), remarks: z.string().max(500).optional().nullable(), rows: z.array(row).min(1).max(60) }))],
  request: { policyNumber: 'POL-2026-90004', billId: 'INV-2026-00104', payee: 'insurance-partner', storageLocation: 'Vault A-12',
    rows: [{ seq: 1, bankId: 2, branch: 'Ayala Avenue', accountNumber: '3159-0456-21', brstn: '010040018', chequeNumber: '0045121', chequeDate: '2026-10-15' }] },
  response: { success: true, data: { set: { setNumber: 'PCS-2026-00031', chequeCount: 4, total: 51150 }, cheques: [example] }, message: 'Set PCS-2026-00031 saved with 4 cheques, PHP 51,150.00' },
  handler: async (req, res) => {
    const r = await tx((db) => life.encodeSet(db, req.body, req.user));
    await audit(req, { entity: 'pdc_set', entityId: r.set.id, action: 'create', after: { setNumber: r.set.setNumber, policy: r.set.policyNumber, payee: r.set.payeeText,
      cheques: r.cheques.map((c) => c.pdcNumber), total: r.set.total } });
    for (const c of r.cheques) await logCheque(req, c, 'encode', null, { set: r.set.setNumber, instalment: c.instalmentText, chequeNumber: c.chequeNumber, amount: c.amount });
    created(res, r, r.message);
  },
});

define({
  method: 'GET', path: '/transmittals', summary: 'Transmittals to the Insurance Partners (status sent | partly-received | received, insurerId)', screen: S, middleware: read,
  response: { success: true, data: [{ transmittalNumber: 'PT-2026-00008', insurerName: 'Standard Insurance Co., Inc.', forwardedOn: '2026-10-12', status: 'received' }] },
  handler: async (req, res) => ok(res, await life.listTransmittals(pool, req.query)),
});
define({
  method: 'GET', path: '/transmittals/:id', summary: 'A transmittal with its cheques and the pull-outs carried on it; format=xlsx or csv for the list sent with the cheques',
  screen: `${S} > Transmittal`, middleware: read, response: { success: true, data: { transmittalNumber: 'PT-2026-00008', status: 'sent', count: 4, total: 51150, cheques: [example], pullOuts: [] } },
  handler: async (req, res) => {
    const t = await life.getTransmittal(pool, req.params.id);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      const cols = [['Kind', 'kind'], ['PDC No.', 'pdcNumber'], ['Client', 'clientName'], ['Policy', 'policyNumber'], ['Bank', 'bankName'], ['Cheque No.', 'chequeNumber'],
        ['Cheque Date', 'chequeDate'], ['Amount', 'amount']];
      const rows = [...t.cheques.map((c) => ({ ...c, kind: 'Forwarded' })), ...t.pullOuts.map((c) => ({ ...c, kind: 'Pull-out requested' }))];
      await sendTable(res, { header: cols.map((c) => c[0]), rows: rows.map((r) => cols.map((c) => r[c[1]] ?? '')), fileBase: `transmittal-${t.transmittalNumber}`, format: req.query.format,
        sheetName: t.transmittalNumber });
      return;
    }
    ok(res, t);
  },
});
define({
  method: 'POST', path: '/transmittals', summary: 'Forward to Insurance Partner: the cheques ticked (Received at TIS, payee Insurance Partner, one partner) on a transmittal PT-, Forwarded; open pull-outs of the partner are carried on it',
  screen: `${S} > Forward to Insurance Partner`, middleware: [...write, validate(z.object({ pdcIds: z.array(z.string()).min(1).max(200), forwardedOn: date.optional(),
    sentBy: z.enum(life.SENT_BY), courierReference: z.string().max(60).optional().nullable(), remarks: z.string().max(500).optional().nullable() }))],
  request: { pdcIds: ['pdc_1', 'pdc_2'], forwardedOn: '2026-10-12', sentBy: 'courier', courierReference: 'LBC-778812' },
  response: { success: true, data: { transmittal: { transmittalNumber: 'PT-2026-00008', count: 4, total: 51150 } }, message: '4 cheques forwarded to Standard Insurance Co., Inc. on transmittal PT-2026-00008' },
  handler: async (req, res) => {
    const r = await tx((db) => life.forwardCheques(db, req.body, req.user));
    await audit(req, { entity: 'pdc_transmittal', entityId: r.transmittal.id, action: 'create', after: { transmittalNumber: r.transmittal.transmittalNumber, insurer: r.transmittal.insurerName,
      cheques: r.transmittal.cheques.map((c) => c.pdcNumber), pullOuts: r.transmittal.pullOuts.map((c) => c.pdcNumber), total: r.transmittal.total } });
    for (const c of r.transmittal.cheques) await logCheque(req, c, 'forward', { ...c, statusText: 'Received at TIS', custodyText: 'TIS vault', transmittalNumber: null });
    created(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/transmittals/:id/received', summary: 'Partner received: the cheques of the transmittal (all, or those ticked) are Warehoused with the Insurance Partner',
  screen: `${S} > Partner received`, middleware: [...write, validate(z.object({ receivedOn: date.optional(), receivedBy: z.string().min(1).max(80), partnerReference: z.string().max(60).optional().nullable(),
    pdcIds: z.array(z.string()).max(200).optional() }))],
  request: { receivedOn: '2026-10-14', receivedBy: 'J. Dizon', partnerReference: 'SICI-TR-1045' },
  response: { success: true, data: { transmittal: { transmittalNumber: 'PT-2026-00008', status: 'received' } }, message: '4 cheques of transmittal PT-2026-00008 are warehoused with Standard Insurance Co., Inc.' },
  handler: async (req, res) => {
    const r = await tx((db) => life.partnerReceived(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'pdc_transmittal', entityId: r.transmittal.id, action: 'partner-received', after: { status: r.transmittal.status, receivedOn: req.body.receivedOn,
      receivedBy: req.body.receivedBy, partnerReference: req.body.partnerReference || null } });
    for (const c of r.transmittal.cheques.filter((x) => r.ids.includes(x.id))) {
      await logCheque(req, c, 'partner-received', { ...c, statusText: 'Forwarded', custodyText: `In transit to ${c.insurerName}` }, { receivedBy: req.body.receivedBy });
    }
    ok(res, r, r.message);
  },
});

define({
  method: 'GET', path: '/:id', summary: 'One post-dated cheque with its set, transmittal, advices, AR, cancellation and replacement links', screen: `${S} > Cheque`, middleware: read,
  response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getPdc(pool, req.params.id)),
});
define({
  method: 'PUT', path: '/:id', summary: 'Edit a cheque: every detail while Received at TIS; afterwards only the remarks and the vault folder', screen: `${S} > Cheque > Edit`,
  middleware: [...write, validate(z.object({ bankId: z.number().int().optional().nullable(), draweeBank: z.string().max(120).optional().nullable(), branch: z.string().max(120).optional().nullable(),
    accountNumber: z.string().max(40).optional().nullable(), brstn: z.string().max(20).optional().nullable(), chequeNumber: z.string().min(1).max(20).optional(), chequeDate: date.optional(),
    storageLocation: z.string().max(200).optional().nullable(), remarks: z.string().max(1000).optional().nullable() }))],
  request: { storageLocation: 'Vault A-14' }, response: { success: true, data: { ...example, storageLocation: 'Vault A-14' } },
  handler: async (req, res) => {
    const r = await tx((db) => svc.updatePdc(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'post_dated_cheque', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, `Cheque ${r.after.pdcNumber} saved`);
  },
});
const chequeBody = { bankId: z.number().int().optional().nullable(), draweeBank: z.string().max(120).optional().nullable(), branch: z.string().max(120).optional().nullable(),
  accountNumber: z.string().max(40).optional().nullable(), brstn: z.string().max(20).optional().nullable(), chequeNumber: z.string().min(1).max(40), chequeDate: date,
  amount: z.number().positive().optional(), receivedDate: date.optional(), storageLocation: z.string().max(200).optional().nullable(), remarks: z.string().max(1000).optional().nullable() };
define({
  method: 'POST', path: '/', summary: 'Register one cheque payable to TISPH against a bill (receivableId) or a policy (policyId), outside a set; nothing is posted until it is deposited',
  screen: `${S} > Register`, middleware: [...write, validate(z.object({ ...chequeBody, amount: z.number().positive(), receivableId: z.string().optional(), policyId: z.string().optional() }))],
  request: { receivableId: 'rcv_1', bankId: 3, chequeNumber: '0001234', chequeDate: '2026-11-15', amount: 12525, storageLocation: 'Vault A, folder 11' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const r = await tx((db) => svc.registerPdc(db, req.body, req.user));
    await logCheque(req, r, 'create', null, { chequeNumber: r.chequeNumber, amount: r.amount, payee: r.payeeText });
    created(res, r, `Cheque ${r.chequeNumber} registered as ${r.pdcNumber}`);
  },
});
define({
  method: 'POST', path: '/:id/deposit', summary: 'Deposit a cheque payable to TISPH on or after its date to the collection account (pdc.default_deposit_account): the receipt is created and posted (receipt.apply)',
  screen: `${S} > Deposit`, middleware: [...write, requirePermission('write:receipts'), validate(z.object({ depositAccount: z.string().max(60).optional(), depositDate: date.optional() }))],
  request: { depositDate: '2026-11-15' }, response: { success: true, data: { pdc: { ...example, status: 'deposited', receiptNumber: 'OR-2026-00112' }, receiptNumber: 'OR-2026-00112' } },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => svc.depositPdc(db, req.params.id, req.body || {}, req.user));
    await logCheque(req, r.pdc, 'deposit', before, { depositAccount: r.pdc.depositAccount });
    ok(res, r, `Cheque deposited; receipt ${r.receiptNumber} posted`);
  },
});
define({
  method: 'POST', path: '/:id/clear', summary: 'Record that the bank cleared a deposited cheque', screen: S, middleware: [...write, validate(z.object({ clearedOn: date.optional() }))],
  request: { clearedOn: '2026-11-17' }, response: { success: true, data: { ...example, status: 'cleared' } },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => svc.clearPdc(db, req.params.id, req.body || {}, req.user));
    await logCheque(req, r, 'clear', before, { clearedOn: r.clearedOn });
    ok(res, r, 'Cheque cleared');
  },
});
define({
  method: 'POST', path: '/:id/bounce', summary: 'The bank returned a deposited cheque payable to TISPH (reasonCode of the pdc_bounce reasons, or reason): its receipt is cancelled, Cash Control and the client are told',
  screen: `${S} > Bounced`, middleware: [...write, validate(z.object({ reason: z.string().max(300).optional(), reasonCode: z.string().max(40).optional(), note: z.string().max(300).optional(),
    bouncedOn: date.optional(), bounceCharge: z.number().min(0).optional() }))],
  request: { reasonCode: 'PDC-BNC-DAIF', bouncedOn: '2026-11-17', bounceCharge: 500 }, response: { success: true, data: { pdc: { ...example, status: 'bounced' }, emailedTo: 'client@example.ph' } },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => svc.bouncePdc(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'bounce', before, { reason: r.pdc.bounceReason });
    ok(res, r, `Cheque ${r.pdc.pdcNumber} marked bounced`);
  },
});
define({
  method: 'POST', path: '/:id/partner-cleared', summary: 'Partner cleared: the Insurance Partner collected the cheque; the cheque is Cleared and its acknowledgement receipt raised on the collection date (pdc.partner_collected)',
  screen: `${S} > Partner cleared`, middleware: [...write, requirePermission('write:receipts'), validate(z.object({ collectedOn: date.optional(), partnerReference: z.string().max(60),
    remarks: z.string().max(500).optional().nullable() }))],
  request: { collectedOn: '2026-10-16', partnerReference: '7781204' },
  response: { success: true, data: { pdc: { ...example, status: 'cleared', receiptNumber: 'OR-2026-00213' }, receiptNumber: 'OR-2026-00213' }, message: 'Cheque PDC-2026-00121 cleared; AR OR-2026-00213 raised' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.partnerCleared(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'partner-cleared', before, { collectedOn: r.pdc.collectedOn, partnerReference: r.pdc.partnerReference,
      remark: r.warehousedNow ? 'Warehoused and cleared in one step: the partner\'s receipt was not recorded' : null });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/partner-bounced', summary: 'Partner bounced: the Insurance Partner reports the cheque returned (reasonCode of the pdc_bounce reasons); its AR, if any, is cancelled and the client told',
  screen: `${S} > Partner bounced`, middleware: [...write, validate(z.object({ reasonCode: z.string().max(40).optional(), note: z.string().max(300).optional().nullable(), bouncedOn: date.optional() }))],
  request: { reasonCode: 'PDC-BNC-DAIF', bouncedOn: '2026-12-17' }, response: { success: true, data: { pdc: { ...example, status: 'bounced' }, emailedTo: 'client@example.ph' }, message: 'Cheque PDC-2026-00123 marked bounced' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.partnerBounced(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'partner-bounced', before, { reason: r.pdc.bounceReason });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/cancellation', summary: 'Request cancellation of a cheque (reasonCode of the pdc_cancel reasons, replacementFollows cheque | cash | none): Cancellation pending until a holder of approve:pdc decides',
  screen: `${S} > Request cancellation`, middleware: [...write, validate(z.object({ reasonCode: z.string().max(40).optional(), note: z.string().max(500).optional().nullable(),
    replacementFollows: z.enum(life.REPLACEMENT).optional() }))],
  request: { reasonCode: 'PDC-CXL-CHEQUE', note: 'Client changed bank' }, response: { success: true, data: { pdc: { ...example, status: 'cancellation-pending' } }, message: 'Cancellation of cheque PDC-2026-00122 sent for approval' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.requestCancellation(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'cancellation-requested', before, { reason: r.pdc.cancellation?.remarks });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/cancellation/decision', summary: 'Approve or return a cancellation request (never the requester; remark required to return). Approval cancels a cheque at TIS, or requests the pull-out from the partner',
  screen: 'My Work > Approvals > PDC cancellation', middleware: [...approve, validate(z.object({ action: z.enum(['approve', 'return']), remark: z.string().max(500).optional().nullable() }))],
  request: { action: 'approve' }, response: { success: true, data: { pdc: { ...example, status: 'cancellation-pending' }, pullOut: true }, message: 'Cancellation approved. Pull-out requested from Standard Insurance Co., Inc.' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.decideCancellation(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, req.body.action === 'approve' ? 'cancellation-approved' : 'cancellation-returned', before, { remark: req.body.remark || null });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/partner-returned', summary: 'Partner returned: the Insurance Partner sent back a cheque whose cancellation was approved; the cheque is Cancelled, back in the TIS vault',
  screen: `${S} > Partner returned`, middleware: [...write, validate(z.object({ returnedOn: date.optional(), partnerReference: z.string().max(60).optional().nullable() }))],
  request: { returnedOn: '2026-11-05', partnerReference: 'SICI-PO-0091' }, response: { success: true, data: { pdc: { ...example, status: 'cancelled' } }, message: 'Cheque PDC-2026-00122 cancelled' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.partnerReturned(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'partner-returned', before, { partnerReference: req.body.partnerReference || null });
    ok(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/replace', summary: 'Replace a bounced cheque, or one cancelled for a cheque replacement, by a new cheque for the same instalment (same set and payee)',
  screen: `${S} > Replace`, middleware: [...write, validate(z.object(chequeBody))],
  request: { bankId: 3, chequeNumber: '2000000113', chequeDate: '2026-11-15' },
  response: { success: true, data: { replaced: { ...example, status: 'replaced' }, pdc: { ...example, pdcNumber: 'PDC-2026-00140' } }, message: 'Replacement cheque PDC-2026-00140 encoded in set PCS-2026-00031' },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => svc.replacePdc(db, req.params.id, req.body, req.user));
    await logCheque(req, r.replaced, 'replace', before, { replacedBy: r.pdc.pdcNumber });
    await logCheque(req, r.pdc, 'encode', null, { replaces: r.replaced.pdcNumber, chequeNumber: r.pdc.chequeNumber, amount: r.pdc.amount });
    created(res, r, r.message);
  },
});
define({
  method: 'POST', path: '/:id/return', summary: 'Return to client a cheque in the TIS vault (Received at TIS or Cancelled): date, returned to and reason',
  screen: `${S} > Return to client`, middleware: [...write, validate(z.object({ reason: z.string().min(1).max(500), returnedTo: z.string().max(120).optional().nullable(), returnedOn: date.optional() }))],
  request: { returnedOn: '2026-11-08', returnedTo: 'Andrea Villanueva', reason: 'Cancelled cheque handed back' }, response: { success: true, data: { ...example, status: 'returned' } },
  handler: async (req, res) => {
    const before = await svc.getPdc(pool, req.params.id);
    const r = await tx((db) => life.returnToClient(db, req.params.id, req.body, req.user));
    await logCheque(req, r.pdc, 'return', before, { returnedTo: r.pdc.returnedTo, reason: r.pdc.returnReason });
    ok(res, r.pdc, r.message);
  },
});

export default router;
export const mount = '/pdc';
