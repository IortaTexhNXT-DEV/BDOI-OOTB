/**
 * PDC lifecycle (TIS-BRD-COLL-05, FRS FR-PDC-001 to FR-PDC-051): sets of cheques encoded against the instalment plan
 * of a bill, forwarding to the Insurance Partner with a transmittal, the partner's receipt (warehousing) and maturity
 * advice, cancellation approved by a second user with a pull-out when the partner holds the cheque, replacement and
 * return, and the daily follow-up.
 *
 * A set (PCS-) is one acceptance for one bill: one cheque per unpaid instalment of the plan saved on Credit Control >
 * Instalment Plans (one cheque for the bill balance when the bill has no plan). Its payee is the Insurance Partner (the
 * insurer of the policy; the cheques are forwarded) or TISPH (retained, deposited with the register's Deposit on the
 * one collection account of pdc.default_deposit_account). Nothing is posted until a cheque is collected: Partner
 * cleared raises the acknowledgement receipt through the receipts module on the collection date (posting rule
 * pdc.partner_collected), a deposit raises it as before (receipt.apply).
 */
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { formatMoney, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { printFormat } from '../../lib/pdf/index.js';
import { formatDate } from '../../lib/pdf/format.js';
import { notify } from '../notifications/service.js';
import { requiredReason } from '../ops-masters/records.js';
import { assertPeriodOpen } from '../accounting/lib/ledger.js';
import { createReceipt, cancelReceipt } from '../receipts/service.js';
import { allocatePaid } from '../credit-control/instalments.js';
import { LIVE, PAYEES, PAYEE_TEXT, SETTLED, STATUS_TEXT, getPdc, lockPdc, notifyBounce } from './service.js';

const EPS = 0.005;
export const SENT_BY = ['courier', 'messenger', 'hand-carry'];
export const REPLACEMENT = ['cheque', 'cash', 'none'];
/** Cancellation reasons that a replacement follows (reason code -> replacement kind); the others default to none. */
const REPLACEMENT_BY_REASON = { 'PDC-CXL-CHEQUE': 'cheque', 'PDC-CXL-CASH': 'cash' };

const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);
const dmy = async (iso) => formatDate(iso, await printFormat());
const uid = (user) => user?.id ?? null;

// ---------------------------------------------------------------- encoding

/** The policy of a set: issued, broker billed, with its client and Insurance Partner. */
async function policyOf(db, ref) {
  const p = (await db.query(`SELECT p.*, c.display_name AS client_name, ic.name AS insurer_name FROM policies p LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.id = $1 OR p.policy_number = $1`, [String(ref || '').trim()])).rows[0];
  if (!p) throw fail('policyNumber', `Policy ${ref} not found`);
  if (p.billing_mode === 'direct') throw conflict(`Policy ${p.policy_number} is direct billed: the client pays the insurer, not TISPH`);
  return p;
}

/** Live cheques of a bill per instalment (seq -> amount) and in all. */
async function encodedOn(db, receivableId, exceptId = null) {
  const rows = (await db.query(`SELECT instalment_seq, COALESCE(sum(amount), 0) AS a FROM post_dated_cheques WHERE receivable_id = $1 AND status = ANY($2)
    AND ($3::text IS NULL OR id <> $3) GROUP BY instalment_seq`, [receivableId, LIVE, exceptId])).rows;
  return { bySeq: new Map(rows.map((r) => [r.instalment_seq, Number(r.a)])), total: round2(rows.reduce((s, r) => s + Number(r.a), 0)) };
}

/**
 * The rows a set of a bill can take: the unpaid instalments of its active plan, less what live cheques already cover,
 * with the number, due date and outstanding amount; one row of the bill balance when the bill has no plan.
 */
export async function billRows(db, bill, asOf = null) {
  const now = asOf || (await today());
  const plan = (await db.query('SELECT * FROM premium_instalment_plans WHERE receivable_id = $1 AND status = \'active\'', [bill.id])).rows[0];
  const covered = await encodedOn(db, bill.id);
  if (!plan) {
    const room = round2(Number(bill.balance) - covered.total);
    return { planned: false, instalmentCount: 1, rows: room > EPS ? [{ seq: null, dueDate: isoDate(bill.due_date), amount: room }] : [] };
  }
  const lines = (await db.query('SELECT * FROM premium_instalments WHERE plan_id = $1 ORDER BY seq', [plan.id])).rows;
  // a collected cheque pays its own instalment; the other payments on the bill are allocated in order to what is left
  const own = new Map((await db.query(`SELECT d.instalment_seq, sum(d.amount) AS a FROM post_dated_cheques d JOIN receipts r ON r.id = d.receipt_id
    WHERE d.receivable_id = $1 AND d.instalment_seq IS NOT NULL AND r.receipt_status <> 'Cancelled' GROUP BY d.instalment_seq`, [bill.id])).rows.map((r) => [r.instalment_seq, Number(r.a)]));
  const ownTotal = round2([...own.values()].reduce((x, a) => x + a, 0));
  const alloc = allocatePaid(lines.map((l) => ({ ...l, amount: round2(Math.max(0, Number(l.amount) - (own.get(l.seq) || 0))) })),
    Math.max(0, round2(Number(bill.amount) - Number(bill.balance) - ownTotal)), now);
  const rows = alloc.map((a) => ({ seq: a.seq, dueDate: a.dueDate, amount: round2(a.outstanding - (covered.bySeq.get(a.seq) || 0)) })).filter((r) => r.amount > EPS);
  return { planned: true, planId: plan.id, instalmentCount: lines.length, rows };
}

/**
 * GET /pdc/encode?policy=: what Encode PDCs shows for a policy: client, Insurance Partner, open bills and, for the bill
 * picked (or the first open one), the rows of its unpaid instalments; the payee proposed and the collection account.
 */
