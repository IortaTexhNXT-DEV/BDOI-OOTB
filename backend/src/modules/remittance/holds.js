/**
 * Instalment hold (FRS FR-RMT-012): broker-billed policies with a payment but not fully paid are held from remittance
 * on the fully paid basis, never remitted in part. remittance_holds records each held policy with its payment position
 * (premium, paid to date, balance, next due) and releases it once fully paid, with the receipt that cleared it; the
 * next weekly run then picks it with its fully paid date. A bounced cheque keeps a policy held (its AR is cancelled, so
 * the balance includes it). Kept up to date by the daily job "Instalment hold check" and on reading the Held list.
 */
import { many, one, query } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { today as businessToday } from '../../lib/dates.js';
import { isoDate, params, round2 } from '../masters/helpers.js';
import { eligiblePolicies } from './service.js';
import { paymentPositions } from './eligibility.js';

const SYSTEM = { user: { id: null, username: 'system', roles: [], permissions: [] }, auditSource: { channel: 'job', name: 'remittance-hold-check' } };

/**
 * Bring remittance_holds up to date on `asOf`: hold the part-paid policies not yet remitted, refresh the position of
 * those still held and release those now fully paid. Returns { held, released: [policy numbers] }.
 */
export async function refreshHolds({ asOf = null, req = null } = {}) {
  const day = asOf || (await businessToday());
  const pols = await eligiblePolicies({ kind: 'direct-bill', includeExpired: true });
  const positions = await paymentPositions(pols.map((p) => p.id));
  const heldNow = new Set();
  for (const p of pols) {
    const pos = positions.get(p.id);
    if (!pos || pos.fullyPaidOn || !(pos.paidToDate > 0)) continue;
    heldNow.add(p.id);
    await query(`INSERT INTO remittance_holds(policy_id, insurance_company_id, status, held_since, last_checked, premium, paid_to_date, balance, next_due)
      VALUES ($1,$2,'held',$3,$3,$4,$5,$6,$7)
      ON CONFLICT (policy_id) DO UPDATE SET status = 'held', last_checked = EXCLUDED.last_checked, premium = EXCLUDED.premium, paid_to_date = EXCLUDED.paid_to_date,
        balance = EXCLUDED.balance, next_due = EXCLUDED.next_due, released_on = NULL, release_receipt = NULL,
        held_since = CASE WHEN remittance_holds.status = 'released' THEN EXCLUDED.held_since ELSE remittance_holds.held_since END, updated_at = now()`,
    [p.id, p.insurance_company_id, day, pos.premium, pos.paidToDate, pos.balance, pos.nextDue]);
  }
  const open = (await many("SELECT h.policy_id, p.policy_number FROM remittance_holds h JOIN policies p ON p.id = h.policy_id WHERE h.status = 'held'"))
    .filter((h) => !heldNow.has(h.policy_id));
  const now = await paymentPositions(open.map((h) => h.policy_id));
  const released = [];
  for (const h of open) {
    const pos = now.get(h.policy_id);
    if (!pos?.fullyPaidOn) {
      await query('UPDATE remittance_holds SET last_checked = $2, updated_at = now() WHERE policy_id = $1', [h.policy_id, day]);
      continue;
    }
    const last = await one(`SELECT r.receipt_number FROM receipt_applications a JOIN receivables rv ON rv.id = a.receivable_id JOIN receipts r ON r.id = a.receipt_id
      WHERE rv.policy_id = $1 AND a.status = 'applied' ORDER BY a.collected_on DESC, a.id DESC LIMIT 1`, [h.policy_id]);
    await query(`UPDATE remittance_holds SET status = 'released', released_on = $2, release_receipt = $3, last_checked = $4, paid_to_date = $5, balance = 0, next_due = NULL,
      updated_at = now() WHERE policy_id = $1`, [h.policy_id, pos.fullyPaidOn, last?.receipt_number || null, day, pos.paidToDate]);
    await audit(req || SYSTEM, { entity: 'remittance_hold', entityId: h.policy_id, action: 'release',
      before: { status: 'Held' }, after: { status: 'Released', policy: h.policy_number, fullyPaidOn: pos.fullyPaidOn, receipt: last?.receipt_number || null } });
    released.push(h.policy_number);
  }
  return { asOf: day, held: heldNow.size, released };
}

/** Scheduled job "Instalment hold check" (remittance-hold-check). */
export const holdCheckJob = () => refreshHolds();

/**
 * GET /remittance/held: the held policies (status held | released, insurerId, q) with the plan, premium, paid to date,
 * balance and next due date, refreshed first. Returns { asOf, totals, rows }.
 */
export async function listHeld(qs = {}) {
  const { asOf } = await refreshHolds();
  const p = params([qs.status === 'released' ? 'released' : 'held']);
  const conds = ['h.status = $1'];
  if (qs.insurerId) conds.push(`h.insurance_company_id::text = ${p.add(String(qs.insurerId))}`);
  if (qs.q) conds.push(`(p.policy_number ILIKE '%' || ${p.add(String(qs.q))} || '%' OR c.display_name ILIKE '%' || $${p.values.length} || '%')`);
  const rows = await many(`SELECT h.*, p.policy_number, c.display_name AS client_name, ic.name AS insurer_name, pr.line AS product_line,
      (SELECT pl.instalment_count FROM premium_instalment_plans pl JOIN receivables r ON r.id = pl.receivable_id WHERE r.policy_id = h.policy_id AND pl.status = 'active' LIMIT 1) AS instalments,
      (SELECT count(*)::int FROM post_dated_cheques d WHERE d.policy_id = h.policy_id AND d.status = 'bounced') AS bounced
    FROM remittance_holds h JOIN policies p ON p.id = h.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = h.insurance_company_id
    LEFT JOIN products pr ON pr.id = p.product_id WHERE ${conds.join(' AND ')} ORDER BY h.next_due NULLS LAST, p.policy_number LIMIT 1000`, p.values);
  const out = rows.map((r) => ({
    policyId: r.policy_id, policyNumber: r.policy_number, clientName: r.client_name, insurerId: r.insurance_company_id, insurerName: r.insurer_name,
    productLine: r.product_line ? r.product_line.charAt(0).toUpperCase() + r.product_line.slice(1) : null, plan: r.instalments ? `${r.instalments} instalments` : null,
    premium: round2(r.premium), paidToDate: round2(r.paid_to_date), balance: round2(r.balance), nextDue: isoDate(r.next_due), heldSince: isoDate(r.held_since),
    bouncedCheques: r.bounced, status: r.status, releasedOn: isoDate(r.released_on), releaseReceipt: r.release_receipt,
  }));
  return { asOf, totals: { count: out.length, premium: round2(out.reduce((s, r) => s + r.premium, 0)), paidToDate: round2(out.reduce((s, r) => s + r.paidToDate, 0)),
    balance: round2(out.reduce((s, r) => s + r.balance, 0)) }, rows: out };
}
