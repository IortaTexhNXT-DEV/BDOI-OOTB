/**
 * How the Configuration screen presents the settings stored in app_settings: the business areas they are grouped
 * under, the name of each group, and per setting the kind of editor, the unit, the choices offered and whether it is
 * an advanced (technical) setting. The settings themselves, their labels and values come from the API; a setting this
 * file does not know is still shown, in its group, with an editor chosen from its type.
 */

/** Business areas, in menu order. `groups` are app_settings groups; `links` are the screens that own related data. */
export const AREAS = [
  {
    id: "company",
    title: "Company & Branding",
    icon: "pi pi-building",
    summary: "Time zone, date format and the look of printed documents. The application name, logo and colours are set in System Settings; the company's legal identity in the Company master.",
    groups: ["general", "branding", "currency", "documents", "system", "golive"],
    links: [
      { label: "System Settings (application name, logo, colours, language, currency)", path: "/master/configuration/system-settings" },
      { label: "Go-Live Data Load (configuration and migration workbooks)", path: "/master/go-live-data-load" },
      { label: "Company master (legal name, TIN, registered address, print logo)", path: "/master/generals/organization/companymaster" },
      { label: "Branch master", path: "/master/generals/organization/branchmaster" },
    ],
  },
  {
    id: "sales",
    title: "Sales, Quotations & Placement",
    icon: "pi pi-briefcase",
    summary: "Prospects, quotation validity and approval, motor quote options, requests for quotation, placement steps and packaged products.",
    groups: ["leads", "quotations", "quote", "broker_slips", "placement", "product", "packages", "premium", "motor"],
    links: [
      { label: "Product master", path: "/master/generals/insurancemanagement/productmaster" },
      { label: "Insurer rate tables", path: "/master/finance/insurer-rate-tables" },
      { label: "Package bundles", path: "/master/finance/package-bundles" },
    ],
  },
  {
    id: "policy",
    title: "Policies, Endorsements & Renewals",
    icon: "pi pi-file",
    summary: "Policy term and KYC documents, endorsement types, renewal notices, loyalty discounts and claims loading.",
    groups: ["policies", "policy", "endorsements", "renewals"],
    links: [{ label: "Document numbering", path: "/master/configuration/document-numbering" }],
  },
  {
    id: "claims",
    title: "Claims",
    icon: "pi pi-shield",
    summary: "Service level, ageing, preliminary loss advice and the claim documents printed for insurers.",
    groups: ["claims"],
    links: [],
  },
  {
    id: "collections",
    title: "Billing, Collections & Credit",
    icon: "pi pi-wallet",
    summary: "Credit days, reminders, overdue levels, instalment plans, premium warranty and online payment links.",
    groups: ["receivables", "collections", "credit", "payments", "receipts"],
    links: [{ label: "Payment gateways", path: "/master/finance/payment-gateways" }],
  },
  {
    id: "remittance",
    title: "Remittance & Reconciliation",
    icon: "pi pi-sync",
    summary: "Remittance to insurers, direct billing of commission, bank and insurer statement reconciliation, reinsurance.",
    groups: ["remittance", "direct_bill", "disbursements", "bank_reconciliation", "insurer_reconciliation", "reinsurance"],
    links: [
      { label: "Bank statement formats", path: "/master/finance/bank-statement-formats" },
      { label: "Insurer statement formats", path: "/master/finance/insurer-statement-formats" },
    ],
  },
  {
    id: "commission",
    title: "Commission & Incentives",
    icon: "pi pi-percentage",
    summary: "Default brokerage and sub-agent rates, withholding tax on commission, and incentive programmes.",
    groups: ["commission", "incentive"],
    links: [{ label: "Commission rate matrix", path: "/master/finance/commission-rate-matrix" }],
  },
  {
    id: "accounting",
    title: "Accounting & Tax",
    icon: "pi pi-calculator",
    summary: "Fiscal year, posting, GL accounts, premium taxes (VAT, DST, FST, LGT), BIR forms and month-end.",
    groups: ["accounting", "finance", "tax", "bir", "period_end"],
    links: [
      { label: "Account determination", path: "/master/finance/account-determination" },
      { label: "Posting rules", path: "/master/finance/posting-rules" },
      { label: "Premium taxes & LGU rates", path: "/master/finance/premium-taxes" },
      { label: "Accounting flow", path: "/master/finance/accounting-flow" },
    ],
  },
  {
    id: "notifications",
    title: "Notifications & E-mail",
    icon: "pi pi-envelope",
    summary: "Which notices are sent, the sender address, the wording of every e-mail sent to clients and insurers, and the reminders of My Work.",
    groups: ["notification", "email", "myWork"],
    links: [{ label: "E-mail outbox", path: "/master/configuration/email-outbox" }],
  },
  {
    id: "security",
    title: "Security & Access",
    icon: "pi pi-lock",
    summary: "Passwords, sign-in protection, two-factor, sessions, approval authority and dormant accounts.",
    groups: ["security", "access", "limits"],
    links: [
      { label: "Authority matrix", path: "/master/generals/usermanagement/authority-matrix" },
      { label: "User access matrix", path: "/master/generals/usermanagement/access-matrix" },
    ],
  },
  {
    id: "reports",
    title: "Reports & Dashboards",
    icon: "pi pi-chart-bar",
    summary: "Report format and limits, scheduled report e-mails and the targets shown on the executive dashboard.",
    groups: ["reports", "dashboard"],
    links: [{ label: "Schedules", path: "/master/configuration/schedules" }],
  },
  {
    id: "maintenance",
    title: "Data Retention, Privacy & Uploads",
    icon: "pi pi-database",
    summary: "How long logs and messages are kept, the data privacy notice version, request due days and record retention, the size limits of uploaded files and the go-live lock.",
    groups: ["housekeeping", "privacy", "uploads", "golive"],
    links: [
      { label: "Audit trail", path: "/master/configuration/audit-trail" },
      { label: "Data subject requests", path: "/master/data-privacy/requests" },
    ],
  },
];

