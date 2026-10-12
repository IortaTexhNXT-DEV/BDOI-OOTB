/**
 * Role-based menu and route access.
 *
 * Deny by default: a role that is not listed here sees no menu and cannot open a menu route.
 * `all: true` grants every menu. Each other entry maps a top-level menu name (lower case) to the
 * second-level items the role may open (case-insensitive; a nested group such as "Renewals" or
 * "Petty Cash" grants all of its children; "Group > Item" grants one item of a group or of a Master
 * section such as "Finance"), or to `true` for the whole menu (a top-level entry such as My Work).
 *
 * The server enforces the same personas through permissions on every endpoint; this file only
 * decides what the user sees and which screens the router lets them open. A screen is shown only when the user also
 * holds what it needs to load: the permissions of the endpoints it calls when it opens (components/SideBar/requires.js,
 * or `requires` on the entry; one permission of each group), so no entry leads to a refusal. Entries of features this
 * environment does not run (features/entitlements.js) are left out for every role, and entries marked `platform: true`
 * are shown to the iorta TechNXT platform administrator only.
 */
import { withoutFeatures } from "../features/entitlements.js";
import { requiresOf } from "../components/SideBar/requires.js";

// Policy Servicing item by item, in the order of the menu (components/SideBar/list.js). Endorsements is the work list of
// the endorsements raised from a policy: it goes with Clients and Policy, whose detail screens open them.
const POLICY_SERVICING_ALL = [
  "Clients",
  "Policy",
  // cover notes and policy cancellation (return premium computed): write:policies / write:endorsements
  "Cover Notes",
  // fleet schedules and parcel / courier open covers (read:fleet / read:marine; processing and operations also write)
  "Fleet Schedules",
  "Marine Open Covers",
  // monthly Credit Life batches of the financing bank (read:credit-life; Operations and the Processing Team also write)
  "Credit Life",
  "Endorsements",
  "Policy Cancellation",
  "Renewals",
  "Claims",
  // CTPL COC authentication (read:policies; authenticate, enter a code, COC series: write:policies)
  "CTPL Authentication",
];

// The Processing Team reads prospects (read:leads) and works the market side: requests for quotation (broker slips),
// quotations and placement slips. Quick Quote creates prospects and quotations, which is Sales and Operations work.
const SALES_PLACEMENT_PROCESSING = [
  "Prospects",
  "Request for Quotation",
  "Quotations",
  "Placement Slips",
  // dealer schemes: the Scheme Master and the scheme applications (write:schemes, write:scheme-issuance)
  "Scheme Issuance",
  // brand-new vehicle programmes (write:motor-programmes), promotions (write:promotions) and client comparison reports
  "Dealer Programmes",
  "Promotions",
  "Scheme Master",
  "Comparison Reports",
  // the sales activity timelines and report (read:sales-activities)
  "Sales Activities",
];

// Policy payments to verify (Accounts > Payments, opened from the Receipts header): read with the policies by the front
// office and with the receipts by Accounting
const PAYMENTS = "Payments";
// Commission (Accounts > Commission, formerly a menu of its own) entry by entry
const COMMISSION = (...items) => items.map((item) => `Commission > ${item}`);

/** The administrator role (System Administrator, Super Admin Access): every menu. The one place the front end names it. */
export const ADMIN_ROLE = "system-admin";
export const ADMIN_ROLES = [ADMIN_ROLE];
/** The iorta TechNXT platform administrator (vendor): Features & Releases only, never a menu of the tenant. */
export const PLATFORM_ROLE = "iorta-platform-admin";

