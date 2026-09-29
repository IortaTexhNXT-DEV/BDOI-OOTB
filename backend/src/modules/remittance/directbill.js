/**
 * Direct bill (D36). The client pays the premium directly to the insurer; the broker bills the insurer for its
 * commission with a commission debit note.
 *
 * - Billing mode is stored on the policy (policies.billing_mode = broker | direct, default direct_bill.default_billing_mode).
 *   A direct-bill policy has no premium receivable from the client, no premium payable / remittance to the insurer and
 *   therefore no collection reminders.
 * - Each billing event (issue, endorsement premium change, renewal) books a direct_bill_items row and its journal:
 *     Dr Commission Receivable – Insurers   (commission + VAT)
 *        Cr Brokerage Commission Income     (commission)
 *        Cr Output VAT Payable              (VAT, when direct_bill.broker_vat_registered)
 *   A return premium books the reverse. Agent / referrer commission accrues exactly as for broker-billed policies.
 * - Finance raises a numbered commission debit note (commission_debit_note series, Master > Document Numbering) to an insurer for the unbilled
 *   items of a period. Maker-checker: the maker submits, a different user approves (finance.maker_checker_enabled). The
 *   commission was booked at issue, so approval opens the note for collection without a second posting.
 * - Collections from the insurer (partial allowed) post:
 *     Dr Cash in Bank                        (cash received)
 *     Dr Creditable Withholding Tax          (EWT the insurer withheld, direct_bill.insurer_ewt_rate of the commission)
 *        Cr Commission Receivable – Insurers (cash + EWT)
 *   The note moves Open -> Partially collected -> Collected; when collected, agent commission on its policies becomes
 *   eligible (commission.require_full_payment).
 */
import { many, one, pool, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { queueEmail } from '../../lib/mailer.js';
import { notify } from '../notifications/router.js';
import { account, cashAccountFor, createJournal, reverseJournal } from '../accounting/lib/ledger.js';
import { assertChecker, isoDate, num, round2, today } from '../accounting/lib/http.js';
import { renderTemplate } from '../documents/common.js';
import { formatMoney } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { resolveCreditTerms } from '../commission-rates/terms.js';

export const BILLING_MODES = ['broker', 'direct'];
export const BILLING_MODE_LABELS = { broker: 'Broker billed', direct: 'Direct bill' };
export const DN_STATUS_LABELS = { draft: 'Draft', 'for-approval': 'Pending Approval', open: 'Open', partial: 'Partially Collected', collected: 'Collected', rejected: 'Rejected', cancelled: 'Cancelled' };
const EPS = 0.005;

/** broker | direct from API input ('direct', 'Direct Bill', 'DIRECT_BILLED', 'broker', 'Broker billed'); null when not given. */
export function normaliseBillingMode(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).toLowerCase().replace(/[^a-z]/g, '');
  if (['direct', 'directbill', 'directbilled', 'insurer'].includes(s)) return 'direct';
  if (['broker', 'brokerbill', 'brokerbilled', 'agencybill'].includes(s)) return 'broker';
  throw badRequest('Validation failed', [{ path: 'billingMode', message: `billingMode must be one of ${BILLING_MODES.join(', ')}` }]);
}

/** Billing mode for a new policy: the requested one, else the configured default. */
export async function billingModeFor(requested, insurerId = null) {
  const given = normaliseBillingMode(requested);
  if (given) return given;
  // the insurer's default billing mode (insurer credit terms), else direct_bill.default_billing_mode
  if (insurerId) return (await resolveCreditTerms(insurerId)).billingMode;
  return normaliseBillingMode(await getSetting('direct_bill.default_billing_mode', 'broker')) || 'broker';
}

/**
 * Split a commission into commission (net of VAT), VAT and amount due, from direct_bill.broker_vat_registered,
 * direct_bill.commission_vat_rate (falls back to tax.vat_rate) and direct_bill.commission_vat_inclusive.
 */
export async function commissionTax(gross) {
  const registered = (await getSetting('direct_bill.broker_vat_registered', true)) !== false;
  const configured = await getSetting('direct_bill.commission_vat_rate', null);
  const rate = registered ? Number(configured ?? (await getSetting('tax.vat_rate', 0.12))) || 0 : 0;
  const inclusive = (await getSetting('direct_bill.commission_vat_inclusive', false)) === true;
  const value = round2(gross);
  if (!rate) return { commission: value, vat: 0, amount: value, vatRate: 0 };
  if (inclusive) {
    const net = round2(value / (1 + rate));
    return { commission: net, vat: round2(value - net), amount: value, vatRate: rate };
  }
  const vat = round2(value * rate);
  return { commission: value, vat, amount: round2(value + vat), vatRate: rate };
}

export const ewtRate = async () => Number(await getSetting('direct_bill.insurer_ewt_rate', 0.1)) || 0;

async function policyRow(db, id) {
  const { findPolicy } = await import('../receipts/receivables.js');
  const p = await findPolicy(db, id);
  if (!p) throw notFound(`Policy ${id} not found`);
  return p;
}

/**
 * Book the commission due from the insurer for a direct-bill billing event. amount = premium of the event (negative for a
 * return premium); breakdown = { netPremium, commissionAmount }. Returns the direct_bill_items row, or null when the
 * commission is nil.
 */
