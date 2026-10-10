/**
 * Post-dated cheque log (Accounts > Post-Dated Cheques).
 *
 * Every cheque received from a client against a bill is on the log with its drawee bank, number, date, amount, payee,
 * custody and status; nothing is posted while a cheque is held. Cheques payable to TISPH are deposited on or after
 * their date to the one collection account (pdc.default_deposit_account): the receipt is created through the receipts
 * module (receivable credited, posting rule receipt.apply). The bank's answer is recorded: cleared, or bounced, which
 * cancels that receipt (its journal is reversed and the bill is open again), tells Cash Control and, with
 * pdc.notify_client_on_bounce, the client. Sets, forwarding to the Insurance Partner, maturity advices and
 * cancellations are in lifecycle.js. A cheque not settled is aged on its date (limits.receivable_ageing_buckets).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { formatMoney, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { notify } from '../notifications/service.js';
import { emailTemplate, renderTemplate } from '../documents/common.js';
import { createReceipt, cancelReceipt } from '../receipts/service.js';

const EPS = 0.005;
/** Statuses a cheque is still alive in (counted against the bill and the instalment). */
export const LIVE = ['on-hand', 'forwarded', 'warehoused', 'deposited', 'cancellation-pending'];
/** Statuses that settle a cheque: no ageing, and a set is closed when all its cheques are in one of them. */
export const SETTLED = ['cleared', 'cancelled', 'replaced', 'returned'];
export const PAYEES = ['insurance-partner', 'tisph'];
export const STATUS_TEXT = { 'on-hand': 'Received at TIS', forwarded: 'Forwarded', warehoused: 'Warehoused', deposited: 'Deposited', cleared: 'Cleared', bounced: 'Bounced',
  replaced: 'Replaced', 'cancellation-pending': 'Cancellation pending', cancelled: 'Cancelled', returned: 'Returned' };
export const PAYEE_TEXT = { 'insurance-partner': 'Insurance Partner', tisph: 'TISPH' };
/** Tabs of the log: the statuses each one lists ('awaiting', 'follow-up' and 'deposit-due' are computed). */
export const TABS = {
  open: ['on-hand', 'forwarded', 'warehoused', 'deposited', 'bounced', 'cancellation-pending'], 'at-tis': ['on-hand'], 'with-partners': ['forwarded', 'warehoused'],
  bounced: ['bounced'], 'cancellation-pending': ['cancellation-pending'], closed: SETTLED,
};

const SELECT = `SELECT d.*, c.display_name AS client_name, c.client_code, c.email AS client_email, p.policy_number, r.bill_number, r.balance AS bill_balance,
  b.name AS bank_name, rc.receipt_number, rc.receipt_status, s.set_number, t.transmittal_number, pt.transmittal_number AS pullout_transmittal_number, ic.name AS insurer_name,
  (SELECT u.display_name FROM users u WHERE u.id = d.created_by) AS created_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = d.cancel_requested_by) AS cancel_requested_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = d.cancel_approved_by) AS cancel_approved_by_name,
  (SELECT u.display_name FROM users u WHERE u.id = d.cancelled_by) AS cancelled_by_name,
  (SELECT m.name FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = d.cancel_reason_code) AS cancel_reason_name,
  (SELECT x.pdc_number FROM post_dated_cheques x WHERE x.id = d.replaced_by_id) AS replaced_by_number,
  (SELECT x.pdc_number FROM post_dated_cheques x WHERE x.id = d.replaces_id) AS replaces_number
  FROM post_dated_cheques d LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN policies p ON p.id = d.policy_id LEFT JOIN receivables r ON r.id = d.receivable_id
  LEFT JOIN banks b ON b.id = d.bank_id LEFT JOIN receipts rc ON rc.id = d.receipt_id LEFT JOIN pdc_sets s ON s.id = d.set_id
  LEFT JOIN pdc_transmittals t ON t.id = d.transmittal_id LEFT JOIN pdc_transmittals pt ON pt.id = d.pullout_transmittal_id
  LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id`;

/**
 * Ageing bucket of a cheque on `asOf` (FR-PDC-021): none once settled, current before its date, then the buckets of
 * limits.receivable_ageing_buckets (1-30, 31-60, 61-90, over 90 by default).
 */
