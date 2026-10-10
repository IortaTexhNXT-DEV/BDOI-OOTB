/**
 * Which policies a remittance run remits (TIS-BRD-COMM-01, FRS FR-RMT-010 to 012).
 *
 * Two bases, chosen per schedule (Eligibility) with remittance.default_eligibility for a schedule that names none:
 *  - "Incepted up to the cut-off" (Release 1): every issued policy incepted up to the end of the window that is not on
 *    a remittance yet, paid or not (the outstanding is shown on the line).
 *  - "Fully paid in the window": a policy is remitted once, in full, when its premium is fully paid; its fully paid date
 *    (the collection date of the last payment that cleared its bills) falls in the window, or before it within
 *    remittance.catch_up_days for a receipt entered late. A part-paid policy (instalments, PDCs not yet collected, a
 *    part payment) is Held and is never remitted in part; a fully paid policy with a receipt that has no proof of
 *    payment is an exception (No proof of payment) while the schedule asks for proof.
 * Proof of a receipt: the proof file attached to it or to the payment captured on the policy, the post-dated cheque it
 * collected, or a document filed against it.
 */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate } from '../../lib/dates.js';
import { round2 } from '../masters/helpers.js';

export const INCEPTED = 'Incepted up to the cut-off';
export const FULLY_PAID = 'Fully paid in the window';
export const ELIGIBILITY = [INCEPTED, FULLY_PAID];
const EPS = 0.005;

/** The basis of a schedule: { fullyPaid, proofRequired, catchUpDays, hold } from its fields and the settings. */
export async function basisOf(s = {}) {
  const fallback = (await getSetting('remittance.default_eligibility', 'inception')) === 'fully-paid' ? FULLY_PAID : INCEPTED;
  const fullyPaid = (s.eligibility || fallback) === FULLY_PAID;
  const proofSetting = (await getSetting('remittance.proof_of_payment_required', true)) !== false;
  return {
    eligibility: fullyPaid ? FULLY_PAID : INCEPTED, fullyPaid,
    proofRequired: s.proofRequired === undefined || s.proofRequired === null ? proofSetting : s.proofRequired === true || s.proofRequired === 'true',
    catchUpDays: Math.max(0, Number(await getSetting('remittance.catch_up_days', 60)) || 0),
    hold: (await getSetting('remittance.instalment_hold', true)) !== false,
  };
}

/** SQL: whether receipt `r` carries a proof of payment. */
export const RECEIPT_PROOF_SQL = `(r.proof_key IS NOT NULL
  OR EXISTS (SELECT 1 FROM policy_payments pp WHERE pp.receipt_id = r.id AND pp.proof_key IS NOT NULL)
  OR EXISTS (SELECT 1 FROM post_dated_cheques pd WHERE pd.receipt_id = r.id)
  OR EXISTS (SELECT 1 FROM documents dc WHERE dc.entity = 'receipt' AND dc.entity_id = r.id AND COALESCE(dc.category, '') <> 'print'))`;

/**
 * Payment position of policies: Map policy id -> { premium, paidToDate, balance, fullyPaidOn, nextDue, planned,
 * missingProof: [receipt numbers of applied receipts without proof] }.
 */
