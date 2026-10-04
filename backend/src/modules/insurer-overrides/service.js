/**
 * Overriding, profit and contingent commission from insurers.
 *
 * Agreement (per insurer): basis production (premium volume of the period), loss_ratio (claims incurred / production)
 * or growth (production against the same period one year earlier); period monthly, quarterly, semi-annual or annual;
 * lines of business (empty = all); premium measure (net or gross premium); minimum production; tiers (from / to value
 * of the basis, rate % of the production) read as a slab (the tier reached applies to the whole production) or, for a
 * production basis, banded (each band of production at its own rate); VAT and the insurer's expected withholding.
 *
 * Computation: production = premium of the insurer's policies issued in the period (issued date, else inception),
 * cancelled ones excluded; claims incurred = claims on those lines with a loss date in the period, at the settled,
 * approved or estimated amount (statuses in commission.override_claims_statuses), or the insurer's own figure entered
 * on the computation; commission = production x rate of the tier; VAT at the commission VAT code when the agreement
 * and the broker are VAT-registered. Prepared, submitted and approved by another user (commission.override_requires_
 * approval); approval posts override_commission.accrual (receivable / income / output VAT). Settlement against the
 * insurer's statement posts override_commission.settlement (cash, creditable tax withheld, receivable cleared, any
 * difference to the income when the broker accepts the insurer's figure).
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { round2 } from '../../lib/money.js';
import { today } from '../../lib/dates.js';
import { postEvent } from '../accounting/lib/posting.js';
import { reverseJournal } from '../accounting/lib/ledger.js';
import { taxCodeRate } from '../accounting/lib/commissionTax.js';
import { addMonths, iso, monthEnd } from '../period-end/fiscal.js';

export const BASES = ['production', 'loss_ratio', 'growth'];
export const TYPES = ['overriding', 'profit', 'contingent'];
export const PERIOD_TYPES = ['monthly', 'quarterly', 'semi_annual', 'annual'];
const TYPE_LABEL = { overriding: 'Overriding', profit: 'Profit', contingent: 'Contingent' };

const tierRow = (t) => ({ tierNo: t.tier_no, fromValue: Number(t.from_value), toValue: t.to_value === null ? null : Number(t.to_value), rate: Number(t.rate) });
export const agreementRow = (a, tiers = []) => a && ({
  id: a.id, agreementCode: a.agreement_code, name: a.name, insurerId: a.insurance_company_id, insurerName: a.insurer_name, commissionType: a.commission_type, basis: a.basis,
  periodType: a.period_type, premiumMeasure: a.premium_measure, tierMethod: a.tier_method, linesOfBusiness: a.lines_of_business || [], minProduction: Number(a.min_production),
  vatApplicable: a.vat_applicable, ewtRate: Number(a.ewt_rate), effectiveFrom: iso(a.effective_from), effectiveTo: a.effective_to ? iso(a.effective_to) : null, status: a.status,
  remarks: a.remarks, tiers: tiers.map(tierRow), createdBy: a.created_by, createdAt: a.created_at, updatedAt: a.updated_at,
});

export async function listAgreements(db, q = {}) {
  const rows = (await db.query(`SELECT a.*, ic.name AS insurer_name FROM override_agreements a JOIN insurance_companies ic ON ic.id = a.insurance_company_id
    WHERE ($1::text IS NULL OR a.status = $1) AND ($2::int IS NULL OR a.insurance_company_id = $2) ORDER BY ic.name, a.agreement_code`, [q.status || null, q.insurerId ? Number(q.insurerId) : null])).rows;
  const tiers = rows.length ? (await db.query('SELECT * FROM override_agreement_tiers WHERE agreement_id = ANY($1) ORDER BY agreement_id, tier_no', [rows.map((r) => r.id)])).rows : [];
  return rows.map((a) => agreementRow(a, tiers.filter((t) => t.agreement_id === a.id)));
}

export async function getAgreement(db, id) {
  const a = (await db.query(`SELECT a.*, ic.name AS insurer_name FROM override_agreements a JOIN insurance_companies ic ON ic.id = a.insurance_company_id
    WHERE a.id = $1 OR a.agreement_code = $1`, [String(id)])).rows[0];
  if (!a) throw notFound('Overriding commission agreement not found');
  const tiers = (await db.query('SELECT * FROM override_agreement_tiers WHERE agreement_id = $1 ORDER BY tier_no', [a.id])).rows;
  return agreementRow(a, tiers);
}

/** Tiers in order, each starting where the previous one ended, rates 0 to 100. */
export function checkTiers(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) throw badRequest('An agreement needs at least one tier');
  const sorted = [...tiers].map((t) => ({ fromValue: Number(t.fromValue), toValue: t.toValue === null || t.toValue === undefined || t.toValue === '' ? null : Number(t.toValue), rate: Number(t.rate) }))
    .sort((a, b) => a.fromValue - b.fromValue);
  sorted.forEach((t, i) => {
    if (!Number.isFinite(t.fromValue) || !Number.isFinite(t.rate)) throw badRequest(`Tier ${i + 1}: from value and rate are required`);
    if (t.rate < 0 || t.rate > 100) throw badRequest(`Tier ${i + 1}: the rate must be between 0 and 100`);
    if (t.toValue !== null && t.toValue <= t.fromValue) throw badRequest(`Tier ${i + 1}: the to value must be more than the from value`);
    if (i < sorted.length - 1 && t.toValue === null) throw badRequest(`Tier ${i + 1}: only the last tier can be open ended`);
    if (i > 0 && sorted[i - 1].toValue !== null && t.fromValue < sorted[i - 1].toValue) throw badRequest(`Tier ${i + 1} overlaps tier ${i}`);
  });
  return sorted.map((t, i) => ({ ...t, tierNo: i + 1 }));
}