export const roleMenuPermissions = {
  // The administrator sees every menu.
  [ADMIN_ROLE]: { all: true },
  // Sales & Marketing (Account Executive): prospects, leads, clients, quotation requests, renewals follow-up, own production
  sales: {
    dashboard: ["Executive Dashboard", "Sales Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    "sales & placement": true,
    "policy servicing": POLICY_SERVICING_ALL,
    accounts: [PAYMENTS, ...COMMISSION("Commission Dashboard")],
    reports: ["All Reports", "Operational Reports", "Report Builder"],
    master: ["Insurance Management > Distribution Channels"],
  },
  // Processing Team (Placement & Policy Processing): broker slips, offer comparison, quotation / placement slips,
  // insurer confirmation, policy checking and issuance, endorsement processing, product templates
  processing: {
    dashboard: ["Processing Dashboard", "Executive Dashboard"],
    "product configurator": [
      "Dashboard",
      "Product Templates",
      "Coverage Builder",
      "Rating Engine",
      "Acceptance Rules",
      "Document Manager",
      "Market Mapping",
      "Product Analytics",
    ],
    "my work": true,
    "sales & placement": SALES_PLACEMENT_PROCESSING,
    "policy servicing": POLICY_SERVICING_ALL,
    accounts: [PAYMENTS],
    reports: ["All Reports", "Operational Reports", "Report Builder"],
    // distribution channels; the discount caps the promotions are checked against (write:discount-caps)
    master: ["Insurance Management > Distribution Channels", "Finance > Discount Caps", "Insurance Management > Scheme Document Checklist", "Insurance Management > Motor Issuance Checklist"],
  },
  // Operations (Client Servicing): client servicing, endorsement requests, renewals, My Work, documents
  operations: {
    dashboard: ["Executive Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    "sales & placement": true,
    "policy servicing": POLICY_SERVICING_ALL,
    accounts: [PAYMENTS],
    reports: ["All Reports", "Operational Reports", "Report Builder"],
    // distribution channels (read:channels)
    master: ["Insurance Management > Distribution Channels"],
  },
  claims: {
    dashboard: ["Claims Dashboard"],
    "my work": true,
    "policy servicing": ["Clients", "Policy", "Endorsements", "Claims", "Fleet Schedules", "Marine Open Covers",
      // claim document checklist and motor claim repairs (write:claims); their masters below
      "Claim Documents", "Motor Claim Repairs"],
    master: ["Insurance Management > Claim Document Checklist", "Insurance Management > Repair Shops"],
    reports: ["All Reports", "Operational Reports", "Report Builder"],
  },
  // Accounting: billing, collection, official receipts, remittance, commission, period end, BIR. The Accounting Manager
  // inherits Accounting (the server returns both roles), so it needs no entry of its own.
  accounting: {
    dashboard: ["Executive Dashboard"],
    "my work": true,
    accounts: [
      "Receipts",
      PAYMENTS,
      "Unapplied Collections",
      "Collections",
      "Accounting Query",
      "All Clients Accounting",
      "Open Entry Matching",
      "Open Entry Unmatching",
      "Disbursement",
      "Petty Cash",
      "Journal Voucher",
      // daily SAP GL text files (run now / re-generate: write:journal-vouchers)
      "SAP GL Export",
      "Correction JV",
      "Reversal JV",
      // remittance, with the insurer statements under Reconciliation (approval: accounting-manager, approve:insurer-reconciliation)
      "Remittance",
      // incentives are calculated, approved and paid by Accounting
      "Incentive",
      // period-end processing and BIR tax
      "Period End",
      "Tax",
      // bank reconciliation (approval: accounting-manager, approve:bank-reconciliation)
      "Bank Reconciliation",
      // instalment plans, premium warranty, credit limits, remittance ageing (approvals: accounting-manager, approve:credit-control)
      "Credit Control",
      // payment vouchers paid by bank file (maker-checker approval of the batch)
      "Bank Payment Files",
      // post-dated cheques, claims paid through the broker, accounts payable (approval: approve:payables), fixed assets
      "Post-Dated Cheques",
      "Claims Settlements",
      "Payables",
      "Fixed Assets",
      ...COMMISSION("Commission Dashboard", "Agents/Referrer Accounts", "Sharing Schemes",
        // overriding, profit and contingent commission from insurers (read:commission / write:commission)
        "Insurer Override Agreements", "Insurer Override Computations"),
    ],
    // Account Determination and Posting Rules: Accounting reads them; the Accounting Manager proposes changes and approves
    // those of another user on Configuration Approvals (the administrator configures too)
    master: ["Finance > Taxation", "Finance > Close Checklist", "Finance > Bank Statement Formats", "Finance > Bank Transaction Types",
      "Finance > Account Determination", "Finance > Posting Rules", "Finance > Configuration Approvals", "Finance > Accounting Flow", "Finance > Insurer Statement Formats",
      // the financial statement versions of the FS reports (write:journal-vouchers)
      "Finance > Financial Statement Versions",
      // premium taxes (write:premium-charges) and the payment links collected through the gateways
      "Finance > Premium Taxes & LGU Rates", "Finance > Payment Gateways",
      // discount caps of the promotions (read:discount-caps; the Accounting Manager approves them)
      "Finance > Discount Caps",
      // bank payment file layouts and payee bank accounts (write:disbursements)
      "Finance > Bank File Layouts",
      // asset classes of the fixed asset register (write:fixed-assets)
      "Finance > Asset Classes",
      // cost centres of the journal lines (write:journal-vouchers)
      "Finance > Cost Centres"],
    // the production, claims and renewal registers are not accounting reports (report catalogue roles)
    reports: ["All Reports", "Financial Reports", "Operational Reports > Remittance", "Operational Reports > Broker Commission", "Report Builder"],
  },
};

// TISPH personas (Pre-BSM RBAC v4, backend migration 0348): each starts from the menus of the broker role closest to
// it, and the server's permissions decide what it may change (an Associate sees the approval screens but cannot
// approve). SUPERID includes the System Administrator, so the server returns system-admin among its roles: every menu.
const TIS_CASH_REPORTS = ["All Reports", "Financial Reports > SOA/Premium Receivable", "Financial Reports > Collection Report"];
// Accounts > Remittance entry by entry (spec §1.3). Finance and IT keep the whole menu.
const REMITTANCE = (...items) => items.map((item) => `Remittance > ${item}`);
// the policy payments to verify are read with the receipts: not by CCD-PDU (RBAC v4 Receipting)
const TIS_CCD = (accounts, payments = true) => ({ "my work": true, accounts: [...accounts, ...(payments ? [PAYMENTS] : [])], reports: TIS_CASH_REPORTS });
// Incentive self-service of a producer (read:incentive, own data only): not the calculation, approval and report screens
const INCENTIVE_SELF_SERVICE = ["Incentive > My Programs", "Incentive > Statement"];
// Sales & Placement item by item, in the order of the menu (components/SideBar/list.js)
const SALES_PLACEMENT = ["Prospects", "Lead Assignment", "Sales Activities", "Quotations", "Request for Quotation", "Comparison Reports", "Placement Slips",
  "Scheme Issuance", "Dealer Programmes", "Promotions", "Scheme Master", "Quick Quote", "Campaigns"];
// entries that map to no TISPH requirement (BRD, FRS, MOM): no TISPH persona is given them. Quick Quote: the BRD raises a
// quotation per product from the Quotations screen; Campaigns: no requirement. Removing an entry here gives it back.
const TIS_HIDDEN_SALES = ["Quick Quote", "Campaigns"];
const salesPlacementWithout = (...left) => SALES_PLACEMENT.filter((item) => !left.includes(item) && !TIS_HIDDEN_SALES.includes(item));
const policyServicingWithout = (...left) => POLICY_SERVICING_ALL.filter((item) => !left.includes(item));
// Talkbot Calls (Policy Servicing > Renewals, TIS-BRD-LEAD-09): opened with read:talkbot-calls (Sales and Operations
// personas, the General Manager); IT AppSupport and Finance read the renewal screens without it.
const RENEWALS_WITHOUT_TALKBOT = ["Renewal Policy", "Renewal Batch", "Renewal Queue", "Retention Analytics", "At-Risk Policies", "Negotiations",
  "Lapse Management", "Performance", "Lock-in Review"].map((item) => `Renewals > ${item}`);
// the post-dated cheque log is read by every persona (RBAC v4 PDC Management: others R)
// Sales and Operations read the sharing schemes behind the share of a quotation (read:sharing-schemes, migration 0570)
// RBAC v4 Interface Monitor: Sales, Operations, Finance and the General Manager read the scheduled jobs and their runs
const INTERFACE_MONITOR = "System Configuration > Schedules";
const FRONT_OFFICE_COMMISSION = COMMISSION("Commission Dashboard", "Sharing Schemes");
const TIS_SALES = { ...roleMenuPermissions.sales, "sales & placement": salesPlacementWithout(), "policy servicing": policyServicingWithout(),
  accounts: ["Receipts", PAYMENTS, "Collections", "Post-Dated Cheques", ...FRONT_OFFICE_COMMISSION, ...INCENTIVE_SELF_SERVICE],
  master: [...roleMenuPermissions.sales.master, INTERFACE_MONITOR] };
// Payables of an approver of supplier invoices (approve:payables): not the withholding certificates (BIR 2307)
const TIS_PAYABLES_APPROVER = ["Supplier Invoices", "Supplier Payments", "AP Ageing", "Suppliers"].map((item) => `Payables > ${item}`);
// RBAC v4 Telesales Incentives: Operations and IT AppSupport read the calculations and the incentive reports
const INCENTIVE_READER = ["Incentive > Calculations", "Incentive > Reports"];
const TIS_OPERATIONS = {
  dashboard: ["Executive Dashboard", "Processing Dashboard", "Claims Dashboard"],
  "product configurator": ["Dashboard", "Product Templates"],
  "my work": true,
  "sales & placement": salesPlacementWithout(),
  "policy servicing": [...policyServicingWithout(), "Claim Documents", "Motor Claim Repairs"],
  accounts: ["Receipts", PAYMENTS, "Collections", "Post-Dated Cheques", ...REMITTANCE("Remittances"), ...FRONT_OFFICE_COMMISSION, ...INCENTIVE_READER],
  reports: ["All Reports", "Operational Reports", "Report Builder"],
  master: ["Insurance Management > Distribution Channels", "Insurance Management > Claim Document Checklist", "Insurance Management > Repair Shops",
    // the document checklist of the scheme applications (Scheme Issuance) and of a Motor booking (placement slips)
    "Insurance Management > Scheme Document Checklist", "Insurance Management > Motor Issuance Checklist",
    // the discount caps of the promotions: proposed by Operations Officers and the Unit Head (write:discount-caps)
    "Finance > Discount Caps", INTERFACE_MONITOR],
};
// Operations officers and unit heads work the rates-missing and confirmation exceptions and read insurer billing
const TIS_OPS_REMITTANCE = REMITTANCE("Exceptions", "Held policies", "Insurer billing");
Object.assign(roleMenuPermissions, {
  "tis-sales-associate": TIS_SALES,
  "tis-sales-officer": TIS_SALES,
  // the Sales Unit Head approves promotions and discount caps (approve:promotions, approve:discount-caps) and supplier
  // invoices (approve:payables); the supplier withholding certificates (BIR 2307) stay with Finance
  // (TISPH decision, migration 0691: disbursements and journal vouchers are Finance work)
  "tis-sales-unit-head": { ...TIS_SALES, accounts: [...TIS_SALES.accounts, ...TIS_PAYABLES_APPROVER, "Incentive"],
    master: [...TIS_SALES.master, "Finance > Discount Caps"] },
  "tis-ops-associate": TIS_OPERATIONS,
  "tis-ops-officer": { ...TIS_OPERATIONS, accounts: [...TIS_OPERATIONS.accounts, ...TIS_OPS_REMITTANCE, "Fixed Assets"] },
  // the Operations Unit Head approves, as the data owner of policies, clients and claims, the migration loads
  // (approve:data-load); it reads the incentives as the other Operations personas and no longer approves them, and
  // journal vouchers and disbursements are Finance work (TISPH decision, migration 0691)
  "tis-ops-unit-head": { ...TIS_OPERATIONS, accounts: [...TIS_OPERATIONS.accounts, ...TIS_OPS_REMITTANCE, "Fixed Assets", ...TIS_PAYABLES_APPROVER],
    master: [...TIS_OPERATIONS.master, "System Configuration > Data Migration & Go-Live"] },
  // Receipting (RBAC v4): CCD-PDU has no access to the receipts
  "tis-ccd-pdu": TIS_CCD(["Post-Dated Cheques"], false),
  // Cash Control: the remittance reconciliation and the exceptions it works (no proof of payment); BP and Recon keep the
  // instalment plans and the follow-ups of Credit Control (write:collections); Recon also decides
  // insurer statements (approve:insurer-reconciliation) and reads payments and billing. The claim settlement funds an
  // insurer remits are banked by Cash Control (write:receipts).
  "tis-ccd-pdc": TIS_CCD(["Post-Dated Cheques", "Receipts", "Collections", "Bank Reconciliation", ...REMITTANCE("Remittances", "Reconciliation", "Exceptions", "Held policies")]),
  // CCD-BP (the teller) also opens the placement slips to verify the proof of payment before the slip is sent (cash before cover)
  "tis-ccd-bp": { ...TIS_CCD(["Receipts", "Unapplied Collections", "Collections", "Credit Control", "Post-Dated Cheques", "Claims Settlements", "Bank Reconciliation",
    ...REMITTANCE("Remittances", "Reconciliation", "Exceptions", "Held policies")]), "sales & placement": ["Placement Slips"] },
  "tis-ccd-recon": TIS_CCD(["Receipts", "Unapplied Collections", "Collections", "Credit Control", "Post-Dated Cheques", "Claims Settlements", "Bank Reconciliation",
    "Disbursement", ...REMITTANCE("Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Held policies", "Insurer billing")]),
  // Finance & General Accounting: the Accounting menus, plus the audit trail and the schedules (interface monitor). RBAC v4
  // Finance & GenAcctg reads the front office from the prospect (read:leads) and the quotation to the renewal and the
  // claim, the dashboards and the product configurator with the dealer programmes and promotions (not the talkbot call
  // lists: read:talkbot-calls)
  "tis-finance": {
    ...roleMenuPermissions.accounting,
    dashboard: ["Executive Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "sales & placement": ["Prospects", "Quotations", "Request for Quotation", "Placement Slips", "Scheme Issuance", "Dealer Programmes", "Promotions", "Scheme Master"],
    "policy servicing": ["Clients", "Policy", "Endorsements", "Claims", "Cover Notes", "Policy Cancellation", ...RENEWALS_WITHOUT_TALKBOT],
    master: [...roleMenuPermissions.accounting.master, "System Configuration > Audit Trail", "System Configuration > Schedules",
      "System Configuration > Data Migration & Go-Live"],
  },
  // IT AppSupport / Admin: administration and the reference masters; the business screens read only.
  "tis-it-admin": {
    dashboard: ["Executive Dashboard"],
    "my work": true,
    // reads the business registers; not the quick quote (write:quotations), campaigns, sales activities, lead assignment
    // (read:lead-assignment), fleet schedules, open covers and Credit Life (read:campaigns, read:sales-activities, read:fleet,
    // read:marine, read:credit-life) or the talkbot call lists; maintains and approves the Scheme Master and the promotions
    // (TISPH decision of 11 Oct 2026, GAP-SALES-17)
    "sales & placement": salesPlacementWithout("Sales Activities", "Lead Assignment"),
    "policy servicing": [...policyServicingWithout("Fleet Schedules", "Marine Open Covers", "Credit Life", "Renewals"), ...RENEWALS_WITHOUT_TALKBOT],
    accounts: ["Receipts", PAYMENTS, "Collections", "Post-Dated Cheques", "Disbursement", "Journal Voucher", "Payables", "Fixed Assets", "Remittance",
      ...FRONT_OFFICE_COMMISSION, ...INCENTIVE_READER],
    reports: ["All Reports", "Operational Reports", "Financial Reports"],
    master: ["Organization", "Insurance Management", "Location", "Employee Management", "User Management", "System Configuration", "Environment Promotion", "Finance > Currency",
      "Finance > Exchange Rate", "Finance > Bank", "Finance > Transaction Code", "Finance > Premium Taxes & LGU Rates", "Finance > Insurer Rate Tables",
      "Finance > Commission Rate Matrix", "Finance > Package Bundles"],
    "product configurator": roleMenuPermissions.processing["product configurator"],
  },
  [PLATFORM_ROLE]: { master: ["Platform > Features & Releases"] },
  // TIS General Manager: the front office with its approvals; accounting, commission and administration read only
  "tis-general-manager": {
    dashboard: ["Executive Dashboard", "Sales Dashboard", "Processing Dashboard", "Claims Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    "sales & placement": salesPlacementWithout(),
    "policy servicing": [...policyServicingWithout(), "Claim Documents", "Motor Claim Repairs"],
    // Remittance without Setup; Approvals to decide what approve:remittance gives it
    accounts: [...roleMenuPermissions.accounting.accounts.filter((item) => item !== "Remittance"),
      ...REMITTANCE("Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Held policies", "Insurer billing", "Settlement")],
    reports: ["All Reports", "Operational Reports", "Financial Reports"],
    // decides the commission rules and sharing schemes of Finance on Configuration Approvals (approve:commission-rules, approve:sharing-schemes)
    master: ["Finance > Commission Rate Matrix", "Finance > Configuration Approvals", "User Management > User", "User Management > Role", "User Management > User Access Matrix", "User Management > Role Permissions",
      "User Management > Authority Matrix", "User Management > Segregation of Duties", "System Configuration > Audit Trail", "System Configuration > Features & Releases",
      "Insurance Management > Distribution Channels",
      // approves promotions and discount caps
      "Finance > Discount Caps", "System Configuration > Data Migration & Go-Live", INTERFACE_MONITOR],
  },
  // TIS Audit: the migration workspace and the audit trail, read only (read:data-load, read:audit)
  "tis-auditor": { master: ["System Configuration > Data Migration & Go-Live", "System Configuration > Audit Trail"] },
});

// Sales reports (Reports > Operational Reports, TIS-BRD-RPT-SLS-01..04): every role with Operational Reports sees them;
// Finance, which has only some operational reports, gets them too (report catalogue roles, backend migration 0462), and
// the dealer production report as well (report_definitions roles).
const SALES_REPORTS = ["APR Operation Report", "Production per Line", "Agent Pipeline", "Renewal Notice Listing", "CLI Generated Report"].map((item) => `Operational Reports > ${item}`);
["accounting", "tis-finance"].forEach((role) => { roleMenuPermissions[role].reports = [...roleMenuPermissions[role].reports, ...SALES_REPORTS]; });
roleMenuPermissions["tis-finance"].reports.push("Operational Reports > Dealer Production");

/** API permissions of the signed-in user, stored at sign-in; null when unknown (the role grants alone then apply). */
export const getUserPermissions = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("USER_PERMISSIONS") || "null");
    return Array.isArray(stored) ? stored : null;
  } catch {
    return null;
  }
};

/** True when the permissions meet `requires` of a menu entry: one permission of every group (unknown permissions pass). */
export const meetsRequires = (requires, permissions) =>
  !permissions || !requires || requires.every((group) => group.some((code) => permissions.includes(code)));

/** The menu tree without the entries the permissions cannot load; a group left without entries goes too. */
const withoutUnusable = (items, permissions) =>
  (items || [])
    .filter((item) => item.submenu || meetsRequires(requiresOf(item), permissions))
    .map((item) => (item.submenu ? { ...item, submenu: withoutUnusable(item.submenu, permissions) } : item))
    .filter((item) => !item.submenu || item.submenu.length);

/** Roles of the signed-in user, from the login response stored by authService. */
export const getUserRoles = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("USER_ROLES") || "[]");
    if (Array.isArray(stored) && stored.length) return stored.map((r) => String(r).toLowerCase());
  } catch {
    /* fall back to the comma-separated form */
  }
  return (localStorage.getItem("USER_ROLE") || "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
};

