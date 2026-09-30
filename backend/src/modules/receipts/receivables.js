/**
 * Premium receivables: creation with the booking journal (Dr Premium Receivable / Cr Due to Insurer / Cr Commission
 * Income), payment application (Dr Cash / Cr Premium Receivable) and reversal. Used by receipts, payment entries and
 * collections.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { num, round2, today } from '../accounting/lib/http.js';
import { postEvent, splitTaxes } from '../accounting/lib/posting.js';
import { allocate, isCoInsured, policyParticipants } from '../accounting/lib/coinsurance.js';
import { onPolicyPremiumCollected } from '../commission/service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { resolveCommissionRate } from '../commission-rates/resolve.js';
import { resolveCreditTerms } from '../commission-rates/terms.js';
import { commissionTaxSetup, commissionTaxes, ratesOf } from '../accounting/lib/commissionTax.js';
import { syncDueDate } from '../credit-control/instalments.js';

export const POLICY_SQL = `SELECT p.*, c.display_name AS client_name, c.client_code, c.email AS client_email, c.first_name, c.last_name,
  ic.name AS insurer_name, ic.short_name AS insurer_short, ic.commission_rate AS insurer_commission_rate, pr.name AS product_name, pr.line AS product_line
  FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
  LEFT JOIN products pr ON pr.id = p.product_id`;

/** Policy by id or policy number (null when not found). */
export async function findPolicy(db, ref) {
  if (!ref) return null;
  return (await db.query(`${POLICY_SQL} WHERE p.id = $1 OR p.policy_number = $1 LIMIT 1`, [String(ref)])).rows[0] || null;
}
export async function requirePolicy(db, ref) {
  const p = await findPolicy(db, ref);
  if (!p) throw notFound(`Policy ${ref} not found`);
  return p;
}
/** Client by id or client code. */
export async function findClient(db, ref) {
  if (!ref) return null;
  return (await db.query('SELECT * FROM clients WHERE id = $1 OR client_code = $1 LIMIT 1', [String(ref)])).rows[0] || null;
}

/** Brokerage commission on a premium amount: the given amount, the policy's own commission for its full premium, else rate x net premium. */
export async function commissionFor(policy, amount, breakdown, source) {
  if (breakdown.commissionAmount !== undefined && breakdown.commissionAmount !== null) return round2(breakdown.commissionAmount);
  const base = breakdown.netPremium > 0 ? breakdown.netPremium : amount;
  if (source === 'policy' && Number(policy.commission_amount) > 0 && Math.abs(Number(policy.premium_total) - amount) < 0.01) return round2(policy.commission_amount);
  const rate = (await resolveCommissionRate({ insurerId: policy.insurance_company_id, productId: policy.product_id, lob: policy.lob || policy.product_line,
    policyType: source === 'renewal' || policy.renewed_from ? 'renewal' : 'new', date: policy.inception_date })).rate;
  return round2(Math.min(base * rate, amount));
}

const ENTRY_BY_SOURCE = { endorsement: 'ENDORSEMENT', renewal: 'RENEWAL' };
const EVENT_BY_SOURCE = { endorsement: 'endorsement.additional_premium', renewal: 'policy.renewal.broker_billed' };

/** Premium taxes booked in their own accounts (accounting.split_premium_taxes), unless they do not fit in the amount due to the insurer. */
function taxesOf(breakdown, split, room) {
  if (!split) return { vat: 0, dst: 0, lgt: 0 };
  const t = { vat: round2(num(breakdown.vat)), dst: round2(num(breakdown.dst)), lgt: round2(num(breakdown.lgt)) };
  if (t.vat < 0 || t.dst < 0 || t.lgt < 0 || round2(t.vat + t.dst + t.lgt) > round2(room)) return { vat: 0, dst: 0, lgt: 0 };
  return t;
}