/** Groups edited on their own screens, not here. */
export const HIDDEN_GROUPS = ["numbering"];

export const GROUP_TITLES = {
  general: "General", branding: "Branding", currency: "Currency", documents: "Printed documents", system: "System",
  leads: "Prospects", quotations: "Quotations", quote: "Motor quotations", broker_slips: "Requests for quotation", placement: "Placement",
  product: "Products", packages: "Packaged products", premium: "Premium", motor: "Motor pricing",
  policies: "Policies", policy: "Policy issuance and KYC", endorsements: "Endorsements", renewals: "Renewals",
  claims: "Claims", receivables: "Billing", collections: "Collections", credit: "Credit control", payments: "Online payments",
  receipts: "Receipts", remittance: "Remittance to insurers", direct_bill: "Direct bill", disbursements: "Disbursements",
  bank_reconciliation: "Bank reconciliation", insurer_reconciliation: "Insurer statement reconciliation", reinsurance: "Reinsurance",
  commission: "Commission", incentive: "Incentives", accounting: "Accounting", finance: "Finance", tax: "Taxes",
  bir: "BIR forms", period_end: "Month-end close", notification: "Notifications", email: "E-mail templates",
  security: "Security", access: "Approval authority and accounts", limits: "Limits and validity",
  reports: "Reports", dashboard: "Dashboard", myWork: "My Work", housekeeping: "Data retention", privacy: "Data privacy", uploads: "Uploads", golive: "Go-live",
};