export async function saveAgreement(db, id, b, user) {
  const current = id ? await getAgreement(db, id) : null;
  const m = { ...(current || {}), ...b };
  if (!m.agreementCode || !m.name || !m.insurerId || !m.effectiveFrom) throw badRequest('agreementCode, name, insurerId and effectiveFrom are required');
  if (!BASES.includes(m.basis || 'production')) throw badRequest(`basis must be one of ${BASES.join(', ')}`);
  if (m.tierMethod === 'banded' && (m.basis || 'production') !== 'production') throw badRequest('Banded tiers apply to a production basis only');
  if (m.effectiveTo && m.effectiveTo < m.effectiveFrom) throw badRequest('effectiveTo must be on or after effectiveFrom');
  const ic = (await db.query('SELECT id FROM insurance_companies WHERE id = $1', [Number(m.insurerId)])).rows[0];
  if (!ic) throw badRequest('Insurer not found');
  const tiers = checkTiers(b.tiers || current?.tiers);
  const dup = (await db.query('SELECT id FROM override_agreements WHERE agreement_code = $1 AND id <> COALESCE($2, \'\')', [m.agreementCode, current?.id || null])).rows[0];
  if (dup) throw conflict(`Agreement code ${m.agreementCode} is already used`);
  const vals = [m.agreementCode, m.name, Number(m.insurerId), m.commissionType || 'overriding', m.basis || 'production', m.periodType || 'quarterly', m.premiumMeasure || 'net_premium',
    m.tierMethod || 'slab', m.linesOfBusiness || [], round2(m.minProduction || 0), m.vatApplicable !== false, Number(m.ewtRate ?? 10), m.effectiveFrom, m.effectiveTo || null,
    m.status || 'active', m.remarks || null, user?.id ?? null];
  const row = current
    ? (await db.query(`UPDATE override_agreements SET agreement_code = $1, name = $2, insurance_company_id = $3, commission_type = $4, basis = $5, period_type = $6, premium_measure = $7,
        tier_method = $8, lines_of_business = $9, min_production = $10, vat_applicable = $11, ewt_rate = $12, effective_from = $13, effective_to = $14, status = $15, remarks = $16,
        updated_by = $17, updated_at = now() WHERE id = $18 RETURNING id`, [...vals, current.id])).rows[0]
    : (await db.query(`INSERT INTO override_agreements(agreement_code, name, insurance_company_id, commission_type, basis, period_type, premium_measure, tier_method, lines_of_business,
        min_production, vat_applicable, ewt_rate, effective_from, effective_to, status, remarks, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`, vals)).rows[0];
  await db.query('DELETE FROM override_agreement_tiers WHERE agreement_id = $1', [row.id]);
  for (const t of tiers) {
    await db.query('INSERT INTO override_agreement_tiers(agreement_id, tier_no, from_value, to_value, rate) VALUES ($1,$2,$3,$4,$5)', [row.id, t.tierNo, t.fromValue, t.toValue, t.rate]);
  }
  return { before: current, after: await getAgreement(db, row.id) };
}