export async function paymentPositions(policyIds) {
  const ids = [...new Set(policyIds.map(String))];
  if (!ids.length) return new Map();
  const bills = await many(`SELECT r.policy_id, sum(r.amount) AS amount, sum(r.balance) AS balance, count(*)::int AS n,
      min(r.due_date) FILTER (WHERE r.balance > 0) AS next_due,
      bool_or(EXISTS (SELECT 1 FROM premium_instalment_plans pl WHERE pl.receivable_id = r.id AND pl.status = 'active') OR r.parent_receivable_id IS NOT NULL) AS planned
    FROM receivables r WHERE r.policy_id = ANY($1) AND r.status NOT IN ('cancelled', 'written-off', 'credited') GROUP BY r.policy_id`, [ids]);
  const paid = await many(`SELECT rv.policy_id, max(a.collected_on) AS last_paid FROM receipt_applications a JOIN receivables rv ON rv.id = a.receivable_id
    WHERE rv.policy_id = ANY($1) AND a.status = 'applied' GROUP BY rv.policy_id`, [ids]);
  const proofless = await many(`SELECT DISTINCT rv.policy_id, r.receipt_number FROM receipt_applications a JOIN receivables rv ON rv.id = a.receivable_id JOIN receipts r ON r.id = a.receipt_id
    WHERE rv.policy_id = ANY($1) AND a.status = 'applied' AND r.receipt_status <> 'Cancelled' AND NOT ${RECEIPT_PROOF_SQL} ORDER BY r.receipt_number`, [ids]);
  const last = new Map(paid.map((p) => [p.policy_id, isoDate(p.last_paid)]));
  const out = new Map();
  for (const b of bills) {
    const balance = round2(b.balance);
    const amount = round2(b.amount);
    out.set(b.policy_id, { premium: amount, paidToDate: round2(amount - balance), balance, nextDue: balance > EPS ? isoDate(b.next_due) : null, planned: !!b.planned,
      fullyPaidOn: balance <= EPS && amount > 0 ? last.get(b.policy_id) || null : null,
      missingProof: proofless.filter((x) => x.policy_id === b.policy_id).map((x) => x.receipt_number) });
  }
  return out;
}

/**
 * Sort the policies a run could take into ready, held and exceptions. pols: rows of eligiblePolicies (not on a live
 * remittance, of the insurer); w: { from, to }. Returns { ready, held, exceptions, catchUpFrom } (rows with their
 * position as `.position`).
 */
export async function sortForRun(pols, w, basis) {
  if (!basis.fullyPaid) {
    return { ready: pols.filter((p) => !w.to || isoDate(p.inception_date) <= w.to), held: [], exceptions: [], catchUpFrom: null };
  }
  const positions = await paymentPositions(pols.map((p) => p.id));
  const earliest = addDays(w.from, -basis.catchUpDays);
  const ready = [];
  const held = [];
  const exceptions = [];
  let catchUpFrom = null;
  for (const p of pols) {
    const pos = positions.get(p.id);
    if (!pos) continue;
    const row = { ...p, position: pos };
    if (pos.fullyPaidOn) {
      if (pos.fullyPaidOn > w.to || pos.fullyPaidOn < earliest) continue;
      if (pos.fullyPaidOn < w.from && (!catchUpFrom || pos.fullyPaidOn < catchUpFrom)) catchUpFrom = pos.fullyPaidOn;
      if (basis.proofRequired && pos.missingProof.length) exceptions.push(row);
      else ready.push(row);
    } else if (basis.hold && pos.paidToDate > EPS) held.push(row);
  }
  return { ready, held, exceptions, catchUpFrom };
}

/** Product line of a policy as the runs group it ("Motor", "Accident"); "Other" when the product names none. */
export const lineOf = (p) => {
  const l = String(p.product_line || '').trim();
  return l ? l.charAt(0).toUpperCase() + l.slice(1) : 'Other';
};

/**
 * Open a "No proof of payment" exception for each policy held back for a missing proof (once per policy while it is
 * open), assigned to Cash Control. Returns the exceptions opened now.
 */
export async function raiseProofExceptions(rows, insurer, createException, user) {
  const opened = [];
  for (const p of rows) {
    const open = await one(`SELECT id FROM remittance_items WHERE kind = 'exception' AND status <> 'Resolved' AND data->>'type' = 'No proof of payment' AND data->>'sysRef' = $1`,
      [p.policy_number]);
    if (open) continue;
    opened.push(await createException({ type: 'No proof of payment', severity: 'Medium', sysRef: p.policy_number, assignedTo: 'Cash Control', amount: Number(p.premium_total) || 0,
      description: `Receipt ${p.position.missingProof.join(', ')} of ${p.policy_number} has no proof of payment. The policy is not remitted to ${insurer.name} until the proof is attached.`,
      action: 'Attach the proof of payment to the receipt' }, user));
  }
  return opened;
}
