/**
 * Direct bill: the client's payment to the insurer.
 *
 * On a direct-bill policy the client pays the premium to the insurer, so nothing in the broker's books records it. The
 * broker still needs to know it happened: the insurer usually pays commission only on paid premium, and an unpaid policy
 * may be cancelled by the insurer. Finance records each payment the client made (date, amount, the insurer's official
 * receipt or reference, a proof such as the OR copy or deposit slip). Nothing is posted to the GL: the money never passes
 * through the broker.
 *
 * Payment status of a policy: paid against the premium billed by the insurer (sum of the direct-bill items booked for the
 * policy; the policy premium when none is booked yet): Unpaid, Partially paid or Paid.
 *
 * direct_bill.client_payment_required (none | any | full) makes the approval of a commission debit note wait until every
 * policy on it has a recorded payment (any) or is paid in full (full).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, num, round2, today } from '../accounting/lib/http.js';

export const PAYMENT_STATUS_LABELS = { unpaid: 'Unpaid', partial: 'Partially paid', paid: 'Paid' };
export const REQUIREMENTS = ['none', 'any', 'full'];
const EPS = 0.005;

const paymentOut = (x) => ({
  id: Number(x.id), policyId: x.policy_id, policyNo: x.policy_number || null, insurerId: x.insurance_company_id, insurerName: x.insurer_name || null,
  paymentDate: isoDate(x.payment_date), amount: Number(x.amount), insurerReference: x.insurer_reference, paymentMode: x.payment_mode,
  proofKey: x.proof_key, proofFileName: x.proof_file_name, remarks: x.remarks, status: x.status,
  createdBy: x.created_by_name || x.created_by, createdAt: x.created_at, voidedBy: x.voided_by_name || x.voided_by, voidedAt: x.voided_at, voidReason: x.void_reason,
});

const PAYMENT_SELECT = `SELECT x.*, p.policy_number, ic.name AS insurer_name,
    (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = x.voided_by) AS voided_by_name
  FROM direct_bill_client_payments x JOIN policies p ON p.id = x.policy_id LEFT JOIN insurance_companies ic ON ic.id = x.insurance_company_id`;

/**
 * Payment status of direct-bill policies: Map policyId -> { premium, paid, balance, status, statusLabel, lastPaymentDate,
 * lastReference, payments }.
 */
export async function clientPaymentStatus(db, policyIds) {
  const ids = [...new Set((policyIds || []).filter(Boolean).map(String))];
  const out = new Map();
  if (!ids.length) return out;
  const rows = (await db.query(`SELECT p.id,
      COALESCE((SELECT sum(it.gross_premium) FROM direct_bill_items it WHERE it.policy_id = p.id AND it.status <> 'cancelled'), p.premium_total, 0) AS premium,
      COALESCE((SELECT sum(x.amount) FROM direct_bill_client_payments x WHERE x.policy_id = p.id AND x.status = 'recorded'), 0) AS paid,
      (SELECT count(*)::int FROM direct_bill_client_payments x WHERE x.policy_id = p.id AND x.status = 'recorded') AS payments,
      (SELECT x.payment_date FROM direct_bill_client_payments x WHERE x.policy_id = p.id AND x.status = 'recorded' ORDER BY x.payment_date DESC, x.id DESC LIMIT 1) AS last_date,
      (SELECT x.insurer_reference FROM direct_bill_client_payments x WHERE x.policy_id = p.id AND x.status = 'recorded' ORDER BY x.payment_date DESC, x.id DESC LIMIT 1) AS last_ref
    FROM policies p WHERE p.id = ANY($1)`, [ids])).rows;
  for (const r of rows) {
    const premium = round2(r.premium);
    const paid = round2(r.paid);
    let status = 'unpaid';
    if (paid > EPS) status = paid >= premium - EPS ? 'paid' : 'partial';
    out.set(r.id, { premium, paid, balance: round2(Math.max(0, premium - paid)), status, statusLabel: PAYMENT_STATUS_LABELS[status],
      lastPaymentDate: isoDate(r.last_date), lastReference: r.last_ref, payments: r.payments });
  }
  return out;
}

/** Payments recorded on one policy (all statuses) with its payment status. */
export async function policyClientPayments(db, policyRef) {
  const p = (await db.query('SELECT id, policy_number, billing_mode FROM policies WHERE id = $1 OR policy_number = $1', [String(policyRef)])).rows[0];
  if (!p) throw notFound(`Policy ${policyRef} not found`);
  const rows = (await db.query(`${PAYMENT_SELECT} WHERE x.policy_id = $1 ORDER BY x.payment_date, x.id`, [p.id])).rows;
  return { policyId: p.id, policyNo: p.policy_number, billingMode: p.billing_mode, ...(await clientPaymentStatus(db, [p.id])).get(p.id), items: rows.map(paymentOut) };
}