/** Periods of an agreement in a year: [{ label, from, to }]. */
export function periodsOf(periodType, year) {
  const y = Number(year);
  const make = (startMonth, months, label) => {
    const from = `${y}-${String(startMonth).padStart(2, '0')}-01`;
    return { label, from, to: monthEnd(addMonths(from, months - 1)) };
  };
  if (periodType === 'monthly') return Array.from({ length: 12 }, (_, i) => make(i + 1, 1, `${y}-${String(i + 1).padStart(2, '0')}`));
  if (periodType === 'quarterly') return [1, 2, 3, 4].map((q) => make((q - 1) * 3 + 1, 3, `${y}-Q${q}`));
  if (periodType === 'semi_annual') return [make(1, 6, `${y}-H1`), make(7, 6, `${y}-H2`)];
  return [make(1, 12, String(y))];
}

const minusYear = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;

/** Production of an insurer's policies issued in a window, per line of business. */
export async function production(db, ag, from, to) {
  const measure = ag.premiumMeasure === 'gross_premium' ? 'p.premium_total' : 'COALESCE(p.net_premium, NULLIF(p.details->>\'netPremium\', \'\')::numeric, p.premium_total)';
  const rows = (await db.query(`SELECT COALESCE(p.lob, p.product_type, '(none)') AS lob, count(*)::int AS policies, COALESCE(sum(${measure}), 0) AS premium
    FROM policies p WHERE p.insurance_company_id = $1 AND COALESCE(p.issued_date, p.inception_date) BETWEEN $2 AND $3
      AND lower(COALESCE(p.status, '')) NOT IN ('cancelled', 'void', 'draft', 'rejected')
      AND (cardinality($4::text[]) = 0 OR p.lob = ANY($4)) GROUP BY 1 ORDER BY 1`, [ag.insurerId, from, to, ag.linesOfBusiness || []])).rows;
  return { total: round2(rows.reduce((s, r) => s + Number(r.premium), 0)), policies: rows.reduce((s, r) => s + r.policies, 0), perLine: rows.map((r) => ({ lob: r.lob, policies: r.policies, premium: round2(r.premium) })) };
}

/** Claims incurred on an insurer's policies (losses in the window): settled, else approved, else estimated amount. */
export async function claimsIncurred(db, ag, from, to) {
  const statuses = (await getSetting('commission.override_claims_statuses', ['registered', 'in-review', 'pending-approval', 'approved', 'settled', 'closed'])) || [];
  const r = (await db.query(`SELECT count(*)::int AS n, COALESCE(sum(CASE WHEN COALESCE(c.settled_amount, 0) > 0 THEN c.settled_amount WHEN COALESCE(c.approved_amount, 0) > 0 THEN c.approved_amount
      ELSE COALESCE(c.estimate_amount, 0) END), 0) AS amount
    FROM claims c JOIN policies p ON p.id = c.policy_id WHERE p.insurance_company_id = $1 AND c.loss_date BETWEEN $2 AND $3 AND c.status = ANY($4)
      AND (cardinality($5::text[]) = 0 OR p.lob = ANY($5))`, [ag.insurerId, from, to, statuses, ag.linesOfBusiness || []])).rows[0];
  return { claims: r.n, amount: round2(r.amount) };
}