export async function bookDirectBill(db, { policy, amount, breakdown = {}, source = 'policy', reference = null, endorsementId = null, date = null, user = null }) {
  const p = await policyRow(db, policy.id || policy);
  const gross = round2(amount);
  if (!gross) throw badRequest('Premium amount is required to book direct-bill commission');
  const sign = gross < 0 ? -1 : 1;
  const { commissionFor } = await import('../receipts/receivables.js');
  const net = Math.abs(num(breakdown.netPremium));
  const base = breakdown.commissionAmount !== undefined && breakdown.commissionAmount !== null
    ? round2(Math.abs(num(breakdown.commissionAmount)))
    : await commissionFor(p, Math.abs(gross), { ...breakdown, netPremium: net }, source);
  if (!(base > 0)) return null;
  const tax = await commissionTax(base);
  const basis = net > 0 ? net : Math.abs(gross);
  const rate = basis ? Math.round((base / basis) * 1e6) / 1e6 : null;
  const bookedOn = isoDate(date) || (await today());
  const it = (await db.query(`INSERT INTO direct_bill_items(policy_id, endorsement_id, insurance_company_id, source, reference, booked_on, currency, gross_premium, net_premium,
      commission_rate, commission, vat, amount, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
  [p.id, endorsementId, p.insurance_company_id, source, reference || p.policy_number, bookedOn, p.currency || (await getSetting('currency.default', 'PHP')), gross,
    round2(sign * (net || Math.abs(gross))), rate, round2(sign * tax.commission), round2(sign * tax.vat), round2(sign * tax.amount), user?.id ?? null])).rows[0];
  const insurer = p.insurer_name || 'insurer';
  const receivable = { accountCode: await account('commission_receivable'), memo: `Commission due from ${insurer}` };
  const income = { accountCode: await account('commission_income'), memo: 'Brokerage commission (direct bill)' };
  const vat = { accountCode: await account('output_vat'), memo: 'Output VAT on commission' };
  const lines = sign > 0
    ? [{ ...receivable, debit: tax.amount }, { ...income, credit: tax.commission }, { ...vat, credit: tax.vat }]
    : [{ ...income, debit: tax.commission }, { ...vat, debit: tax.vat }, { ...receivable, credit: tax.amount }];
  const jv = await createJournal(db, {
    source: 'booking', entryType: 'DIRECT_BILLED', entrySubType: String(source).toUpperCase(), transactionCode: reference || p.policy_number,
    referenceType: 'Policy', referenceId: p.id, policyId: p.id, policyNumber: p.policy_number, date: bookedOn,
    description: `${sign > 0 ? 'Direct-bill commission' : 'Direct-bill commission returned'} – ${p.policy_number}${reference && reference !== p.policy_number ? ` (${reference})` : ''} – ${insurer}`,
    lines,
  }, user);
  await db.query('UPDATE direct_bill_items SET booking_jv_id = $2 WHERE id = $1', [it.id, jv.id]);
  return { ...it, booking_jv_id: jv.id };
}

/** Policy summary for the payment and policy screens: billing mode and the commission due from the insurer. */
export async function directBillSummary(db, policyId) {
  const r = (await db.query(`SELECT COALESCE(sum(amount) FILTER (WHERE status <> 'cancelled'), 0) AS due, count(*) FILTER (WHERE status <> 'cancelled')::int AS n,
      COALESCE(sum(amount) FILTER (WHERE status = 'unbilled'), 0) AS unbilled, COALESCE(sum(amount) FILTER (WHERE status = 'collected'), 0) AS collected
    FROM direct_bill_items WHERE policy_id = $1`, [policyId])).rows[0];
  return { items: r.n, commissionDue: round2(r.due), unbilled: round2(r.unbilled), collected: round2(r.collected) };
}

/** Direct bill: every booked item of the policy is on a fully collected debit note (commission received from the insurer). */
export async function isDirectBillCollected(db, policyId) {
  const r = (await db.query(`SELECT count(*) FILTER (WHERE amount > 0)::int AS total, count(*) FILTER (WHERE amount > 0 AND status <> 'collected')::int AS open
    FROM direct_bill_items WHERE policy_id = $1 AND status <> 'cancelled'`, [policyId])).rows[0];
  return r.total > 0 && r.open === 0;
}

// ---------------- billing mode change (existing policies) ----------------

/**
 * Change a policy's billing mode after issue. broker -> direct: allowed while nothing was collected or remitted; the
 * premium bills are cancelled (booking journals reversed) and the commission is booked against the insurer.
 * direct -> broker: allowed while no commission is on a debit note; the commission bookings are reversed and the
 * premium is billed to the client.
 */
export async function changeBillingMode(policyRef, requested, user, opts = {}) {
  return withTransaction((db) => changeBillingModeIn(db, policyRef, requested, user, opts));
}

/** changeBillingMode inside the caller's transaction. */
export async function changeBillingModeIn(db, policyRef, requested, user, { reason } = {}) {
  const mode = normaliseBillingMode(requested);
  if (!mode) throw badRequest('Validation failed', [{ path: 'billingMode', message: 'billingMode is required' }]);
  const p = await policyRow(db, policyRef);
  await db.query('SELECT id FROM policies WHERE id = $1 FOR UPDATE', [p.id]);
  if (p.billing_mode === mode) throw conflict(`Policy ${p.policy_number} is already ${BILLING_MODE_LABELS[mode].toLowerCase()}`);
  if (['cancelled'].includes(p.status)) throw conflict(`Policy ${p.policy_number} is cancelled`);
  const note = `Billing mode changed to ${BILLING_MODE_LABELS[mode].toLowerCase()}${reason ? ` – ${reason}` : ''}`;
  if (mode === 'direct') {
    const rcvs = (await db.query('SELECT * FROM receivables WHERE policy_id = $1 AND status <> \'cancelled\' ORDER BY created_at FOR UPDATE', [p.id])).rows;
    const applied = (await db.query(`SELECT count(*)::int AS n FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id WHERE r.policy_id = $1 AND a.status = 'applied'`, [p.id])).rows[0].n;
    if (applied || rcvs.some((r) => Number(r.balance) < Number(r.amount))) throw conflict(`Premium has already been collected on ${p.policy_number}; it cannot become direct bill`);
    const pending = (await db.query('SELECT count(*)::int AS n FROM policy_payments WHERE policy_id = $1 AND status = \'submitted\'', [p.id])).rows[0].n;
    if (pending) throw conflict(`A payment on ${p.policy_number} is awaiting finance verification`);
    const remitted = (await db.query(`SELECT count(*)::int AS n FROM remittance_lines l JOIN remittances r ON r.id = l.remittance_id WHERE l.policy_id = $1 AND r.status NOT IN ('rejected','cancelled')`, [p.id])).rows[0].n;
    if (remitted) throw conflict(`${p.policy_number} is on an insurer remittance; it cannot become direct bill`);
    for (const r of rcvs) {
      if (r.booking_jv_id) await reverseJournal(db, r.booking_jv_id, user, { description: `${note} – bill ${r.bill_number} cancelled` });
      await db.query('UPDATE receivables SET status = \'cancelled\', balance = 0, updated_at = now() WHERE id = $1', [r.id]);
      await db.query('UPDATE collection_items SET closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE receivable_id = $1', [r.id]);
    }
    await db.query('UPDATE policies SET billing_mode = \'direct\', bill_number = NULL, updated_by = $2, updated_at = now() WHERE id = $1', [p.id, user?.id ?? null]);
    const events = rcvs.length ? rcvs.map((r) => ({ amount: Number(r.amount), breakdown: { netPremium: Number(r.net_premium), commissionAmount: Number(r.commission_amount) > 0 ? Number(r.commission_amount) : undefined }, source: r.source, reference: r.reference || r.bill_number }))
      : [{ amount: Number(p.premium_total), breakdown: { netPremium: Number(p.net_premium) || undefined }, source: 'policy', reference: p.policy_number }];
    for (const e of events) if (e.amount) await bookDirectBill(db, { policy: p, ...e, user });
  } else {
    const items = (await db.query('SELECT * FROM direct_bill_items WHERE policy_id = $1 AND status <> \'cancelled\' FOR UPDATE', [p.id])).rows;
    if (items.some((i) => i.debit_note_id)) throw conflict(`Commission on ${p.policy_number} is already on a debit note; it cannot become broker billed`);
    for (const i of items) {
      const rev = i.booking_jv_id ? await reverseJournal(db, i.booking_jv_id, user, { description: `${note} – commission booking reversed` }) : null;
      await db.query('UPDATE direct_bill_items SET status = \'cancelled\', reversal_jv_id = $2 WHERE id = $1', [i.id, rev?.id ?? null]);
    }
    await db.query('UPDATE policies SET billing_mode = \'broker\', updated_by = $2, updated_at = now() WHERE id = $1', [p.id, user?.id ?? null]);
    const { createReceivable } = await import('../receipts/receivables.js');
    const fresh = await policyRow(db, p.id);
    let first = null;
    for (const i of items.filter((x) => Number(x.gross_premium) > 0)) {
      const r = await createReceivable(db, { policy: fresh, amount: Number(i.gross_premium), breakdown: { netPremium: Number(i.net_premium) }, source: i.source === 'endorsement' ? 'endorsement' : (i.source === 'renewal' ? 'renewal' : 'policy'), reference: i.reference, user });
      first = first || r;
    }
    if (!items.length) first = await createReceivable(db, { policy: fresh, amount: Number(p.premium_total), breakdown: { netPremium: Number(p.net_premium) || undefined }, source: 'policy', user });
    if (first) await db.query('UPDATE policies SET bill_number = $2 WHERE id = $1', [p.id, first.bill_number]);
  }
  const after = await policyRow(db, p.id);
  return { policyId: p.id, policyNumber: p.policy_number, before: BILLING_MODE_LABELS[p.billing_mode], billingMode: mode, billingModeLabel: BILLING_MODE_LABELS[mode],
    billNumber: after.bill_number, directBill: await directBillSummary(db, p.id) };
}

// ---------------- unbilled commission (Direct Bill Processing grid) ----------------

const ITEM_SQL = `SELECT it.*, p.policy_number, p.inception_date, p.expiry_date, p.client_id, COALESCE(p.insured_name, c.display_name) AS insured_name,
    COALESCE(p.product_type, pr.name) AS product_name, COALESCE(p.lob, upper(pr.line)) AS line_of_business, ic.code AS insurer_code, ic.name AS insurer_name,
    jv.jv_number AS booking_jv_number, e.endorsement_number
  FROM direct_bill_items it JOIN policies p ON p.id = it.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
  LEFT JOIN insurance_companies ic ON ic.id = it.insurance_company_id LEFT JOIN journal_vouchers jv ON jv.id = it.booking_jv_id
  LEFT JOIN endorsements e ON e.id = it.endorsement_id`;

const pctOf = (rate) => (rate === null || rate === undefined ? null : round2(Number(rate) * 100));

export const itemOut = (it, ewt = 0) => ({
  id: it.id, policyId: it.policy_id, policyNo: it.policy_number, reference: it.endorsement_number || (it.source === 'endorsement' ? it.reference : 'New business'), source: it.source,
  insuredName: it.insured_name, product: it.product_name, lineOfBusiness: it.line_of_business, insurerCode: it.insurer_code, insurerName: it.insurer_name,
  inceptionDate: isoDate(it.inception_date), bookedOn: isoDate(it.booked_on), currency: it.currency,
  grossPremium: Number(it.gross_premium), netPremium: Number(it.net_premium), commissionRate: pctOf(it.commission_rate),
  commission: Number(it.commission), vat: Number(it.vat), totalDue: Number(it.amount), expectedEwt: round2(Number(it.commission) * ewt),
  netReceivable: round2(Number(it.amount) - Number(it.commission) * ewt), bookingJournal: it.booking_jv_number, debitNoteId: it.debit_note_id, status: it.status,
});

async function findInsurer(ref, required = true) {
  if (ref === undefined || ref === null || ref === '') {
    if (required) throw badRequest('Validation failed', [{ path: 'insurerCode', message: 'Insurer is required' }]);
    return null;
  }
  const r = await one(`SELECT * FROM insurance_companies WHERE (id::text = $1 OR lower(code) = lower($1) OR lower(name) = lower($1) OR lower(short_name) = lower($1))
    AND status <> 'deleted' ORDER BY id LIMIT 1`, [String(ref)]);
  if (!r) throw badRequest('Validation failed', [{ path: 'insurerCode', message: `Insurer ${ref} was not found` }]);
  return r;
}

/** Unbilled direct-bill commission, insurer-wise (insurerCode, from / to on the booking date, productLine, search). */
export async function unbilledItems(qs) {
  const ins = await findInsurer(qs.insurerCode ?? qs.insurerId, false);
  const conds = ['it.debit_note_id IS NULL', 'it.status = \'unbilled\''];
  const vals = [];
  const add = (sql, v) => { vals.push(v); conds.push(sql.replaceAll('?', `$${vals.length}`)); };
  if (ins) add('it.insurance_company_id = ?', ins.id);
  if (isoDate(qs.from)) add('it.booked_on >= ?::date', isoDate(qs.from));
  if (isoDate(qs.to)) add('it.booked_on <= ?::date', isoDate(qs.to));
  const lines = [].concat(qs.productLine || []).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter((x) => x && x !== 'All');
  if (lines.length) add('(upper(COALESCE(p.lob, pr.line)) = ANY(?) OR upper(COALESCE(p.product_type, pr.name)) = ANY($' + (vals.length + 1) + '))', lines.map((x) => x.toUpperCase()));
  if (qs.search) add('(p.policy_number ILIKE \'%\' || ? || \'%\' OR COALESCE(p.insured_name, c.display_name) ILIKE \'%\' || $' + (vals.length + 1) + ' || \'%\')', qs.search);
  const rows = await many(`${ITEM_SQL} WHERE ${conds.join(' AND ')} ORDER BY ic.name, it.booked_on, p.policy_number`, vals);
  const ewt = await ewtRate();
  const data = rows.map((r) => itemOut(r, ewt));
  const sum = (k) => round2(data.reduce((s, x) => s + x[k], 0));
  return { data, summary: { count: data.length, grossPremium: sum('grossPremium'), commission: sum('commission'), vat: sum('vat'), totalDue: sum('totalDue'), expectedEwt: sum('expectedEwt'), netReceivable: sum('netReceivable'), ewtRate: ewt } };
}

// ---------------- debit notes ----------------

const DN_SELECT = `SELECT d.*, i.code AS insurer_code, i.name AS insurer_name, i.address AS insurer_address, i.tin AS insurer_tin, i.contact_email AS insurer_email,
    (SELECT display_name FROM users u WHERE u.id = d.created_by) AS created_by_name, (SELECT display_name FROM users u WHERE u.id = d.approved_by) AS approved_by_name,
    (SELECT display_name FROM users u WHERE u.id = d.rejected_by) AS rejected_by_name,
    (SELECT count(*)::int FROM commission_debit_note_lines l WHERE l.debit_note_id = d.id) AS line_count
  FROM commission_debit_notes d JOIN insurance_companies i ON i.id = d.insurance_company_id`;

export function debitNoteOut(d) {
  const collected = round2(Number(d.collected_cash) + Number(d.collected_ewt));
  return {
    id: d.id, dnNumber: d.dn_number, debitNoteNo: d.dn_number, dnDate: isoDate(d.dn_date), dueDate: isoDate(d.due_date), periodFrom: isoDate(d.period_from), periodTo: isoDate(d.period_to),
    insurerId: d.insurance_company_id, insurerCode: d.insurer_code, insurerName: d.insurer_name, insurerAddress: d.insurer_address, insurerTin: d.insurer_tin, insurerEmail: d.insurer_email,
    currency: d.currency, policyCount: d.line_count, grossPremium: Number(d.gross_premium), commission: Number(d.commission), vat: Number(d.vat),
    vatRate: Number(d.commission) ? round2(Number(d.vat) / Number(d.commission)) : 0, amount: Number(d.amount), totalDue: Number(d.amount),
    ewtRate: Number(d.ewt_rate), expectedEwt: Number(d.expected_ewt), netPayable: round2(Number(d.amount) - Number(d.expected_ewt)),
    collectedCash: Number(d.collected_cash), collectedEwt: Number(d.collected_ewt), collectedAmount: collected, balance: Number(d.balance),
    status: DN_STATUS_LABELS[d.status] || d.status, statusCode: d.status, remarks: d.remarks,
    createdBy: d.created_by_name || d.created_by, createdById: d.created_by, createdAt: d.created_at, submittedAt: d.submitted_at,
    approvedBy: d.approved_by_name || d.approved_by, approvedAt: d.approved_at, rejectedBy: d.rejected_by_name || d.rejected_by, rejectedAt: d.rejected_at,
    rejectionReason: d.rejection_reason, sentTo: d.sent_to, sentAt: d.sent_at, updatedAt: d.updated_at,
  };
}

const lineOut = (l) => ({
  id: Number(l.id), itemId: l.item_id, lineNo: l.line_no, policyId: l.policy_id, policyNo: l.policy_number, reference: l.reference, insuredName: l.insured_name,
  product: l.product, lineOfBusiness: l.line_of_business, inceptionDate: isoDate(l.inception_date), grossPremium: Number(l.gross_premium),
  commissionRate: pctOf(l.commission_rate), commission: Number(l.commission), vat: Number(l.vat), amount: Number(l.amount),
});

const collectionOut = (x) => ({
  id: x.id, collectionNumber: x.collection_number, receivedDate: isoDate(x.received_date), cashAmount: Number(x.cash_amount), ewtAmount: Number(x.ewt_amount),
  appliedAmount: Number(x.applied_amount), paymentMode: x.payment_mode, cashAccount: x.cash_account, referenceNo: x.reference_no, form2307No: x.form_2307_no,
  remarks: x.remarks, journalNumber: x.jv_number || null, journalId: x.journal_id, status: x.status, createdBy: x.created_by_name || x.created_by, createdAt: x.created_at,
});

async function dnRow(db, id, lock = false) {
  const d = (await db.query(`${lock ? 'SELECT * FROM commission_debit_notes d' : DN_SELECT} WHERE d.id = $1 OR d.dn_number = $1${lock ? ' FOR UPDATE' : ''}`, [String(id)])).rows[0];
  if (!d) throw notFound('Debit note not found');
  return d;
}

export async function getDebitNote(id) {
  const d = await dnRow(pool, id);
  const lines = await many('SELECT * FROM commission_debit_note_lines WHERE debit_note_id = $1 ORDER BY line_no, id', [d.id]);
  const cols = await many(`SELECT x.*, j.jv_number, (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name
    FROM commission_debit_note_collections x LEFT JOIN journal_vouchers j ON j.id = x.journal_id WHERE x.debit_note_id = $1 ORDER BY x.received_date, x.created_at`, [d.id]);
  return { ...debitNoteOut(d), lines: lines.map(lineOut), collections: cols.map(collectionOut) };
}

export async function listDebitNotes(qs, pg) {
  const conds = ['TRUE'];
  const vals = [];
  const add = (sql, v) => { vals.push(v); conds.push(sql.replaceAll('?', `$${vals.length}`)); };
  if (qs.insurerCode || qs.insurerId || qs.insurer) {
    const ins = await findInsurer(qs.insurerCode ?? qs.insurerId ?? qs.insurer);
    add('d.insurance_company_id = ?', ins.id);
  }
  if (qs.status && qs.status !== 'All') {
    const wanted = String(qs.status).split(',').map((s) => s.trim()).map((s) => Object.entries(DN_STATUS_LABELS).find(([k, l]) => k === s || l.toLowerCase() === s.toLowerCase())?.[0] || s.toLowerCase());
    add('d.status = ANY(?)', wanted);
  }
  if (isoDate(qs.from)) add('d.dn_date >= ?::date', isoDate(qs.from));
  if (isoDate(qs.to)) add('d.dn_date <= ?::date', isoDate(qs.to));
  if (qs.search) add('(d.dn_number ILIKE \'%\' || ? || \'%\' OR i.name ILIKE \'%\' || $' + (vals.length + 1) + ' || \'%\')', qs.search);
  const where = conds.join(' AND ');
  const t = await one(`SELECT count(*)::int AS n, COALESCE(sum(d.amount),0) AS amount, COALESCE(sum(d.balance) FILTER (WHERE d.status IN ('open','partial')),0) AS outstanding
    FROM commission_debit_notes d JOIN insurance_companies i ON i.id = d.insurance_company_id WHERE ${where}`, vals);
  const rows = await many(`${DN_SELECT} WHERE ${where} ORDER BY d.dn_date DESC, d.created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`, [...vals, pg.limit, pg.offset]);
  return { rows: rows.map(debitNoteOut), total: t.n, summary: { count: t.n, amount: round2(t.amount), outstanding: round2(t.outstanding) } };
}

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Raise a commission debit note to an insurer for unbilled items: itemIds (or policyIds) selected on screen, else every
 * unbilled item of the insurer booked in the period. submit=true sends it for approval at once.
 */
export async function raiseDebitNote(b, user) {
  const ins = await findInsurer(b.insurerCode ?? b.insurerId);
  const from = isoDate(b.periodFrom ?? b.from);
  const to = isoDate(b.periodTo ?? b.to);
  if (from && to && to < from) throw badRequest('Validation failed', [{ path: 'periodTo', message: 'Period to must not be before period from' }]);
  const dnDate = isoDate(b.dnDate ?? b.billDate) || (await today());
  const id = await withTransaction(async (db) => {
    const itemIds = Array.isArray(b.itemIds) ? b.itemIds.map(String) : null;
    const policyIds = Array.isArray(b.policyIds) ? b.policyIds.map(String) : null;
    const items = (await db.query(`SELECT it.*, p.policy_number, p.inception_date, COALESCE(p.insured_name, c.display_name) AS insured_name, COALESCE(p.product_type, pr.name) AS product_name,
        COALESCE(p.lob, upper(pr.line)) AS line_of_business, e.endorsement_number
      FROM direct_bill_items it JOIN policies p ON p.id = it.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
      LEFT JOIN endorsements e ON e.id = it.endorsement_id
      WHERE it.insurance_company_id = $1 AND it.debit_note_id IS NULL AND it.status = 'unbilled'
        AND ($2::text[] IS NULL OR it.id = ANY($2)) AND ($3::text[] IS NULL OR it.policy_id = ANY($3) OR p.policy_number = ANY($3))
        AND ($4::date IS NULL OR it.booked_on >= $4) AND ($5::date IS NULL OR it.booked_on <= $5)
      ORDER BY it.booked_on, p.policy_number FOR UPDATE OF it`, [ins.id, itemIds, policyIds, from, to])).rows;
    if (itemIds && items.length !== new Set(itemIds).size) throw badRequest('Validation failed', [{ path: 'itemIds', message: 'Some items are not unbilled direct-bill commission of this insurer (already on a debit note?)' }]);
    if (!items.length) throw badRequest('Validation failed', [{ path: 'itemIds', message: `No unbilled direct-bill commission for ${ins.name} in the period` }]);
    const sum = (k) => round2(items.reduce((s, x) => s + Number(x[k]), 0));
    const amount = sum('amount');
    if (!(amount > 0)) throw badRequest('Validation failed', [{ path: 'itemIds', message: 'The debit note total must be greater than zero' }]);
    const rate = await ewtRate();
    const commission = sum('commission');
    const number = await nextDocumentNumber('commission_debit_note', { db });
    const due = isoDate(b.dueDate) || addDays(dnDate, Number(await getSetting('direct_bill.debit_note_due_days', 30)) || 0);
    const submit = b.submit === true || b.submit === 'true';
    const d = (await db.query(`INSERT INTO commission_debit_notes(dn_number, insurance_company_id, period_from, period_to, dn_date, due_date, currency, gross_premium, commission, vat, amount,
        ewt_rate, expected_ewt, balance, status, remarks, created_by, updated_by, submitted_by, submitted_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$11,$14,$15,$16,$16,$17,$18) RETURNING id`,
    [number, ins.id, from, to, dnDate, due, items[0].currency || (await getSetting('currency.default', 'PHP')), sum('gross_premium'), commission, sum('vat'), amount,
      rate, round2(commission * rate), submit ? 'for-approval' : 'draft', b.remarks || null, user.id, submit ? user.id : null, submit ? new Date() : null])).rows[0];
    let n = 0;
    for (const it of items) {
      n += 1;
      await db.query(`INSERT INTO commission_debit_note_lines(debit_note_id, item_id, line_no, policy_id, policy_number, reference, insured_name, product, line_of_business, inception_date,
          gross_premium, commission_rate, commission, vat, amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [d.id, it.id, n, it.policy_id, it.policy_number, it.endorsement_number || it.reference, it.insured_name, it.product_name, it.line_of_business, it.inception_date,
        it.gross_premium, it.commission_rate, it.commission, it.vat, it.amount]);
    }
    await db.query('UPDATE direct_bill_items SET debit_note_id = $2, status = \'billed\' WHERE id = ANY($1)', [items.map((x) => x.id), d.id]);
    return d.id;
  });
  const out = await getDebitNote(id);
  if (out.statusCode === 'for-approval') await askApproval(out);
  return out;
}

