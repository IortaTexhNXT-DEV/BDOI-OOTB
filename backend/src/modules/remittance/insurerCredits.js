/**
 * Refunds due from insurers. A return premium (or cancellation) on premium the client already paid and the broker
 * already remitted to the insurer leaves the insurer owing the broker its share back: the part of the return that
 * relates to paid premium (refund / return) times the share of the policy's collections already remitted to that
 * insurer. Posting rule insurer.refund_due moves that amount from the premium payables (debited by the return journal)
 * to "Refunds due from insurers"; the credit is kept in insurer_refund_credits, shown on the remittance screens and
 * netted against the next premium remittance voucher to the insurer (posting rule insurer.refund_applied).
 */
import { postEvent } from '../accounting/lib/posting.js';
import { round2 } from '../accounting/lib/http.js';

// A remittance counts as made when its payment voucher is approved or paid (sample data may carry no voucher).
const REMITTED = `(i.disbursement_id IS NULL OR EXISTS (SELECT 1 FROM disbursements d WHERE d.id = i.disbursement_id AND d.status IN ('approved', 'paid')))`;

/** Share (0..1) of the policy's applied collections already remitted to the insurer. */
export async function remittedFraction(db, policyId, insurerId, coInsured) {
  const applied = Number((await db.query(`SELECT COALESCE(sum(a.amount), 0) AS a FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id
    WHERE r.policy_id = $1 AND a.status = 'applied'`, [policyId])).rows[0].a);
  if (!(applied > 0)) return 0;
  const remitted = coInsured
    ? Number((await db.query(`SELECT COALESCE(sum(a.amount), 0) AS a FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id
        WHERE r.policy_id = $1 AND a.status = 'applied' AND EXISTS (SELECT 1 FROM remittance_allocations al JOIN invoice_lists i ON i.id = al.invoice_list_id
          WHERE al.receipt_application_id = a.id AND al.insurance_company_id = $2 AND ${REMITTED})`, [policyId, insurerId])).rows[0].a)
    : Number((await db.query(`SELECT COALESCE(sum(a.amount), 0) AS a FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id
        JOIN invoice_lists i ON i.id = a.remitted_invoice_id WHERE r.policy_id = $1 AND a.status = 'applied' AND ${REMITTED}`, [policyId])).rows[0].a);
  return Math.min(1, remitted / applied);
}

/**
 * After a return premium journal: raise the refunds due from the insurers for the part already remitted.
 * split = premiumSplit result of the return; gross = the return; refund = the part the client had already paid.
 * Returns [{ id, insurerId, insurer, amount }] (empty when nothing was remitted).
 */
export async function raiseInsurerRefunds(db, { policy, split, gross, refund, kind, reference = null, endorsementId = null, user = null }) {
  if (!(refund > 0) || !(gross > 0)) return [];
  const paidShare = Math.min(1, refund / gross);
  const parts = [];
  for (const p of split.parts) {
    if (!p.insurerId) continue;
    const factor = paidShare * (await remittedFraction(db, policy.id, p.insurerId, split.coInsured));
    if (!(factor > 0)) continue;
    const a = p.amounts || {};
    const amounts = { due_to_insurer: round2((a.due_to_insurer || 0) * factor), vat: round2((a.vat || 0) * factor), dst: round2((a.dst || 0) * factor), lgt: round2((a.lgt || 0) * factor) };
    amounts.amount = round2(amounts.due_to_insurer + amounts.vat + amounts.dst + amounts.lgt);
    if (amounts.amount > 0) parts.push({ insurerId: p.insurerId, insurerName: p.insurerName, share: p.share, amounts });
  }
  if (!parts.length) return [];
  const jv = await postEvent('insurer.refund_due', {
    source: 'booking', entryType: kind === 'cancellation' ? 'CANCELLATION' : 'ENDORSEMENT_NEGATIVE', entrySubType: split.coInsured ? 'CO_INSURANCE' : null,
    transactionCode: reference || policy.policy_number, referenceType: endorsementId ? 'Endorsement' : 'Policy', referenceId: endorsementId || policy.id,
    clientId: policy.client_id, policyId: policy.id, policyNumber: policy.policy_number,
    description: `Refund due from insurer – ${policy.policy_number}${reference ? ` (${reference})` : ''}`,
    amounts: { amount: round2(parts.reduce((s, p) => s + p.amounts.amount, 0)) }, participants: parts,
    vars: { policyNumber: policy.policy_number, reference: reference || '', insurer: parts[0].insurerName || 'insurer' },
  }, { db, user });
  const out = [];
  for (const p of parts) {
    const { amount, ...rest } = p.amounts;
    const r = (await db.query(`INSERT INTO insurer_refund_credits(insurance_company_id, policy_id, policy_number, endorsement_id, reference, kind, amount, balance, split, journal_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10) RETURNING id`, [p.insurerId, policy.id, policy.policy_number, endorsementId, reference || policy.policy_number, kind, amount, JSON.stringify(rest), jv.id, user?.id ?? null])).rows[0];
    out.push({ id: Number(r.id), insurerId: p.insurerId, insurer: p.insurerName, amount });
  }
  return out;
}

