import { quoteStatusOut } from '../documents/statuses.js';

/** Fields that describe workflow / identity and must never be stored inside the quotation document. */
export const RESERVED = ['id', 'quotationId', 'quotationNumber', 'generatedQuotationId', 'quotationStatus', 'status', 'createdAt', 'updatedAt',
  'createdBy', 'updatedBy', 'lead', 'premiumBreakdown', 'policyId', 'approvalSentTo', 'approvalSentAt', 'customerAcceptedAt',
  'submittedToInsurerAt', 'approvedBy', 'approvedAt', 'success', 'message', 'data', 'insured',
  // placement journey links and co-insurance rows are served from their own tables, never stored in the document
  'participants', 'brokerSlipId', 'brokerSlipNumber', 'placementId', 'placementNumber', 'placementStatus', 'journey', 'offers'];

export const stripReserved = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => !RESERVED.includes(k)));

const leadSummary = (l) => (l && l.id ? {
  id: l.id, leadId: l.id, generatedLeadId: l.lead_number, firstName: l.first_name, lastName: l.last_name, preferredName: l.preferred_name,
  companyName: l.company_name, emailId: l.email, contactNumber: l.phone, leadCategory: l.lead_category, city: l.city, province: l.state,
  country: l.country, houseNo: l.house_no, barangay: l.barangay, zipCode: l.postal_code,
} : null);

/**
 * The party insured by the quotation: its prospect (lead), else its client (quotations prepared for an existing client
 * or renewals). { type: 'prospect' | 'client', id, number, name, emailId, contactNumber }.
 */
const insuredOf = (r, lead) => {
  const l = r.lead_row;
  if (l && l.id) {
    return { type: 'prospect', id: l.id, number: l.lead_number, name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.company_name || '',
      emailId: l.email || '', contactNumber: l.phone || '' };
  }
  const c = r.client_row;
  if (c && c.id) return { type: 'client', id: c.id, number: c.code, name: c.name || '', emailId: c.email || '', contactNumber: c.phone || '' };
  if (lead) return { type: 'prospect', id: lead.id || null, number: lead.generatedLeadId || null, name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.companyName || '', emailId: lead.emailId || '', contactNumber: lead.contactNumber || '' };
  return null;
};

/** Row (quotes.* plus optional lead_row / client_row / insurer_name / created_by_name) -> quotation object read by the screens. */
export function toQuote(r) {
  if (!r) return null;
  const doc = r.doc || {};
  return {
    ...doc,
    id: r.id, quotationId: r.id, quotationNumber: r.quote_number, generatedQuotationId: r.quote_number,
    quotationStatus: quoteStatusOut(r.status), status: quoteStatusOut(r.status),
    leadRefId: r.lead_id, leadId: r.lead_id, clientId: r.client_id, policyId: r.policy_id, brokerSlipId: r.broker_slip_id || null, channelId: r.channel_id ?? doc.channelId ?? null,
    productType: r.product_type || doc.productType, lob: r.lob, insuranceCompanyId: r.insurance_company_id,
    insuranceCompanyName: r.insurer_name || doc.insuranceCompanyName || doc.participantDetails?.[0]?.insuranceCompanyName,
    netPremium: Number(r.premium_base), valueAddedTax: Number(r.vat), documentaryStampTax: Number(r.dst), localGovernmentTax: Number(r.lgt),
    fireServiceTax: Number(r.fst), accountPremiumOthers: Number(r.others), discount: Number(r.discount), NCD: Number(r.ncd),
    taxRates: doc.premiumBreakdown?.taxRates || null, isRenewal: Boolean(doc.renewal?.policyId), renewedFromPolicyId: doc.renewal?.policyId || null,
    grossPremium: Number(r.premium_total), totalSumInsured: Number(r.sum_insured), commissionRate: r.commission_rate == null ? null : Number(r.commission_rate),
    commissionAmount: Number(r.commission_amount), currency: r.currency, validUntil: r.valid_until,
    customerAccepted: r.customer_accepted_at ? 'Yes' : (doc.customerAccepted ?? null),
    approvalSentTo: r.approval_sent_to, approvalSentAt: r.approval_sent_at, customerAcceptedAt: r.customer_accepted_at,
    submittedToInsurerAt: r.submitted_to_insurer_at, approvedBy: r.approved_by, approvedAt: r.approved_at,
    lead: leadSummary(r.lead_row) || doc.lead || null,
    insured: insuredOf(r, doc.lead),
    createdBy: r.created_by_name || r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const QUOTE_SELECT = `SELECT q.*, row_to_json(l.*) AS lead_row, ic.name AS insurer_name,
  (SELECT u.display_name FROM users u WHERE u.id = q.created_by) AS created_by_name,
  (SELECT json_build_object('id', qc.id, 'code', qc.client_code, 'name', qc.display_name, 'email', qc.email, 'phone', qc.phone)
     FROM clients qc WHERE qc.id = q.client_id) AS client_row
  FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id LEFT JOIN insurance_companies ic ON ic.id = q.insurance_company_id`;