/**
 * Premium due to the insurer on a share: gross less premium taxes, commission and the VAT on the commission (borne by the
 * insurer), plus the EWT the insurer withholds on the commission (the broker pays it back with the premium).
 */
const dueToInsurer = (gross, commission, tax, ctax) => round2(gross - commission - tax.vat - tax.dst - tax.lgt - ctax.commission_vat + ctax.commission_ewt);

/**
 * Split of a premium amount between the insurers of the policy: per participant gross, commission, premium taxes, the
 * taxes on the commission (output VAT, EWT withheld by the insurer) and the premium due to the insurer. A single-insurer
 * policy is one participant at 100% with the commission of commissionFor(). On a co-insured policy each insurer's
 * commission is its own rate on its share of the net premium (commissionFor() with the insurer's master rate when the
 * participant has no rate), unless a commission amount is given (split by share).
 * taxRates = { vat, ewt } fractions for the commission taxes (default: the tax codes in force, see commissionTax.js).
 */
export async function premiumSplit(db, policy, gross, breakdown = {}, source = 'policy', { commission: given = null, parts: known = null, ratios = null, taxRates = null } = {}) {
  const parts = known || (await policyParticipants(policy.id, db));
  const split = await splitTaxes();
  const rates = taxRates || ratesOf(await commissionTaxSetup(db));
  if (!isCoInsured(parts)) {
    const commission = given ?? (await commissionFor(policy, gross, breakdown, source));
    const ctax = commissionTaxes(commission, rates);
    const tax = taxesOf(breakdown, split, gross - commission - ctax.commission_vat);
    return { coInsured: false, commission, taxes: tax, commissionTaxes: ctax, parts: [{ insurerId: policy.insurance_company_id, insurerName: policy.insurer_name || parts[0]?.insurerName || 'insurer', share: 100, isLead: true,
      amounts: { gross, commission, ...tax, ...ctax, due_to_insurer: dueToInsurer(gross, commission, tax, ctax) } }] };
  }
  const w = parts.map((p) => p.share);
  const grossS = allocate(gross, w);
  const net = num(breakdown.netPremium) > 0 ? round2(num(breakdown.netPremium)) : 0;
  const netS = net ? allocate(net, w) : grossS.map(() => 0);
  const explicit = given ?? (breakdown.commissionAmount !== undefined && breakdown.commissionAmount !== null ? round2(breakdown.commissionAmount) : null);
  const comms = explicit !== null ? allocate(explicit, w) : [];
  if (explicit === null) {
    for (const [i, p] of parts.entries()) {
      if (ratios?.has(p.insurerId)) comms.push(round2(Math.min(grossS[i] * ratios.get(p.insurerId), grossS[i])));
      else if (p.commissionRate !== null) comms.push(round2(Math.min((netS[i] > 0 ? netS[i] : grossS[i]) * p.commissionRate, grossS[i])));
      else comms.push(await commissionFor({ ...policy, insurance_company_id: p.insurerId, insurer_commission_rate: p.insurerCommissionRate, commission_amount: p.commissionAmount, premium_total: p.premiumTotal }, grossS[i], { netPremium: netS[i] }, source));
    }
  }
  // each insurer is billed VAT on, and withholds EWT from, its own commission
  const ctaxS = comms.map((c) => commissionTaxes(c, rates));
  const ctax = { commission_vat: round2(ctaxS.reduce((s, t) => s + t.commission_vat, 0)), commission_ewt: round2(ctaxS.reduce((s, t) => s + t.commission_ewt, 0)) };
  const tax = taxesOf(breakdown, split, gross - comms.reduce((s, c) => s + c, 0) - ctax.commission_vat);
  const taxS = { vat: allocate(tax.vat, w), dst: allocate(tax.dst, w), lgt: allocate(tax.lgt, w) };
  const out = parts.map((p, i) => {
    const t = { vat: taxS.vat[i], dst: taxS.dst[i], lgt: taxS.lgt[i] };
    return { insurerId: p.insurerId, insurerName: p.insurerName, share: p.share, isLead: p.isLead,
      amounts: { gross: grossS[i], commission: comms[i], ...t, ...ctaxS[i], due_to_insurer: dueToInsurer(grossS[i], comms[i], t, ctaxS[i]) } };
  });
  return { coInsured: true, commission: round2(comms.reduce((s, c) => s + c, 0)), taxes: tax, commissionTaxes: ctax, parts: out };
}

