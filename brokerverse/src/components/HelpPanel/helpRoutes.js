/**
 * Which section of the user manual (public/help/user-manual.html, built by `npm run help:build` from
 * docs/package/source/user-manual.md) explains a screen: [address prefix, heading id]. The longest matching prefix
 * wins; record numbers in the address do not matter. helpRoutes.test.js checks every id against public/help/sections.json.
 */
export const HELP_ROUTES = [
  // home and dashboards
  ["/agent/home", "home-and-open-items"],
  ["/agent/openitems", "home-and-open-items"],
  ["/agent/openitemslistdata", "my-work"],
  ["/operations/my-work", "my-work"],
  ["/executive/dashboard", "dashboard"],
  ["/claims/dashboard", "claims-dashboard"],
  ["/processing/dashboard", "processing-dashboard"],
  ["/sales/dashboard", "sales-dashboard"],
  // sales and placement
  ["/agent/leadlisting", "prospects"],
  ["/agent/createlead", "create-a-prospect"],
  ["/agent/leadedit", "view-edit-or-delete-a-prospect"],
  ["/agent/leaddetail", "view-edit-or-delete-a-prospect"],
  ["/agent/createquote", "create-a-motor-quotation"],
  ["/createquote", "create-a-motor-quotation"],
  ["/sales/quick-quote", "quick-quote-and-compare-insurers"],
  ["/sales/compare-insurers", "quick-quote-and-compare-insurers"],
  ["/agent/Quotation", "quotations"],
  ["/agent/quotelisting", "quotations"],
  ["/agent/quotedetailview", "quotations"],
  ["/agent/employee-benefit", "quotations"],
  ["/placement/broker-slips", "requests-for-quotation-broker-slips"],
  ["/placement/placement-slips", "placement-slips"],
  ["/placement/record-issued-policy", "record-issued-policy"],
  // servicing
  ["/agent/clientlisting", "clients"],
  ["/agent/clientview", "clients"],
  ["/agent/clientedit", "clients"],
  ["/agent/policy", "policies"],
  ["/agent/policydetailedview", "policies"],
  ["/agent/policy/paymentoptions", "verify-payments-and-post-official-receipts"],
  ["/agent/endorsement", "raise-an-endorsement-request"],
  ["/agent/uploadendorsement", "raise-an-endorsement-request"],
  ["/agent/endorsementdetailedview", "raise-an-endorsement-request"],
  ["/agent/claim", "the-claims-list"],
  ["/agent/claimrequest", "register-a-claim"],
  ["/agent/claimrequest/adjustersubmission", "adjuster-report"],
  ["/agent/claimrequest/settlementapproval", "approve-a-settlement-checker"],
  ["/agent/claimrequest/settlementdetails", "assessment-and-settlement-maker"],
  ["/agent/claimdetailedview", "claim-details-documents-and-audit-trail"],
  ["/agent/expired-policies", "operations-client-servicing-renewals"],
  ["/agent/renewal", "renew-a-policy"],
  ["/agent/renewal-batch", "renewal-batch-lapse-management-and-the-analytics"],
  ["/renewal/queue", "renewal-queue-and-at-risk-policies"],
  ["/renewal/at-risk", "renewal-queue-and-at-risk-policies"],
  ["/renewal/negotiations", "negotiations"],
  ["/renewal", "renewal-batch-lapse-management-and-the-analytics"],
  ["/agent/payments", "payments"],
  // accounts
  ["/accounts/receipts", "verify-payments-and-post-official-receipts"],
  ["/agent/collections", "collections"],
  ["/accounts/credit-control", "credit-control"],
  ["/accounts/paymentvoucher", "disbursement-payment-vouchers-and-cheques"],
  ["/finance/remittance", "remittance-to-insurers"],
  ["/finance/remittance/directbill", "direct-bill-commission-debit-notes"],
  ["/accounts/journalvoucher", "journal-vouchers"],
  ["/accounts/correctionsjv", "journal-vouchers"],
  ["/accounts/reversaljv", "journal-vouchers"],
  ["/accounts/open-entry-matching", "open-entry-matching-and-write-offs"],
  ["/accounts/open-entry-unmatching", "open-entry-matching-and-write-offs"],
  ["/agent/accounting", "accounting-query-and-all-clients-accounting"],
  ["/accounts/pettycash", "petty-cash"],
  ["/accounts/bank-reconciliation", "bank-reconciliation"],
  ["/accounts/insurer-reconciliation", "insurer-statement-reconciliation"],
  ["/accounts/tax", "tax-bir-forms-and-returns"],
  ["/accounts/period-end", "period-end"],
  ["/accounts/period-end/year-end", "year-end-close-preparer"],
  ["/accounts/period-end/recurring", "recurring-journals"],
  ["/incentive", "incentives"],
  ["/commission", "commission-to-agents-and-referrers"],
  ["/reinsurance", "processing-team-reinsurance"],
  ["/reports", "reports-dashboards-schedules-and-notifications-reports"],
  // master
  ["/master/generals/organization", "company-branches-and-the-letterhead"],
  ["/master/generals/insurancemanagement", "masters-that-work-the-same-way"],
  ["/master/generals/insurancemanagement/insurancecompany", "insurance-companies"],
  ["/master/generals/location", "masters-that-work-the-same-way"],
  ["/master/generals/employeemanagement", "masters-that-work-the-same-way"],
  ["/master/generals/usermanagement/user", "users"],
  ["/master/generals/usermanagement/role", "roles-and-role-permissions"],
  ["/master/generals/usermanagement/role-permissions", "roles-and-role-permissions"],
  ["/master/generals/usermanagement/access-matrix", "user-access-matrix"],
  ["/master/generals/usermanagement/authority-matrix", "authority-matrix"],
  ["/master/generals/usermanagement/delegations", "delegations"],
  ["/master/generals/usermanagement/segregation-of-duties", "segregation-of-duties"],
  ["/master/generals/usermanagement/access-reviews", "access-reviews"],
  ["/master/finance", "finance"],
  ["/master/finance/account-determination", "posting-configuration-configuration-approvals-posting-rules-account-determination"],
  ["/master/finance/posting-rules", "posting-configuration-configuration-approvals-posting-rules-account-determination"],
  ["/master/finance/configuration-approvals", "posting-configuration-configuration-approvals-posting-rules-account-determination"],
  ["/master/finance/commission-rate-matrix", "commission-rate-matrix"],
  ["/master/incentive", "reinsurance-treaties-and-incentive-programmes"],
  ["/master/reinsurance", "reinsurance-treaties-and-incentive-programmes"],
  ["/master/configuration/system-settings", "configuration-screens"],
  ["/master/configuration/settings", "configuration"],
  ["/master/configuration/document-numbering", "document-numbering"],
  ["/master/configuration/schedules", "system-administrator-schedules"],
  ["/master/configuration/audit-trail", "audit-trail"],
  ["/master/configuration/email-outbox", "e-mail-outbox"],
  ["/master/configuration/integrations", "integrations"],
  ["/master/configuration/message-templates", "sms-and-message-templates"],
  ["/master/configuration/insurer-integration", "insurer-integration"],
  ["/operations/ctpl-authentication", "ctpl-authentication"],
  ["/master/finance/bank-file-layouts", "bank-file-layouts-and-payee-bank-accounts"],
  ["/accounts/bank-payment-files", "bank-payment-files"],
  ["/master/data-privacy", "data-privacy"],
  // AML/CFT (Compliance Officer chapter of the user manual)
  ["/agent/client-onboarding", "onboard-a-client-before-the-first-policy"],
  ["/compliance/aml/dashboard", "aml-dashboard"],
  ["/compliance/aml/clients", "client-due-diligence-and-risk-rating"],
  ["/compliance/aml/edd", "enhanced-due-diligence-edd-reviews"],
  ["/compliance/aml/kyc-refresh", "kyc-refresh"],
  ["/compliance/aml/hits", "screening-hits"],
  ["/compliance/aml/lists", "screening-lists-and-the-screening-provider"],
  ["/compliance/aml/alerts", "transaction-alerts"],
  ["/compliance/aml/cases", "aml-cases"],
  ["/compliance/aml/reports", "amlc-reports"],
  ["/compliance/aml/settings", "aml-settings"],
  ["/master/go-live-data-load", "go-live-data-load"],
  ["/product-configurator", "module-reference-product-configurator"],
  // the user's own pages
  ["/account/profile", "my-profile"],
  ["/agent/notification", "notifications"],
];

/** Section shown for a screen the table does not list: how the screen is laid out. */
export const DEFAULT_SECTION = "the-screen-layout";

const strip = (p) => String(p || "").replace(/\/\d+(?=\/|$)/g, "");

/** The manual section of an address ({ id, matched }); `matched` is false when the default section is returned. */
export const helpSectionFor = (pathname) => {
  const raw = String(pathname || "/");
  const path = strip(raw);
  let best = null;
  for (const [prefix, id] of HELP_ROUTES) {
    const hit = raw.startsWith(prefix) || path.startsWith(prefix);
    if (hit && (!best || prefix.length > best[0].length)) best = [prefix, id];
  }
  if (raw === "/" && !best) return { id: "dashboard", matched: true };
  return best ? { id: best[1], matched: true } : { id: DEFAULT_SECTION, matched: false };
};
