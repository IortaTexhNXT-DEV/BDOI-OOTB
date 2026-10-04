/**
 * Policy premium payment capture (Policy > Payment screen).
 *
 * - "Pay later": nothing is posted; the receivable raised at issuance stays open.
 * - A payment (mode, reference, amount, date, optional proof) is recorded as a capture for finance to verify. It does
 *   not post a receipt or a journal unless the capturing user holds write:receipts (finance), in which case it is
 *   confirmed at once. Confirmation raises the official receipt through the receipts module (POST /receipts shape:
 *   receivableId + amount, balance enforced), which posts Dr Cash / Cr Premium Receivable.
 * - An online gateway is used only when policy.payment_gateway_url is configured; otherwise online payments are
 *   captured manually with their transaction reference like any other mode.
 */
import { hasPermission } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2, num, isoDate, today } from '../accounting/lib/http.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { oldBillNumber } from '../receipts/opening.js';

export const DEFAULT_MODES = ['bank-transfer', 'check', 'online', 'cash'];
const MODE_LABELS = { 'bank-transfer': 'Bank transfer', check: 'Cheque', online: 'Online payment', cash: 'Cash', card: 'Card', gcash: 'GCash' };
const NEEDS_REFERENCE = ['bank-transfer', 'check', 'online', 'card', 'gcash'];

export const canPostReceipts = (user) => hasPermission(user, 'write:receipts');

export const captureRow = (x) => ({
  id: x.id, arNumber: x.ar_number || null, policyId: x.policy_id, policyNumber: x.policy_number, receivableId: x.receivable_id, billNumber: x.bill_number,
  amount: Number(x.amount), paymentMode: x.payment_mode, paymentModeLabel: MODE_LABELS[x.payment_mode] || x.payment_mode, referenceNo: x.reference_no,
  paymentDate: isoDate(x.paid_on), proofKey: x.proof_key, proofFileName: x.proof_file_name, remarks: x.remarks, status: x.status,
  receiptId: x.receipt_id, receiptNumber: x.receipt_number || null, clientName: x.client_name || null, clientCode: x.client_code || null,
  submittedBy: x.submitted_by_name || x.submitted_by, submittedById: x.submitted_by, confirmedBy: x.confirmed_by_name || x.confirmed_by, confirmedAt: x.confirmed_at,
  rejectedAt: x.rejected_at, rejectReason: x.reject_reason, createdAt: x.created_at,
});

export const CAPTURE_SQL = `SELECT pp.*, p.policy_number, r.bill_number, rc.receipt_number, c.display_name AS client_name, c.client_code,
  (SELECT display_name FROM users WHERE id = pp.submitted_by) AS submitted_by_name, (SELECT display_name FROM users WHERE id = pp.confirmed_by) AS confirmed_by_name
  FROM policy_payments pp JOIN policies p ON p.id = pp.policy_id LEFT JOIN receivables r ON r.id = pp.receivable_id
  LEFT JOIN receipts rc ON rc.id = pp.receipt_id LEFT JOIN clients c ON c.id = p.client_id`;

export async function paymentSettings() {
  const modes = (await getSetting('policy.payment_capture_modes', DEFAULT_MODES)) || DEFAULT_MODES;
  const gatewayUrl = String((await getSetting('policy.payment_gateway_url', '')) || '');
  return { modes: modes.map((m) => ({ value: m, label: MODE_LABELS[m] || m, referenceRequired: NEEDS_REFERENCE.includes(m) })), gateway: { enabled: Boolean(gatewayUrl), url: gatewayUrl || null } };
}

/** Open bills of a policy (the receivable raised at issuance, endorsement bills ...). */
async function openReceivables(db, policyId) {
  return (await db.query(`SELECT * FROM receivables WHERE policy_id = $1 AND status IN ('open','partial') AND balance > 0 ORDER BY due_date, created_at`, [policyId])).rows;
}
const pendingOn = async (db, receivableId, exceptId = null) => Number((await db.query(`SELECT COALESCE(sum(amount),0) AS s FROM policy_payments
  WHERE receivable_id = $1 AND status = 'submitted' AND ($2::text IS NULL OR id <> $2)`, [receivableId, exceptId])).rows[0].s);