export async function encodeOptions(db, { policy: ref, bill: billRef = null } = {}) {
  const p = await policyOf(db, ref);
  const bills = (await db.query(`SELECT * FROM receivables WHERE policy_id = $1 AND status IN ('open', 'partial') AND balance > 0 ORDER BY due_date, created_at`, [p.id])).rows;
  if (!bills.length) throw conflict(`Policy ${p.policy_number} has no open bill to pay`);
  const bill = billRef ? bills.find((b) => b.id === billRef || b.bill_number === billRef) : bills[0];
  if (!bill) throw fail('billId', `Bill ${billRef} is not an open bill of policy ${p.policy_number}`);
  const rows = await billRows(db, bill);
  return {
    policyId: p.id, policyNumber: p.policy_number, clientId: p.client_id, clientName: p.client_name, insurerId: p.insurance_company_id, insurerName: p.insurer_name,
    bills: bills.map((b) => ({ id: b.id, billNumber: b.bill_number, balance: Number(b.balance), dueDate: isoDate(b.due_date) })),
    billId: bill.id, billNumber: bill.bill_number, billBalance: Number(bill.balance), planned: rows.planned, instalmentCount: rows.instalmentCount, rows: rows.rows,
    defaultPayee: PAYEES.includes(await getSetting('pdc.default_payee', 'insurance-partner')) ? await getSetting('pdc.default_payee', 'insurance-partner') : 'insurance-partner',
    depositAccount: (await getSetting('pdc.default_deposit_account', null)) || null,
    maxCheques: Number(await getSetting('pdc.max_cheques_per_set', 12)) || 12, brstnRequired: (await getSetting('pdc.brstn_required', false)) === true,
  };
}

/** Bank of a row: the Bank master (bankId) or the name typed; the name for the messages. */
async function bankOf(db, row) {
  if (row.bankId) {
    const b = (await db.query('SELECT id, name FROM banks WHERE id = $1', [Number(row.bankId)])).rows[0];
    if (b) return { id: b.id, name: b.name, typed: null };
  }
  const typed = String(row.draweeBank || '').trim();
  return typed ? { id: null, name: typed, typed } : null;
}

/**
 * Check the rows of a set (FR-PDC-002) and return them normalised; every error of every row is reported at once
 * under rows[i].<field>. ctx: { receivedDate, rows of the bill (seq -> due date, amount), brstnRequired, tolerance }.
 */