/** The tier a value falls in (from <= value < to; the last tier open ended). */
export function tierFor(tiers, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return tiers.find((t) => value >= t.fromValue && (t.toValue === null || value < t.toValue)) || null;
}

/** Commission of a production amount under an agreement's tiers. */
export function commissionFor(ag, prod, basisValue) {
  if (prod <= 0 || prod < Number(ag.minProduction || 0)) return { commission: 0, tier: null, rate: 0, bands: [] };
  if (ag.tierMethod === 'banded' && ag.basis === 'production') {
    const bands = ag.tiers.filter((t) => prod > t.fromValue).map((t) => {
      const portion = round2(Math.min(prod, t.toValue ?? prod) - t.fromValue);
      return { tierNo: t.tierNo, portion, rate: t.rate, amount: round2((portion * t.rate) / 100) };
    });
    const commission = round2(bands.reduce((s, b) => s + b.amount, 0));
    const top = bands[bands.length - 1];
    return { commission, tier: top ? top.tierNo : null, rate: prod ? round2((100 * commission) / prod) : 0, bands };
  }
  const t = tierFor(ag.tiers, basisValue);
  if (!t) return { commission: 0, tier: null, rate: 0, bands: [] };
  return { commission: round2((prod * t.rate) / 100), tier: t.tierNo, rate: t.rate, bands: [] };
}

export const computationRow = (c, settlements = null) => c && ({
  id: c.id, computationNumber: c.computation_number, agreementId: c.agreement_id, agreementCode: c.agreement_code, agreementName: c.agreement_name, insurerId: c.insurance_company_id,
  insurerName: c.insurer_name, commissionType: c.commission_type, basis: c.basis, periodLabel: c.period_label, periodFrom: iso(c.period_from), periodTo: iso(c.period_to),
  production: Number(c.production), policies: c.policies, priorProduction: Number(c.prior_production), growthPct: c.growth_pct === null ? null : Number(c.growth_pct),
  claimsIncurred: Number(c.claims_incurred), claimsSource: c.claims_source, claimsNote: c.claims_note, lossRatioPct: c.loss_ratio_pct === null ? null : Number(c.loss_ratio_pct),
  basisValue: c.basis_value === null ? null : Number(c.basis_value), tierNo: c.tier_no, rate: Number(c.rate), commission: Number(c.commission), vat: Number(c.vat),
  receivable: Number(c.receivable), expectedEwt: Number(c.expected_ewt), settled: Number(c.settled), balance: Number(c.balance), details: c.details, status: c.status,
  journalId: c.journal_id, journalNumber: c.journal_number || null, reversalJournalId: c.reversal_journal_id, submittedBy: c.submitted_by, submittedAt: c.submitted_at,
  approvedBy: c.approved_by, approvedAt: c.approved_at, rejectionReason: c.rejection_reason, cancelReason: c.cancel_reason, remarks: c.remarks, createdBy: c.created_by, createdAt: c.created_at,
  ...(settlements ? { settlements: settlements.map(settlementRow) } : {}),
});
export const settlementRow = (s) => ({ id: s.id, computationId: s.computation_id, statementReference: s.statement_reference, statementDate: iso(s.statement_date),
  statementAmount: Number(s.statement_amount), cashReceived: Number(s.cash_received), ewtWithheld: Number(s.ewt_withheld), form2307No: s.form_2307_no, applied: Number(s.applied),
  difference: Number(s.difference), differenceTreatment: s.difference_treatment, bankAccount: s.bank_account, remarks: s.remarks, journalId: s.journal_id, createdBy: s.created_by, createdAt: s.created_at });

const COMP_SQL = `SELECT c.*, a.agreement_code, a.name AS agreement_name, a.commission_type, a.basis, ic.name AS insurer_name, j.jv_number AS journal_number
  FROM override_computations c JOIN override_agreements a ON a.id = c.agreement_id JOIN insurance_companies ic ON ic.id = c.insurance_company_id
  LEFT JOIN journal_vouchers j ON j.id = c.journal_id`;