const askApproval = async (dn) => notify({ audience: 'write:remittance', type: 'approval', title: 'Commission debit note awaiting approval', message: `${dn.dnNumber} to ${dn.insurerName} for ${await formatMoney(dn.amount, dn.currency)} needs approval`,
  link: '/finance/remittance/directbill', entity: 'commission_debit_note', entityId: dn.id });

/** Release the items of a rejected / cancelled note so they can be billed again. */
async function releaseItems(db, dnId) {
  await db.query('UPDATE direct_bill_items SET debit_note_id = NULL, status = \'unbilled\' WHERE debit_note_id = $1 AND status = \'billed\'', [dnId]);
}

export async function submitDebitNote(id, user) {
  const before = await getDebitNote(id);
  await withTransaction(async (db) => {
    const d = await dnRow(db, id, true);
    if (d.status !== 'draft') throw conflict(`Debit note ${d.dn_number} is ${DN_STATUS_LABELS[d.status]}; only a draft can be submitted`);
    await db.query('UPDATE commission_debit_notes SET status = \'for-approval\', submitted_by = $2, submitted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [d.id, user.id]);
  });
  const after = await getDebitNote(id);
  await askApproval(after);
  return { before, after };
}

/** Maker-checker decision: approve (-> Open, ready to send and collect) or reject (items released). */
export async function decideDebitNote(id, action, body, user) {
  const before = await getDebitNote(id);
  const reason = body?.reason ?? body?.remarks ?? body?.comments ?? null;
  if (action === 'reject' && !String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to reject' }]);
  await withTransaction(async (db) => {
    const d = await dnRow(db, id, true);
    if (d.status !== 'for-approval') throw conflict(`Debit note ${d.dn_number} is ${DN_STATUS_LABELS[d.status]}; only a note pending approval can be ${action === 'approve' ? 'approved' : 'rejected'}`);
    await assertChecker(user, d.created_by, 'debit note');
    await assertChecker(user, d.submitted_by, 'debit note');
    if (action === 'approve') {
      // the approver's remarks go to the audit trail (logged by the route), not onto the printed note
      await db.query('UPDATE commission_debit_notes SET status = \'open\', approved_by = $2, approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1', [d.id, user.id]);
    } else {
      await db.query(`UPDATE commission_debit_notes SET status = 'rejected', rejected_by = $2, rejected_at = now(), rejection_reason = $3, updated_by = $2, updated_at = now() WHERE id = $1`, [d.id, user.id, reason]);
      await releaseItems(db, d.id);
    }
  });
  const after = await getDebitNote(id);
  if (before.createdById) {
    await notify({ userId: before.createdById, type: 'info', title: `Debit note ${action === 'approve' ? 'approved' : 'rejected'}`, message: `${after.dnNumber} to ${after.insurerName} was ${action === 'approve' ? 'approved' : `rejected: ${reason}`}`,
      link: '/finance/remittance/directbill', entity: 'commission_debit_note', entityId: after.id });
  }
  return { before, after: { ...after, decisionRemarks: reason } };
}

/** Cancel a draft / pending note, or an open one with no collection; its items become unbilled again. */
export async function cancelDebitNote(id, body, user) {
  const before = await getDebitNote(id);
  const reason = body?.reason ?? body?.remarks ?? null;
  await withTransaction(async (db) => {
    const d = await dnRow(db, id, true);
    if (!['draft', 'for-approval', 'open'].includes(d.status)) throw conflict(`Debit note ${d.dn_number} is ${DN_STATUS_LABELS[d.status]}; it cannot be cancelled`);
    const posted = (await db.query('SELECT count(*)::int AS n FROM commission_debit_note_collections WHERE debit_note_id = $1 AND status = \'posted\'', [d.id])).rows[0].n;
    if (posted) throw conflict(`Debit note ${d.dn_number} has collections; reverse them first`);
    if (d.status === 'open' && !String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required to cancel an approved debit note' }]);
    await db.query(`UPDATE commission_debit_notes SET status = 'cancelled', cancelled_by = $2, cancelled_at = now(), remarks = COALESCE($3, remarks), balance = 0, updated_by = $2, updated_at = now() WHERE id = $1`, [d.id, user.id, reason]);
    await releaseItems(db, d.id);
  });
  return { before, after: await getDebitNote(id) };
}

/** Queue the debit note e-mail to the insurer (direct_bill.email_subject / email_body). */
export async function sendDebitNote(id, body, user) {
  const dn = await getDebitNote(id);
  if (!['open', 'partial'].includes(dn.statusCode)) throw conflict(`Debit note ${dn.dnNumber} must be approved before it is sent`);
  const to = body?.email || dn.insurerEmail;
  if (!to) throw badRequest('Validation failed', [{ path: 'email', message: `${dn.insurerName} has no e-mail address; enter one` }]);
  const vars = { dnNumber: dn.dnNumber, insurerName: dn.insurerName, amount: `${dn.currency} ${dn.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    dueDate: dn.dueDate, companyName: ((await getSetting('general.company_name')) ?? '') };
  await queueEmail({ to, subject: renderTemplate(await getSetting('direct_bill.email_subject'), vars),
    html: renderTemplate(await getSetting('direct_bill.email_body'), vars), template: 'commission-debit-note', entity: 'commission_debit_note', entityId: dn.id });
  await one('UPDATE commission_debit_notes SET sent_to = $2, sent_at = now(), updated_by = $3, updated_at = now() WHERE id = $1 RETURNING id', [dn.id, to, user.id]);
  return { ...(await getDebitNote(dn.id)), emailedTo: to };
}

/**
 * Record a payment from the insurer against an approved debit note. cashAmount = money received; ewtAmount = tax the
 * insurer withheld (default: the pro-rata share of the expected EWT on the note). Partial collections are allowed.
 */
export async function collectDebitNote(id, b, user) {
  const receivedDate = isoDate(b.receivedDate ?? b.paymentDate) || (await today());
  if (receivedDate > (await today())) throw badRequest('Validation failed', [{ path: 'receivedDate', message: 'The received date cannot be in the future' }]);
  const cash = round2(num(b.cashAmount ?? b.amount));
  if (cash < 0) throw badRequest('Validation failed', [{ path: 'cashAmount', message: 'Amount must not be negative' }]);
  const out = await withTransaction(async (db) => {
    const d = await dnRow(db, id, true);
    if (!['open', 'partial'].includes(d.status)) throw conflict(`Debit note ${d.dn_number} is ${DN_STATUS_LABELS[d.status]}; only an approved, uncollected note can be collected`);
    const balance = Number(d.balance);
    const ewtLeft = round2(Math.max(0, Number(d.expected_ewt) - Number(d.collected_ewt)));
    const cashLeft = round2(balance - ewtLeft);
    let ewt;
    if (b.ewtAmount !== undefined && b.ewtAmount !== null && b.ewtAmount !== '') ewt = round2(num(b.ewtAmount));
    else if (cash >= cashLeft - EPS) ewt = ewtLeft;
    else ewt = cashLeft > 0 ? round2((cash * ewtLeft) / cashLeft) : 0;
    if (ewt < 0) throw badRequest('Validation failed', [{ path: 'ewtAmount', message: 'Withholding tax must not be negative' }]);
    const applied = round2(cash + ewt);
    if (!(applied > 0)) throw badRequest('Validation failed', [{ path: 'cashAmount', message: 'Enter the amount received' }]);
    if (applied > balance + EPS) throw badRequest('Validation failed', [{ path: 'cashAmount', message: `Cash ${cash.toFixed(2)} + tax withheld ${ewt.toFixed(2)} exceeds the balance of ${d.dn_number} (${balance.toFixed(2)})` }]);
    const cashAccount = b.cashAccount ? String(b.cashAccount) : await cashAccountFor(b.paymentMode);
    const number = await nextDocumentNumber('dn_collection', { db });
    const insurer = (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [d.insurance_company_id])).rows[0]?.name || 'insurer';
    const jv = await createJournal(db, {
      source: 'receipt', entryType: 'DIRECT_BILL_COLLECTION', transactionCode: number, referenceType: 'CommissionDebitNote', referenceId: d.id, date: receivedDate,
      description: `Commission collected – ${d.dn_number} – ${insurer}${b.referenceNo ? ` (${b.referenceNo})` : ''}`,
      lines: [
        { accountCode: cashAccount, debit: cash, memo: b.referenceNo || `Collection ${number}` },
        { accountCode: await account('creditable_wht'), debit: ewt, memo: `EWT withheld by ${insurer}${b.form2307No ? ` (BIR 2307 ${b.form2307No})` : ''}` },
        { accountCode: await account('commission_receivable'), credit: applied, memo: `Settles ${d.dn_number}` },
      ],
    }, user);
    const x = (await db.query(`INSERT INTO commission_debit_note_collections(collection_number, debit_note_id, received_date, cash_amount, ewt_amount, applied_amount, payment_mode, cash_account,
        reference_no, form_2307_no, remarks, journal_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [number, d.id, receivedDate, cash, ewt, applied, b.paymentMode || null, cashAccount, b.referenceNo || null, b.form2307No || null, b.remarks || null, jv.id, user.id])).rows[0];
    const left = round2(balance - applied);
    const status = left <= EPS ? 'collected' : 'partial';
    await db.query(`UPDATE commission_debit_notes SET collected_cash = collected_cash + $2, collected_ewt = collected_ewt + $3, balance = $4, status = $5, updated_by = $6, updated_at = now()
      WHERE id = $1`, [d.id, cash, ewt, Math.max(0, left), status, user.id]);
    if (status === 'collected') await onCollected(db, d.id);
    return { collectionId: x.id, collectionNumber: number, journalId: jv.id };
  });
  return { ...(await getDebitNote(id)), collection: out };
}

/** Fully collected: items collected; agent commission on the policies becomes eligible once all their items are collected. */
async function onCollected(db, dnId) {
  await db.query('UPDATE direct_bill_items SET status = \'collected\' WHERE debit_note_id = $1', [dnId]);
  const policies = (await db.query('SELECT DISTINCT policy_id, (SELECT dn_number FROM commission_debit_notes WHERE id = $1) AS dn FROM direct_bill_items WHERE debit_note_id = $1', [dnId])).rows;
  const { onPolicyPremiumCollected } = await import('../commission/service.js');
  for (const p of policies) if (await isDirectBillCollected(db, p.policy_id)) await onPolicyPremiumCollected(db, p.policy_id, p.dn);
}

/** Undo a collection entered in error: reversing journal, balance restored. */
export async function reverseCollection(id, collectionId, body, user) {
  await withTransaction(async (db) => {
    const d = await dnRow(db, id, true);
    const x = (await db.query('SELECT * FROM commission_debit_note_collections WHERE (id = $1 OR collection_number = $1) AND debit_note_id = $2 FOR UPDATE', [String(collectionId), d.id])).rows[0];
    if (!x) throw notFound('Collection not found');
    if (x.status !== 'posted') throw conflict(`Collection ${x.collection_number} is already reversed`);
    if (x.journal_id) await reverseJournal(db, x.journal_id, user, { description: `Reversal of ${x.collection_number} (${d.dn_number})${body?.reason ? ` – ${body.reason}` : ''}` });
    await db.query('UPDATE commission_debit_note_collections SET status = \'reversed\' WHERE id = $1', [x.id]);
    const balance = round2(Number(d.balance) + Number(x.applied_amount));
    const cash = round2(Number(d.collected_cash) - Number(x.cash_amount));
    const ewt = round2(Number(d.collected_ewt) - Number(x.ewt_amount));
    await db.query(`UPDATE commission_debit_notes SET collected_cash = $2, collected_ewt = $3, balance = $4, status = CASE WHEN $2::numeric + $3::numeric > 0 THEN 'partial' ELSE 'open' END, updated_by = $5, updated_at = now()
      WHERE id = $1`, [d.id, cash, ewt, balance, user.id]);
    if (d.status === 'collected') await db.query('UPDATE direct_bill_items SET status = \'billed\' WHERE debit_note_id = $1 AND status = \'collected\'', [d.id]);
  });
  return getDebitNote(id);
}

/** Commission receivable from insurers by debit-note ageing and unbilled (dashboard and Direct Bill Processing header). */
export async function receivableSummary() {
  const r = await one(`SELECT COALESCE((SELECT sum(amount) FROM direct_bill_items WHERE status = 'unbilled'), 0) AS unbilled,
      COALESCE((SELECT sum(balance) FROM commission_debit_notes WHERE status IN ('open','partial')), 0) AS billed,
      COALESCE((SELECT sum(balance) FROM commission_debit_notes WHERE status IN ('open','partial') AND due_date < current_date), 0) AS overdue,
      (SELECT count(*)::int FROM commission_debit_notes WHERE status = 'for-approval') AS pending_approval`);
  return { unbilled: round2(r.unbilled), billedOutstanding: round2(r.billed), overdue: round2(r.overdue), total: round2(Number(r.unbilled) + Number(r.billed)), pendingApproval: r.pending_approval };
}

