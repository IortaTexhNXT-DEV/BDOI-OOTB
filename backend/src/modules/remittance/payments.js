/**
 * Accounts > Remittance > Insurer payments: a read model of the payment vouchers raised for insurer remittances
 * (disbursements of source insurer-remittance), with the batch or cheque that pays them and the bank's result. It
 * creates no payment and posts nothing: batching and release stay in Bank Payment Files and Disbursement, under their
 * own maker-checker.
 *
 * Payment state of a voucher, from its latest bank payment batch line (on a batch that is not cancelled) and its
 * latest cheque (a cheque written by a bank file result is the bank payment itself):
 *   to-pay      not paid, no pending batch line, no cheque in hand; a draft voucher is To pay as well, its next step
 *               is to submit it in Disbursement (Bank Payment Files batches only vouchers submitted for approval)
 *   in-payment  a pending line of a batch (draft to sent), or a cheque prepared or approved
 *   paid        voucher paid, line paid or cheque printed (released)
 *   failed      line rejected by the bank, or cheque cancelled, and nothing newer
 *   cancelled   voucher cancelled (All only)
 * The remittance of a voucher is found through the settlement that raised it (remittance_items.data.disbursementId,
 * remittanceIds) until the Phase 2 lifecycle links them directly.
 *
 * The payee's account number is masked everywhere; GET /payments/:voucherId/account gives it in full to a user with
 * write:disbursements, and the reveal is audited. Electronic transfers of earlier releases (TRF-) are listed read-only
 * with their approval, the journal posted at approval and its reversal.
 */
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { getSetting } from '../../lib/settings.js';
import { activityEntries, instant } from '../../lib/auditEvents.js';
import { printFormat } from '../../lib/pdf/index.js';
import { applyDatePattern } from '../../lib/pdf/format.js';
import { businessTimeZone, isoDate, today as businessToday } from '../../lib/dates.js';
import { params, round2 } from '../masters/helpers.js';
import { eligibleStatuses } from '../integrations/bankfiles/batches.js';
import { codeMoney, decisionContext, limitSourceLabel, roleNames } from './decision.js';