/** Client payments across policies (filters: insurer, from / to payment date, status, search on policy / reference). */
export async function listClientPayments(db, qs = {}) {
  const conds = ['TRUE'];
  const vals = [];
  const add = (sql, v) => { vals.push(v); conds.push(sql.replaceAll('?', `$${vals.length}`)); };
  if (qs.insurerId || qs.insurerCode) add('(ic.id::text = ? OR ic.code = ?)', String(qs.insurerId ?? qs.insurerCode));
  if (isoDate(qs.from)) add('x.payment_date >= ?::date', isoDate(qs.from));
  if (isoDate(qs.to)) add('x.payment_date <= ?::date', isoDate(qs.to));
  if (qs.status && qs.status !== 'all') add('x.status = ?', String(qs.status));
  if (qs.search) add('(p.policy_number ILIKE \'%\' || ? || \'%\' OR x.insurer_reference ILIKE \'%\' || ? || \'%\')', String(qs.search));
  const rows = (await db.query(`${PAYMENT_SELECT} WHERE ${conds.join(' AND ')} ORDER BY x.payment_date DESC, x.id DESC LIMIT 500`, vals)).rows;
  return rows.map(paymentOut);
}

/** Record a payment the client made to the insurer on a direct-bill policy. */
export async function recordClientPayment(db, policyRef, b, user) {
  const p = (await db.query('SELECT id, policy_number, billing_mode, insurance_company_id, status FROM policies WHERE id = $1 OR policy_number = $1 FOR UPDATE', [String(policyRef)])).rows[0];
  if (!p) throw notFound(`Policy ${policyRef} not found`);
  if (p.billing_mode !== 'direct') throw conflict(`Policy ${p.policy_number} is broker billed: the client pays the broker, record the payment as a receipt`);
  const paymentDate = isoDate(b.paymentDate);
  if (!paymentDate) throw badRequest('Validation failed', [{ path: 'paymentDate', message: 'Payment date is required' }]);
  if (paymentDate > (await today())) throw badRequest('Validation failed', [{ path: 'paymentDate', message: 'The payment date cannot be in the future' }]);
  const amount = round2(num(b.amount));
  if (!(amount > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'Amount must be greater than zero' }]);
  const reference = String(b.insurerReference || '').trim();
  if (!reference) throw badRequest('Validation failed', [{ path: 'insurerReference', message: 'The insurer\'s official receipt or reference number is required' }]);
  const dup = (await db.query('SELECT 1 FROM direct_bill_client_payments WHERE policy_id = $1 AND lower(insurer_reference) = lower($2) AND status = \'recorded\'', [p.id, reference])).rows[0];
  if (dup) throw conflict(`Insurer reference ${reference} is already recorded on ${p.policy_number}`);
  const insurerId = b.insurerId ? Number(b.insurerId) : p.insurance_company_id;
  const r = (await db.query(`INSERT INTO direct_bill_client_payments(policy_id, insurance_company_id, payment_date, amount, insurer_reference, payment_mode, proof_key, proof_file_name, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [p.id, insurerId, paymentDate, amount, reference, b.paymentMode || null, b.proofKey || null, b.proofFileName || null,
    b.remarks || null, user?.id ?? null])).rows[0];
  return (await db.query(`${PAYMENT_SELECT} WHERE x.id = $1`, [r.id])).rows.map(paymentOut)[0];
}

/** Void a payment recorded in error (kept for the audit trail). */
export async function voidClientPayment(db, id, reason, user) {
  const x = (await db.query('SELECT * FROM direct_bill_client_payments WHERE id = $1 FOR UPDATE', [Number(id) || 0])).rows[0];
  if (!x) throw notFound('Client payment not found');
  if (x.status !== 'recorded') throw conflict('The payment is already voided');
  if (!String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required' }]);
  const before = paymentOut(x);
  await db.query('UPDATE direct_bill_client_payments SET status = \'voided\', voided_by = $2, voided_at = now(), void_reason = $3 WHERE id = $1', [x.id, user?.id ?? null, String(reason).trim()]);
  return { before, after: (await db.query(`${PAYMENT_SELECT} WHERE x.id = $1`, [x.id])).rows.map(paymentOut)[0] };
}

/** direct_bill.client_payment_required: none | any | full. */
export async function paymentRequirement() {
  const v = String((await getSetting('direct_bill.client_payment_required', 'none')) || 'none').toLowerCase();
  return REQUIREMENTS.includes(v) ? v : 'none';
}

/**
 * Before a commission debit note is approved: every policy on it must have a recorded client payment (any) or be paid
 * in full (full). Throws 409 naming the policies that do not meet the requirement.
 */
export async function assertClientPaid(db, debitNoteId, dnNumber) {
  const need = await paymentRequirement();
  if (need === 'none') return;
  const ids = (await db.query('SELECT DISTINCT policy_id FROM commission_debit_note_lines WHERE debit_note_id = $1 AND policy_id IS NOT NULL', [debitNoteId])).rows.map((r) => r.policy_id);
  const status = await clientPaymentStatus(db, ids);
  const numbers = new Map((await db.query('SELECT id, policy_number FROM policies WHERE id = ANY($1)', [ids])).rows.map((r) => [r.id, r.policy_number]));
  const missing = ids.filter((id) => {
    const s = status.get(id);
    return !s || (need === 'full' ? s.status !== 'paid' : s.status === 'unpaid');
  });
  if (missing.length) {
    const what = need === 'full' ? 'paid in full' : 'a recorded payment';
    throw conflict(`${dnNumber} cannot be approved: the client's payment to the insurer is not recorded for ${missing.map((id) => numbers.get(id) || id).join(', ')} (policies must have ${what})`);
  }
}
