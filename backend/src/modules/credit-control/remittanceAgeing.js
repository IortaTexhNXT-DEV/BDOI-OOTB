/**
 * Overdue remittance to insurers. Premium collected on a broker-billed policy is due to the insurer within its
 * remittance terms (insurance_companies.remittance_terms_days, else remittance.default_due_days) from the collection.
 * A collection counts as remitted once it is on an insurer payment voucher that is approved or paid.
 *
 * Amount due per collection: the insurer's share of the premium collected, net of the commission and the VAT on it and
 * plus the EWT on it (what the insurer voucher pays). Co-insured policies are aged per participating insurer.
 */
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';

const REMITTED = (alias) => `EXISTS (SELECT 1 FROM invoice_lists i JOIN disbursements d ON d.id = i.disbursement_id WHERE i.id = ${alias} AND d.status IN ('approved', 'paid'))`;

export async function remittanceAgeing(db, qs = {}) {
  const asOf = String(qs.asOf || (await today())).slice(0, 10);
  const buckets = ((await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90, 120]).map(Number);
  const defaultDays = Number(await getSetting('remittance.default_due_days', 30)) || 0;
  const insurer = qs.insurerId ? String(qs.insurerId) : null;
  // single-insurer policies: the collection is remitted when its invoice list is on an approved / paid voucher
  const single = (await db.query(`SELECT a.id, a.amount, a.applied_at::date AS collected_on, r.amount AS bill_amount, r.commission_amount, r.commission_vat, r.commission_ewt, r.bill_number,
      p.policy_number, c.display_name AS client_name, ic.id AS insurer_id, ic.code AS insurer_code, ic.name AS insurer_name, COALESCE(ic.remittance_terms_days, $2::int) AS terms,
      rc.receipt_number
    FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = p.client_id
    JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN receipts rc ON rc.id = a.receipt_id
    WHERE a.status = 'applied' AND a.applied_at::date <= $1::date AND p.billing_mode <> 'direct'
      AND (SELECT count(*) FROM risk_participants x WHERE x.entity_type = 'policy' AND x.entity_id = p.id AND x.status = 'active') <= 1
      AND NOT (a.remitted_invoice_id IS NOT NULL AND ${REMITTED('a.remitted_invoice_id')})
      AND ($3::text IS NULL OR ic.id::text = $3 OR ic.code = $3)`, [asOf, defaultDays, insurer])).rows;
  // co-insured policies: one row per participant not yet remitted its share
  const co = (await db.query(`SELECT a.id, a.amount, a.applied_at::date AS collected_on, r.id AS receivable_id, r.amount AS bill_amount, r.commission_amount, r.bill_number,
      p.id AS policy_id, p.policy_number, c.display_name AS client_name, ic.id AS insurer_id, ic.code AS insurer_code, ic.name AS insurer_name,
      COALESCE(ic.remittance_terms_days, $2::int) AS terms, rp.gross AS part_gross, rp.commission AS part_commission, rp.commission_vat AS part_vat, rp.commission_ewt AS part_ewt, rc.receipt_number
    FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id LEFT JOIN clients c ON c.id = p.client_id
    JOIN receivable_participants rp ON rp.receivable_id = r.id JOIN insurance_companies ic ON ic.id = rp.insurance_company_id LEFT JOIN receipts rc ON rc.id = a.receipt_id
    WHERE a.status = 'applied' AND a.applied_at::date <= $1::date AND p.billing_mode <> 'direct'
      AND NOT EXISTS (SELECT 1 FROM remittance_allocations al WHERE al.receipt_application_id = a.id AND al.insurance_company_id = rp.insurance_company_id
        AND al.invoice_list_id IS NOT NULL AND ${REMITTED('al.invoice_list_id')})
      AND ($3::text IS NULL OR ic.id::text = $3 OR ic.code = $3)`, [asOf, defaultDays, insurer])).rows;
  const bucketOf = (dpd) => {
    if (dpd <= 0) return 'current';
    if (dpd <= buckets[0]) return 'b1';
    if (dpd <= buckets[1]) return 'b2';
    if (dpd <= buckets[2]) return 'b3';
    return 'b4';
  };
  const row = (x, net) => {
    const due = new Date(Date.parse(`${x.collected_on}T00:00:00Z`) + Number(x.terms) * 86400000).toISOString().slice(0, 10);
    const dpd = Math.max(0, Math.round((Date.parse(asOf) - Date.parse(due)) / 86400000));
    return { applicationId: Number(x.id), insurerId: x.insurer_id, insurerCode: x.insurer_code, insurerName: x.insurer_name, policyNumber: x.policy_number, clientName: x.client_name,
      billNumber: x.bill_number, receiptNumber: x.receipt_number, collectedOn: x.collected_on, termsDays: Number(x.terms), remitBy: due, daysOverdue: dpd, amountDue: net, bucket: bucketOf(dpd) };
  };
  const rows = [];
  for (const x of single) {
    const ratio = Number(x.amount) / Number(x.bill_amount);
    const net = round2(Number(x.amount) - ratio * (Number(x.commission_amount) + Number(x.commission_vat || 0) - Number(x.commission_ewt || 0)));
    if (net > 0) rows.push(row(x, net));
  }
  for (const x of co) {
    const ratio = Number(x.amount) / Number(x.bill_amount);
    const share = Number(x.bill_amount) ? Number(x.part_gross) / Number(x.bill_amount) : 0;
    const gross = round2(Number(x.amount) * share);
    const net = round2(gross - ratio * (Number(x.part_commission) + Number(x.part_vat || 0) - Number(x.part_ewt || 0)));
    if (net > 0) rows.push(row(x, net));
  }
  const filtered = qs.overdueOnly === 'true' ? rows.filter((r) => r.daysOverdue > 0) : rows;
  filtered.sort((a, b) => b.daysOverdue - a.daysOverdue || a.insurerName.localeCompare(b.insurerName));
  const byInsurer = new Map();
  for (const r of filtered) {
    const s = byInsurer.get(r.insurerId) || { insurerId: r.insurerId, insurerCode: r.insurerCode, insurerName: r.insurerName, count: 0, total: 0, current: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    s.count += 1;
    s.total = round2(s.total + r.amountDue);
    s[r.bucket] = round2(s[r.bucket] + r.amountDue);
    byInsurer.set(r.insurerId, s);
  }
  const insurers = [...byInsurer.values()].sort((a, b) => b.total - a.total);
  const sum = (k) => round2(insurers.reduce((t, s) => t + s[k], 0));
  return { asOf, bucketDays: buckets.slice(0, 3), summary: { count: filtered.length, total: sum('total'), current: sum('current'), b1: sum('b1'), b2: sum('b2'), b3: sum('b3'), b4: sum('b4') },
    insurers, rows: filtered };
}

export const AGEING_HEADER = ['Insurer', 'Policy', 'Client', 'Bill', 'Receipt', 'Collected on', 'Terms (days)', 'Remit by', 'Days overdue', 'Amount due'];
export const ageingRows = (r) => r.rows.map((x) => [x.insurerName, x.policyNumber, x.clientName || '', x.billNumber || '', x.receiptNumber || '', x.collectedOn, x.termsDays, x.remitBy, x.daysOverdue, x.amountDue]);