/**
 * Create a receivable for a policy and post its booking journal. breakdown: { netPremium, vat, dst, lgt, other, discount, commissionAmount }.
 * `split` (optional): the split per insurer in the shape of premiumSplit(), used as given.
 */
export async function createReceivable(db, { policy, amount, breakdown = {}, source = 'policy', reference = null, dueDate = null, user = null, split: given = null }) {
  // Direct bill: the client pays the insurer, so the broker has no premium receivable (commission is billed to the insurer)
  if (policy.billing_mode === 'direct') throw badRequest(`Policy ${policy.policy_number} is direct billed: the client pays the insurer, so no premium is billed or collected by the broker`);
  const gross = round2(amount);
  if (!(gross > 0)) throw badRequest('Receivable amount must be greater than zero');
  const creditDays = (await resolveCreditTerms(policy.insurance_company_id, { db })).premiumWarrantyDays;
  const billNumber = await nextDocumentNumber('invoice', { db, unique: { table: 'receivables', column: 'bill_number' } });
  // a package gives its own split (each insurer carries its own sections); otherwise the premium is split by share
  const split = given || await premiumSplit(db, policy, gross, breakdown, source);
  const { commission } = split;
  const due = dueDate || (await db.query('SELECT (GREATEST($1::date, $3::date) + $2::int)::date AS d', [policy.inception_date || (await today()), creditDays, await today()])).rows[0].d;
  const r = (await db.query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status, source, reference, currency,
      net_premium, vat, dst, lgt, other_charges, discount, commission_amount, created_by, commission_vat, commission_ewt)
    VALUES ($1,$2,$3,$4,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
  [billNumber, policy.id, policy.client_id, gross, due, source, reference, policy.currency || (await getSetting('currency.default', 'PHP')), round2(breakdown.netPremium || gross),
    round2(breakdown.vat), round2(breakdown.dst), round2(breakdown.lgt), round2(breakdown.other), round2(breakdown.discount), commission, user?.id ?? null,
    split.commissionTaxes.commission_vat, split.commissionTaxes.commission_ewt])).rows[0];
  const jv = await postBooking(db, r, policy, split, user);
  await db.query('UPDATE receivables SET booking_jv_id = $2 WHERE id = $1', [r.id, jv.id]);
  await db.query('INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ($1,$2,$3) ON CONFLICT (receivable_id) DO NOTHING', [r.id, policy.id, policy.client_id]);
  return { ...r, booking_jv_id: jv.id };
}