const norm = (s) => String(s || "").trim().toLowerCase();

/** Grants of one role for a top-level menu: [["Item"], ["Group", "Item"], ...] (split on " > "). */
const grantsFor = (role, menuName) => {
  const perms = roleMenuPermissions[norm(role)];
  const allowed = perms && perms[norm(menuName)];
  return Array.isArray(allowed) ? allowed.map((a) => String(a).split(">").map(norm)) : [];
};

/** True when one role may open a second-level item of a top-level menu (whole item or part of it). */
export const checkSubmenuAccess = (role, menuName, submenu) => {
  const perms = roleMenuPermissions[norm(role)];
  if (!perms) return false;
  if (perms.all) return true;
  const name = norm(typeof submenu === "object" ? submenu.name : submenu);
  return grantsFor(role, menuName).some((path) => path[0] === name);
};

/** Keep only the parts of an item a set of grant paths allows (a path that ends at the item keeps it whole). */
const pruneItem = (item, paths) => {
  if (paths.some((p) => p.length === 0) || !item.submenu) return item;
  const submenu = item.submenu
    .map((child) => {
      const rest = paths.filter((p) => p[0] === norm(child.name)).map((p) => p.slice(1));
      return rest.length ? pruneItem(child, rest) : null;
    })
    .filter(Boolean);
  return submenu.length ? { ...item, submenu } : null;
};