export const creditRow = (c) => ({
  id: Number(c.id), insurerId: c.insurance_company_id, insurer: c.insurer_name || null, insurerCode: c.insurer_code || null, policyId: c.policy_id, policyNumber: c.policy_number,
  reference: c.reference, kind: c.kind, amount: Number(c.amount), balance: Number(c.balance), status: c.status, journalId: c.journal_id, applications: c.applications || [],
  createdAt: c.created_at,
});

/** Refunds due from insurers (filters: insurer id / code, status open | applied | all). */
export async function listInsurerCredits(db, { insurer = null, status = 'open' } = {}) {
  const rows = (await db.query(`SELECT c.*, ic.name AS insurer_name, ic.code AS insurer_code FROM insurer_refund_credits c JOIN insurance_companies ic ON ic.id = c.insurance_company_id
    WHERE ($1::text IS NULL OR ic.id::text = $1 OR ic.code = $1 OR ic.name = $1) AND ($2::text = 'all' OR c.status = $2) ORDER BY c.created_at, c.id`, [insurer ? String(insurer) : null, status || 'open'])).rows;
  const items = rows.map(creditRow);
  return { items, openBalance: round2(items.filter((c) => c.status === 'open').reduce((s, c) => s + c.balance, 0)) };
}

/**
 * Net the insurer's open refunds against a premium remittance voucher of `available` (its net amount): the credits
 * are applied oldest first up to the voucher amount (posting rule insurer.refund_applied) and the amount to pay is
 * reduced. Returns { applied, credits: [{ id, amount }] }.
 */
export async function applyInsurerCredits(db, { insurerId, insurerName, available, disbursement, user = null }) {
  if (!(available > 0)) return { applied: 0, credits: [] };
  const open = (await db.query('SELECT * FROM insurer_refund_credits WHERE insurance_company_id = $1 AND status = \'open\' AND balance > 0 ORDER BY created_at, id FOR UPDATE', [insurerId])).rows;
  let left = round2(available);
  const credits = [];
  for (const c of open) {
    if (!(left > 0)) break;
    const take = round2(Math.min(left, Number(c.balance)));
    const f = take / Number(c.amount);
    const split = c.split || {};
    const amounts = { due_to_insurer: round2((split.due_to_insurer || 0) * f), vat: round2((split.vat || 0) * f), dst: round2((split.dst || 0) * f), lgt: round2((split.lgt || 0) * f) };
    amounts.due_to_insurer = round2(take - amounts.vat - amounts.dst - amounts.lgt); // rounding stays on the premium payable
    amounts.amount = take;
    const jv = await postEvent('insurer.refund_applied', {
      source: 'remittance', entryType: 'REMITTANCE', transactionCode: disbursement.voucher_number, referenceType: 'Disbursement', referenceId: disbursement.id,
      policyId: c.policy_id, policyNumber: c.policy_number, insuranceCompanyId: insurerId, payeeType: 'Insurer',
      description: `Refund from ${insurerName} netted – ${disbursement.voucher_number}`,
      amounts, vars: { insurer: insurerName, voucherNumber: disbursement.voucher_number, policyNumber: c.policy_number },
    }, { db, user });
    const balance = round2(Number(c.balance) - take);
    await db.query(`UPDATE insurer_refund_credits SET balance = $2::numeric, status = CASE WHEN $2::numeric <= 0 THEN 'applied' ELSE status END, updated_at = now(),
      applications = applications || $3::jsonb WHERE id = $1`, [c.id, balance, JSON.stringify([{ disbursementId: disbursement.id, voucherNumber: disbursement.voucher_number, amount: take, journalId: jv.id, at: new Date().toISOString() }])]);
    credits.push({ id: Number(c.id), amount: take, journalId: jv.id });
    left = round2(left - take);
  }
  return { applied: round2(available - left), credits };
}