/** Booking journal of a bill from the posting rule of its source (issue, endorsement, renewal); participants kept on co-insured bills. */
async function postBooking(db, r, policy, split, user) {
  if (split.coInsured) {
    for (const p of split.parts) {
      const a = p.amounts;
      await db.query(`INSERT INTO receivable_participants(receivable_id, insurance_company_id, is_lead, share_percent, gross, commission, taxes, due_to_insurer, commission_vat, commission_ewt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (receivable_id, insurance_company_id) DO UPDATE SET share_percent = EXCLUDED.share_percent, gross = EXCLUDED.gross,
          commission = EXCLUDED.commission, taxes = EXCLUDED.taxes, due_to_insurer = EXCLUDED.due_to_insurer, commission_vat = EXCLUDED.commission_vat, commission_ewt = EXCLUDED.commission_ewt`,
      [r.id, p.insurerId, p.isLead, p.share, a.gross, a.commission, round2(a.vat + a.dst + a.lgt), a.due_to_insurer, a.commission_vat || 0, a.commission_ewt || 0]);
    }
  }
  const gross = Number(r.amount);
  return postEvent(EVENT_BY_SOURCE[r.source] || 'policy.issue.broker_billed', {
    source: 'booking', entryType: ENTRY_BY_SOURCE[r.source] || 'NEW_BUSINESS', entrySubType: split.coInsured ? 'CO_INSURANCE' : null, transactionCode: r.bill_number,
    referenceType: 'Policy', referenceId: policy.id, clientId: r.client_id || policy.client_id, policyId: policy.id, policyNumber: policy.policy_number, dueDate: r.due_date,
    description: `Premium billed – ${policy.policy_number} (${r.bill_number})`,
    amounts: { gross, net_premium: Number(r.net_premium) || gross, commission: split.commission, ...split.taxes, ...split.commissionTaxes, due_to_insurer: round2(split.parts.reduce((s, p) => s + p.amounts.due_to_insurer, 0)) },
    participants: split.parts, vars: { policyNumber: policy.policy_number, billNumber: r.bill_number, insurer: policy.insurer_name || 'insurer', participantSuffix: '' },
  }, { db, user });
}

/**
 * Book a receivable that another module inserted without its journal (receivable = GL control account). Only the
 * still-open part is booked when earlier payments were never journalised, so the sub-ledger and GL stay equal.
 */
export async function ensureBooked(db, rcv, policy, user) {
  // go-live open items (source 'opening') are carried by the GL opening balance, never booked
  if (rcv.booking_jv_id || rcv.source === 'opening') return rcv;
  const applied = Number((await db.query('SELECT COALESCE(sum(amount),0) AS a FROM receipt_applications WHERE receivable_id = $1 AND status = \'applied\' AND journal_id IS NOT NULL', [rcv.id])).rows[0].a);
  const bookable = round2(Number(rcv.balance) + applied);
  if (!(bookable > 0)) return rcv;
  const commission = round2(Number(rcv.commission_amount) > 0 ? Number(rcv.commission_amount) * (bookable / Number(rcv.amount)) : await commissionFor(policy, bookable, { netPremium: Number(rcv.net_premium) * (bookable / Number(rcv.amount)) }, rcv.source));
  const ratio = bookable / Number(rcv.amount);
  const split = await premiumSplit(db, policy, bookable, { vat: Number(rcv.vat) * ratio, dst: Number(rcv.dst) * ratio, lgt: Number(rcv.lgt) * ratio, netPremium: Number(rcv.net_premium) * ratio },
    rcv.source, { commission: Math.min(commission, bookable) });
  const jv = await postBooking(db, { ...rcv, amount: bookable }, policy, split, user);
  const upd = (await db.query(`UPDATE receivables SET booking_jv_id = $2, commission_amount = CASE WHEN commission_amount > 0 THEN commission_amount ELSE $3 END,
    commission_vat = $4, commission_ewt = $5 WHERE id = $1 RETURNING *`, [rcv.id, jv.id, commission, split.commissionTaxes.commission_vat, split.commissionTaxes.commission_ewt])).rows[0];
  await db.query('INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ($1,$2,$3) ON CONFLICT (receivable_id) DO NOTHING', [rcv.id, rcv.policy_id, rcv.client_id]);
  return upd;
}

export const policyReceivables = async (db, policyId) => (await db.query('SELECT * FROM receivables WHERE policy_id = $1 ORDER BY due_date, created_at', [policyId])).rows;

/** Make sure a policy has at least one receivable (pay-later bills); returns the open ones. */
export async function ensureBilled(db, { policy, amount, breakdown, source, user }) {
  const all = await policyReceivables(db, policy.id);
  if (!all.length && amount > 0) await createReceivable(db, { policy, amount, breakdown, source, user });
  return (await policyReceivables(db, policy.id)).filter((r) => ['open', 'partial'].includes(r.status) && Number(r.balance) > 0);
}