export async function listComputations(db, q = {}) {
  const rows = (await db.query(`${COMP_SQL} WHERE ($1::text IS NULL OR c.status = $1) AND ($2::text IS NULL OR c.agreement_id = $2) AND ($3::int IS NULL OR c.insurance_company_id = $3)
    AND ($4::int IS NULL OR extract(year FROM c.period_from)::int = $4) ORDER BY c.period_from DESC, c.computation_number DESC LIMIT 500`,
  [q.status || null, q.agreementId || null, q.insurerId ? Number(q.insurerId) : null, q.year ? Number(q.year) : null])).rows;
  return rows.map((r) => computationRow(r));
}

export async function getComputation(db, id) {
  const c = (await db.query(`${COMP_SQL} WHERE c.id = $1 OR c.computation_number = $1`, [String(id)])).rows[0];
  if (!c) throw notFound('Computation not found');
  const s = (await db.query('SELECT * FROM override_settlements WHERE computation_id = $1 ORDER BY created_at', [c.id])).rows;
  return computationRow(c, s);
}

/** Figures of an agreement for a period (nothing saved). */
export async function evaluate(db, ag, period, { claimsOverride = null } = {}) {
  const prod = await production(db, ag, period.from, period.to);
  const prior = await production(db, ag, minusYear(period.from), minusYear(period.to));
  const claims = claimsOverride !== null && claimsOverride !== undefined ? { claims: null, amount: round2(claimsOverride) } : await claimsIncurred(db, ag, period.from, period.to);
  const lossRatio = prod.total > 0 ? round2((100 * claims.amount) / prod.total) : null;
  const growth = prior.total > 0 ? round2((100 * (prod.total - prior.total)) / prior.total) : null;
  const basisValue = ag.basis === 'loss_ratio' ? lossRatio : ag.basis === 'growth' ? growth : prod.total;
  const c = commissionFor(ag, prod.total, basisValue);
  const registered = (await getSetting('direct_bill.broker_vat_registered', true)) !== false;
  const vatRate = ag.vatApplicable && registered ? (await taxCodeRate(db, await getSetting('direct_bill.commission_vat_code', 'VAT12-OUT'))).rate : 0;
  const vat = round2(c.commission * vatRate);
  return { production: prod.total, policies: prod.policies, perLine: prod.perLine, priorProduction: prior.total, growthPct: growth, claimsIncurred: claims.amount, claimsCount: claims.claims,
    lossRatioPct: lossRatio, basisValue, tierNo: c.tier, rate: c.rate, bands: c.bands, commission: c.commission, vat, receivable: round2(c.commission + vat),
    expectedEwt: round2((c.commission * Number(ag.ewtRate || 0)) / 100) };
}

