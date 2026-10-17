/**
 * Report centre categories (Reports > All Reports): each catalogue report code belongs to one category of the left
 * rail. A code not listed here falls under "Other", so a new report appears without a change to this file.
 */
export const CATEGORIES = [
  { key: "production", label: "Production & Sales" },
  { key: "claims", label: "Claims" },
  { key: "renewals", label: "Renewals" },
  { key: "remittance", label: "Remittance & Insurers" },
  { key: "commission", label: "Commission & Incentive" },
  { key: "collections", label: "Collections & Receivables" },
  { key: "accounting", label: "Accounting & Financial Statements" },
  { key: "tax", label: "Tax" },
  { key: "coinsurance", label: "Co-insurance" },
  { key: "other", label: "Other" },
];

const BY_CATEGORY = {
  production: [
    "production-register", "production-by-line", "premium-by-product", "dealer-production", "new-vs-renewal", "agent-pipeline",
    "lead-conversion-funnel", "placement-pipeline", "market-response", "tisph-agent-conversion", "tisph-premium-payment-status",
    "apr-operation", "tisph-invoice-tracker",
  ],
  claims: ["claims-ageing", "claims-position"],
  renewals: ["renewal-notice-listing", "renewal-retention", "lock-in-expiry"],
  remittance: [
    "remittance-summary", "aged-payables-insurers", "tisph-net-remittance-fully-paid", "tisph-net-remittance-partially-paid",
    "tisph-soa-per-partner", "tisph-reconciliation-schedule", "disbursement-register",
  ],
  commission: ["commission-statement", "direct-bill-commission", "incentive-results", "tisph-commission-sharing", "tisph-sales-target-variance"],
  collections: [
    "collections-ageing", "collections-summary", "premium-receivable-soa", "receipts-register", "non-payment", "tisph-insufficient-payments",
    "tisph-overpayments", "tisph-payment-summary", "tisph-pdc-acknowledgements", "tisph-pdc-cancelled", "tisph-pdc-encoded",
    "tisph-pdc-history", "tisph-pdc-maturing", "tisph-pdc-maturing-matrix",
  ],
  accounting: [
    "balance-sheet", "income-statement", "trial-balance", "trial-balance-ocm", "gl-detail", "journal-register", "bank-book",
    "bank-deposits-in-transit", "bank-outstanding-cheques", "bank-reconciliation-statement", "bank-unmatched-lines",
    "month-end-close-status", "tisph-daily-gl-balance", "tisph-daily-reversals", "tisph-fs-by-version",
  ],
  tax: ["bir-qap", "bir-sawt", "bir-slsp-purchases", "bir-slsp-sales", "bir-vat-summary"],
  coinsurance: ["coinsurance-register", "due-to-insurers-by-coinsurer"],
};

export const REPORT_CATEGORY = Object.fromEntries(Object.entries(BY_CATEGORY).flatMap(([key, codes]) => codes.map((c) => [c, key])));

/** Category key of a report code; "other" when it is not mapped. */
export const categoryOf = (code) => REPORT_CATEGORY[code] || "other";
