/**
 * Premium receivables: creation with the booking journal (Dr Premium Receivable / Cr Due to Insurer / Cr Commission
 * Income), payment application (Dr Cash / Cr Premium Receivable) and reversal. Used by receipts, payment entries and
 * collections.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { account, cashAccountFor, createJournal, reverseJournal } from '../accounting/lib/ledger.js';
import { round2, today } from '../accounting/lib/http.js';
import { onPolicyPremiumCollected } from '../commission/service.js';

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
  const rate = Number(policy.insurer_commission_rate) || Number(await getSetting('commission.default_rate', 0.15));
  return round2(Math.min(base * rate, amount));
}

const ENTRY_BY_SOURCE = { endorsement: 'ENDORSEMENT', renewal: 'RENEWAL' };

/** Create a receivable for a policy and post its booking journal. breakdown: { netPremium, vat, dst, lgt, other, discount, commissionAmount } */
export async function createReceivable(db, { policy, amount, breakdown = {}, source = 'policy', reference = null, dueDate = null, user = null }) {
  // Direct bill: the client pays the insurer, so the broker has no premium receivable (commission is billed to the insurer)
  if (policy.billing_mode === 'direct') throw badRequest(`Policy ${policy.policy_number} is direct billed: the client pays the insurer, so no premium is billed or collected by the broker`);
  const gross = round2(amount);
  if (!(gross > 0)) throw badRequest('Receivable amount must be greater than zero');
  const creditDays = Number(await getSetting('collections.default_credit_days', 30));
  const prefix = await getSetting('numbering.invoice.prefix', 'INV');
  const billNumber = (await db.query('SELECT next_number($1, $2) AS n', ['invoice', prefix])).rows[0].n;
  const commission = await commissionFor(policy, gross, breakdown, source);
  const due = dueDate || (await db.query('SELECT (GREATEST($1::date, current_date) + $2::int)::date AS d', [policy.inception_date || (await today()), creditDays])).rows[0].d;
  const r = (await db.query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status, source, reference, currency,
      net_premium, vat, dst, lgt, other_charges, discount, commission_amount, created_by)
    VALUES ($1,$2,$3,$4,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
  [billNumber, policy.id, policy.client_id, gross, due, source, reference, policy.currency || (await getSetting('currency.default', 'PHP')), round2(breakdown.netPremium || gross),
    round2(breakdown.vat), round2(breakdown.dst), round2(breakdown.lgt), round2(breakdown.other), round2(breakdown.discount), commission, user?.id ?? null])).rows[0];
  const jv = await postBooking(db, r, policy, commission, user);
  await db.query('UPDATE receivables SET booking_jv_id = $2 WHERE id = $1', [r.id, jv.id]);
  await db.query('INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ($1,$2,$3) ON CONFLICT (receivable_id) DO NOTHING', [r.id, policy.id, policy.client_id]);
  return { ...r, booking_jv_id: jv.id };
}

async function postBooking(db, r, policy, commission, user) {
  return createJournal(db, {
    source: 'booking', entryType: ENTRY_BY_SOURCE[r.source] || 'NEW_BUSINESS', transactionCode: r.bill_number, referenceType: 'Policy', referenceId: policy.id,
    clientId: r.client_id || policy.client_id, policyId: policy.id, policyNumber: policy.policy_number, dueDate: r.due_date,
    description: `Premium billed – ${policy.policy_number} (${r.bill_number})`,
    lines: [
      { accountCode: await account('premium_receivable'), debit: Number(r.amount), memo: `Premium receivable ${r.bill_number}` },
      { accountCode: await account('due_to_insurer'), credit: round2(Number(r.amount) - commission), memo: `Premium due to ${policy.insurer_name || 'insurer'}` },
      { accountCode: await account('commission_income'), credit: commission, memo: 'Brokerage commission' },
    ],
  }, user);
}

/**
 * Book a receivable that another module inserted without its journal (receivable = GL control account). Only the
 * still-open part is booked when earlier payments were never journalised, so the sub-ledger and GL stay equal.
 */
export async function ensureBooked(db, rcv, policy, user) {
  if (rcv.booking_jv_id) return rcv;
  const applied = Number((await db.query('SELECT COALESCE(sum(amount),0) AS a FROM receipt_applications WHERE receivable_id = $1 AND status = \'applied\' AND journal_id IS NOT NULL', [rcv.id])).rows[0].a);
  const bookable = round2(Number(rcv.balance) + applied);
  if (!(bookable > 0)) return rcv;
  const commission = round2(Number(rcv.commission_amount) > 0 ? Number(rcv.commission_amount) * (bookable / Number(rcv.amount)) : await commissionFor(policy, bookable, { netPremium: Number(rcv.net_premium) * (bookable / Number(rcv.amount)) }, rcv.source));
  const jv = await postBooking(db, { ...rcv, amount: bookable }, policy, Math.min(commission, bookable), user);
  const upd = (await db.query('UPDATE receivables SET booking_jv_id = $2, commission_amount = CASE WHEN commission_amount > 0 THEN commission_amount ELSE $3 END WHERE id = $1 RETURNING *', [rcv.id, jv.id, commission])).rows[0];
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
  const jv = await createJournal(db, {
    source: ctx.receipt ? 'receipt' : 'payment', entryType: 'PAYMENT_RECEIPT', transactionCode: ctx.receipt?.receipt_number || rcv.bill_number,
    referenceType: ctx.receipt ? 'Receipt' : 'Policy', referenceId: ctx.receipt?.id || policy.id, clientId: rcv.client_id, policyId: policy.id,
    policyNumber: policy.policy_number, date: ctx.date || (await today()),
    description: `Premium collected – ${policy.policy_number}${ctx.receipt ? ` (${ctx.receipt.receipt_number})` : ''}`,
    lines: [
      { accountCode: await cashAccountFor(ctx.paymentMode), debit: amount, memo: ctx.referenceNo || 'Premium collection' },
      { accountCode: await account('premium_receivable'), credit: amount, memo: `Settles ${rcv.bill_number}` },
    ],
  }, ctx.user);
  const upd = (await db.query(`UPDATE receivables SET balance = balance - $2, last_payment_at = now(), updated_at = now(),
      status = CASE WHEN balance - $2 <= 0 THEN 'paid' ELSE 'partial' END WHERE id = $1 RETURNING *`, [rcv.id, amount])).rows[0];
  if (Number(upd.balance) <= 0) await db.query('UPDATE collection_items SET closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE receivable_id = $1', [rcv.id]);
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