export const SEGMENTS = ['to-pay', 'in-payment', 'paid', 'failed', 'all'];
export const STATES = { 'to-pay': 'To pay', 'in-payment': 'In payment', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled' };
export const METHODS = { 'fund-transfer': 'Fund transfer', cheque: 'Cheque' };
const BATCH_STATUS = { draft: 'Draft', 'for-approval': 'Pending approval', approved: 'Approved', 'file-generated': 'File generated', sent: 'Sent to bank', completed: 'Completed', cancelled: 'Cancelled' };
const VOUCHER_STATUS = { draft: 'Draft', 'for-approval': 'Submitted', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled' };
export const NO_LAYOUT = 'No Metrobank layout configured. Pay by cheque or ask the administrator.';
const LAYOUTS_LINK = '/master/finance/bank-file-layouts';
const voucherLink = (id) => `/accounts/paymentvoucher/detailview/${id}`;
const batchLink = (id) => `/accounts/bank-payment-files?batch=${id}`;
const remittanceLink = (id) => `/finance/remittance/remittances/${id}`;
const paymentLink = (no) => `/finance/remittance/payments?payment=${encodeURIComponent(no)}`;

/** "···4821": the last four digits of an account number. */
export const maskAccount = (n) => {
  const digits = String(n || '').replace(/\D/g, '');
  return digits ? `···${digits.slice(-4)}` : null;
};

const STATE_SQL = `CASE
    WHEN d.status = 'cancelled' THEN 'cancelled'
    WHEN d.status = 'paid' OR d.paid_at IS NOT NULL OR bl.status = 'paid' OR ch.status = 'Printed' THEN 'paid'
    WHEN bl.status = 'pending' OR ch.status IN ('Pending', 'Approved') THEN 'in-payment'
    WHEN bl.status = 'rejected' OR ch.status = 'Cancelled' THEN 'failed'
    ELSE 'to-pay' END`;
const METHOD_SQL = `CASE WHEN ch.status IN ('Pending', 'Approved', 'Printed') THEN 'cheque' WHEN bl.id IS NOT NULL THEN 'fund-transfer' WHEN ch.id IS NOT NULL THEN 'cheque' END`;

// one row per insurer voucher, with its settlement, latest batch line, latest cheque and the insurer's bank account
const BASE = `SELECT d.id, d.voucher_number, d.status AS voucher_status, d.amount, d.voucher_date, d.paid_at, d.reference_no, d.created_by, d.created_at,
    d.insurance_company_id, d.payee_name, d.journal_id, d.approved_by, d.approved_at,
    i.code AS insurer_code, i.name AS insurer_name, i.short_name AS insurer_short_name,
    x.id AS settlement_id, x.reference_no AS settlement_no, COALESCE(x.data->'remittanceIds', '[]'::jsonb) AS remittance_ids,
    bl.id AS line_id, bl.status AS line_status, bl.bank_reference AS line_bank_reference, bl.reason AS line_reason, bl.amount AS line_amount, bl.result_at AS line_result_at,
    bl.result_by AS line_result_by, bl.result_source AS line_result_source, bl.journal_id AS line_journal_id,
    bl.batch_id, bl.batch_number, bl.batch_status, bl.batch_value_date, bl.batch_created_by, bl.batch_created_at, bl.batch_submitted_by, bl.batch_submitted_at,
    bl.batch_approved_by, bl.batch_approved_at, bl.batch_file_name, bl.batch_file_generated_by, bl.batch_file_generated_at, bl.batch_sent_at, bl.batch_bank_account_code,
    ch.id AS cheque_id, ch.instrument_no AS cheque_no, ch.status AS cheque_status, ch.instrument_date AS cheque_date, ch.totale_amount AS cheque_amount,
    ch.journal_id AS cheque_journal_id, ch.printed_at AS cheque_printed_at, ch.created_by AS cheque_created_by, ch.approved_by AS cheque_approved_by, ch.approved_at AS cheque_approved_at,
    pa.bank_code AS payee_bank_code, pa.bank_name AS payee_bank_name, pa.account_number AS payee_account_number, pa.account_name AS payee_account_name,
    ${STATE_SQL} AS state, ${METHOD_SQL} AS method,
    COALESCE(bl.batch_value_date, ch.instrument_date, d.voucher_date) AS value_date,
    COALESCE(d.paid_at, CASE WHEN bl.status = 'paid' THEN bl.result_at END, ch.printed_at) AS paid_on,
    COALESCE(bl.bank_reference, CASE WHEN d.paid_at IS NOT NULL THEN d.reference_no END) AS bank_reference
  FROM disbursements d
  LEFT JOIN insurance_companies i ON i.id = d.insurance_company_id
  LEFT JOIN LATERAL (SELECT s.id, s.reference_no, s.data FROM remittance_items s WHERE s.kind = 'settlement' AND s.data->>'disbursementId' = d.id ORDER BY s.created_at DESC LIMIT 1) x ON TRUE
  LEFT JOIN LATERAL (SELECT l.*, b.batch_number, b.status AS batch_status, b.value_date AS batch_value_date, b.created_by AS batch_created_by, b.created_at AS batch_created_at,
      b.submitted_by AS batch_submitted_by, b.submitted_at AS batch_submitted_at, b.approved_by AS batch_approved_by, b.approved_at AS batch_approved_at, b.file_name AS batch_file_name,
      b.file_generated_by AS batch_file_generated_by, b.file_generated_at AS batch_file_generated_at, b.sent_at AS batch_sent_at, b.bank_account_code AS batch_bank_account_code
    FROM bank_payment_batch_lines l JOIN bank_payment_batches b ON b.id = l.batch_id
    WHERE l.disbursement_id = d.id AND b.status <> 'cancelled' ORDER BY b.created_at DESC, l.id DESC LIMIT 1) bl ON TRUE
  LEFT JOIN LATERAL (SELECT c.* FROM checkbooks c WHERE c.disbursement_id = d.id AND c.instrument_book_id IS DISTINCT FROM 'BANK-FILE' ORDER BY c.created_at DESC LIMIT 1) ch ON TRUE
  LEFT JOIN LATERAL (SELECT a.bank_code, b.name AS bank_name, a.account_number, a.account_name FROM payee_bank_accounts a LEFT JOIN banks b ON upper(b.code) = upper(a.bank_code)
    WHERE a.payee_type = 'Insurer' AND a.payee_id = d.insurance_company_id::text AND a.active ORDER BY a.is_default DESC, a.id LIMIT 1) pa ON TRUE
  WHERE d.source = 'insurer-remittance'`;

/** The filters of the page shared by the rows, the totals, the KPI figures and the segment counts (not the segment). */
function filterConds(qs, p) {
  const conds = ['TRUE'];
  if (qs.insurerId) conds.push(`(p.insurance_company_id::text = ${p.add(String(qs.insurerId))} OR lower(p.insurer_code) = lower($${p.values.length}))`);
  const from = isoDate(qs.from);
  const to = isoDate(qs.to);
  if (from) conds.push(`p.value_date >= ${p.add(from)}::date`);
  if (to) conds.push(`p.value_date <= ${p.add(to)}::date`);
  if (METHODS[qs.method]) conds.push(`p.method = ${p.add(qs.method)}`);
  if (qs.q) {
    const like = p.add(`%${String(qs.q).trim()}%`);
    conds.push(`(p.voucher_number ILIKE ${like} OR p.bank_reference ILIKE ${like} OR p.batch_number ILIKE ${like}
      OR EXISTS (SELECT 1 FROM remittances r WHERE p.remittance_ids ? r.id AND r.remittance_number ILIKE ${like}))`);
  }
  return conds;
}

/**
 * Can insurer vouchers be put on a batch, for `user`? { allowed, code, reason, layout, bankCode, chequeAllowed,
 * setupLink (administrators) }. A batch needs write:disbursements and an active payment file layout of the bank of
 * remittance.payment_bank_code (Metrobank); paying by cheque stays possible either way.
 */
export async function batchingFor(user) {
  const bankCode = (await getSetting('remittance.payment_bank_code')) || 'MBT';
  const layout = await one("SELECT code, name FROM bank_file_layouts WHERE upper(bank_code) = upper($1) AND active ORDER BY is_example, code LIMIT 1", [bankCode]);
  const base = { bankCode, layout: layout ? { code: layout.code, name: layout.name } : null, chequeAllowed: hasPermission(user, 'write:disbursements'),
    ...(isAdmin(user) ? { setupLink: LAYOUTS_LINK } : {}) };
  if (!hasPermission(user, 'write:disbursements')) return { ...base, allowed: false, code: 'NO_PERMISSION', reason: 'You can view insurer payments but not pay them.' };
  if (!layout) return { ...base, allowed: false, code: 'NO_LAYOUT', reason: NO_LAYOUT };
  return { ...base, allowed: true, code: null, reason: null };
}

/** The next step of a payment and who takes it. */
function nextStepOf(r, hasAccount) {
  const step = (code, label, actor = 'Disbursement') => ({ code, label, actor: { type: 'permission', name: actor } });
  if (r.state === 'paid' || r.state === 'cancelled') return null;
  if (r.state === 'failed') {
    const why = r.method === 'cheque' ? 'Cheque cancelled' : r.line_reason || 'Rejected by the bank';
    return { ...step('repay', 'Re-batch or pay by cheque', 'Bank Payment Files'), reason: why };
  }
  if (r.state === 'in-payment') {
    if (r.method === 'cheque') return r.cheque_status === 'Pending' ? step('approve-cheque', 'Approve cheque') : step('release-cheque', 'Release cheque');
    const b = { draft: ['submit-batch', 'Submit batch'], 'for-approval': ['approve-batch', 'Approve batch'], approved: ['generate-file', 'Generate bank file'],
      'file-generated': ['send-file', 'Upload file to the bank'], sent: ['import-result', 'Import bank result'] }[r.batch_status];
    return b ? step(b[0], `${b[1]} ${r.batch_number}`, 'Bank Payment Files') : null;
  }
  if (r.voucher_status === 'draft') return step('submit-voucher', 'Submit voucher (Disbursement)');
  if (!hasAccount) return step('add-account', 'Add bank account or pay by cheque');
  return step('create-batch', 'Create batch', 'Bank Payment Files');
}

/** Payment rows of `user` from BASE rows: state, payee, method, batch, next step, selectable, actions. */
async function rowsOut(raw, user, batching) {
  const remIds = [...new Set(raw.flatMap((r) => r.remittance_ids || []))];
  const rems = remIds.length ? await many('SELECT id, remittance_number, net_due, status FROM remittances WHERE id = ANY($1) ORDER BY remittance_number', [remIds]) : [];
  const byId = new Map(rems.map((r) => [r.id, r]));
  const batchable = await eligibleStatuses();
  const write = hasPermission(user, 'write:disbursements');
  const differences = await voucherDifferences(raw.filter((r) => ['to-pay', 'failed'].includes(r.state)).map((r) => r.id));
  return raw.map((r) => {
    const remittances = (r.remittance_ids || []).map((id) => byId.get(id)).filter(Boolean)
      .map((x) => ({ id: x.id, remittanceNo: x.remittance_number, dueToInsurer: round2(x.net_due), link: remittanceLink(x.id) }));
    const hasAccount = !!r.payee_account_number;
    const bank = r.payee_bank_name || r.payee_bank_code || null;
    const difference = differences.get(r.id) || null;
    const selectable = ['to-pay', 'failed'].includes(r.state) && hasAccount && batchable.includes(r.voucher_status) && batching.allowed && !difference;
    const actions = [{ code: 'view', label: 'View payment', allowed: true, link: paymentLink(r.voucher_number) }];
    if (remittances.length) actions.push({ code: 'open-remittance', label: 'Open remittance', allowed: true, link: remittances[0].link });
    if (r.batch_id) actions.push({ code: 'open-batch', label: 'Open batch', allowed: true, link: batchLink(r.batch_id) });
    if (['to-pay', 'failed'].includes(r.state) && write) actions.push({ code: 'pay-by-cheque', label: 'Pay by cheque', allowed: true, link: voucherLink(r.id) });
    if (r.state === 'failed' && write && selectable) actions.push({ code: 'rebatch', label: 'Re-batch', allowed: true });
    if (!hasAccount && write && r.state !== 'paid') actions.push({ code: 'add-account', label: 'Add bank account', allowed: true, link: LAYOUTS_LINK });
    if (r.state === 'paid' && remittances.length) {
      actions.push({ code: 'download-advice', label: 'Download advice (PDF)', allowed: true, href: `/remittance/remittances/${remittances[0].id}/advice.pdf` });
    }
    return {
      id: r.id, voucherNo: r.voucher_number, voucherStatus: r.voucher_status, voucherStatusLabel: VOUCHER_STATUS[r.voucher_status] || r.voucher_status,
      state: r.state, stateLabel: STATES[r.state], amount: round2(r.amount), currency: 'PHP',
      insurer: r.insurance_company_id ? { id: r.insurance_company_id, code: r.insurer_code, name: r.insurer_name, shortName: r.insurer_short_name || r.insurer_name } : null,
      remittance: remittances[0] || null, remittances,
      settlement: r.settlement_id ? { id: r.settlement_id, reference: r.settlement_no } : null,
      payee: { bank: bank ? { code: r.payee_bank_code, name: bank } : null, accountMasked: maskAccount(r.payee_account_number), accountName: r.payee_account_name || null,
        label: hasAccount ? `${bank} ${maskAccount(r.payee_account_number)}` : null,
        chip: hasAccount ? { code: 'on-file', label: 'On file' } : { code: 'none', label: 'No account' } },
      method: r.method ? { code: r.method, label: METHODS[r.method] } : null,
      batch: r.batch_id ? { id: r.batch_id, number: r.batch_number, status: r.batch_status, statusLabel: BATCH_STATUS[r.batch_status] || r.batch_status, link: batchLink(r.batch_id) } : null,
      cheque: r.cheque_id ? { id: r.cheque_id, number: r.cheque_no, status: r.cheque_status } : null,
      valueDate: isoDate(r.value_date), bankReference: r.bank_reference || null, paidOn: r.paid_on ? new Date(r.paid_on).toISOString() : null,
      failureReason: r.state === 'failed' ? (r.method === 'cheque' ? 'Cheque cancelled' : r.line_reason || 'Rejected by the bank') : null,
      amountDifference: difference ? { amount: difference.difference, text: difference.text } : null,
      nextStep: difference ? { code: 'amount-difference', label: 'Correct the voucher amount (Disbursement)', actor: { type: 'permission', name: 'Disbursement' }, reason: difference.text }
        : nextStepOf(r, hasAccount),
      selectable, actions, link: paymentLink(r.voucher_number), voucherLink: voucherLink(r.id),
    };
  });
}

/** KPI figures and segment counts over the filters of the page. */
async function kpisOf(conds, values) {
  const tz = await businessTimeZone();
  const p = params([...values]);
  const t = p.add(await businessToday());
  const z = p.add(tz);
  const k = await one(`SELECT
      count(*) FILTER (WHERE p.state = 'to-pay')::int AS to_pay, COALESCE(sum(p.amount) FILTER (WHERE p.state = 'to-pay'), 0) AS to_pay_amount,
      count(*) FILTER (WHERE p.state = 'in-payment')::int AS in_payment, COALESCE(sum(p.amount) FILTER (WHERE p.state = 'in-payment'), 0) AS in_payment_amount,
      count(*) FILTER (WHERE p.state = 'paid')::int AS paid,
      count(*) FILTER (WHERE p.state = 'paid' AND (p.paid_on AT TIME ZONE ${z})::date >= date_trunc('week', ${t}::date)::date)::int AS paid_week,
      COALESCE(sum(p.amount) FILTER (WHERE p.state = 'paid' AND (p.paid_on AT TIME ZONE ${z})::date >= date_trunc('week', ${t}::date)::date), 0) AS paid_week_amount,
      count(*) FILTER (WHERE p.state = 'failed')::int AS failed, COALESCE(sum(p.amount) FILTER (WHERE p.state = 'failed'), 0) AS failed_amount,
      count(*)::int AS all_count
    FROM (${BASE}) p WHERE ${conds.join(' AND ')}`, p.values);
  return {
    kpis: {
      toPay: { count: k.to_pay, amount: round2(k.to_pay_amount) }, inPayment: { count: k.in_payment, amount: round2(k.in_payment_amount) },
      paidThisWeek: { count: k.paid_week, amount: round2(k.paid_week_amount) }, failed: { count: k.failed, amount: round2(k.failed_amount) },
    },
    segments: { 'to-pay': k.to_pay, 'in-payment': k.in_payment, paid: k.paid, failed: k.failed, all: k.all_count },
  };
}

/**
 * The vouchers among `ids` whose amount differs from what their remittances owe (due to insurer, less the refund
 * credits netted on the voucher): Map voucherId -> { voucherAmount, dueToInsurer, refundCredits, difference, text }.
 * Such a voucher is not batched: the voucher of an R1 settlement pays the premium collected, which can fall short of
 * the remittance (a policy not collected yet).
 */
export async function voucherDifferences(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const fmt = await printFormat();
  const rows = await many(`SELECT d.id, d.amount, (SELECT sum(r.net_due) FROM remittances r WHERE x.data->'remittanceIds' ? r.id) AS due,
      COALESCE((SELECT sum((ap->>'amount')::numeric) FROM insurer_refund_credits c CROSS JOIN LATERAL jsonb_array_elements(c.applications) ap WHERE ap->>'disbursementId' = d.id), 0) AS refund
    FROM disbursements d JOIN LATERAL (SELECT s.data FROM remittance_items s WHERE s.kind = 'settlement' AND s.data->>'disbursementId' = d.id ORDER BY s.created_at DESC LIMIT 1) x ON TRUE
    WHERE d.id = ANY($1) AND d.source = 'insurer-remittance'`, [ids.map(String)]);
  for (const r of rows.filter((x) => x.due !== null)) {
    const expected = round2(Number(r.due) - Number(r.refund));
    const difference = round2(Number(r.amount) - expected);
    if (Math.abs(difference) < 0.005) continue;
    const money = (v) => codeMoney(Math.abs(v), fmt);
    out.set(r.id, { voucherAmount: round2(r.amount), dueToInsurer: round2(r.due), refundCredits: round2(r.refund), difference,
      text: `Voucher ${money(r.amount)} is ${money(difference)} ${difference < 0 ? 'less' : 'more'} than the ${money(expected)} due to the insurer.` });
  }
  return out;
}

/** Count of TRF- items of earlier releases (the Legacy transfers segment shows only when there are some). */
const legacyCount = async () => (await one("SELECT count(*)::int AS n FROM remittance_items WHERE kind = 'transfer'")).n;

/**
 * GET /remittance/payments?segment=: { segment, rows (one page), total, totals (count, amount) of the filtered set,
 * kpis and segment counts over the filters, batching, legacyTransfers (count of TRF- items) }.
 */
export async function paymentList(qs, user, pg) {
  const segment = SEGMENTS.includes(qs.segment) ? qs.segment : 'to-pay';
  const p = params();
  const base = filterConds(qs, p);
  const baseValues = [...p.values];
  const where = [...base, segment === 'all' ? 'TRUE' : `p.state = ${p.add(segment)}`].join(' AND ');
  const agg = await one(`SELECT count(*)::int AS n, COALESCE(sum(p.amount), 0) AS amount FROM (${BASE}) p WHERE ${where}`, p.values);
  const raw = await many(`SELECT p.* FROM (${BASE}) p WHERE ${where}
    ORDER BY CASE p.state WHEN 'failed' THEN 0 WHEN 'to-pay' THEN 1 WHEN 'in-payment' THEN 2 ELSE 3 END, p.voucher_date DESC, p.voucher_number DESC
    LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  const batching = await batchingFor(user);
  const { kpis, segments } = await kpisOf(base, baseValues);
  return { segment, rows: await rowsOut(raw, user, batching), total: agg.n, totals: { count: agg.n, amount: round2(agg.amount) }, kpis, segments, batching,
    legacyTransfers: await legacyCount() };
}

export const EXPORT_HEADER = ['Voucher no', 'Remittance', 'Insurer', 'Amount', 'Payee account', 'Account', 'Method', 'Batch', 'Batch status', 'Value date', 'Bank ref',
  'Paid on', 'State', 'Next step'];

/** The rows of Export XLSX: every payment of the segment and filters of GET /payments (not one page). */
export async function paymentExport(qs, user) {
  const r = await paymentList(qs, user, { limit: 100000, offset: 0 });
  const fmt = await printFormat();
  const day = (v) => (v ? instant(v, fmt)?.date || '' : '');
  const rows = r.rows.map((x) => [x.voucherNo, x.remittances.map((m) => m.remittanceNo).join(', '), x.insurer?.name || '', x.amount, x.payee.label || '', x.payee.chip.label,
    x.method?.label || '', x.batch?.number || '', x.batch?.statusLabel || '', x.valueDate ? applyDatePattern(x.valueDate, fmt.dateFormat) : '', x.bankReference || '', day(x.paidOn), x.stateLabel,
    [x.nextStep?.label, x.nextStep?.reason].filter(Boolean).join(' · ')]);
  return { segment: r.segment, rows };
}

const nameOf = async (id) => (id ? (await one('SELECT display_name, username FROM users WHERE id = $1', [id]).then((u) => u?.display_name || u?.username || null)) : null);
const personAt = async (id, at) => (id || at ? { name: await nameOf(id), at: at ? new Date(at).toISOString() : null } : null);

async function paymentRow(voucherId) {
  const r = await one(`SELECT p.* FROM (${BASE}) p WHERE p.id = $1 OR p.voucher_number = $1`, [String(voucherId)]);
  if (!r) throw notFound('Insurer payment not found');
  return r;
}

/** The approvals of the remittances a voucher pays: who approved each, when, with which limit. */
async function remittanceApprovals(remittances) {
  if (!remittances.length) return [];
  const ctx = await decisionContext({ id: null });
  const names = await roleNames(ctx);
  const rows = await many(`SELECT a.entity_id, h.value AS h, u.display_name, u.username FROM remittance_approvals a CROSS JOIN LATERAL jsonb_array_elements(a.history) h
      LEFT JOIN users u ON u.id = h.value->>'by'
    WHERE a.entity = 'remittance' AND a.entity_id = ANY($1) AND a.status = 'Approved' AND h.value->>'action' = 'Approved' ORDER BY h.value->>'at'`, [remittances.map((x) => x.id)]);
  return rows.map((r) => ({ remittanceNo: remittances.find((x) => x.id === r.entity_id)?.remittanceNo || null, by: r.display_name || r.username || null, at: r.h.at || null,
    limitAtDecision: r.h.limitAtDecision ?? null, limitSourceLabel: limitSourceLabel(r.h.limitSource, names) }));
}

/** The activity of the voucher, its batch and its cheques (audit trail), oldest first. */
async function paymentActivity(r, user) {
  const rows = await many(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
    WHERE (a.entity = 'disbursement' AND a.entity_id = $1) OR (a.entity = 'bank_payment_batch' AND a.entity_id = $2) OR (a.entity = 'checkbook' AND a.entity_id = ANY($3))
       OR (a.entity = 'payee_bank_account' AND a.action = 'reveal' AND a.after_data->>'voucherId' = $1)
    ORDER BY a.at, a.id`, [r.id, r.batch_id || '', (await many('SELECT id FROM checkbooks WHERE disbursement_id = $1', [r.id])).map((c) => c.id)]);
  return activityEntries(rows, { viewer: user });
}

/** The steps of the payment, with when and by whom each was taken (null while not taken). */
async function timelineOf(r) {
  const step = async (code, label, at, by) => ({ code, label, done: !!at, at: at ? new Date(at).toISOString() : null, by: await nameOf(by) });
  const out = [await step('voucher-raised', 'Voucher raised', r.created_at, r.created_by)];
  if (r.method === 'cheque') {
    out.push(await step('cheque-prepared', 'Cheque prepared', r.cheque_id ? r.cheque_date : null, r.cheque_created_by));
    out.push(await step('cheque-approved', 'Cheque approved', r.cheque_approved_at, r.cheque_approved_by));
    out.push(await step(r.cheque_status === 'Cancelled' ? 'cancelled' : 'paid', r.cheque_status === 'Cancelled' ? 'Cheque cancelled' : 'Paid', r.cheque_printed_at, null));
    return out;
  }
  out.push(await step('in-batch', 'In batch', r.batch_created_at, r.batch_created_by));
  out.push(await step('batch-approved', 'Batch approved', r.batch_approved_at, r.batch_approved_by));
  out.push(await step('file-generated', 'File generated', r.batch_file_generated_at, r.batch_file_generated_by));
  out.push(await step('sent', 'Sent', r.batch_sent_at, null));
  const rejected = r.line_status === 'rejected';
  out.push({ ...(await step(rejected ? 'rejected' : 'paid', rejected ? 'Rejected' : 'Paid', r.line_status === 'pending' ? null : r.line_result_at || r.paid_on, r.line_result_by)),
    ...(rejected ? { reason: r.line_reason || null } : {}) });
  return out;
}

/**
 * GET /remittance/payments/:voucherId (id or voucher no.): the row and the sections of the payment record panel:
 * payee, payment, amounts (with the check of the voucher against the remittances), links, approvals, the timeline
 * and the activity of the voucher, its batch and its cheques.
 */
export async function paymentRecord(voucherId, user) {
  const r = await paymentRow(voucherId);
  const batching = await batchingFor(user);
  const [row] = await rowsOut([r], user, batching);
  const debit = r.batch_bank_account_code ? await one('SELECT bank_account_name, bank_name, account_number FROM bank_account_links WHERE bank_account_code = $1', [r.batch_bank_account_code]) : null;
  const credits = await one(`SELECT COALESCE(sum((ap->>'amount')::numeric), 0) AS amount FROM insurer_refund_credits c CROSS JOIN LATERAL jsonb_array_elements(c.applications) ap
    WHERE ap->>'disbursementId' = $1`, [r.id]);
  const journalId = r.line_journal_id || r.cheque_journal_id || r.journal_id;
  const journal = journalId ? await one('SELECT id, jv_number FROM journal_vouchers WHERE id = $1', [journalId]) : null;
  const statusFile = r.batch_id ? await one(`SELECT external_ref, received_at, received_by FROM integration_inbox WHERE entity = 'bank_payment_batch' AND entity_id = $1
    AND message_type = 'bank.status_file' ORDER BY received_at DESC LIMIT 1`, [r.batch_id]) : null;
  const due = round2(row.remittances.reduce((s, x) => s + x.dueToInsurer, 0));
  const refund = round2(credits.amount);
  const bankAmount = r.line_id ? round2(r.line_amount) : r.cheque_id ? round2(r.cheque_amount) : null;
  const difference = row.remittances.length ? round2(row.amount - (due - refund)) : null;
  const pass = (difference === null || Math.abs(difference) < 0.005) && (bankAmount === null || Math.abs(bankAmount - row.amount) < 0.005);
  return {
    ...row,
    payee: { ...row.payee, insurer: row.insurer, canReveal: hasPermission(user, 'write:disbursements'), verification: row.payee.chip },
    payment: {
      method: row.method, amount: row.amount, valueDate: row.valueDate,
      debitAccount: debit ? { name: debit.bank_account_name, label: `${debit.bank_name || debit.bank_account_name} ${maskAccount(debit.account_number)}` } : null,
      bankReference: row.bankReference, paidOn: row.paidOn, failureReason: row.failureReason,
    },
    amounts: { dueToInsurer: row.remittances.length ? due : null, refundCredits: refund, voucherAmount: row.amount, bankAmount,
      check: { code: pass ? 'pass' : 'difference', label: pass ? 'Pass' : 'Difference', difference } },
    links: {
      remittances: row.remittances.map((x) => ({ remittanceNo: x.remittanceNo, link: x.link, schedule: `/remittance/remittances/${x.id}/schedule.xlsx` })),
      voucher: { number: r.voucher_number, link: voucherLink(r.id) },
      batch: row.batch, bankFile: r.batch_file_name ? { name: r.batch_file_name, href: `/bank-payments/batches/${r.batch_id}/file` } : null,
      statusFile: statusFile ? { name: statusFile.external_ref || null, at: new Date(statusFile.received_at).toISOString() } : null,
      cheque: row.cheque, journal: journal ? { id: journal.id, number: journal.jv_number } : null, bankReconciliation: null,
    },
    approvals: {
      remittances: await remittanceApprovals(row.remittances), voucherMaker: await personAt(r.created_by, r.created_at),
      batchCreatedBy: r.batch_id ? await personAt(r.batch_created_by, r.batch_created_at) : null,
      batchApprovedBy: r.batch_approved_by ? await personAt(r.batch_approved_by, r.batch_approved_at) : null,
      fileGeneratedBy: r.batch_file_generated_at ? await personAt(r.batch_file_generated_by, r.batch_file_generated_at) : null,
      resultImportedBy: r.line_result_at ? { ...(await personAt(r.line_result_by, r.line_result_at)), source: r.line_result_source === 'file' ? 'Status file' : 'Entered by hand' } : null,
    },
    timeline: await timelineOf(r),
    activity: await paymentActivity(r, user),
    batching,
  };
}

/** GET /remittance/payments/:voucherId/account: the payee's full account number (write:disbursements; audited by the route). */
export async function paymentAccount(voucherId) {
  const r = await paymentRow(voucherId);
  if (!r.payee_account_number) throw notFound('No bank account on file for this insurer');
  return { voucherId: r.id, voucherNo: r.voucher_number, bank: r.payee_bank_name || r.payee_bank_code, accountNumber: r.payee_account_number, accountName: r.payee_account_name };
}

// ---------------- electronic transfers of earlier releases (TRF-) ----------------

const TRANSFER_SELECT = `SELECT x.*, j.id AS jv_id, j.jv_number, j.reversed_by_jv, rj.jv_number AS reversal_jv_number, rj.jv_date AS reversal_date,
    (SELECT display_name FROM users u WHERE u.id = x.approved_by) AS approved_by_name, (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name,
    i.name AS insurer_name
  FROM remittance_items x LEFT JOIN journal_vouchers j ON j.id = x.journal_id LEFT JOIN journal_vouchers rj ON rj.id = j.reversed_by_jv
  LEFT JOIN insurance_companies i ON i.id = x.insurance_company_id`;

function transferOut(x) {
  const d = x.data || {};
  return {
    id: x.id, reference: x.reference_no, beneficiary: d.beneficiary || x.insurer_name || null, bank: d.bankName || null, accountMasked: maskAccount(d.accountNumber),
    method: d.method || null, amount: round2(x.amount), status: x.status, statusLabel: x.status, date: d.scheduledDate || isoDate(x.created_at),
    approvedBy: x.approved_by ? { name: x.approved_by_name || null, at: x.approved_at ? new Date(x.approved_at).toISOString() : null } : null,
    journal: x.jv_id ? { id: x.jv_id, number: x.jv_number } : null,
    reversal: x.reversed_by_jv ? { reversed: true, number: x.reversal_jv_number, date: isoDate(x.reversal_date), label: x.reversal_jv_number }
      : { reversed: false, number: null, date: null, label: x.jv_id ? 'Not reversed' : null },
    bankReference: d.bankReference || null, failureReason: d.failureReason || null, remittanceNo: d.remittanceNo || null, purpose: d.purpose || null,
    readOnly: true, chip: { code: 'legacy', label: 'Recorded outside a payment voucher' }, creationDisabled: true,
    createdBy: x.created_by_name || null, createdAt: new Date(x.created_at).toISOString(),
  };
}

/** GET /remittance/transfers?legacy=1: the TRF- items, read-only, newest first (paging; status and q filters). */
export async function legacyTransfers(qs, pg) {
  const p = params();
  const conds = ["x.kind = 'transfer'"];
  if (qs.status && qs.status !== 'all') conds.push(`x.status = ANY(${p.add(String(qs.status).split(','))})`);
  if (qs.q) conds.push(`(x.reference_no ILIKE ${p.add(`%${String(qs.q).trim()}%`)} OR x.data->>'beneficiary' ILIKE $${p.values.length})`);
  const where = conds.join(' AND ');
  const agg = await one(`SELECT count(*)::int AS n, COALESCE(sum(x.amount), 0) AS amount FROM remittance_items x WHERE ${where}`, p.values);
  const rows = await many(`${TRANSFER_SELECT} WHERE ${where} ORDER BY x.created_at DESC, x.reference_no DESC LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { rows: rows.map((x) => transferOut(x)), total: agg.n, totals: { count: agg.n, amount: round2(agg.amount) } };
}

/** GET /remittance/transfers/:id (id or TRF no.): the read-only record with its approval, journal, reversal and activity. */
export async function legacyTransfer(id, user) {
  const x = await one(`${TRANSFER_SELECT} WHERE x.kind = 'transfer' AND (x.id = $1 OR x.reference_no = $1)`, [String(id)]);
  if (!x) throw notFound('Transfer not found');
  const a = await one(`SELECT a.status, a.history, a.action_at, (SELECT display_name FROM users u WHERE u.id = a.action_by) AS action_by_name
    FROM remittance_approvals a WHERE a.entity = 'item' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 1`, [x.id]);
  const decided = (a?.history || []).filter((h) => ['Approved', 'Rejected'].includes(h.action));
  const deciders = decided.length ? await many('SELECT id, display_name, username FROM users WHERE id = ANY($1)', [decided.map((h) => h.by)]) : [];
  const rows = await many(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
    WHERE (a.entity = 'remittance_item' AND a.entity_id = $1)
       OR (a.entity = 'remittance_approval' AND a.entity_id IN (SELECT id::text FROM remittance_approvals WHERE entity = 'item' AND entity_id = $1)) ORDER BY a.at, a.id`, [x.id]);
  return {
    ...transferOut(x),
    approval: a ? { status: a.status, decisions: decided.map((h) => {
      const u = deciders.find((d) => d.id === h.by);
      return { action: h.action, by: u?.display_name || u?.username || null, at: h.at, remarks: h.remarks || null };
    }) } : null,
    activity: await activityEntries(rows, { viewer: user }),
  };
}
