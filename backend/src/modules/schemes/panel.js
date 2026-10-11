/**
 * The read-only Scheme panel of Policy detail (FR-SCM-023, 030, 031; FR-SIS-023): the scheme, version, vehicle line and
 * policy year of the term ("S1-STD-2027 v1, line 1, Year 2 of 5"), the sums insured and rates used, the commission of
 * the year with the dealer and TISPH shares, the scheme premium against an adjusted renewal premium, and what only the
 * issuance knows: the application, the loan, the KYC source, the Auto Renewal Agreement and the waived documents.
 */
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { num } from '../../lib/money.js';
import { TYPE_LABELS } from './service.js';

export async function policySchemePanel(policyRef) {
  const p = await one('SELECT id, details FROM policies WHERE id = $1 OR policy_number = $1', [String(policyRef)]);
  if (!p) throw notFound('Policy not found');
  const ps = await one('SELECT ps.*, d.name AS dealer_name FROM policy_schemes ps LEFT JOIN distribution_channels d ON d.id = ps.dealer_channel_id WHERE ps.policy_id = $1', [p.id]);
  if (!ps) return null;
  const basis = p.details?.commissionBasis || null;
  const app = ps.application_id ? await one(`SELECT a.id, a.application_number, a.loan_account, a.booking_date, a.loan_term_months, a.kyc_source, a.ara_signed_on, a.ara_payment_mode,
      a.status FROM scheme_applications a WHERE a.id = $1`, [ps.application_id]) : null;
  const waived = app ? await many(`SELECT i.document, i.waiver_reason, i.waiver_decided_at, u.display_name AS approver FROM scheme_checklist_items i LEFT JOIN users u ON u.id = i.waiver_decided_by
    WHERE i.application_id = $1 AND i.status = 'waived' ORDER BY i.sort_order`, [app.id]) : [];
  return {
    policyId: p.id, schemeNo: ps.scheme_no, version: ps.version, schemeType: ps.scheme_type, schemeTypeLabel: TYPE_LABELS[ps.scheme_type], lineNo: ps.line_no, line: ps.line_label,
    policyYear: ps.policy_year, termYears: ps.term_years,
    label: `${ps.scheme_no} v${ps.version}${ps.line_no ? `, line ${ps.line_no}` : ''}, Year ${ps.policy_year} of ${ps.term_years}`,
    sumInsured: num(ps.sum_insured), year1SumInsured: num(ps.year1_sum_insured), rates: ps.rates, commissionPct: num(ps.commission_pct), dealerCommissionPct: num(ps.dealer_commission_pct),
    commission: basis?.rateBasis === 'scheme' ? basis.grossCommission : num(ps.commission_amount), dealerShare: basis?.rateBasis === 'scheme' ? basis.sharedTotal : num(ps.dealer_share),
    tisphShare: basis?.rateBasis === 'scheme' ? basis.retained : num(ps.tisph_share), dealerName: ps.dealer_name || null,
    dealerShareHeld: basis?.shares?.some((s) => s.held) ? basis.warnings?.[0] || 'The dealer share is held' : null,
    commissionSource: basis?.sourceLabel || `scheme ${ps.scheme_no} v${ps.version}`,
    schemePremium: ps.scheme_premium === null ? null : num(ps.scheme_premium), adjustedPremium: ps.adjusted_premium === null ? null : num(ps.adjusted_premium), adjustReason: ps.adjust_reason,
    application: app ? { id: app.id, number: app.application_number, loanAccount: app.loan_account, bookingDate: app.booking_date, loanTermMonths: app.loan_term_months,
      kycSource: app.kyc_source, kycSourceLabel: app.kyc_source === 'tfs' ? 'TFSPH KYC confirmation' : 'Full KYC', araSignedOn: app.ara_signed_on, araPaymentMode: app.ara_payment_mode } : null,
    waivedDocuments: waived.map((w) => ({ document: w.document, reason: w.waiver_reason, approver: w.approver, approvedAt: w.waiver_decided_at })),
  };
}