export function ageingOf(status, chequeDate, asOf, buckets = [30, 60, 90]) {
  if (!asOf || SETTLED.includes(status)) return null;
  const days = Math.round((Date.parse(asOf) - Date.parse(chequeDate)) / 86400000);
  if (days <= 0) return { code: 'current', label: 'Current', days };
  const [a, b, c] = buckets.map(Number);
  if (days <= a) return { code: 'b1', label: `1-${a}`, days };
  if (days <= b) return { code: 'b2', label: `${a + 1}-${b}`, days };
  if (days <= c) return { code: 'b3', label: `${b + 1}-${c}`, days };
  return { code: 'b4', label: `Over ${c}`, days };
}
const buckets = async () => ((await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90, 120]).map(Number);

/** Where the cheque is, in words: the vault folder, the partner, in transit, returned. */
function custodyText(r) {
  if (r.custody === 'partner') return r.insurer_name || 'Insurance Partner';
  if (r.custody === 'in-transit') return `In transit to ${r.insurer_name || 'the Insurance Partner'}`;
  if (r.custody === 'returned') return 'Returned to client';
  return r.storage_location ? `TIS vault, ${r.storage_location}` : 'TIS vault';
}

const out = (r, asOf, bucketDays) => r && ({
  id: r.id, pdcNumber: r.pdc_number, setId: r.set_id, setNumber: r.set_number || null, clientId: r.client_id, clientCode: r.client_code || null, clientName: r.client_name || null,
  policyId: r.policy_id, policyNumber: r.policy_number || null, receivableId: r.receivable_id, billNumber: r.bill_number || null,
  billBalance: r.bill_balance === null || r.bill_balance === undefined ? null : Number(r.bill_balance),
  instalmentSeq: r.instalment_seq, instalmentCount: r.instalment_count, instalmentDueDate: isoDate(r.instalment_due_date),
  instalmentText: r.instalment_seq ? `${r.instalment_seq} of ${r.instalment_count || r.instalment_seq}` : null,
  payee: r.payee, payeeText: PAYEE_TEXT[r.payee] || r.payee, insurerId: r.insurance_company_id, insurerName: r.insurer_name || null,
  bankId: r.bank_id, bankName: r.bank_name || r.drawee_bank || null, draweeBank: r.drawee_bank, branch: r.branch, accountNumber: r.account_number, brstn: r.brstn,
  chequeNumber: r.cheque_number, chequeDate: isoDate(r.cheque_date), amount: Number(r.amount), receivedDate: isoDate(r.received_date), storageLocation: r.storage_location,
  custody: r.custody, custodyText: custodyText(r), status: r.status, statusText: STATUS_TEXT[r.status] || r.status,
  ageing: ageingOf(r.status, isoDate(r.cheque_date), asOf, bucketDays),
  dueInDays: asOf && ['on-hand', 'forwarded', 'warehoused'].includes(r.status) ? Math.round((Date.parse(isoDate(r.cheque_date)) - Date.parse(asOf)) / 86400000) : null,
  transmittalId: r.transmittal_id, transmittalNumber: r.transmittal_number || null, forwardedOn: isoDate(r.forwarded_on), warehousedOn: isoDate(r.warehoused_on),
  partnerReceivedBy: r.partner_received_by, partnerReceiptReference: r.partner_receipt_reference, collectedOn: isoDate(r.collected_on), partnerReference: r.partner_reference,
  depositAccount: r.deposit_account, depositedOn: isoDate(r.deposited_on), receiptId: r.receipt_id, receiptNumber: r.receipt_number || null,
  receiptCancelled: r.receipt_status === 'Cancelled', clearedOn: isoDate(r.cleared_on),
  bouncedOn: isoDate(r.bounced_on), bounceReason: r.bounce_reason, bounceReasonCode: r.bounce_reason_code, bounceCharge: Number(r.bounce_charge),
  cancellation: r.cancel_reason_code ? {
    reasonCode: r.cancel_reason_code, reason: r.cancel_reason_name || r.cancel_reason_code, remarks: r.cancel_remarks, replacementFollows: r.replacement_follows,
    requestedBy: r.cancel_requested_by_name || r.cancel_requested_by, requestedById: r.cancel_requested_by, requestedAt: r.cancel_requested_at, priorStatus: r.cancel_prior_status,
    approvedBy: r.cancel_approved_by_name || r.cancel_approved_by, approvedAt: r.cancel_approved_at, pullOutRequested: r.status === 'cancellation-pending' && !!r.cancel_approved_at,
    pullOutTransmittalNumber: r.pullout_transmittal_number || null, cancelledOn: isoDate(r.cancelled_on), cancelledBy: r.cancelled_by_name || r.cancelled_by,
  } : null,
  replacesId: r.replaces_id, replacesNumber: r.replaces_number || null, replacedById: r.replaced_by_id, replacedByNumber: r.replaced_by_number || null,
  returnedOn: isoDate(r.returned_on), returnReason: r.return_reason, returnedTo: r.returned_to, remarks: r.remarks,
  createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function getPdc(db, ref) {
  const r = (await db.query(`${SELECT} WHERE d.id = $1 OR d.pdc_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Post-dated cheque not found');
  return out(r, await today(), await buckets());
}

/** Rows of a tab. awaiting: with the partner and past the cheque date; deposit-due: retained cheques on hand within the window. */
async function tabWhere(tab, asOf, add, where) {
  if (tab === 'awaiting') add("d.status IN ('forwarded', 'warehoused') AND d.cheque_date < ?::date", asOf);
  else if (tab === 'deposit-due') {
    const window = Number(await getSetting('pdc.due_window_days', 3)) || 0;
    add("d.status = 'on-hand' AND d.payee = 'tisph' AND d.cheque_date <= ?::date", addDays(asOf, window));
  } else if (TABS[tab]) add('d.status = ANY(?)', TABS[tab]);
  else if (tab && tab !== 'all') add('d.status = ?', tab);
  return where;
}

/**
 * The log (FR-PDC-020): tab or status (open | at-tis | with-partners | awaiting | bounced | cancellation-pending | closed
 * | deposit-due | all, or a status), insurerId, payee, chequeFrom / chequeTo, receivedFrom / receivedTo, dueBy, clientId,
 * policyId, setId, search. Sorted by cheque date then PDC no. Returns { asOf, summary, counts, ageing, rows }.
 */
export async function listPdcs(db, q = {}) {
  const asOf = await today();
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  await tabWhere(q.tab || q.status, asOf, add, where);
  if (q.insurerId) add('d.insurance_company_id::text = ?', String(q.insurerId));
  if (q.payee) add('d.payee = ?', q.payee);
  if (q.chequeFrom) add('d.cheque_date >= ?::date', isoDate(q.chequeFrom));
  if (q.chequeTo) add('d.cheque_date <= ?::date', isoDate(q.chequeTo));
  if (q.receivedFrom) add('d.received_date >= ?::date', isoDate(q.receivedFrom));
  if (q.receivedTo) add('d.received_date <= ?::date', isoDate(q.receivedTo));
  if (q.dueBy) add("d.status = 'on-hand' AND d.cheque_date <= ?::date", isoDate(q.dueBy));
  if (q.clientId) add('(d.client_id = ? OR c.client_code = ?)', q.clientId);
  if (q.policyId) add('(d.policy_id = ? OR p.policy_number = ?)', q.policyId);
  if (q.setId) add('(d.set_id = ? OR s.set_number = ?)', q.setId);
  if (q.search) add(`(d.pdc_number ILIKE '%' || ? || '%' OR d.cheque_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR p.policy_number ILIKE '%' || ? || '%'
    OR r.bill_number ILIKE '%' || ? || '%' OR s.set_number ILIKE '%' || ? || '%')`, q.search);
  const bucketDays = await buckets();
  const rows = (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.cheque_date, d.pdc_number LIMIT 2000`, params)).rows.map((r) => out(r, asOf, bucketDays));
  const s = (await db.query(`SELECT
      count(*) FILTER (WHERE status = 'on-hand')::int AS at_tis, COALESCE(sum(amount) FILTER (WHERE status = 'on-hand'), 0) AS at_tis_amount,
      count(*) FILTER (WHERE status IN ('forwarded', 'warehoused'))::int AS partners, COALESCE(sum(amount) FILTER (WHERE status IN ('forwarded', 'warehoused')), 0) AS partners_amount,
      count(*) FILTER (WHERE status = ANY($3) AND cheque_date BETWEEN $1::date AND $1::date + 7)::int AS week,
      COALESCE(sum(amount) FILTER (WHERE status = ANY($3) AND cheque_date BETWEEN $1::date AND $1::date + 7), 0) AS week_amount,
      count(*) FILTER (WHERE status IN ('forwarded', 'warehoused') AND cheque_date < $1::date)::int AS awaiting,
      COALESCE(sum(amount) FILTER (WHERE status IN ('forwarded', 'warehoused') AND cheque_date < $1::date), 0) AS awaiting_amount,
      count(*) FILTER (WHERE status = 'bounced')::int AS bounced, COALESCE(sum(amount) FILTER (WHERE status = 'bounced'), 0) AS bounced_amount,
      count(*) FILTER (WHERE status = 'cancellation-pending')::int AS pending,
      count(*) FILTER (WHERE status = ANY($2))::int AS open, count(*) FILTER (WHERE status = ANY($4))::int AS closed,
      count(*) FILTER (WHERE status = 'on-hand' AND payee = 'tisph' AND cheque_date <= $1::date + $5::int)::int AS deposit_due,
      count(*) FILTER (WHERE status = 'on-hand' AND cheque_date <= $1::date)::int AS due_now, COALESCE(sum(amount) FILTER (WHERE status = 'on-hand' AND cheque_date <= $1::date), 0) AS due_now_amount
    FROM post_dated_cheques`, [asOf, TABS.open, ['on-hand', 'forwarded', 'warehoused', 'deposited'], SETTLED, Number(await getSetting('pdc.due_window_days', 3)) || 0])).rows[0];
  const ageing = { current: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
  for (const r of rows) if (r.ageing) ageing[r.ageing.code] = round2(ageing[r.ageing.code] + r.amount);
  return {
    asOf,
    summary: { atTis: s.at_tis, atTisAmount: Number(s.at_tis_amount), withPartners: s.partners, withPartnersAmount: Number(s.partners_amount), dueThisWeek: s.week,
      dueThisWeekAmount: Number(s.week_amount), awaiting: s.awaiting, awaitingAmount: Number(s.awaiting_amount), bounced: s.bounced, bouncedAmount: Number(s.bounced_amount),
      onHand: s.at_tis, onHandAmount: Number(s.at_tis_amount), dueNow: s.due_now, dueNowAmount: Number(s.due_now_amount) },
    counts: { open: s.open, 'at-tis': s.at_tis, 'with-partners': s.partners, awaiting: s.awaiting, bounced: s.bounced, 'cancellation-pending': s.pending, closed: s.closed,
      'deposit-due': s.deposit_due },
    ageing: { buckets: bucketDays.slice(0, 3), amounts: ageing }, depositAccount: (await getSetting('pdc.default_deposit_account', null)) || null, rows,
  };
}

/** Retained cheques on hand due for deposit within pdc.due_window_days (or by the given date). */
export async function depositDue(db, { asOf = null } = {}) {
  const now = asOf || (await today());
  const window = Number(await getSetting('pdc.due_window_days', 3)) || 0;
  const bucketDays = await buckets();
  const rows = (await db.query(`${SELECT} WHERE d.status = 'on-hand' AND d.payee = 'tisph' AND d.cheque_date <= ($1::date + $2::int) ORDER BY d.cheque_date, d.pdc_number`, [now, window]))
    .rows.map((r) => out(r, now, bucketDays));
  return { asOf: now, windowDays: window, total: round2(rows.reduce((s, r) => s + r.amount, 0)), rows };
}

export async function lockPdc(db, id) {
  const r = (await db.query('SELECT * FROM post_dated_cheques WHERE id = $1 OR pdc_number = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!r) throw notFound('Post-dated cheque not found');
  return r;
}

/** What the cheque pays: the bill (and its policy and client), or the policy. */
async function targetOf(db, b) {
  if (b.receivableId) {
    const r = (await db.query('SELECT r.*, p.billing_mode, p.insurance_company_id FROM receivables r LEFT JOIN policies p ON p.id = r.policy_id WHERE r.id = $1 OR r.bill_number = $1',
      [String(b.receivableId)])).rows[0];
    if (!r) throw notFound(`Bill ${b.receivableId} not found`);
    if (!['open', 'partial'].includes(r.status) || !(Number(r.balance) > EPS)) throw conflict(`Bill ${r.bill_number} has no open balance`);
    return { receivable: r, policyId: r.policy_id, clientId: r.client_id, insurerId: r.insurance_company_id };
  }
  if (b.policyId) {
    const p = (await db.query('SELECT id, client_id, policy_number, billing_mode, insurance_company_id FROM policies WHERE id = $1 OR policy_number = $1', [String(b.policyId)])).rows[0];
    if (!p) throw notFound(`Policy ${b.policyId} not found`);
    if (p.billing_mode === 'direct') throw conflict(`Policy ${p.policy_number} is direct billed: the client pays the insurer, not TISPH`);
    return { receivable: null, policyId: p.id, clientId: p.client_id, insurerId: p.insurance_company_id };
  }
  throw badRequest('Validation failed', [{ path: 'receivableId', message: 'Give the bill (receivableId) or the policy (policyId) the cheque pays' }]);
}

/**
 * Register one cheque payable to TISPH, as the register always did (a full payment by one dated-ahead cheque, or the
 * replacement of a cheque outside a set). b: { receivableId | policyId, bankId | draweeBank, branch, chequeNumber,
 * chequeDate, amount, receivedDate, storageLocation, remarks, replacesId }.
 */
export async function registerPdc(db, b, user) {
  const t = await targetOf(db, b);
  const amount = round2(b.amount);
  if (!(amount > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'Amount must be greater than zero' }]);
  if (!b.bankId && !String(b.draweeBank || '').trim()) throw badRequest('Validation failed', [{ path: 'bankId', message: 'Choose the drawee bank' }]);
  if (t.receivable) {
    const pending = Number((await db.query(`SELECT COALESCE(sum(amount), 0) AS a FROM post_dated_cheques WHERE receivable_id = $1 AND status = ANY($3)
      AND ($2::text IS NULL OR id <> $2)`, [t.receivable.id, b.replacesId || null, LIVE])).rows[0].a);
    const room = round2(Number(t.receivable.balance) - pending);
    if (amount > room + EPS) throw conflict(`Bill ${t.receivable.bill_number} has ${room.toFixed(2)} left after the cheques already encoded; this cheque is ${amount.toFixed(2)}`);
  }
  const number = await nextDocumentNumber('pdc', { db, unique: { table: 'post_dated_cheques', column: 'pdc_number' } });
  const r = (await db.query(`INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, bank_id, drawee_bank, branch, cheque_number, cheque_date, amount, received_date,
      storage_location, remarks, replaces_id, payee, insurance_company_id, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'tisph',$15,$16,$16) RETURNING id`,
  [number, t.clientId, t.policyId, t.receivable?.id || null, b.bankId || null, b.draweeBank || null, b.branch || null, String(b.chequeNumber).trim(), isoDate(b.chequeDate), amount,
    isoDate(b.receivedDate) || (await today()), b.storageLocation || null, b.remarks || null, b.replacesId || null, t.insurerId || null, user?.id ?? null])).rows[0].id;
  return getPdc(db, r);
}

/**
 * Edit a cheque (FR-PDC-002): while Received at TIS every detail of the cheque; afterwards only the remarks and the
 * vault folder. b: { bankId, draweeBank, branch, accountNumber, brstn, chequeNumber, chequeDate, storageLocation, remarks }.
 */
export async function updatePdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  const before = await getPdc(db, d.id);
  const details = ['bankId', 'draweeBank', 'branch', 'accountNumber', 'brstn', 'chequeNumber', 'chequeDate'].filter((k) => b[k] !== undefined);
  if (details.length && d.status !== 'on-hand') throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only the remarks and custody folder can be changed`);
  const errors = [];
  if (b.chequeNumber !== undefined && !/^\d{6,10}$/.test(String(b.chequeNumber).trim()) && d.set_id) errors.push({ path: 'chequeNumber', message: 'Cheque number must be 6 to 10 digits' });
  if (b.brstn && !/^\d{9}$/.test(String(b.brstn).trim())) errors.push({ path: 'brstn', message: 'BRSTN must be 9 digits' });
  if (b.chequeDate !== undefined && !(isoDate(b.chequeDate) > isoDate(d.received_date))) errors.push({ path: 'chequeDate', message: 'The cheque date must be after the received date' });
  if (errors.length) throw badRequest('Validation failed', errors);
  const cols = { bankId: 'bank_id', draweeBank: 'drawee_bank', branch: 'branch', accountNumber: 'account_number', brstn: 'brstn', chequeNumber: 'cheque_number', chequeDate: 'cheque_date',
    storageLocation: 'storage_location', remarks: 'remarks' };
  const sets = [];
  const p = [d.id];
  for (const [k, col] of Object.entries(cols)) {
    if (b[k] === undefined) continue;
    p.push(k === 'chequeDate' ? isoDate(b[k]) : (b[k] === '' ? null : b[k]));
    sets.push(`${col} = $${p.length}`);
  }
  if (!sets.length) return { before, after: before };
  p.push(user?.id ?? null);
  await db.query(`UPDATE post_dated_cheques SET ${sets.join(', ')}, updated_by = $${p.length}, updated_at = now() WHERE id = $1`, p);
  return { before, after: await getPdc(db, d.id) };
}

/**
 * Deposit a retained cheque on or after its date: the receipt is created and posted on the one TISPH collection account
 * (pdc.default_deposit_account, FR-PDC-004). b: { depositDate }.
 */
export async function depositPdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'on-hand') throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a cheque received at TIS is deposited`);
  if (d.payee !== 'tisph') throw conflict(`Cheque ${d.pdc_number} is payable to the Insurance Partner; it is forwarded, not deposited`);
  const on = isoDate(b.depositDate) || (await today());
  if (on < isoDate(d.cheque_date)) throw conflict(`Cheque ${d.pdc_number} is dated ${isoDate(d.cheque_date)}; it cannot be deposited before its date`);
  const account = (await getSetting('pdc.default_deposit_account', null)) || null;
  if (!account) throw badRequest('Validation failed', [{ path: 'depositAccount', message: 'No TISPH collection bank account is set up for deposits' }]);
  if (b.depositAccount && b.depositAccount !== account) {
    throw badRequest('Validation failed', [{ path: 'depositAccount', message: `Retained cheques are deposited to the collection account ${account} only` }]);
  }
  const bill = d.receivable_id ? (await db.query('SELECT id, balance, status FROM receivables WHERE id = $1', [d.receivable_id])).rows[0] : null;
  const onBill = bill && ['open', 'partial'].includes(bill.status) && Number(bill.balance) + EPS >= Number(d.amount);
  const set = d.set_id ? (await db.query('SELECT set_number FROM pdc_sets WHERE id = $1', [d.set_id])).rows[0] : null;
  const receipt = await createReceipt(db, {
    ...(onBill ? { receivableId: bill.id } : { policyId: d.policy_id }), amount: Number(d.amount), paymentMode: 'check', referenceNo: `Cheque ${d.cheque_number}`,
    bankId: d.bank_id || null, receiptDate: on, bankAccountCode: account,
    remarks: set ? `PDC ${d.pdc_number} of set ${set.set_number}${d.instalment_seq ? `, instalment ${d.instalment_seq}` : ''}`
      : `Post-dated cheque ${d.pdc_number} (cheque ${d.cheque_number} dated ${isoDate(d.cheque_date)})`,
  }, user, { source: 'pdc' });
  await db.query(`UPDATE post_dated_cheques SET status = 'deposited', deposit_account = $2, deposited_on = $3, deposited_by = $4, receipt_id = $5, updated_by = $4, updated_at = now()
    WHERE id = $1`, [d.id, account, on, user?.id ?? null, receipt.receiptId || receipt.id]);
  return { pdc: await getPdc(db, d.id), receiptNumber: receipt.receiptNumber };
}

export async function clearPdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'deposited') throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a deposited cheque clears`);
  await db.query('UPDATE post_dated_cheques SET status = \'cleared\', cleared_on = $2, updated_by = $3, updated_at = now() WHERE id = $1', [d.id, isoDate(b.clearedOn) || (await today()), user?.id ?? null]);
  if (d.set_id) {
    const { refreshSet } = await import('./lifecycle.js');
    await refreshSet(db, d.set_id);
  }
  return getPdc(db, d.id);
}

/** Tell Cash Control and, with pdc.notify_client_on_bounce, e-mail the client (template pdc_bounced); returns the address e-mailed. */
export async function notifyBounce(db, pdc, reason) {
  await notify({ type: 'task', priority: 'high', title: `Cheque ${pdc.chequeNumber} bounced`, audience: 'write:pdc',
    message: `${pdc.pdcNumber}: cheque ${pdc.chequeNumber} of ${pdc.clientName || 'the client'} for ${await formatMoney(pdc.amount)} was returned (${reason}).${pdc.receiptNumber
      ? ` Receipt ${pdc.receiptNumber} was cancelled;` : ''} ask for a replacement.`.replace(/\s+/g, ' '),
    link: `/accounts/post-dated-cheques?cheque=${pdc.id}`, entity: 'post_dated_cheque', entityId: pdc.id });
  if ((await getSetting('pdc.notify_client_on_bounce', true)) === false || !pdc.clientId) return null;
  const c = (await db.query('SELECT email, display_name FROM clients WHERE id = $1', [pdc.clientId])).rows[0];
  if (!c?.email) return null;
  const t = await emailTemplate('pdc_bounced');
  const v = { clientName: c.display_name, chequeNumber: pdc.chequeNumber, bankName: pdc.bankName || '', chequeDate: pdc.chequeDate, amount: pdc.amount.toFixed(2),
    currency: await getSetting('currency.default', 'PHP'), reason, policyNumber: pdc.policyNumber || '', companyName: await companyName() };
  await queueEmail({ db, to: c.email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'pdc_bounced', entity: 'post_dated_cheque', entityId: pdc.id });
  return c.email;
}

/** The bank returned a retained cheque: its receipt is cancelled (the bill is open again), Cash Control and the client are told. */
export async function bouncePdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (!['deposited', 'cleared'].includes(d.status) || d.payee !== 'tisph') throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a deposited cheque can bounce`);
  let reason = String(b.reason || '').trim();
  let code = null;
  if (b.reasonCode) {
    const { requiredReason } = await import('../ops-masters/records.js');
    const r = await requiredReason(db, 'pdc_bounce', { reasonCode: b.reasonCode, note: b.note });
    reason = r.text;
    code = r.code;
  }
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason the bank returned the cheque (e.g. DAIF, account closed)' }]);
  if (d.receipt_id) {
    const rc = (await db.query('SELECT receipt_status FROM receipts WHERE id = $1', [d.receipt_id])).rows[0];
    if (rc && rc.receipt_status !== 'Cancelled') await cancelReceipt(db, d.receipt_id, `Cheque ${d.cheque_number} bounced: ${reason}`, user);
  }
  await db.query(`UPDATE post_dated_cheques SET status = 'bounced', bounced_on = $2, bounce_reason = $3, bounce_reason_code = $4, bounce_charge = $5, updated_by = $6, updated_at = now()
    WHERE id = $1`, [d.id, isoDate(b.bouncedOn) || (await today()), reason, code, round2(b.bounceCharge || 0), user?.id ?? null]);
  if (d.set_id) {
    const { refreshSet } = await import('./lifecycle.js');
    await refreshSet(db, d.set_id);
  }
  const pdc = await getPdc(db, d.id);
  return { pdc, emailedTo: await notifyBounce(db, pdc, reason) };
}