/** Payment screen payload: bills, captures, modes, gateway and whether the user may confirm. */
export async function paymentSummary(db, policy, user) {
  const bills = await openReceivables(db, policy.id);
  const captures = (await db.query(`${CAPTURE_SQL} WHERE pp.policy_id = $1 ORDER BY pp.created_at DESC`, [policy.id])).rows.map(captureRow);
  const out = [];
  for (const b of bills) {
    const pending = await pendingOn(db, b.id);
    out.push({ receivableId: b.id, billNumber: b.bill_number, oldBillNumber: oldBillNumber(b), source: b.source, amount: Number(b.amount), balance: Number(b.balance), pendingVerification: round2(pending), dueDate: b.due_date });
  }
  const direct = policy.billing_mode === 'direct';
  const { directBillSummary } = await import('../remittance/directbill.js');
  return { policyId: policy.id, policyNumber: policy.policy_number, paymentStatus: policy.payment_status, receivables: out,
    outstanding: round2(out.reduce((s, b) => s + b.balance, 0)), captures, ...(await paymentSettings()), canConfirm: canPostReceipts(user),
    // direct bill: the client pays the insurer; the broker collects only its commission from the insurer (debit note)
    billingMode: policy.billing_mode || 'broker', directBill: direct ? await directBillSummary(db, policy.id) : null };
}