async function checkRows(db, input, ctx) {
  const errors = [];
  const err = (i, field, message) => errors.push({ path: `rows[${i}].${field}`, message });
  const out = [];
  const seen = new Map();
  for (const [i, r] of input.entries()) {
    const n = i + 1;
    const bank = await bankOf(db, r);
    if (!bank) err(i, 'bankId', `Row ${n}: choose the drawee bank`);
    const cheque = String(r.chequeNumber || '').trim();
    if (!/^\d{6,10}$/.test(cheque)) err(i, 'chequeNumber', `Row ${n}: cheque number must be 6 to 10 digits`);
    else if (bank) {
      const key = `${bank.id || ''}|${(bank.typed || '').toLowerCase()}|${cheque}`;
      if (seen.has(key)) err(i, 'chequeNumber', `Row ${n}: cheque ${cheque} is already on row ${seen.get(key)}`);
      seen.set(key, n);
      const dup = (await db.query(`SELECT pdc_number FROM post_dated_cheques WHERE cheque_number = $1 AND COALESCE(bank_id, 0) = $2 AND lower(COALESCE(drawee_bank, '')) = $3
        AND status <> 'cancelled' LIMIT 1`, [cheque, bank.id || 0, (bank.typed || '').toLowerCase()])).rows[0];
      if (dup) err(i, 'chequeNumber', `Row ${n}: cheque ${cheque} of ${bank.name} is already encoded as ${dup.pdc_number}`);
    }
    const brstn = String(r.brstn || '').trim();
    if (brstn ? !/^\d{9}$/.test(brstn) : ctx.brstnRequired) err(i, 'brstn', `Row ${n}: BRSTN must be 9 digits`);
    const date = isoDate(r.chequeDate);
    const target = ctx.bySeq.get(r.seq ?? null);
    if (!target) err(i, 'seq', `Row ${n}: this instalment has nothing left to pay`);
    if (!date) err(i, 'chequeDate', `Row ${n}: enter the cheque date`);
    else if (date <= ctx.receivedDate) {
      err(i, 'chequeDate', `Row ${n}: the cheque is dated ${await dmy(date)}, not after the received date. Receipt it as a cheque payment`);
    } else if (target && target.dueDate && Math.abs(Date.parse(date) - Date.parse(target.dueDate)) / 86400000 > ctx.tolerance) {
      err(i, 'chequeDate', `Row ${n}: cheque date ${await dmy(date)} is more than ${ctx.tolerance} days from the instalment due date ${await dmy(target.dueDate)}`);
    }
    if (date && i > 0 && out[i - 1]?.chequeDate && date < out[i - 1].chequeDate) err(i, 'chequeDate', `Row ${n}: cheque dates run in the order of the instalments`);
    out.push({ seq: r.seq ?? null, dueDate: target?.dueDate || null, amount: target?.amount || 0, bank, branch: String(r.branch || '').trim() || null,
      accountNumber: String(r.accountNumber || '').trim() || null, brstn: brstn || null, chequeNumber: cheque, chequeDate: date, remarks: r.remarks || null });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return out;
}

async function insertCheque(db, set, row, extra, user) {
  const number = await nextDocumentNumber('pdc', { db, unique: { table: 'post_dated_cheques', column: 'pdc_number' } });
  return (await db.query(`INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, bank_id, drawee_bank, branch, account_number, brstn, cheque_number, cheque_date,
      amount, received_date, storage_location, remarks, set_id, instalment_seq, instalment_count, instalment_due_date, payee, insurance_company_id, custody, replaces_id, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'tis-vault',$22,$23,$23) RETURNING id`,
  [number, set.client_id, set.policy_id, set.receivable_id, row.bank?.id || null, row.bank?.typed || null, row.branch, row.accountNumber, row.brstn, row.chequeNumber, row.chequeDate,
    round2(row.amount), set.received_date, set.storage_location, row.remarks, set.id, row.seq, extra.instalmentCount, row.dueDate, set.payee, set.insurance_company_id,
    extra.replacesId || null, uid(user)])).rows[0].id;
}

/**
 * POST /pdc/sets (Encode PDCs): b = { policyNumber, billId, payee, receivedDate, storageLocation, remarks, rows: [{ seq,
 * bankId | draweeBank, branch, accountNumber, brstn, chequeNumber, chequeDate }] }. One set and one cheque per row,
 * Received at TIS; nothing is posted. Returns { set, cheques, message }.
 */
export async function encodeSet(db, b, user) {
  const p = await policyOf(db, b.policyNumber || b.policyId);
  const bill = (await db.query(`SELECT * FROM receivables WHERE (id = $1 OR bill_number = $1) AND policy_id = $2 FOR UPDATE`, [String(b.billId || ''), p.id])).rows[0];
  if (!bill || !['open', 'partial'].includes(bill.status) || !(Number(bill.balance) > EPS)) throw conflict(`Policy ${p.policy_number} has no open bill to pay`);
  const payee = b.payee || (await getSetting('pdc.default_payee', 'insurance-partner'));
  if (!PAYEES.includes(payee)) throw fail('payee', 'Payee is the Insurance Partner or TISPH');
  if (payee === 'tisph' && !(await getSetting('pdc.default_deposit_account', null))) throw fail('payee', 'No TISPH collection bank account is set up for deposits');
  if (payee === 'insurance-partner' && !p.insurance_company_id) throw fail('payee', `Policy ${p.policy_number} has no Insurance Partner`);
  const input = Array.isArray(b.rows) ? b.rows : [];
  if (!input.length) throw fail('rows', 'Keep at least one cheque in the set');
  const max = Number(await getSetting('pdc.max_cheques_per_set', 12)) || 12;
  if (input.length > max) throw fail('rows', `A set can hold at most ${max} cheques`);
  const receivedDate = isoDate(b.receivedDate) || (await today());
  if (receivedDate > (await today())) throw fail('receivedDate', 'Received date cannot be in the future');
  const avail = await billRows(db, bill);
  const bySeq = new Map(avail.rows.map((r) => [r.seq, r]));
  const rows = await checkRows(db, input, { receivedDate, bySeq, brstnRequired: (await getSetting('pdc.brstn_required', false)) === true,
    tolerance: Number(await getSetting('pdc.date_tolerance_days', 5)) || 0 });
  const total = round2(rows.reduce((s, r) => s + r.amount, 0));
  const room = round2(Number(bill.balance) - (await encodedOn(db, bill.id)).total);
  if (total > room + EPS) throw conflict(`Bill ${bill.bill_number} has ${await formatMoney(room)} left after the cheques already encoded; this set is ${await formatMoney(total)}`);
  const number = await nextDocumentNumber('pdc_set', { db, unique: { table: 'pdc_sets', column: 'set_number' } });
  const set = (await db.query(`INSERT INTO pdc_sets(set_number, policy_id, receivable_id, client_id, insurance_company_id, payee, received_date, received_by, storage_location, remarks,
      created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$8,$8) RETURNING *`,
  [number, p.id, bill.id, p.client_id, p.insurance_company_id, payee, receivedDate, uid(user), String(b.storageLocation || '').trim() || null, b.remarks || null])).rows[0];
  const ids = [];
  for (const r of rows) ids.push(await insertCheque(db, set, r, { instalmentCount: avail.instalmentCount }, user));
  const cheques = [];
  for (const id of ids) cheques.push(await getPdc(db, id));
  return { set: await getSet(db, set.id), cheques, message: `Set ${number} saved with ${rows.length} cheques, ${await formatMoney(total)}` };
}

// ---------------------------------------------------------------- sets

const setOut = (s) => ({
  id: s.id, setNumber: s.set_number, policyId: s.policy_id, policyNumber: s.policy_number || null, receivableId: s.receivable_id, billNumber: s.bill_number || null,
  clientId: s.client_id, clientName: s.client_name || null, insurerId: s.insurance_company_id, insurerName: s.insurer_name || null, payee: s.payee, payeeText: PAYEE_TEXT[s.payee],
  receivedDate: isoDate(s.received_date), receivedBy: s.received_by_name || s.received_by, storageLocation: s.storage_location, status: s.status, remarks: s.remarks,
  createdAt: s.created_at, updatedAt: s.updated_at,
});

/** A set with its cheques per instalment (the cheque paying it now first, the ones it replaced under it), count, total and term. */
export async function getSet(db, ref) {
  const s = (await db.query(`SELECT s.*, p.policy_number, r.bill_number, c.display_name AS client_name, ic.name AS insurer_name,
      (SELECT u.display_name FROM users u WHERE u.id = s.received_by) AS received_by_name
    FROM pdc_sets s LEFT JOIN policies p ON p.id = s.policy_id LEFT JOIN receivables r ON r.id = s.receivable_id LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN insurance_companies ic ON ic.id = s.insurance_company_id WHERE s.id = $1 OR s.set_number = $1`, [String(ref)])).rows[0];
  if (!s) throw notFound('PDC set not found');
  const ids = (await db.query('SELECT id FROM post_dated_cheques WHERE set_id = $1 ORDER BY instalment_seq NULLS FIRST, created_at', [s.id])).rows.map((r) => r.id);
  const cheques = [];
  for (const id of ids) cheques.push(await getPdc(db, id));
  const active = cheques.filter((c) => !['cancelled', 'replaced', 'returned'].includes(c.status));
  const seqs = [...new Set(cheques.map((c) => c.instalmentSeq))];
  const instalments = seqs.map((seq) => {
    const of = cheques.filter((c) => c.instalmentSeq === seq);
    const current = of.find((c) => !c.replacedById && !['cancelled', 'returned'].includes(c.status)) || of.at(-1);
    return { seq, dueDate: current?.instalmentDueDate || null, current, earlier: of.filter((c) => c.id !== current?.id) };
  });
  const dates = active.map((c) => c.chequeDate).filter(Boolean).sort();
  return { ...setOut(s), chequeCount: active.length, total: round2(active.reduce((x, c) => x + c.amount, 0)),
    firstChequeDate: dates[0] || null, lastChequeDate: dates.at(-1) || null, instalments, cheques };
}

/**
 * Status of a set from its cheques (FRS 5.2): Open while a cheque is alive or bounced; Closed when every cheque is
 * Cleared, Cancelled, Replaced or Returned and one was Cleared; Cancelled when none was Cleared.
 */
export async function refreshSet(db, setId) {
  if (!setId) return null;
  const st = (await db.query('SELECT status FROM post_dated_cheques WHERE set_id = $1', [setId])).rows.map((r) => r.status);
  let status = 'open';
  if (st.length && st.every((x) => SETTLED.includes(x))) status = st.includes('cleared') ? 'closed' : 'cancelled';
  await db.query('UPDATE pdc_sets SET status = $2, updated_at = now() WHERE id = $1 AND status <> $2', [setId, status]);
  return status;
}

export async function listSets(db, q = {}) {
  const rows = (await db.query(`SELECT s.*, p.policy_number, r.bill_number, c.display_name AS client_name, ic.name AS insurer_name, NULL AS received_by_name
    FROM pdc_sets s LEFT JOIN policies p ON p.id = s.policy_id LEFT JOIN receivables r ON r.id = s.receivable_id LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN insurance_companies ic ON ic.id = s.insurance_company_id
    WHERE ($1::text IS NULL OR s.status = $1) AND ($2::text IS NULL OR p.id = $2 OR p.policy_number = $2) ORDER BY s.created_at DESC LIMIT 500`,
  [q.status || null, q.policyId || null])).rows;
  return rows.map(setOut);
}

// ---------------------------------------------------------------- forwarding and warehousing

const transmittalOut = (t) => ({
  id: t.id, transmittalNumber: t.transmittal_number, insurerId: t.insurance_company_id, insurerName: t.insurer_name || null, forwardedOn: isoDate(t.forwarded_on),
  sentBy: t.sent_by, courierReference: t.courier_reference, remarks: t.remarks, status: t.status, receivedOn: isoDate(t.received_on), receivedBy: t.received_by,
  partnerReference: t.partner_reference, createdBy: t.created_by_name || t.created_by, createdAt: t.created_at,
});
const TRANSMITTAL_SQL = `SELECT t.*, ic.name AS insurer_name, (SELECT u.display_name FROM users u WHERE u.id = t.created_by) AS created_by_name
  FROM pdc_transmittals t LEFT JOIN insurance_companies ic ON ic.id = t.insurance_company_id`;

/** A transmittal with the cheques it carries and the pull-outs requested on it, with totals. */
export async function getTransmittal(db, ref) {
  const t = (await db.query(`${TRANSMITTAL_SQL} WHERE t.id = $1 OR t.transmittal_number = $1`, [String(ref)])).rows[0];
  if (!t) throw notFound('Transmittal not found');
  const load = async (col) => {
    const ids = (await db.query(`SELECT id FROM post_dated_cheques WHERE ${col} = $1 ORDER BY cheque_date, pdc_number`, [t.id])).rows.map((r) => r.id);
    const out = [];
    for (const id of ids) out.push(await getPdc(db, id));
    return out;
  };
  const cheques = await load('transmittal_id');
  const pullOuts = await load('pullout_transmittal_id');
  return { ...transmittalOut(t), cheques, pullOuts, total: round2(cheques.reduce((s, c) => s + c.amount, 0)), count: cheques.length };
}

export async function listTransmittals(db, q = {}) {
  const rows = (await db.query(`${TRANSMITTAL_SQL} WHERE ($1::text IS NULL OR t.status = $1) AND ($2::text IS NULL OR t.insurance_company_id::text = $2)
    ORDER BY t.forwarded_on DESC, t.transmittal_number DESC LIMIT 500`, [q.status || null, q.insurerId ? String(q.insurerId) : null])).rows;
  return rows.map(transmittalOut);
}

/**
 * POST /pdc/transmittals (Forward to Insurance Partner): b = { pdcIds, forwardedOn, sentBy, courierReference, remarks }.
 * The cheques (Received at TIS, payee Insurance Partner, all of one partner) go on one transmittal PT- and become
 * Forwarded, in transit; the approved pull-outs open for that partner are carried on it.
 */
export async function forwardCheques(db, b, user) {
  const ids = [...new Set((b.pdcIds || []).map(String))];
  if (!ids.length) throw fail('pdcIds', 'Tick the cheques to forward');
  const forwardedOn = isoDate(b.forwardedOn) || (await today());
  if (forwardedOn > (await today())) throw fail('forwardedOn', 'Forwarded date cannot be in the future');
  if (!SENT_BY.includes(b.sentBy)) throw fail('sentBy', 'Choose how the cheques are sent');
  const rows = (await db.query('SELECT * FROM post_dated_cheques WHERE id = ANY($1) OR pdc_number = ANY($1) ORDER BY pdc_number FOR UPDATE', [ids])).rows;
  if (rows.length !== ids.length) throw notFound('Post-dated cheque not found');
  const partners = [...new Set(rows.map((r) => r.insurance_company_id))];
  if (partners.length > 1) throw conflict(`The ticked cheques belong to ${partners.length} Insurance Partners. Forward one partner at a time`);
  for (const r of rows) {
    if (r.status !== 'on-hand' || r.payee !== 'insurance-partner' || r.transmittal_id) {
      throw conflict(`Cheque ${r.pdc_number} is ${STATUS_TEXT[r.status]} with payee ${PAYEE_TEXT[r.payee]}; only cheques Received at TIS with payee Insurance Partner are forwarded`);
    }
  }
  const number = await nextDocumentNumber('pdc_transmittal', { db, unique: { table: 'pdc_transmittals', column: 'transmittal_number' } });
  const t = (await db.query(`INSERT INTO pdc_transmittals(transmittal_number, insurance_company_id, forwarded_on, sent_by, courier_reference, remarks, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`, [number, partners[0], forwardedOn, b.sentBy, b.courierReference || null, b.remarks || null, uid(user)])).rows[0];
  await db.query(`UPDATE post_dated_cheques SET status = 'forwarded', custody = 'in-transit', transmittal_id = $2, forwarded_on = $3, updated_by = $4, updated_at = now()
    WHERE id = ANY($1)`, [rows.map((r) => r.id), t.id, forwardedOn, uid(user)]);
  await db.query(`UPDATE post_dated_cheques SET pullout_transmittal_id = $2, updated_at = now() WHERE status = 'cancellation-pending' AND cancel_approved_at IS NOT NULL
    AND custody IN ('partner', 'in-transit') AND insurance_company_id = $1 AND pullout_transmittal_id IS NULL`, [partners[0], t.id]);
  const out = await getTransmittal(db, t.id);
  return { transmittal: out, message: `${rows.length} cheques forwarded to ${out.insurerName} on transmittal ${number}` };
}

/** Status of a transmittal from its cheques: Received when none is still Forwarded, Partly received when some are. */
async function refreshTransmittal(db, id) {
  const st = (await db.query('SELECT status FROM post_dated_cheques WHERE transmittal_id = $1', [id])).rows.map((r) => r.status);
  const left = st.filter((s) => s === 'forwarded').length;
  const status = left === 0 ? 'received' : left < st.length ? 'partly-received' : 'sent';
  await db.query('UPDATE pdc_transmittals SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
  return status;
}

/**
 * POST /pdc/transmittals/:id/received (Partner received): b = { receivedOn, receivedBy, partnerReference, pdcIds }. The
 * cheques ticked (all the transmittal's Forwarded cheques when none is given) become Warehoused with the partner.
 */
export async function partnerReceived(db, id, b, user) {
  const t = (await db.query('SELECT t.*, ic.name AS insurer_name FROM pdc_transmittals t LEFT JOIN insurance_companies ic ON ic.id = t.insurance_company_id WHERE t.id = $1 OR t.transmittal_number = $1 FOR UPDATE OF t', [String(id)])).rows[0];
  if (!t) throw notFound('Transmittal not found');
  const receivedOn = isoDate(b.receivedOn) || (await today());
  if (receivedOn < isoDate(t.forwarded_on)) throw fail('receivedOn', `Received on cannot be before the forwarded date ${await dmy(t.forwarded_on)}`);
  if (receivedOn > (await today())) throw fail('receivedOn', 'Received on cannot be in the future');
  if (!String(b.receivedBy || '').trim()) throw fail('receivedBy', 'Enter who received the cheques at the Insurance Partner');
  const wanted = Array.isArray(b.pdcIds) && b.pdcIds.length ? b.pdcIds.map(String) : null;
  const rows = (await db.query(`SELECT id FROM post_dated_cheques WHERE transmittal_id = $1 AND status = 'forwarded' AND ($2::text[] IS NULL OR id = ANY($2) OR pdc_number = ANY($2)) FOR UPDATE`,
    [t.id, wanted])).rows;
  if (!rows.length) throw conflict(`Transmittal ${t.transmittal_number} has no cheque in transit to record`);
  await db.query(`UPDATE post_dated_cheques SET status = 'warehoused', custody = 'partner', warehoused_on = $2, partner_received_by = $3, partner_receipt_reference = $4, updated_by = $5,
    updated_at = now() WHERE id = ANY($1)`, [rows.map((r) => r.id), receivedOn, String(b.receivedBy).trim(), b.partnerReference || null, uid(user)]);
  await db.query('UPDATE pdc_transmittals SET received_on = $2, received_by = $3, partner_reference = COALESCE($4, partner_reference), updated_by = $5 WHERE id = $1',
    [t.id, receivedOn, String(b.receivedBy).trim(), b.partnerReference || null, uid(user)]);
  await refreshTransmittal(db, t.id);
  return { transmittal: await getTransmittal(db, t.id), ids: rows.map((r) => r.id),
    message: `${rows.length} cheques of transmittal ${t.transmittal_number} are warehoused with ${t.insurer_name}` };
}

// ---------------------------------------------------------------- maturity advices

/**
 * Partner cleared (FR-PDC-030, 050, 051): b = { collectedOn, partnerReference, remarks }. The cheque (Warehoused, or
 * Forwarded whose receipt was never recorded) becomes Cleared and its acknowledgement receipt is raised on the
 * collection date against the bill (collected by the partner: posting rule pdc.partner_collected).
 */
export async function partnerCleared(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (!['forwarded', 'warehoused'].includes(d.status)) throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a cheque with the Insurance Partner is cleared here`);
  const on = isoDate(b.collectedOn) || (await today());
  if (on < isoDate(d.cheque_date)) throw fail('collectedOn', `Collection date cannot be before the cheque date ${await dmy(d.cheque_date)}`);
  if (on > (await today())) throw fail('collectedOn', 'Collection date cannot be in the future');
  const reference = String(b.partnerReference || '').trim();
  if (!reference) throw fail('partnerReference', 'Enter the Insurance Partner\'s reference');
  try {
    await assertPeriodOpen(db, on, user);
  } catch {
    throw conflict(`The period of ${await dmy(on)} is closed`);
  }
  const partner = (await db.query('SELECT id, name FROM insurance_companies WHERE id = $1', [d.insurance_company_id])).rows[0];
  const set = d.set_id ? (await db.query('SELECT set_number FROM pdc_sets WHERE id = $1', [d.set_id])).rows[0] : null;
  const bank = d.bank_id ? (await db.query('SELECT name FROM banks WHERE id = $1', [d.bank_id])).rows[0]?.name : d.drawee_bank;
  const bill = d.receivable_id ? (await db.query('SELECT id, balance, status FROM receivables WHERE id = $1', [d.receivable_id])).rows[0] : null;
  const onBill = bill && ['open', 'partial'].includes(bill.status) && Number(bill.balance) + EPS >= Number(d.amount);
  const receipt = await createReceipt(db, {
    ...(onBill ? { receivableId: bill.id } : { policyId: d.policy_id }), amount: Number(d.amount), paymentMode: 'check', referenceNo: `Cheque ${d.cheque_number} ${bank || ''}`.trim(),
    bankId: d.bank_id || null, receiptDate: on, collectedByInsurerId: partner?.id || null, partnerReference: reference,
    remarks: [`PDC ${d.pdc_number}${set ? ` of set ${set.set_number}` : ''}${d.instalment_seq ? `, instalment ${d.instalment_seq}` : ''}`, b.remarks].filter(Boolean).join('. '),
  }, user, { source: 'pdc' });
  await db.query(`UPDATE post_dated_cheques SET status = 'cleared', custody = 'partner', warehoused_on = COALESCE(warehoused_on, $2), collected_on = $2, cleared_on = $2,
    partner_reference = $3, receipt_id = $4, updated_by = $5, updated_at = now() WHERE id = $1`, [d.id, on, reference, receipt.receiptId || receipt.id, uid(user)]);
  if (d.transmittal_id) await refreshTransmittal(db, d.transmittal_id);
  await refreshSet(db, d.set_id);
  return { pdc: await getPdc(db, d.id), receiptNumber: receipt.receiptNumber, warehousedNow: d.status === 'forwarded',
    message: `Cheque ${d.pdc_number} cleared; AR ${receipt.receiptNumber} raised` };
}

/**
 * Partner bounced (FR-PDC-032): b = { bouncedOn, reasonCode, note }. A cheque with the partner (or cleared by it)
 * becomes Bounced; its AR, if any, is cancelled (journal reversed, the instalment open again); Cash Control and, with
 * pdc.notify_client_on_bounce, the client are told.
 */
export async function partnerBounced(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (!['forwarded', 'warehoused', 'cleared'].includes(d.status) || d.payee !== 'insurance-partner') {
    throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a cheque with the Insurance Partner or cleared can bounce`);
  }
  if (!String(b.reasonCode || '').trim()) throw fail('reasonCode', 'Choose the reason given by the Insurance Partner');
  const reason = await requiredReason(db, 'pdc_bounce', { reasonCode: b.reasonCode, note: b.note });
  if (d.receipt_id) {
    const rc = (await db.query('SELECT receipt_status FROM receipts WHERE id = $1', [d.receipt_id])).rows[0];
    if (rc && rc.receipt_status !== 'Cancelled') await cancelReceipt(db, d.receipt_id, `Cheque ${d.cheque_number} bounced: ${reason.text}`, user);
  }
  await db.query(`UPDATE post_dated_cheques SET status = 'bounced', bounced_on = $2, bounce_reason = $3, bounce_reason_code = $4, updated_by = $5, updated_at = now() WHERE id = $1`,
    [d.id, isoDate(b.bouncedOn) || (await today()), reason.text, reason.code, uid(user)]);
  await refreshSet(db, d.set_id);
  const pdc = await getPdc(db, d.id);
  const emailedTo = await notifyBounce(db, pdc, reason.text);
  return { pdc, emailedTo, message: `Cheque ${d.pdc_number} marked bounced` };
}

