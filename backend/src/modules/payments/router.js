import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { notFound } from '../../lib/errors.js';
import { pageParams, sendList } from '../accounting/lib/http.js';
import * as svc from './service.js';
import * as pc from './pettycash.js';
import { today } from '../../lib/dates.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { pettyCashVoucherDoc } from '../documents/finance.js';

// ---------- Payments (agent) ----------
const pay = moduleRouter('Payments', '/payments');
const payRead = [requireAuth, requirePermission('read:receipts', 'read:policies')];
const payment = { id: 'rcv_1', billNumber: 'INV-2026-00001', grossPremium: 11862.5, paidAmount: 11862.5, outstanding: 0, clientId: 'CL-2026-00001', clientName: 'Maria Santos', date: '2026-09-28', policyNumber: 'POL-2026-00001', insurer: 'Malayan Insurance Co., Inc.', product: 'Motor Vehicle Insurance', status: 'PAID', paymentMethod: 'gcash', referenceNumber: 'OR-2026-00001', commission: 1500 };
pay.define({
  method: 'GET', path: '/', summary: 'Premium payment status per bill: PAID, PENDING (unpaid), REVIEWING (partially paid); roles without the payments overview (e.g. Claims) see only the policies they own', screen: 'Agent > Payments',
  middleware: payRead, query: { status: 'PENDING', search: 'Santos', page: 1, pageSize: 10 },
  response: { success: true, data: [payment], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, summary: { paid: { count: 1, grossPremium: 11862.5, outstanding: 0 }, pending: { count: 0 }, reviewing: { count: 0 } } },
  handler: async (req, res) => { const pg = pageParams(req.query); const r = await svc.listPayments(pool, req.query, pg, req.user); sendList(res, r.rows, r.total, pg, { summary: r.summary }); },
});
pay.define({
  method: 'GET', path: '/:id', summary: 'One bill with its payments', screen: 'Agent > Payments > Detail', middleware: payRead,
  response: { success: true, data: { ...payment, payments: [{ amount: 11862.5, paymentMethod: 'gcash', receiptNumber: 'OR-2026-00001', date: '2026-09-28T02:00:00Z' }] } },
  handler: async (req, res) => ok(res, await svc.getPayment(pool, req.params.id, req.user)),
});