/** Replace a bounced cheque registered outside a set by a new cheque for the same bill or policy (cheques of a set: lifecycle.replaceInSet). */
export async function replacePdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.set_id) {
    const { replaceInSet } = await import('./lifecycle.js');
    return replaceInSet(db, d, b, user);
  }
  if (d.status !== 'bounced') throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a bounced cheque or a cheque cancelled for a cheque replacement is replaced`);
  const target = d.receivable_id && (await db.query('SELECT 1 FROM receivables WHERE id = $1 AND status IN (\'open\', \'partial\') AND balance > 0', [d.receivable_id])).rowCount
    ? { receivableId: d.receivable_id } : { policyId: d.policy_id };
  const fresh = await registerPdc(db, { ...b, ...target, replacesId: d.id, amount: b.amount ?? Number(d.amount) }, user);
  await db.query('UPDATE post_dated_cheques SET status = \'replaced\', replaced_by_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [d.id, fresh.id, user?.id ?? null]);
  return { replaced: await getPdc(db, d.id), pdc: fresh, message: `Replacement cheque ${fresh.pdcNumber} encoded` };
}

/** Daily job: tell Cash Control which retained cheques are due for deposit. */
export async function depositDueJob(db) {
  const due = await depositDue(db);
  if (!due.rows.length) return { due: 0 };
  const now = due.asOf;
  const today0 = due.rows.filter((r) => r.chequeDate <= now).length;
  await notify({ type: 'reminder', title: `${due.rows.length} post-dated cheque(s) due for deposit`, audience: 'write:pdc',
    message: `${today0} due today or earlier and ${due.rows.length - today0} within ${due.windowDays} day(s), ${await formatMoney(due.total)} in all.`,
    link: '/accounts/post-dated-cheques?tab=deposit-due', entity: 'post_dated_cheque', entityId: now });
  return { due: due.rows.length, total: due.total };
}