/** Compute (or recompute a draft) for an agreement and period. */
export async function compute(db, agreementId, b, user) {
  const ag = await getAgreement(db, agreementId);
  if (ag.status !== 'active') throw conflict(`Agreement ${ag.agreementCode} is ${ag.status}`);
  const period = periodsOf(ag.periodType, b.year).find((p) => p.label === b.periodLabel);
  if (!period) throw badRequest(`Period ${b.periodLabel} is not a ${ag.periodType.replace('_', '-')} period of ${b.year}`);
  if (period.to < ag.effectiveFrom || (ag.effectiveTo && period.from > ag.effectiveTo)) throw badRequest(`${period.label} is outside the agreement's effective dates`);
  const claimsOverride = b.claimsIncurred === undefined || b.claimsIncurred === null || b.claimsIncurred === '' ? null : Number(b.claimsIncurred);
  const f = await evaluate(db, ag, period, { claimsOverride });
  const existing = (await db.query('SELECT * FROM override_computations WHERE agreement_id = $1 AND period_from = $2 AND status NOT IN (\'rejected\', \'cancelled\') FOR UPDATE', [ag.id, period.from])).rows[0];
  if (existing && existing.status !== 'draft') throw conflict(`${ag.agreementCode} ${period.label} is already ${existing.status} (${existing.computation_number})`);
  const details = { perLine: f.perLine, bands: f.bands, claimsCount: f.claimsCount, tiers: ag.tiers, tierMethod: ag.tierMethod, premiumMeasure: ag.premiumMeasure };
  const vals = [f.production, f.policies, f.priorProduction, f.growthPct, f.claimsIncurred, claimsOverride !== null ? 'insurer' : 'system', b.claimsNote || null, f.lossRatioPct, f.basisValue,
    f.tierNo, f.rate, f.commission, f.vat, f.receivable, f.expectedEwt, JSON.stringify(details), b.remarks || null];
  let id;
  if (existing) {
    await db.query(`UPDATE override_computations SET production = $1, policies = $2, prior_production = $3, growth_pct = $4, claims_incurred = $5, claims_source = $6, claims_note = $7,
      loss_ratio_pct = $8, basis_value = $9, tier_no = $10, rate = $11, commission = $12, vat = $13, receivable = $14, expected_ewt = $15, details = $16, remarks = $17, balance = $14,
      updated_at = now() WHERE id = $18`, [...vals, existing.id]);
    id = existing.id;
  } else {
    const number = await nextDocumentNumber('override_computation', { db, date: period.to });
    id = (await db.query(`INSERT INTO override_computations(production, policies, prior_production, growth_pct, claims_incurred, claims_source, claims_note, loss_ratio_pct, basis_value,
        tier_no, rate, commission, vat, receivable, expected_ewt, details, remarks, balance, computation_number, agreement_id, insurance_company_id, period_label, period_from, period_to, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$14,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
    [...vals, number, ag.id, ag.insurerId, period.label, period.from, period.to, user?.id ?? null])).rows[0].id;
  }
  return getComputation(db, id);
}

export async function submit(db, id, user) {
  const c = await getComputation(db, id);
  if (c.status !== 'draft') throw conflict(`Computation ${c.computationNumber} is ${c.status}`);
  await db.query('UPDATE override_computations SET status = \'submitted\', submitted_by = $2, submitted_at = now(), updated_at = now() WHERE id = $1', [c.id, user?.id ?? null]);
  return getComputation(db, c.id);
}

/** Approve: maker-checker, then the accrual journal (no journal for a nil commission). */
export async function approve(db, id, user, { postingDate = null } = {}) {
  const c = await getComputation(db, id);
  if (!['submitted', 'draft'].includes(c.status)) throw conflict(`Computation ${c.computationNumber} is ${c.status}`);
  const checker = (await getSetting('commission.override_requires_approval', true)) !== false;
  if (checker && c.status !== 'submitted') throw conflict('Submit the computation for approval first');
  if (checker && [c.createdBy, c.submittedBy].includes(user?.id)) throw forbidden('Maker-checker: the computation must be approved by a user other than the one who prepared or submitted it');
  let jvId = null;
  if (c.receivable > 0) {
    const jv = await postEvent('override_commission.accrual', { date: postingDate || (await today()), transactionCode: c.computationNumber, referenceType: 'override_computation',
      referenceId: c.id, insuranceCompanyId: c.insurerId, amounts: { receivable: c.receivable, commission: c.commission, vat: c.vat },
      vars: { computationNumber: c.computationNumber, insurer: c.insurerName, period: c.periodLabel, commissionType: TYPE_LABEL[c.commissionType] || 'Overriding' } }, { db, user });
    jvId = jv.id;
  }
  await db.query(`UPDATE override_computations SET status = $2, approved_by = $3, approved_at = now(), journal_id = $4, balance = receivable, updated_at = now() WHERE id = $1`,
    [c.id, c.receivable > 0 ? 'approved' : 'settled', user?.id ?? null, jvId]);
  return getComputation(db, c.id);
}

export async function reject(db, id, reason, user) {
  const c = await getComputation(db, id);
  if (c.status !== 'submitted') throw conflict(`Computation ${c.computationNumber} is ${c.status}`);
  await db.query('UPDATE override_computations SET status = \'rejected\', rejected_by = $2, rejected_at = now(), rejection_reason = $3, updated_at = now() WHERE id = $1', [c.id, user?.id ?? null, reason]);
  return getComputation(db, c.id);
}

/** Cancel a draft / submitted computation, or an approved one without settlements (its journal reversed). */
export async function cancel(db, id, reason, user) {
  const c = await getComputation(db, id);
  if (!['draft', 'submitted', 'approved'].includes(c.status)) throw conflict(`Computation ${c.computationNumber} is ${c.status}`);
  if (c.settlements.length) throw conflict(`Computation ${c.computationNumber} has settlements`);
  const invoiced = (await db.query('SELECT invoice_number FROM sales_invoices WHERE source_type = \'override_commission\' AND source_id = $1 AND status = \'issued\'', [c.id])).rows[0];
  if (invoiced) throw conflict(`Computation ${c.computationNumber} is invoiced on ${invoiced.invoice_number}: cancel the invoice first`);
  let rev = null;
  if (c.journalId) rev = await reverseJournal(db, c.journalId, user, { description: `Cancellation of overriding commission ${c.computationNumber}: ${reason}` });
  await db.query('UPDATE override_computations SET status = \'cancelled\', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3, reversal_journal_id = $4, balance = 0, updated_at = now() WHERE id = $1',
    [c.id, user?.id ?? null, reason, rev?.id || null]);
  return getComputation(db, c.id);
}

/**
 * Settle against the insurer's statement. leave_open: the cash and tax withheld clear the receivable up to its
 * balance (an overpayment goes to the income); adjust_income: the receivable is cleared in full and the difference
 * (short or over payment) goes to the commission income.
 */
export async function settle(db, id, b, user) {
  const c = await getComputation(db, id);
  if (!['approved', 'partially_settled'].includes(c.status)) throw conflict(`Computation ${c.computationNumber} is ${c.status}: only an approved computation is settled`);
  const cash = round2(b.cashReceived); const ewt = round2(b.ewtWithheld || 0);
  if (cash < 0 || ewt < 0 || cash + ewt <= 0) throw badRequest('The cash received and the tax withheld cannot be negative, and one of them must be more than zero');
  const received = round2(cash + ewt);
  const treatment = b.differenceTreatment === 'adjust_income' ? 'adjust_income' : 'leave_open';
  const applied = treatment === 'adjust_income' ? c.balance : round2(Math.min(received, c.balance));
  const difference = round2(received - applied);
  const date = b.statementDate || (await today());
  const jv = await postEvent('override_commission.settlement', { date, transactionCode: c.computationNumber, referenceType: 'override_computation', referenceId: c.id,
    insuranceCompanyId: c.insurerId, paymentMode: b.paymentMode || 'bank-transfer', bankAccount: b.bankAccount || null, amounts: { cash, ewt, applied, difference },
    vars: { computationNumber: c.computationNumber, insurer: c.insurerName, statementReference: b.statementReference, form2307: b.form2307No || '' } }, { db, user });
  const s = (await db.query(`INSERT INTO override_settlements(computation_id, statement_reference, statement_date, statement_amount, cash_received, ewt_withheld, form_2307_no, applied, difference,
      difference_treatment, bank_account, remarks, journal_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
  [c.id, b.statementReference, date, round2(b.statementAmount ?? received), cash, ewt, b.form2307No || null, applied, difference, treatment, b.bankAccount || null, b.remarks || null, jv.id, user?.id ?? null])).rows[0];
  const balance = round2(c.balance - applied);
  await db.query('UPDATE override_computations SET settled = settled + $2, balance = $3, status = $4, updated_at = now() WHERE id = $1', [c.id, applied, balance, balance <= 0.005 ? 'settled' : 'partially_settled']);
  const tolerance = Number(await getSetting('commission.override_settlement_tolerance', 1)) || 0;
  const statementDifference = round2(Number(s.statement_amount) - c.receivable);
  return { settlement: settlementRow(s), computation: await getComputation(db, c.id), statementDifference, statementMatches: Math.abs(statementDifference) <= tolerance };
}