// ---------- Open Items (agent) ----------
const oi = moduleRouter('Open Items', '/open-items');
const oiRead = [requireAuth, requirePermission('read:policies', 'read:quotations', 'read:receipts')];
oi.define({
  method: 'GET', path: '/', summary: 'Open items: pending payments, renewal requests, pending quotes, expiring policies (filter type, search)', screen: 'Agent > Open Items',
  middleware: oiRead, query: { type: 'payment', search: 'Santos' },
  response: { success: true, data: { summary: [{ type: 'payment', status: 'Pending Payments', count: 3 }], items: [{ id: 'rcv_1', type: 'payment', status: 'Pending Payments', name: 'Maria Santos', clientId: 'CL-2026-00001', policyNo: 'POL-2026-00001', amount: '₱11,862.50', dueDate: '2026-10-15', insurer: 'Malayan Insurance Co., Inc.' }] } },
  handler: async (req, res) => ok(res, await svc.openItems(pool, req.query, req.user)),
});
oi.define({
  method: 'GET', path: '/events', summary: 'Upcoming events of the signed-in user', screen: 'Agent > Open Items > Upcoming events', middleware: [requireAuth],
  query: { from: '2026-09-28' }, response: { success: true, data: [{ id: 'evt_1', date: '2026-10-01', description: 'Policy review with client', from: '10:00', to: '11:00' }] },
  handler: async (req, res) => {
    const rows = (await pool.query('SELECT * FROM agent_events WHERE user_id = $1 AND status = \'active\' AND event_date >= COALESCE($2::date, $3::date) ORDER BY event_date, start_time LIMIT 200', [req.user.id, req.query.from || null, await today()])).rows;
    ok(res, rows.map(svc.eventRow));
  },
});
oi.define({
  method: 'POST', path: '/events', summary: 'Add an event to the signed-in user\'s calendar', screen: 'Agent > Open Items > Upcoming events', middleware: [requireAuth,
    validate(z.object({ date: z.coerce.date(), notes: z.string().min(1), startTime: z.string().optional(), endTime: z.string().optional(), entity: z.string().optional(), entityId: z.string().optional() }))],
  request: { date: '2026-10-01', notes: 'Policy review with client', startTime: '10:00', endTime: '11:00' }, response: { success: true, data: { id: 'evt_1', date: '2026-10-01', description: 'Policy review with client', from: '10:00', to: '11:00' } },
  handler: async (req, res) => {
    const e = (await pool.query('INSERT INTO agent_events(user_id, event_date, start_time, end_time, description, entity, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.id, req.body.date.toISOString().slice(0, 10), req.body.startTime || null, req.body.endTime || null, req.body.notes, req.body.entity || null, req.body.entityId || null])).rows[0];
    await audit(req, { entity: 'agent_event', entityId: e.id, action: 'create', after: req.body });
    created(res, svc.eventRow(e));
  },
});
oi.define({
  method: 'DELETE', path: '/events/:id', summary: 'Remove one of the signed-in user\'s events', screen: 'Agent > Open Items > Upcoming events', middleware: [requireAuth], response: { success: true },
  handler: async (req, res) => {
    const r = await pool.query('UPDATE agent_events SET status = \'deleted\' WHERE id = $1 AND user_id = $2 AND status = \'active\' RETURNING id', [req.params.id, req.user.id]);
    if (!r.rowCount) throw notFound('Event not found');
    await audit(req, { entity: 'agent_event', entityId: req.params.id, action: 'delete' });
    ok(res, { id: req.params.id }, 'Event removed');
  },
});

// ---------- Petty cash ----------
const pcr = moduleRouter('Petty Cash', '/petty-cash');
const pcRead = [requireAuth, requirePermission('read:disbursements')];
const pcWrite = [requireAuth, requirePermission('write:disbursements')];
const S = 'Accounts > Petty Cash';
const KINDS = { funds: ['Initiate', pc.fundRow], requests: ['Request', null], disbursements: ['Disbursement', pc.disbursementRow], receipts: ['Receipts', pc.receiptRow], replenishments: ['Replenish', pc.replenishRow] };
const moneyish = z.union([z.number(), z.string()]);
const SCHEMAS = {
  funds: z.object({ code: z.string().min(2).optional(), description: z.string().optional(), fundSize: moneyish, maxLimit: moneyish.optional(), minimumCashbox: moneyish.optional(), bankCode: z.string().optional(),
    bankAccountCode: z.string().optional(), mainAccountCode: z.string().optional(), subAccountCode: z.string().optional(), currency: z.string().optional(), branchCode: z.string().optional(),
    departmentCode: z.string().optional(), custodianUserId: z.string().optional(), transactionDate: z.string().optional() }).passthrough(),
  requests: z.object({ fundId: z.string().optional(), pettyCashCode: z.string().optional(), requesterName: z.string().min(2), requestDate: z.string().optional(), departmentCode: z.string().optional(),
    branchCode: z.string().optional(), purpose: z.string().optional(), submit: z.boolean().optional(), lines: z.array(z.object({ narration: z.string().min(1), amount: moneyish, expenseAccount: z.string().optional() })).min(1) }).passthrough(),
  disbursements: z.object({ fundId: z.string().optional(), pettyCashCode: z.string().optional(), requestId: z.string().optional(), expenseAccount: z.string().min(3), amount: moneyish,
    vat: moneyish.optional(), wht: moneyish.optional(), criteria: z.string().optional(), transactionCode: z.string().optional(), remarks: z.string().optional(), date: z.string().optional() }).passthrough(),
  receipts: z.object({ fundId: z.string().optional(), pettyCashCode: z.string().optional(), amount: moneyish, requesterName: z.string().optional(), creditAccount: z.string().optional(),
    subAccountCode: z.string().optional(), branchCode: z.string().optional(), bankCode: z.string().optional(), transactionCode: z.string().optional(), remarks: z.string().optional(), date: z.string().optional() }).passthrough(),
  replenishments: z.object({ fundId: z.string().optional(), pettyCashCode: z.string().optional(), amount: moneyish.optional(), branchCode: z.string().optional(), bankCode: z.string().optional(),
    subAccountCode: z.string().optional(), transactionCode: z.string().optional(), remarks: z.string().optional(), date: z.string().optional() }).passthrough(),
};
const CREATE = { funds: pc.createFund, requests: pc.createRequest, disbursements: pc.createDisbursement, receipts: pc.createReceipt, replenishments: pc.createReplenishment };
const EXAMPLES = {
  funds: { code: 'PCF-MKT', description: 'Makati office petty cash', fundSize: 20000, maxLimit: 5000, minimumCashbox: 3000, branchCode: 'PHP', departmentCode: 'FI' },
  requests: { pettyCashCode: 'PCF-MKT', requesterName: 'Ana Reyes', purpose: 'Courier and supplies', lines: [{ narration: 'LBC courier', amount: 450, expenseAccount: '4401001' }], submit: true },
  disbursements: { pettyCashCode: 'PCF-MKT', requestId: 'PCR-2026-00001', expenseAccount: '4401001', amount: 450, vat: 48.21, wht: 0, remarks: 'LBC courier' },
  receipts: { pettyCashCode: 'PCF-MKT', amount: 200, requesterName: 'Ana Reyes', remarks: 'Unused cash advance returned' },
  replenishments: { pettyCashCode: 'PCF-MKT', remarks: 'Weekly replenishment' },
};
for (const [kind, [label, row]] of Object.entries(KINDS)) {
  pcr.define({
    method: 'GET', path: `/${kind}`, summary: `Petty cash ${kind} (search, fundId / pettyCashCode, status; paging)`, screen: `${S} > ${label}`, middleware: pcRead, query: { search: 'PCF', page: 1, pageSize: 10 },
    response: { success: true, data: [EXAMPLES[kind]], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
    handler: async (req, res) => { const pg = pageParams(req.query); const r = await pc.list(pool, kind, req.query, pg); sendList(res, r.rows, r.total, pg); },
  });
  pcr.define({
    method: 'GET', path: `/${kind}/:id`, summary: `One petty cash ${kind.slice(0, -1)} (id or number)`, screen: `${S} > ${label} > View`, middleware: pcRead, response: { success: true, data: EXAMPLES[kind] },
    handler: async (req, res) => ok(res, await pc.getOne(pool, kind, req.params.id)),
  });
  pcr.define({
    method: 'POST', path: `/${kind}`, summary: `Create a petty cash ${kind.slice(0, -1)}${{ requests: '', funds: ' (waits for approval by another user, then posts its journal)' }[kind] ?? ' (posts its journal)'}`, screen: `${S} > ${label} > Add`,
    middleware: [...pcWrite, validate(SCHEMAS[kind])], request: EXAMPLES[kind], response: { success: true, data: EXAMPLES[kind] },
    handler: async (req, res) => {
      const r = await withTransaction((db) => CREATE[kind](db, req.body, req.user));
      const data = row ? row(r) : r;
      await audit(req, { entity: `petty_cash_${kind.slice(0, -1)}`, entityId: data.id, action: 'create', after: data });
      created(res, kind === 'funds' || kind === 'requests' ? data : await pc.getOne(pool, kind, data.id));
    },
  });
}
pcr.define({
  method: 'PUT', path: '/funds/:id', summary: 'Update fund limits / custodian / status', screen: `${S} > Initiate > Edit`, middleware: [...pcWrite, validate(SCHEMAS.funds.partial())],
  request: { maxLimit: 6000 }, response: { success: true, data: EXAMPLES.funds },
  handler: async (req, res) => {
    const before = await pc.getOne(pool, 'funds', req.params.id);
    const f = await withTransaction((db) => pc.updateFund(db, req.params.id, req.body));
    await audit(req, { entity: 'petty_cash_fund', entityId: f.id, action: 'update', before, after: pc.fundRow(f) });
    ok(res, pc.fundRow(f));
  },
});
pcr.define({
  method: 'PUT', path: '/requests/:id', summary: 'Edit a draft / rejected request (lines replace existing)', screen: `${S} > Request > Edit`, middleware: [...pcWrite, validate(SCHEMAS.requests.partial())],
  request: { purpose: 'Courier, supplies and snacks', lines: [{ narration: 'LBC courier', amount: 450 }, { narration: 'Bond paper', amount: 320 }] }, response: { success: true, data: EXAMPLES.requests },
  handler: async (req, res) => {
    const before = await pc.getRequest(pool, req.params.id);
    const r = await withTransaction((db) => pc.updateRequest(db, req.params.id, req.body));
    await audit(req, { entity: 'petty_cash_request', entityId: r.id, action: 'update', before, after: r });
    ok(res, r);
  },
});
for (const action of ['approve', 'reject']) {
  pcr.define({
    method: 'POST', path: `/funds/:id/${action}`, summary: `${action === 'approve' ? 'Approve (establish: posts its journal)' : 'Reject'} a fund waiting for approval (approver must differ from its initiator)`,
    screen: `${S} > Initiate`, middleware: [...pcWrite, validate(action === 'reject' ? z.object({ reason: z.string().min(3) }) : z.object({}).passthrough())],
    request: action === 'reject' ? { reason: 'Fund size not agreed' } : {}, response: { success: true, data: { ...EXAMPLES.funds, status: action === 'approve' ? 'active' : 'rejected' } },
    handler: async (req, res) => {
      const f = await withTransaction((db) => pc.decideFund(db, req.params.id, action, req.user, req.body.reason));
      await audit(req, { entity: 'petty_cash_fund', entityId: f.id, action, after: { status: f.status, reason: req.body.reason } });
      ok(res, pc.fundRow(f), action === 'approve' ? 'Petty cash fund established' : 'Petty cash fund rejected');
    },
  });
}
for (const action of ['submit', 'approve', 'reject']) {
  pcr.define({
    method: 'POST', path: `/requests/:id/${action}`, summary: action === 'submit' ? 'Submit a request for approval' : `${action === 'approve' ? 'Approve' : 'Reject'} a submitted request (approver must differ from requester)`,
    screen: `${S} > Request`, middleware: [...pcWrite, validate(action === 'reject' ? z.object({ reason: z.string().min(3) }) : z.object({}).passthrough())],
    request: action === 'reject' ? { reason: 'Not a petty cash expense' } : {}, response: { success: true, data: { ...EXAMPLES.requests, status: { submit: 'submitted', approve: 'approved', reject: 'rejected' }[action] } },
    handler: async (req, res) => {
      const r = await withTransaction((db) => pc.transitionRequest(db, req.params.id, action, req.user, req.body.reason));
      await audit(req, { entity: 'petty_cash_request', entityId: r.id, action, after: { status: r.status, reason: req.body.reason } });
      ok(res, r, `Request ${r.status}`);
    },
  });
}
pcr.define({
  method: 'GET', path: '/disbursements/:id/pdf', summary: 'Printable petty cash voucher (PDF, broker letterhead; prepared, approved and received by blocks)',
  screen: `${S} > Disbursement > View > Print`, middleware: pcRead, query: { download: 1 }, response: '(application/pdf)',
  handler: async (req, res) => {
    const d = await pc.getOne(pool, 'disbursements', req.params.id);
    // the fund, the requester and who prepared and approved the request, for the voucher's header and signature blocks
    const extra = (await pool.query(`SELECT f.description AS fund_description, r.requester_name, COALESCE(cu.display_name, cu.username) AS created_by_name,
        COALESCE(au.display_name, au.username) AS approved_by_name
      FROM petty_cash_disbursements x JOIN petty_cash_funds f ON f.id = x.fund_id LEFT JOIN petty_cash_requests r ON r.id = x.request_id
      LEFT JOIN users cu ON cu.id = x.created_by LEFT JOIN users au ON au.id = r.approved_by WHERE x.id = $1`, [d.id])).rows[0] || {};
    const pdf = buildPdf(await pettyCashVoucherDoc({ ...d, fundDescription: extra.fund_description, requesterName: extra.requester_name,
      createdByName: extra.created_by_name, approvedByName: extra.approved_by_name }));
    sendPdf(res, pdf, `petty-cash-voucher-${d.transactionNumber || d.id}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
for (const kind of ['disbursements', 'receipts', 'replenishments']) {
  pcr.define({
    method: 'POST', path: `/${kind}/:id/reverse`, summary: `Reverse a petty cash ${kind.slice(0, -1)} entered in error (mirror journal, fund cash restored)`,
    screen: `${S} > ${KINDS[kind][0]}`, middleware: [...pcWrite, validate(z.object({ reason: z.string().optional() }).passthrough())],
    request: { reason: 'Entered twice' }, response: { success: true, data: { id: 'pcd_1', number: 'PC-2026-00012', status: 'reversed', reversalJournalId: 'jv_2', availableCash: 20000 } },
    handler: async (req, res) => {
      const r = await withTransaction((db) => pc.reverseEntry(db, kind, req.params.id, req.user, req.body?.reason || null));
      await audit(req, { entity: `petty_cash_${kind.slice(0, -1)}`, entityId: r.id, action: 'reverse', after: { ...r, reason: req.body?.reason || null } });
      ok(res, r, `${r.number} reversed`);
    },
  });
}

export default pay.router;
export const mount = '/payments';
export const extraMounts = [['/open-items', oi.router], ['/petty-cash', pcr.router]];
