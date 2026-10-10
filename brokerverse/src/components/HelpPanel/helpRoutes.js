/**
 * Which section of the user manual (public/help/user-manual.html, built by `npm run help:build` for the edition of
 * help.config.json) explains a screen: [address prefix, heading id, ...other ids]. The longest matching prefix wins;
 * record numbers in the address do not matter. Where the editions name the section differently, the TISPH id comes
 * first and the product manual's id after it: the first id the published manual has is used. helpRoutes.test.js checks
 * the routes against public/help/sections.json.
 */
export const HELP_ROUTES = [
  // home and dashboards
  ["/my-work", "my-work"],
  ["/agent/home", "my-work"],
  ["/agent/openitems", "my-work"],
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
  ["/sales/quick-quote", "quick-quote"],
  ["/agent/Quotation", "quotations"],
  ["/agent/quotelisting", "quotations"],
  ["/agent/quotedetailview", "quotations"],
  ["/agent/employee-benefit", "quotations"],
  ["/placement/broker-slips", "requests-for-quotation-broker-slips"],
  ["/placement/placement-slips", "placement-slips"],
  ["/placement/record-epolicy", "record-e-policy"],
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
  ["/agent/claimrequest/documents", "claim-documents"],
  ["/agent/claimrequest/adjustersubmission", "adjuster-report"],
  ["/agent/claimrequest/settlementapproval", "approve-a-settlement-checker"],
  ["/agent/claimrequest/settlementdetails", "assessment-and-settlement-maker"],
  ["/agent/claimdetailedview", "claim-details-documents-and-audit-trail"],
  ["/agent/expired-policies", "renewal-policy", "operations-client-servicing-renewals"],
  ["/agent/renewal", "renew-a-policy"],
  ["/agent/renewal-batch", "renewal-batch-lapse-management-and-the-analytics"],
  ["/renewal/queue", "renewal-queue-and-at-risk-policies"],
  ["/renewal/at-risk", "renewal-queue-and-at-risk-policies"],
  ["/renewal/lock-in-accounts", "lock-in-accounts"],
  ["/renewal/negotiations", "negotiations"],
  ["/renewal", "renewal-batch-lapse-management-and-the-analytics"],
  ["/agent/payments", "payments"],
  // accounts
  ["/accounts/receipts", "verify-payments-and-post-official-receipts"],
  ["/accounts/unapplied-collections", "unapplied-collections"],
  ["/agent/collections", "collections"],
  ["/accounts/credit-control", "credit-control"],
  // operations and accounting: cover notes, cancellation, claims documents and repairs, cheques, claims cash, payables, assets
  ["/operations/cover-notes", "cover-notes-binders"],
  ["/operations/policy-cancellation", "cancel-a-policy-computed-return-premium"],
  ["/operations/claim-documents", "claims-awaiting-documents"],
  ["/operations/motor-claim-repairs", "motor-claim-repairs-and-letters-of-authority"],
  ["/accounts/post-dated-cheques", "post-dated-cheques"],
  ["/accounts/claims-settlements", "claims-settlements-paid-through-the-broker"],
  ["/accounts/payables", "accounts-payable"],
  ["/accounts/fixed-assets", "fixed-assets-and-depreciation"],
  // sales activities, the BIR 2307 of suppliers and asset disposal
  ["/sales/activities", "sales-activities"],
  ["/master/organization/sales-activity", "sales-activities"],
  ["/accounts/payables/2307", "bir-form-2307-for-suppliers"],
  ["/accounts/fixed-assets/disposals", "asset-disposal"],
  ["/master/insurance/", "operational-masters"],
  ["/master/finance/fs-versions", "financial-statement-versions"],
  ["/master/finance/asset-classes", "operational-masters"],
  ["/master/finance/cost-centres", "operational-masters"],
  ["/accounts/paymentvoucher", "disbursement-payment-vouchers-and-cheques"],
  ["/finance/remittance", "remittance-to-insurers"],
  ["/finance/remittance/remittances", "remittances-worklist", "remittance-to-insurers"],
  ["/finance/remittance/approvals", "remittance-approvals", "remittance-to-insurers"],
  ["/finance/remittance/payments", "insurer-payments", "remittance-to-insurers"],
  ["/finance/remittance/exceptions", "remittance-exceptions", "remittance-to-insurers"],
  ["/finance/remittance/setup", "remittance-schedules", "remittance-to-insurers"],
  ["/finance/remittance/settlement", "remittance-settlement", "remittance-to-insurers"],
  ["/finance/remittance/directbill", "direct-bill-commission-debit-notes"],
  ["/finance/remittance/billing", "direct-bill-commission-debit-notes"],
  ["/finance/remittance/reconciliation", "insurer-statement-reconciliation"],
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
  ["/accounts/tax/withholding-returns", "withholding-returns-0619-e-1601-eq-and-their-filing-records"],
  ["/accounts/tax/alphalist-1604e", "annual-information-return-1604-e-and-alphalist-of-payees"],
  ["/accounts/tax/percentage-tax", "percentage-tax-2551q-non-vat-broker-or-agent"],
  ["/accounts/tax/dat-files", "bir-dat-files"],
  ["/accounts/tax/sales-invoices", "sales-invoices-eopt-act"],
  ["/accounts/tax/eis", "e-invoicing-eis"],
  ["/accounts/tax/cas", "cas-books-and-documents"],
  ["/commission/insurer-overrides", "overriding-profit-and-contingent-commission-from-insurers"],
  ["/master/finance/bank", "masters-that-work-the-same-way"],
  ["/master/finance/taxation", "finance-masters-kept-by-accounting"],
  ["/master/finance/close-checklist", "finance-masters-kept-by-accounting"],
  ["/master/finance/bank-statement-formats", "finance-masters-kept-by-accounting"],
  ["/master/finance/bank-transaction-types", "finance-masters-kept-by-accounting"],
  ["/master/finance/insurer-statement-formats", "finance-masters-kept-by-accounting"],
  ["/master/finance/accounting-flow", "posting-configuration-configuration-approvals-posting-rules-account-determination"],
  ["/master/insurance/claim-document-checklist", "claim-documents"],
  ["/master/insurance/repair-shops", "motor-claim-repairs-and-letters-of-authority"],
  ["/master/insurance/short-period-rates", "cancel-a-policy-computed-return-premium"],
  ["/master/insurance/cancellation-reasons", "cancel-a-policy-computed-return-premium"],
  ["/master/insurance/lead-sources", "lead-sources-and-reason-codes"],
  ["/master/insurance/reason-codes", "lead-sources-and-reason-codes"],
  ["/accounts/period-end", "period-end"],
  ["/accounts/period-end/year-end", "year-end-close-preparer"],
  ["/accounts/period-end/recurring", "recurring-journals"],
  ["/incentive", "incentives"],
  ["/commission", "commission-to-agents-and-referrers"],
  ["/reports", "reports-catalogue", "reports-dashboards-schedules-and-notifications-reports"],
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
  ["/master/incentive", "incentive-programmes", "incentives"],
  ["/master/configuration/email-layout", "e-mail-layout"],
  ["/master/configuration/documents-layout", "documents-and-reports-layout"],
  ["/master/configuration/document-signatures", "document-signatures"],
  ["/master/configuration/settings", "configuration"],
  ["/master/configuration/document-numbering", "document-numbering"],
  ["/master/configuration/schedules", "schedules", "system-administrator-schedules"],
  ["/master/configuration/audit-trail", "audit-trail"],
  ["/master/configuration/email-outbox", "e-mail-outbox"],
  ["/master/configuration/integrations", "integrations"],
  ["/master/configuration/message-templates", "sms-and-message-templates"],
  ["/master/configuration/insurer-integration", "insurer-integration"],
  ["/operations/ctpl-authentication", "ctpl-authentication"],
  ["/master/finance/bank-file-layouts", "bank-file-layouts-and-payee-bank-accounts"],
  ["/accounts/bank-payment-files", "bank-payment-files"],
  ["/accounts/sap-gl-export", "sap-gl-export"],
  // client onboarding
  ["/agent/client-onboarding", "onboard-a-client-before-the-first-policy"],
  ["/product-configurator", "product-configurator-dashboard", "module-reference-product-configurator"],
  ["/product-configurator/templates", "product-templates", "module-reference-product-configurator"],
  ["/product-configurator/coverages", "coverage-builder", "module-reference-product-configurator"],
  ["/product-configurator/rating", "rating-engine", "module-reference-product-configurator"],
  ["/product-configurator/underwriting", "acceptance-rules", "module-reference-product-configurator"],
  ["/product-configurator/documents", "document-manager", "module-reference-product-configurator"],
  ["/product-configurator/market-mapping", "market-mapping", "module-reference-product-configurator"],
  ["/product-configurator/risk-mapping", "risk-mapping", "module-reference-product-configurator"],
  ["/product-configurator/analytics", "product-analytics", "module-reference-product-configurator"],
  // distribution, programmes and products
  ["/sales/lead-assignment", "lead-assignment"],
  ["/master/insurance/channels", "distribution-channels"],
  ["/sales/dealer-programmes", "dealer-programmes"],
  ["/operations/fleet-schedules", "fleet-schedules"],
  ["/operations/open-covers", "marine-open-covers"],
  ["/sales/comparison-reports", "comparison-reports"],
  ["/sales/campaigns", "campaigns"],
  ["/reports/run/dealer-production", "distribution-channels"],
  ["/reports/builder", "report-builder"],
  // the user's own pages
  ["/account/profile", "my-profile"],
  ["/agent/notification", "notifications"],
];

/** Section shown for a screen the table does not list: how the screen is laid out. */
export const DEFAULT_SECTION = "the-screen-layout";

const strip = (p) => String(p || "").replace(/\/\d+(?=\/|$)/g, "");

/**
 * The manual section of an address ({ id, matched }); `matched` is false when the default section is returned. With
 * `known` (the heading ids of the published manual), the first id of the route that the manual has is taken.
 */
export const helpSectionFor = (pathname, known = null) => {
  const raw = String(pathname || "/");
  const path = strip(raw);
  let best = null;
  for (const route of HELP_ROUTES) {
    const hit = raw.startsWith(route[0]) || path.startsWith(route[0]);
    if (hit && (!best || route[0].length > best[0].length)) best = route;
  }
  if (raw === "/" && !best) return { id: "dashboard", matched: true };
  if (!best) return { id: DEFAULT_SECTION, matched: false };
  const ids = best.slice(1);
  return { id: (known && ids.find((id) => known.has(id))) || ids[0], matched: true };
};