async function applyToReceivable(db, rcv, amount, ctx) {
  const policy = ctx.policy;
  await ensureBooked(db, rcv, policy, ctx.user);
  const jv = await postEvent('receipt.apply', {
    source: ctx.receipt ? 'receipt' : 'payment', entryType: 'PAYMENT_RECEIPT', transactionCode: ctx.receipt?.receipt_number || rcv.bill_number,
    referenceType: ctx.receipt ? 'Receipt' : 'Policy', referenceId: ctx.receipt?.id || policy.id, clientId: rcv.client_id, policyId: policy.id,
    policyNumber: policy.policy_number, date: ctx.date || (await today()),
    description: `Premium collected – ${policy.policy_number}${ctx.receipt ? ` (${ctx.receipt.receipt_number})` : ''}`,
    paymentMode: ctx.paymentMode, bankAccount: ctx.bankAccount || ctx.receipt?.bank_account_code || null, amounts: { amount },
    vars: { policyNumber: policy.policy_number, receiptSuffix: ctx.receipt ? ` (${ctx.receipt.receipt_number})` : '', memoRef: ctx.referenceNo || 'Premium collection', billNumber: rcv.bill_number },
  }, { db, user: ctx.user });
  const upd = (await db.query(`UPDATE receivables SET balance = balance - $2, last_payment_at = now(), updated_at = now(),
      status = CASE WHEN balance - $2 <= 0 THEN 'paid' ELSE 'partial' END WHERE id = $1 RETURNING *`, [rcv.id, amount])).rows[0];
  if (Number(upd.balance) <= 0) await db.query('UPDATE collection_items SET closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE receivable_id = $1', [rcv.id]);
  // on an instalment plan the bill is next due on its first instalment not yet paid
  await syncDueDate(db, rcv.id);
  await db.query(`INSERT INTO receipt_applications(receipt_id, receipt_line_id, receivable_id, amount, journal_id, payment_mode, reference_no, applied_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [ctx.receipt?.id || null, ctx.lineId || null, rcv.id, amount, jv.id, ctx.paymentMode || null, ctx.referenceNo || null, ctx.user?.id ?? null]);
  return upd;
}

/** Commission eligibility: once nothing is open on the policy, the premium counts as collected. */
async function commissionWhenSettled(db, policy, ctx) {
  const stillOpen = (await db.query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1 AND balance > 0 AND status IN (\'open\',\'partial\')', [policy.id])).rows[0].n;
  if (!stillOpen) await onPolicyPremiumCollected(db, policy.id, ctx.receipt?.receipt_number || null);
}

/**
 * Apply a payment to a policy's open receivables (oldest first). When nothing is open (first bill or an endorsement /
 * extra premium) a receivable is created for billAmount (or the remaining amount) and settled.
 */
export async function applyToPolicy(db, ctx) {
  const { policy } = ctx;
  let remaining = round2(ctx.amount);
  if (!(remaining > 0)) return 0;
  if (ctx.receivableId) return applyToBill(db, ctx, remaining);
  const hasAny = (await policyReceivables(db, policy.id)).length > 0;
  if (!hasAny) await createReceivable(db, { policy, amount: Math.max(remaining, round2(ctx.billAmount || 0)), breakdown: ctx.billAmount && round2(ctx.billAmount) >= remaining ? ctx.breakdown : {}, source: ctx.source || 'policy', user: ctx.user });
  const open = (await db.query(`SELECT * FROM receivables WHERE policy_id = $1 AND status IN ('open','partial') AND balance > 0
    ORDER BY due_date, created_at FOR UPDATE`, [policy.id])).rows;
  for (const r of open) {
    if (remaining <= 0) break;
    const x = round2(Math.min(remaining, Number(r.balance)));
    await applyToReceivable(db, r, x, ctx);
    remaining = round2(remaining - x);
  }
  if (remaining > 0) {
    const extra = await createReceivable(db, { policy, amount: remaining, breakdown: {}, source: ctx.source === 'policy' ? 'receipt' : (ctx.source || 'receipt'), reference: ctx.receipt?.receipt_number, user: ctx.user });
    await applyToReceivable(db, extra, remaining, ctx);
  }
  await commissionWhenSettled(db, policy, ctx);
  return round2(ctx.amount);
}

/**
 * Apply a payment to one named bill only (Accounts > Receipts > Add receipt against an open receivable). The amount
 * may be partial but never more than the bill's balance: excess is refused here, whatever the client sent.
 */
async function applyToBill(db, ctx, amount) {
  const { policy } = ctx;
  const rcv = (await db.query('SELECT * FROM receivables WHERE id = $1 FOR UPDATE', [ctx.receivableId])).rows[0];
  if (!rcv) throw notFound('Receivable not found');
  if (rcv.policy_id !== policy.id) throw badRequest(`Bill ${rcv.bill_number} does not belong to policy ${policy.policy_number}`);
  if (!['open', 'partial'].includes(rcv.status) || !(Number(rcv.balance) > 0)) throw badRequest(`Bill ${rcv.bill_number} has no open balance`);
  if (amount > round2(rcv.balance)) throw badRequest(`Amount ${amount.toFixed(2)} exceeds the outstanding balance of bill ${rcv.bill_number} (${round2(rcv.balance).toFixed(2)})`);
  await applyToReceivable(db, rcv, amount, ctx);
  await commissionWhenSettled(db, policy, ctx);
  return amount;
}

/**
 * Ratios booked on the policy's bills: commission / gross (overall and per co-insurer) and premium taxes / gross, so a
 * return premium or cancellation takes back commission and taxes at the rate they were booked.
 */
async function bookedRatios(db, policyId) {
  const all = (await db.query(`SELECT COALESCE(sum(commission_amount), 0) AS c, COALESCE(sum(amount), 0) AS a,
      COALESCE(sum(commission_vat), 0) AS cv, COALESCE(sum(commission_ewt), 0) AS ce FROM receivables
    WHERE policy_id = $1 AND status <> 'cancelled' AND booking_jv_id IS NOT NULL`, [policyId])).rows[0];
  const per = (await db.query(`SELECT rp.insurance_company_id, sum(rp.commission) AS c, sum(rp.gross) AS a FROM receivable_participants rp
    JOIN receivables r ON r.id = rp.receivable_id WHERE r.policy_id = $1 AND r.status <> 'cancelled' GROUP BY rp.insurance_company_id`, [policyId])).rows;
  // premium taxes booked in their own accounts on the bills' booking journals (none when they were not split)
  const { account } = await import('../accounting/lib/ledger.js');
  const codes = { vat: await account('premium_vat_payable'), dst: await account('premium_dst_payable'), lgt: await account('premium_lgt_payable') };
  const booked = (await db.query(`SELECT l.account_code, sum(l.credit) AS c FROM journal_lines l JOIN receivables r ON r.booking_jv_id = l.jv_id
    WHERE r.policy_id = $1 AND r.status <> 'cancelled' AND l.account_code = ANY($2) GROUP BY l.account_code`, [policyId, Object.values(codes)])).rows;
  const taxes = Object.fromEntries(Object.entries(codes).map(([k, code]) => [k, Number(all.a) > 0 ? Number(booked.find((b) => b.account_code === code)?.c || 0) / Number(all.a) : 0]));
  // commission VAT and EWT go back at the rates they were booked (none on bills booked before they were taxed)
  const commissionTaxRates = Number(all.c) > 0 ? { vat: Number(all.cv) / Number(all.c), ewt: Number(all.ce) / Number(all.c) } : null;
  return { overall: Number(all.a) > 0 ? Number(all.c) / Number(all.a) : null, commissionTaxRates, byInsurer: new Map(per.filter((x) => Number(x.a) > 0).map((x) => [x.insurance_company_id, Number(x.c) / Number(x.a)])), taxes };
}

/**
 * Return premium or cancellation on a broker-billed policy. The return (for a cancellation without a return amount and
 * accounting.cancel_reverses_open_receivable: the open balance of the policy's bills) is credited to the open bills oldest
 * first; what exceeds the open balance was already paid and becomes a refund payable to the client (a Customer payable is
 * raised for Disbursement). The journal (posting rule endorsement.return_premium / policy.cancel) reverses the premium due
 * to each insurer, the premium taxes and the commission at the ratio booked on the bills.
 * Returns { journalId, amount, credited, refund, credits } or null when there is nothing to return.
 */
export async function returnPremium(db, { policy, amount, breakdown = {}, kind = 'return-premium', reference = null, endorsementId = null, user = null }) {
  if (policy.billing_mode === 'direct') throw badRequest(`Policy ${policy.policy_number} is direct billed: its return premium adjusts the commission due from the insurer`);
  const open = (await db.query(`SELECT * FROM receivables WHERE policy_id = $1 AND status IN ('open','partial') AND balance > 0 ORDER BY due_date, created_at FOR UPDATE`, [policy.id])).rows;
  let gross = round2(Math.abs(num(amount)));
  if (kind === 'cancellation' && !(gross > 0) && (await getSetting('accounting.cancel_reverses_open_receivable', true)) !== false) {
    gross = round2(open.reduce((s, r) => s + Number(r.balance), 0));
  }
  if (!(gross > 0)) return null;
  for (const r of open) await ensureBooked(db, r, policy, user);
  const ratios = await bookedRatios(db, policy.id);
  const given = breakdown.commissionAmount !== undefined && breakdown.commissionAmount !== null ? round2(Math.abs(num(breakdown.commissionAmount)))
    : (ratios.overall !== null && !ratios.byInsurer.size ? round2(Math.min(gross * ratios.overall, gross)) : null);
  const given3 = Math.abs(num(breakdown.vat)) + Math.abs(num(breakdown.dst)) + Math.abs(num(breakdown.lgt));
  // taxes of the return: as given on the endorsement, else at the ratio booked on the bills
  const taxes = { netPremium: Math.abs(num(breakdown.netPremium)) || undefined,
    vat: given3 ? Math.abs(num(breakdown.vat)) : round2(gross * ratios.taxes.vat), dst: given3 ? Math.abs(num(breakdown.dst)) : round2(gross * ratios.taxes.dst),
    lgt: given3 ? Math.abs(num(breakdown.lgt)) : round2(gross * ratios.taxes.lgt) };
  const split = await premiumSplit(db, policy, gross, taxes, 'endorsement', { commission: given, ratios: ratios.byInsurer, taxRates: ratios.commissionTaxRates });
  let remaining = gross;
  const credits = [];
  for (const r of open) {
    if (remaining <= 0) break;
    const x = round2(Math.min(remaining, Number(r.balance)));
    const upd = (await db.query(`UPDATE receivables SET balance = balance - $2, updated_at = now(),
        status = CASE WHEN balance - $2 <= 0 THEN 'credited' WHEN balance - $2 < amount THEN 'partial' ELSE status END WHERE id = $1 RETURNING *`, [r.id, x])).rows[0];
    if (Number(upd.balance) <= 0) await db.query('UPDATE collection_items SET closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE receivable_id = $1', [r.id]);
    credits.push({ receivable: r, amount: x });
    remaining = round2(remaining - x);
  }
  const credited = round2(gross - remaining);
  const refund = remaining;
  const billNumbers = credits.map((c) => c.receivable.bill_number).join(', ');
  const jv = await postEvent(kind === 'cancellation' ? 'policy.cancel' : 'endorsement.return_premium', {
    source: 'booking', entryType: kind === 'cancellation' ? 'CANCELLATION' : 'ENDORSEMENT_NEGATIVE', entrySubType: split.coInsured ? 'CO_INSURANCE' : null,
    transactionCode: reference || policy.policy_number, referenceType: endorsementId ? 'Endorsement' : 'Policy', referenceId: endorsementId || policy.id,
    clientId: policy.client_id, policyId: policy.id, policyNumber: policy.policy_number,
    description: `${kind === 'cancellation' ? 'Policy cancelled' : 'Return premium'} – ${policy.policy_number}${reference ? ` (${reference})` : ''}`,
    amounts: { gross, commission: split.commission, ...split.taxes, ...split.commissionTaxes, due_to_insurer: round2(split.parts.reduce((s, p) => s + p.amounts.due_to_insurer, 0)), receivable_credit: credited, refund },
    participants: split.parts,
    vars: { policyNumber: policy.policy_number, reference: reference || '', billNumber: billNumbers || policy.bill_number || '', clientName: policy.client_name || 'client', insurer: policy.insurer_name || 'insurer', participantSuffix: '' },
  }, { db, user });
  for (const c of credits) {
    await db.query(`INSERT INTO receivable_credits(receivable_id, policy_id, endorsement_id, kind, amount, refund_amount, journal_id, created_by) VALUES ($1,$2,$3,$4,$5,0,$6,$7)`,
      [c.receivable.id, policy.id, endorsementId, kind, c.amount, jv.id, user?.id ?? null]);
  }
  let refundPayable = null;
  if (refund > 0) {
    await db.query(`INSERT INTO receivable_credits(receivable_id, policy_id, endorsement_id, kind, amount, refund_amount, journal_id, created_by) VALUES (NULL,$1,$2,$3,0,$4,$5,$6)`,
      [policy.id, endorsementId, kind, refund, jv.id, user?.id ?? null]);
    const { createInvoiceList } = await import('../disbursements/service.js');
    refundPayable = await createInvoiceList(db, { customerCode: policy.client_code, policyId: policy.id, payeeType: 'Customer', payables: refund, outstanding: refund, lcAmount: refund,
      balAmount: refund, totalAmount: refund, isInvoicePaid: true, source: kind }, user);
  }
  // premium the client paid and the broker already remitted: the insurers owe their share back (netted against the next remittance)
  const { raiseInsurerRefunds } = await import('../remittance/insurerCredits.js');
  const insurerRefunds = await raiseInsurerRefunds(db, { policy, split, gross, refund, kind, reference, endorsementId, user });
  return { journalId: jv.id, journalNumber: jv.jv_number, amount: gross, credited, refund, commission: split.commission, refundPayableId: refundPayable?.id || null,
    credits: credits.map((c) => ({ billNumber: c.receivable.bill_number, amount: c.amount })), insurerRefunds };
}

/** Undo every application of a receipt: reversing journals and restoring receivable balances. */
export async function reverseReceiptApplications(db, receipt, user) {
  const apps = (await db.query('SELECT * FROM receipt_applications WHERE receipt_id = $1 AND status = \'applied\' FOR UPDATE', [receipt.id])).rows;
  for (const a of apps) {
    if (a.journal_id) await reverseJournal(db, a.journal_id, user, { description: `Cancellation of receipt ${receipt.receipt_number}` });
    await db.query(`UPDATE receivables SET balance = balance + $2, updated_at = now(),
      status = CASE WHEN balance + $2 >= amount THEN 'open' ELSE 'partial' END WHERE id = $1`, [a.receivable_id, a.amount]);
    await db.query('UPDATE collection_items SET closed_at = NULL, updated_at = now() WHERE receivable_id = $1', [a.receivable_id]);
    await db.query('UPDATE receipt_applications SET status = \'reversed\', reversed_at = now() WHERE id = $1', [a.id]);
  }
  return apps.length;
}