// ---------------------------------------------------------------- cancellation, replacement, return

/**
 * Request cancellation (FR-PDC-040): b = { reasonCode, note, replacementFollows }. A cheque Received at TIS, Forwarded,
 * Warehoused or Bounced without a live AR becomes Cancellation pending and waits for a holder of approve:pdc.
 */
export async function requestCancellation(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status === 'cancellation-pending') throw conflict(`A cancellation of cheque ${d.pdc_number} is already pending`);
  if (d.receipt_id) {
    const rc = (await db.query('SELECT receipt_number, receipt_status FROM receipts WHERE id = $1', [d.receipt_id])).rows[0];
    if (rc && rc.receipt_status !== 'Cancelled') throw conflict(`Cheque ${d.pdc_number} has AR ${rc.receipt_number}. Cancel the AR on Accounts > Receipts first`);
  }
  if (!['on-hand', 'forwarded', 'warehoused', 'bounced'].includes(d.status)) throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]} and cannot be cancelled`);
  if (!String(b.reasonCode || '').trim()) throw fail('reasonCode', 'Choose the reason for the cancellation');
  const reason = await requiredReason(db, 'pdc_cancel', { reasonCode: b.reasonCode, note: b.note });
  const follows = REPLACEMENT.includes(b.replacementFollows) ? b.replacementFollows : (REPLACEMENT_BY_REASON[reason.code] || 'none');
  await db.query(`UPDATE post_dated_cheques SET status = 'cancellation-pending', cancel_prior_status = status, cancel_reason_code = $2, cancel_remarks = $3, replacement_follows = $4,
    cancel_requested_by = $5, cancel_requested_at = now(), cancel_approved_by = NULL, cancel_approved_at = NULL, updated_by = $5, updated_at = now() WHERE id = $1`,
  [d.id, reason.code, reason.text, follows, uid(user)]);
  const pdc = await getPdc(db, d.id);
  await notify({ type: 'approval', title: `Cancellation of cheque ${pdc.pdcNumber} to approve`, audience: 'approve:pdc',
    message: `${pdc.clientName || 'Client'}: cheque ${pdc.chequeNumber} for ${await formatMoney(pdc.amount)}, ${reason.text}.`,
    link: `/accounts/post-dated-cheques?cheque=${pdc.id}`, entity: 'post_dated_cheque', entityId: pdc.id });
  return { pdc, message: `Cancellation of cheque ${d.pdc_number} sent for approval` };
}

/**
 * Approve or return a cancellation (FR-PDC-040): b = { action: approve | return, remark }. Never by the requester. On
 * approval a cheque at TIS (or bounced) is Cancelled at once; one the partner holds waits for the pull-out, carried on
 * the next transmittal to that partner. A returned request puts the cheque back in its earlier status.
 */
export async function decideCancellation(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'cancellation-pending' || d.cancel_approved_at) throw conflict(`Cheque ${d.pdc_number} has no cancellation waiting for approval`);
  if (d.cancel_requested_by && d.cancel_requested_by === user?.id) throw forbidden('Maker-checker: the approver must be different from the user who requested the cancellation');
  const remark = String(b.remark || '').trim();
  if (b.action === 'return') {
    if (!remark) throw fail('remark', 'Remark is required');
    await db.query(`UPDATE post_dated_cheques SET status = cancel_prior_status, cancel_prior_status = NULL, cancel_reason_code = NULL, replacement_follows = NULL,
      cancel_remarks = $2, updated_by = $3, updated_at = now() WHERE id = $1`, [d.id, `Cancellation returned: ${remark}`, uid(user)]);
    if (d.cancel_requested_by) {
      await notify({ userId: d.cancel_requested_by, type: 'info', title: `Cancellation of cheque ${d.pdc_number} returned`, message: remark,
        link: `/accounts/post-dated-cheques?cheque=${d.id}`, entity: 'post_dated_cheque', entityId: d.id });
    }
    return { pdc: await getPdc(db, d.id), message: `Cancellation of cheque ${d.pdc_number} returned` };
  }
  if (b.action !== 'approve') throw fail('action', 'Approve or return the request');
  const withPartner = ['forwarded', 'warehoused'].includes(d.cancel_prior_status);
  if (withPartner) {
    await db.query('UPDATE post_dated_cheques SET cancel_approved_by = $2, cancel_approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [d.id, uid(user)]);
  } else {
    await db.query(`UPDATE post_dated_cheques SET status = 'cancelled', custody = 'tis-vault', cancel_approved_by = $2, cancel_approved_at = now(), cancelled_on = $3, cancelled_by = $2,
      updated_by = $2, updated_at = now() WHERE id = $1`, [d.id, uid(user), await today()]);
    await refreshSet(db, d.set_id);
  }
  const partner = withPartner ? (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [d.insurance_company_id])).rows[0]?.name : null;
  return { pdc: await getPdc(db, d.id), pullOut: withPartner,
    message: withPartner ? `Cancellation approved. Pull-out requested from ${partner}` : `Cheque ${d.pdc_number} cancelled` };
}

/** Partner returned (FR-PDC-040): b = { returnedOn, partnerReference }. A pulled-out cheque is back at TIS and Cancelled. */
export async function partnerReturned(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'cancellation-pending' || !d.cancel_approved_at) throw conflict(`Cheque ${d.pdc_number} has no approved pull-out to record`);
  const on = isoDate(b.returnedOn) || (await today());
  const approved = isoDate(d.cancel_approved_at);
  if (on < approved) throw fail('returnedOn', 'Returned on cannot be before the request was approved');
  if (on > (await today())) throw fail('returnedOn', 'Returned on cannot be in the future');
  await db.query(`UPDATE post_dated_cheques SET status = 'cancelled', custody = 'tis-vault', cancelled_on = $2, cancelled_by = $3,
    cancel_remarks = concat_ws(' / ', cancel_remarks, $4::text), updated_by = $3, updated_at = now() WHERE id = $1`,
  [d.id, on, uid(user), b.partnerReference ? `Returned by the partner, ref. ${b.partnerReference}` : null]);
  await refreshSet(db, d.set_id);
  return { pdc: await getPdc(db, d.id), message: `Cheque ${d.pdc_number} cancelled` };
}

/**
 * Replace (FR-PDC-041) a cheque of a set: a Bounced cheque, or one Cancelled for a cheque replacement. The new cheque
 * pays the same instalment for its outstanding amount, in the same set with its payee, Received at TIS; the bounced
 * cheque becomes Replaced, the cancelled one keeps its status; both are linked.
 */
export async function replaceInSet(db, d, b, user) {
  if (!(d.status === 'bounced' || (d.status === 'cancelled' && d.replacement_follows === 'cheque'))) {
    throw conflict(`Cheque ${d.pdc_number} is ${STATUS_TEXT[d.status]}; only a bounced cheque or a cheque cancelled for a cheque replacement is replaced`);
  }
  if (d.replaced_by_id) throw conflict(`Cheque ${d.pdc_number} is already replaced`);
  const set = (await db.query('SELECT * FROM pdc_sets WHERE id = $1 FOR UPDATE', [d.set_id])).rows[0];
  const bill = (await db.query('SELECT * FROM receivables WHERE id = $1', [set.receivable_id])).rows[0];
  const avail = await billRows(db, bill);
  const target = avail.rows.find((r) => r.seq === d.instalment_seq);
  if (!target) throw conflict(`The instalment of cheque ${d.pdc_number} on bill ${bill.bill_number} has nothing left to pay`);
  const receivedDate = isoDate(b.receivedDate) || (await today());
  const [row] = await checkRows(db, [{ ...b, seq: d.instalment_seq }], { receivedDate, bySeq: new Map([[target.seq, target]]),
    brstnRequired: (await getSetting('pdc.brstn_required', false)) === true, tolerance: Number(await getSetting('pdc.date_tolerance_days', 5)) || 0 });
  const id = await insertCheque(db, { ...set, received_date: receivedDate, storage_location: b.storageLocation || set.storage_location }, row,
    { instalmentCount: d.instalment_count, replacesId: d.id }, user);
  await db.query(`UPDATE post_dated_cheques SET status = CASE WHEN status = 'bounced' THEN 'replaced' ELSE status END, replaced_by_id = $2, updated_by = $3, updated_at = now() WHERE id = $1`,
    [d.id, id, uid(user)]);
  await db.query('UPDATE pdc_sets SET status = \'open\', updated_at = now() WHERE id = $1', [set.id]);
  const pdc = await getPdc(db, id);
  return { replaced: await getPdc(db, d.id), pdc, message: `Replacement cheque ${pdc.pdcNumber} encoded in set ${set.set_number}` };
}

/**
 * Return to client (FR-PDC-042): b = { returnedOn, returnedTo, reason }. A cheque in the TIS vault, Received at TIS or
 * Cancelled, is handed back to the client.
 */
export async function returnToClient(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.custody !== 'tis-vault' || !['on-hand', 'cancelled'].includes(d.status)) {
    const where = { partner: 'the Insurance Partner', 'in-transit': 'the courier', returned: 'the client' }[d.custody] || STATUS_TEXT[d.status];
    throw conflict(`Cheque ${d.pdc_number} is with ${where}; only a cheque in the TIS vault can be returned to the client`);
  }
  const reason = String(b.reason || b.remarks || '').trim();
  if (!reason) throw fail('reason', 'A reason is required');
  const on = isoDate(b.returnedOn) || (await today());
  if (on > (await today())) throw fail('returnedOn', 'Returned on cannot be in the future');
  await db.query(`UPDATE post_dated_cheques SET status = 'returned', custody = 'returned', returned_on = $2, return_reason = $3, returned_to = $4, updated_by = $5, updated_at = now()
    WHERE id = $1`, [d.id, on, reason, String(b.returnedTo || '').trim() || null, uid(user)]);
  await refreshSet(db, d.set_id);
  return { pdc: await getPdc(db, d.id), message: `Cheque ${d.pdc_number} returned to the client` };
}

// ---------------------------------------------------------------- follow-up

/**
 * Cheques that need follow-up on `asOf` (FR-PDC-012): Forwarded more than pdc.forward_ack_days ago without the
 * partner's receipt, Warehoused (or Forwarded) more than pdc.confirmation_grace_days past their date without an advice,
 * and approved pull-outs not returned after pdc.forward_ack_days. Each with the reason.
 */
export async function followUpList(db, { asOf = null } = {}) {
  const now = asOf || (await today());
  const ack = Number(await getSetting('pdc.forward_ack_days', 5)) || 0;
  const grace = Number(await getSetting('pdc.confirmation_grace_days', 3)) || 0;
  const rows = (await db.query(`SELECT id, status, forwarded_on, cheque_date, cancel_approved_at FROM post_dated_cheques
    WHERE (status = 'forwarded' AND forwarded_on < $1::date - $2::int)
       OR (status IN ('forwarded', 'warehoused') AND cheque_date < $1::date - $3::int)
       OR (status = 'cancellation-pending' AND cancel_approved_at IS NOT NULL AND cancel_approved_at::date < $1::date - $2::int)
    ORDER BY cheque_date, pdc_number`, [now, ack, grace])).rows;
  const days = (iso) => Math.round((Date.parse(now) - Date.parse(isoDate(iso))) / 86400000);
  const out = [];
  for (const r of rows) {
    let reason;
    if (r.status === 'cancellation-pending') reason = `Pull-out approved ${days(r.cancel_approved_at)} days ago, cheque not returned`;
    else if (r.status === 'forwarded' && isoDate(r.cheque_date) >= addDays(now, -grace)) reason = `Forwarded ${days(r.forwarded_on)} days ago, receipt not confirmed`;
    else reason = `${days(r.cheque_date)} days past date, no maturity advice`;
    out.push({ ...(await getPdc(db, r.id)), followUpReason: reason });
  }
  return { asOf: now, forwardAckDays: ack, confirmationGraceDays: grace, rows: out };
}

/** Daily job "PDC follow-up": one notification to write:pdc users when anything needs follow-up. */
export async function followUpJob(db, { asOf = null } = {}) {
  const f = await followUpList(db, { asOf });
  if (!f.rows.length) return { followUp: 0 };
  await notify({ type: 'reminder', title: `${f.rows.length} post-dated cheques need follow-up`, audience: 'write:pdc',
    message: `${f.rows.length} cheques forwarded, matured or pulled out are waiting for the Insurance Partner.`,
    link: '/accounts/post-dated-cheques?tab=follow-up', entity: 'post_dated_cheque', entityId: f.asOf });
  return { followUp: f.rows.length };
}