/** True when one role may see a top-level menu (or one of its items). */
export const hasMenuAccess = (role, menuName, submenuName = null) => {
  const perms = roleMenuPermissions[norm(role)];
  if (!perms) return false;
  if (perms.all) return true;
  if (submenuName) return checkSubmenuAccess(role, menuName, submenuName);
  return perms[norm(menuName)] !== undefined;
};

const withoutPlatformEntries = (items) =>
  (items || [])
    .filter((item) => !item.platform)
    .map((item) => (item.submenu ? { ...item, submenu: withoutPlatformEntries(item.submenu) } : item))
    .filter((item) => !item.submenu || item.submenu.length);

/**
 * The menu tree reduced to what any of the given roles may see and the permissions can load (`permissions`: the API
 * permissions of the user, by default those stored at sign-in; the administrator holds every permission).
 */
export const filterMenuForRoles = (fullMenu, roles, permissions = getUserPermissions()) => {
  const list = (roles || []).map(norm).filter(Boolean);
  if (!list.length) return [];
  const edition = withoutFeatures(fullMenu);
  const offered = list.includes(PLATFORM_ROLE) ? edition : withoutPlatformEntries(edition);
  if (list.some((r) => roleMenuPermissions[r]?.all)) return offered;
  const menuList = withoutUnusable(offered, permissions);
  return menuList
    .map((menu) => {
      if (!menu.submenu) {
        return list.some((r) => hasMenuAccess(r, menu.name)) ? menu : null;
      }
      if (list.some((r) => roleMenuPermissions[r]?.[norm(menu.name)] === true)) return menu;
      const paths = list.flatMap((r) => grantsFor(r, menu.name));
      const submenu = menu.submenu
        .map((item) => {
          const rest = paths.filter((p) => p[0] === norm(item.name)).map((p) => p.slice(1));
          return rest.length ? pruneItem(item, rest) : null;
        })
        .filter(Boolean);
      return submenu.length ? { ...menu, submenu } : null;
    })
    .filter(Boolean);
};