export const groupTitle = (group) =>
  GROUP_TITLES[group] || String(group || "Other").replace(/[_.-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The area a group belongs to ("other" for groups no area lists). */
export const areaOfGroup = (group) => AREAS.find((a) => a.groups.includes(group))?.id || "other";

/** Choices of settings stored as text with a fixed set of values. */
export const CHOICES = {
  "access.authority_without_limit": [["allow", "Allow the approval"], ["refuse", "Refuse the approval"]],
  "direct_bill.client_payment_required": [["none", "Not required"], ["any", "Any payment recorded"], ["full", "Paid in full"]],
  "direct_bill.default_billing_mode": [["broker", "Broker collects the premium"], ["direct", "Client pays the insurer (direct bill)"]],
  "reports.default_format": [["xlsx", "Excel"], ["pdf", "PDF"], ["csv", "CSV"]],
  "reports.pdf_page_size": [["A4", "A4"], ["Letter", "Letter"], ["Legal", "Legal"]],
  "general.date_format": [["DD/MM/YYYY", "31/12/2026"], ["MM/DD/YYYY", "12/31/2026"], ["YYYY-MM-DD", "2026-12-31"], ["DD MMM YYYY", "31 Dec 2026"]],
  "general.default_language": [["en", "English"]],
  "general.timezone": [["Asia/Manila", "Philippines (Asia/Manila)"], ["Asia/Singapore", "Singapore"], ["UTC", "UTC"]],
  "currency.default": [["PHP", "Philippine Peso (PHP)"], ["USD", "US Dollar (USD)"]],
  "claims.default_priority": [["Low", "Low"], ["Medium", "Medium"], ["High", "High"], ["Critical", "Critical"]],
  "receipts.default_payment_mode": [["cash", "Cash"], ["check", "Cheque"], ["bank-transfer", "Bank transfer"], ["online", "Online"], ["card", "Card"]],
  "disbursements.default_payment_mode": [["check", "Cheque"], ["bank-transfer", "Bank transfer"], ["cash", "Cash"]],
  "commission.initial_status": [["Accrued", "Accrued"], ["Pending", "Pending"]],
  "reinsurance.min_security_rating": [["AAA", "AAA"], ["AA", "AA"], ["A+", "A+"], ["A", "A"], ["A-", "A-"], ["BBB", "BBB"]],
};

/**
 * Settings kept on their own screens: shown read-only with a link "Managed in <screen>". The API names the owner of
 * most of them (GET /settings managedBy, back end lib/settingOwners.js: System Settings, Company master, Premium
 * Taxes & LGU Rates) and refuses a change sent from here; the GL account settings below are changed with a second
 * person's approval on Account determination.
 */
export const MANAGED_ELSEWHERE = [
  { test: (k) => k.startsWith("accounting.account.") || ["accounting.cash_account_by_payment_mode", "accounting.payable_account_by_payee"].includes(k),
    label: "Account determination", path: "/master/finance/account-determination" },
  { test: (k) => k.startsWith("tax.commission_"), label: "Account determination", path: "/master/finance/account-determination" },
  { test: (k) => k.startsWith("tax.charge_engine."), label: "Premium taxes & LGU rates", path: "/master/finance/premium-taxes" },
];
/** The screen a setting is managed in ({ label, path }), from the API's managedBy or the list above; null when edited here. */
export const managedElsewhere = (key, managedBy = null) => {
  if (managedBy?.path) return { label: managedBy.screen === "Master > System Settings" ? "System Settings" : managedBy.screen, path: managedBy.path };
  return MANAGED_ELSEWHERE.find((m) => m.test(key)) || null;
};

/** Workflow and integration settings for the system administrator: shown under "Advanced". */
const ADVANCED_KEYS = /(statuses|transitions|aliases|status_labels|journey|lob_keywords|metric_map|endorsements\.types|component_kinds|upload_document_names|payments\.payment_modes|mobile_pattern|frontend_url|pricing_template_code|logo_presets|general\.languages|claims\.documents|default_logo_path|payment_gateway_url|kyc_required_fields|currency\.allowed|limits\.password_min_length)/;
const ADVANCED_GROUPS = ["housekeeping", "system"];

const isPlainList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number");
const isFlatMap = (v) => v && typeof v === "object" && !Array.isArray(v)
  && Object.values(v).every((x) => x === null || ["string", "number", "boolean"].includes(typeof x));
const isRecordList = (v) => Array.isArray(v) && v.length > 0
  && v.every((x) => x && typeof x === "object" && !Array.isArray(x) && Object.values(x).every((y) => y === null || ["string", "number", "boolean"].includes(typeof y)));
const isHtml = (v) => typeof v === "string" && /<(p|div|br|b|strong|em|i|u|table|tr|td|ul|ol|li|a|span|h[1-6])\b[^>]*>/i.test(v);

/** A fraction shown as a percent: rates and caps stored as 0.12 for 12%. */
const isFractionKey = (key, v) => /(_rate|_cap|default_rate)$/.test(key) && !/percent/.test(key) && typeof v === "number" && v >= 0 && v <= 1;

/** Unit of a number setting from its key. */
const unitOf = (key) => {
  if (/_bytes$/.test(key)) return { suffix: "MB", scale: 1048576 };
  if (/_days$|_days_before$/.test(key) || /reminder_repeat_days|due_days/.test(key)) return { suffix: "days" };
  if (/_hours$/.test(key)) return { suffix: "hours" };
  if (/_minutes$/.test(key)) return { suffix: "minutes" };
  if (/_months$/.test(key) || key === "product.analytics_months") return { suffix: "months" };
  if (/_years$/.test(key)) return { suffix: "years" };
  if (/_percent$/.test(key)) return { suffix: "%" };
  if (/tolerance$|high_sum_insured|amount$/.test(key)) return { prefix: "PHP" };
  if (key === "accounting.fiscal_year_start_month") return { suffix: "(1 = January)" };
  return {};
};

/**
 * Presentation of one setting: { editor, unit, percent, choices, advanced, managed, html }.
 * editor: switch | number | select | text | textarea | html | color | image | chips | keyvalue | records | template | json
 */
export function presentationOf(r) {
  const key = r.key;
  const v = r.value;
  const managed = managedElsewhere(key, r.managedBy);
  const advanced = ADVANCED_GROUPS.includes(r.group) || ADVANCED_KEYS.test(key);
  if (r.type === "boolean") return { editor: "switch", advanced, managed };
  if (r.type === "number") return { editor: "number", unit: unitOf(key), percent: isFractionKey(key, v), advanced, managed };
  if (r.type === "color") return { editor: "color", advanced, managed };
  if (r.type === "image") return { editor: "image", advanced, managed };
  if (r.type === "json") {
    if (key.startsWith("email.template.") && v && typeof v === "object" && "html" in v) return { editor: "template", advanced: false, managed };
    if (isPlainList(v)) return { editor: "chips", numeric: v.length > 0 && v.every((x) => typeof x === "number"), advanced, managed };
    if (isRecordList(v)) return { editor: "records", advanced, managed };
    if (isFlatMap(v)) return { editor: "keyvalue", percent: /rate/.test(key) && Object.values(v).every((x) => typeof x === "number" && x <= 1), advanced, managed };
    return { editor: "json", advanced: true, managed };
  }
  if (CHOICES[key]) return { editor: "select", choices: CHOICES[key], advanced, managed };
  if (isHtml(v) || /(_template|_body)$/.test(key)) return { editor: "html", advanced, managed };
  if (typeof v === "string" && v.length > 80) return { editor: "textarea", advanced, managed };
  return { editor: "text", advanced, managed };
}

/** Placeholders ({{name}}) used in a template text, for the help line under an e-mail editor. */
export const placeholdersOf = (...texts) => [...new Set(texts.join(" ").match(/\{\{\s*[\w.]+\s*\}\}/g) || [])].map((p) => p.replace(/\s/g, ""));