async function setPolicyPaymentStatus(db, policyId, userId) {
  const r = (await db.query(`SELECT count(*)::int AS n, COALESCE(sum(amount),0) AS amt, COALESCE(sum(balance),0) AS bal FROM receivables WHERE policy_id = $1 AND status <> 'written-off'`, [policyId])).rows[0];
  const pending = Number((await db.query('SELECT count(*)::int AS n FROM policy_payments WHERE policy_id = $1 AND status = \'submitted\'', [policyId])).rows[0].n);
  let status = 'Pending';
  if (r.n > 0 && Number(r.bal) <= 0) status = 'Completed';
  else if (pending > 0) status = 'Reviewing';
  else if (r.n > 0 && Number(r.bal) < Number(r.amt)) status = 'Partial';
  const allowed = (await getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded'])) || [];
  if (!allowed.includes(status)) return;
  await db.query(`UPDATE policies SET payment_status = $2, paid_at = CASE WHEN $2 = 'Completed' THEN COALESCE(paid_at, now()) ELSE paid_at END, updated_by = $3, updated_at = now()
    WHERE id = $1`, [policyId, status, userId]);
}

async function confirm(db, capture, user) {
  const { createReceipt } = await import('../receipts/service.js');
  const receipt = await createReceipt(db, {
    receivableId: capture.receivable_id, amount: Number(capture.amount), paymentMode: capture.payment_mode, referenceNo: capture.reference_no || undefined,
    receiptDate: isoDate(capture.paid_on), remarks: capture.remarks || `Premium payment ${capture.reference_no || ''}`.trim(), transactionCode: 'PAYMENT',
  }, user, { source: 'policy-payment' });
  await db.query(`UPDATE policy_payments SET status = 'confirmed', receipt_id = $2, confirmed_by = $3, confirmed_at = now(), updated_at = now() WHERE id = $1`, [capture.id, receipt.receiptId, user.id]);
  return receipt;
}

/**
 * Record how the client pays. body: { option: 'pay-later' | 'payment', paymentMode, referenceNo, amount, paymentDate, proofKey, proofFileName, remarks, receivableId }.
 * Returns { option, capture, receipt, posted }.
 */
export async function capturePayment(db, policy, body, user) {
  if (policy.billing_mode === 'direct') throw conflict(`Policy ${policy.policy_number} is direct billed: the client pays the premium to the insurer, not to the broker`);
  if (body.option === 'pay-later') {
    await db.query('UPDATE policies SET payment_method = $2, updated_by = $3, updated_at = now() WHERE id = $1', [policy.id, 'Pay later', user.id]);
    await setPolicyPaymentStatus(db, policy.id, user.id);
    return { option: 'pay-later', capture: null, receipt: null, posted: false };
  }
  const { modes } = await paymentSettings();
  const mode = String(body.paymentMode || '').toLowerCase();
  const modeDef = modes.find((m) => m.value === mode);
  if (!modeDef) throw badRequest(`paymentMode must be one of ${modes.map((m) => m.value).join(', ')}`);
  const reference = String(body.referenceNo || '').trim();
  if (modeDef.referenceRequired && !reference) throw badRequest(`A reference number is required for ${modeDef.label} (bank / cheque / transaction reference)`);
  const amount = round2(num(body.amount));
  if (!(amount > 0)) throw badRequest('Amount paid must be greater than zero');
  const paidOn = isoDate(body.paymentDate);
  if (!paidOn) throw badRequest('Payment date is required');
  if (paidOn > (await today())) throw badRequest('Payment date cannot be in the future');
  const bills = await openReceivables(db, policy.id);
  const bill = body.receivableId ? bills.find((b) => b.id === body.receivableId || b.bill_number === body.receivableId) : bills[0];
  if (!bill) throw conflict(body.receivableId ? 'That bill is not open for payment' : `Policy ${policy.policy_number} has no open bill to pay`);
  // lock the bill so concurrent captures cannot exceed it
  await db.query('SELECT id FROM receivables WHERE id = $1 FOR UPDATE', [bill.id]);
  const available = round2(Number(bill.balance) - (await pendingOn(db, bill.id)));
  if (amount > available) throw badRequest(`Amount ${amount.toFixed(2)} exceeds what remains to be paid on bill ${bill.bill_number} (${available.toFixed(2)}${available < Number(bill.balance) ? ' after payments awaiting verification' : ''})`);
  const arNumber = await nextDocumentNumber('acknowledgement_receipt', { db, unique: { table: 'policy_payments', column: 'ar_number' } });
  const c = (await db.query(`INSERT INTO policy_payments(policy_id, receivable_id, amount, payment_mode, reference_no, paid_on, proof_key, proof_file_name, remarks, submitted_by, ar_number)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [policy.id, bill.id, amount, mode, reference || null, paidOn, body.proofKey || null, body.proofFileName || null, body.remarks || null, user.id, arNumber])).rows[0];
  await db.query('UPDATE policies SET payment_method = $2, updated_at = now() WHERE id = $1', [policy.id, modeDef.label]);
  let receipt = null;
  if (canPostReceipts(user)) receipt = await confirm(db, c, user);
  await setPolicyPaymentStatus(db, policy.id, user.id);
  const row = (await db.query(`${CAPTURE_SQL} WHERE pp.id = $1`, [c.id])).rows[0];
  return { option: 'payment', capture: captureRow(row), receipt, posted: Boolean(receipt) };
}

async function lockCapture(db, policyId, id) {
  const c = (await db.query('SELECT * FROM policy_payments WHERE id = $1 AND policy_id = $2 FOR UPDATE', [id, policyId])).rows[0];
  if (!c) throw notFound('Payment not found');
  if (c.status !== 'submitted') throw conflict(`Payment is already ${c.status}`);
  return c;
}

/** Finance verifies a captured payment: official receipt + journal through the receipts module. */
export async function confirmCapture(db, policy, id, user) {
  const c = await lockCapture(db, policy.id, id);
  const receipt = await confirm(db, c, user);
  await setPolicyPaymentStatus(db, policy.id, user.id);
  return { capture: captureRow((await db.query(`${CAPTURE_SQL} WHERE pp.id = $1`, [id])).rows[0]), receipt };
}

export async function rejectCapture(db, policy, id, reason, user) {
  const c = await lockCapture(db, policy.id, id);
  await db.query(`UPDATE policy_payments SET status = 'rejected', rejected_by = $2, rejected_at = now(), reject_reason = $3, updated_at = now() WHERE id = $1`, [c.id, user.id, reason]);
  await setPolicyPaymentStatus(db, policy.id, user.id);
  return { capture: captureRow((await db.query(`${CAPTURE_SQL} WHERE pp.id = $1`, [id])).rows[0]) };
}

/** Captures awaiting (or past) verification, for finance. */
export async function listCaptures(db, q = {}) {
  const status = q.status || 'submitted';
  const rows = (await db.query(`${CAPTURE_SQL} WHERE ($1 = 'all' OR pp.status = $1) ORDER BY pp.created_at DESC LIMIT 500`, [status])).rows;
  return rows.map(captureRow);
}

/**
 * A captured payment with what its acknowledgement receipt prints (client, policy, bill, received by). Payments
 * recorded before acknowledgement receipts were numbered get their AR number on the first print.
 */
export async function captureForReceipt(db, id) {
  let row = (await db.query(`${CAPTURE_SQL} WHERE pp.id = $1 OR pp.ar_number = $1`, [id])).rows[0];
  if (!row) throw notFound('Payment not found');
  if (!row.ar_number) {
    const n = await nextDocumentNumber('acknowledgement_receipt', { db, unique: { table: 'policy_payments', column: 'ar_number' } });
    await db.query('UPDATE policy_payments SET ar_number = $2 WHERE id = $1 AND ar_number IS NULL', [row.id, n]);
    row = (await db.query(`${CAPTURE_SQL} WHERE pp.id = $1`, [row.id])).rows[0];
  }
  const client = (await db.query(`SELECT c.display_name, c.client_code, c.tin, c.address, c.city, c.state FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.id = $1`, [row.policy_id])).rows[0] || {};
  return { ...captureRow(row), client, policyId: row.policy_id };
}