/** First screen the roles may open after sign-in (My Work, the first entry, for every delivered role); an entry marked `landing: false` only when nothing else is open. */
export const firstAllowedPath = (menuList, roles, permissions = getUserPermissions()) => {
  const walk = (items, skip) => {
    for (const item of items || []) {
      if (skip && item.landing === false) continue;
      if (item.path && !item.submenu) return item.path;
      const inner = walk(item.submenu, skip);
      if (inner) return inner;
    }
    return null;
  };
  const allowed = filterMenuForRoles(menuList, roles, permissions);
  return walk(allowed, true) || walk(allowed, false);
};

/** Backwards-compatible single-role filter. */
export const filterMenuByRole = (menuList, role) => filterMenuForRoles(menuList, [role]);

const collectPaths = (items, out = []) => {
  for (const item of items || []) {
    if (item.path) out.push(item.path);
    for (const p of item.includes || []) out.push(p);
    if (item.submenu) collectPaths(item.submenu, out);
  }
  return out;
};

const matches = (pathname, p) => {
  const base = p.replace(/\/+$/, "");
  // the home route "/" matches only itself (it would otherwise prefix every address)
  if (!base) return pathname === "/" || pathname === "";
  return pathname === base || pathname.startsWith(`${base}/`);
};

const specificity = (p) => p.replace(/\/+$/, "").length;

/**
 * Route guard: a path that belongs to a menu screen is allowed only when that screen is in the
 * user's filtered menu. When several entries cover the path, the most specific decides (a report
 * of its own menu entry is not opened through the report catalogue's /reports/run/). Paths outside
 * the menu (profile, notifications, detail pages reached from an allowed screen) are allowed.
 */
export const isPathAllowed = (pathname, menuList, roles, permissions = getUserPermissions()) => {
  const all = collectPaths(menuList).filter((p) => matches(pathname, p));
  if (!all.length) return true;
  const closest = Math.max(...all.map(specificity));
  const allowed = collectPaths(filterMenuForRoles(menuList, roles, permissions));
  return allowed.some((p) => matches(pathname, p) && specificity(p) === closest);
};
