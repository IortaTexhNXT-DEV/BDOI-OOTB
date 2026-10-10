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
 * decides what the user sees and which screens the router lets them open.
 */

const OPERATIONS_ALL = [
  "Sales & Marketing",
  "Clients",
  "Policy",
  "Claims",
  "Renewals",
  "Payments",
  // CTPL COC authentication (read:policies; authenticate, enter a code, COC series: write:policies)
  "CTPL Authentication",
  // cover notes and policy cancellation (return premium computed): write:policies / write:endorsements
  "Cover Notes",
  "Policy Cancellation",
  // fleet schedules and marine open covers (read:fleet / read:marine; processing and operations also write)
  "Fleet Schedules",
  "Marine Open Covers",
];

// The Processing Team reads prospects (read:leads) and works the market side: requests for quotation (broker slips),
// quotations and placement slips. Quick Quote creates prospects and quotations, which is Sales and Operations work.
const OPERATIONS_PROCESSING = [
  ...OPERATIONS_ALL.filter((item) => item !== "Sales & Marketing"),
  "Sales & Marketing > Prospects",
  "Sales & Marketing > Request for Quotation",
  "Sales & Marketing > Quotations",
  "Sales & Marketing > Placement Slips",
  // brand-new vehicle programmes (write:motor-programmes) and client comparison reports from the insurers' offers
  "Sales & Marketing > Dealer Programmes",
  "Sales & Marketing > Comparison Reports",
  // the sales activity timelines and report (read:sales-activities)
  "Sales & Marketing > Sales Activities",
];

/** The administrator role (System Administrator, Super Admin Access): every menu. The one place the front end names it. */
export const ADMIN_ROLE = "system-admin";
export const ADMIN_ROLES = [ADMIN_ROLE];

export const roleMenuPermissions = {
  // The administrator sees every menu.
  [ADMIN_ROLE]: { all: true },
  // Sales & Marketing (Account Executive): prospects, leads, clients, quotation requests, renewals follow-up, own production
  sales: {
    dashboard: ["Executive Dashboard", "Sales Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    operations: OPERATIONS_ALL,
    commission: ["Commission Dashboard"],
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
      "Risk Mapping",
      "Product Analytics",
    ],
    "my work": true,
    operations: OPERATIONS_PROCESSING,
    reports: ["All Reports", "Operational Reports", "Report Builder"],
    master: ["Insurance Management > Distribution Channels"],
  },
  // Operations (Client Servicing): client servicing, endorsement requests, renewals, My Work, documents
  operations: {
    dashboard: ["Executive Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    operations: OPERATIONS_ALL,
    reports: ["All Reports", "Operational Reports", "Report Builder"],
    // distribution channels (read:channels)
    master: ["Insurance Management > Distribution Channels"],
  },
  claims: {
    dashboard: ["Claims Dashboard"],
    "my work": true,
    operations: ["Clients", "Policy", "Claims", "Fleet Schedules", "Marine Open Covers",
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
    operations: ["Payments"],
    accounts: [
      "Receipts",
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
      "Remittance",
      // incentives are calculated, approved and paid by Accounting
      "Incentive",
      // period-end processing and BIR tax
      "Period End",
      "Tax",
      // bank reconciliation (approval: accounting-manager, approve:bank-reconciliation)
      "Bank Reconciliation",
      // insurer statements of account (approval: accounting-manager, approve:insurer-reconciliation)
      "Insurer Reconciliation",
      // instalment plans, premium warranty, credit limits, remittance ageing (approvals: accounting-manager, approve:credit-control)
      "Credit Control",
      // payment vouchers paid by bank file (maker-checker approval of the batch)
      "Bank Payment Files",
      // post-dated cheques, claims paid through the broker, accounts payable (approval: approve:payables), fixed assets
      "Post-Dated Cheques",
      "Claims Settlements",
      "Payables",
      "Fixed Assets",
    ],
    // Account Determination and Posting Rules: Accounting reads them; the Accounting Manager proposes changes and approves
    // those of another user on Configuration Approvals (the administrator configures too)
    master: ["Finance > Taxation", "Finance > Close Checklist", "Finance > Bank Statement Formats", "Finance > Bank Transaction Types",
      "Finance > Account Determination", "Finance > Posting Rules", "Finance > Configuration Approvals", "Finance > Accounting Flow", "Finance > Insurer Statement Formats",
      // premium taxes (write:premium-charges) and the payment links collected through the gateways
      "Finance > Premium Taxes & LGU Rates", "Finance > Payment Gateways",
      // bank payment file layouts and payee bank accounts (write:disbursements)
      "Finance > Bank File Layouts",
      // asset classes of the fixed asset register (write:fixed-assets)
      "Finance > Asset Classes",
      // cost centres of the journal lines (write:journal-vouchers)
      "Finance > Cost Centres"],
    commission: ["Commission Dashboard", "Agents/Referrer Accounts",
      // overriding, profit and contingent commission from insurers (read:commission / write:commission)
      "Insurer Overrides"],
    // the production, claims and renewal registers are not accounting reports (report catalogue roles)
    reports: ["All Reports", "Financial Reports", "Operational Reports > Remittance", "Operational Reports > Broker Commission", "Report Builder"],
  },
};

// TISPH personas (Pre-BSM RBAC v4, backend migration 0348): each starts from the menus of the broker role closest to
// it, and the server's permissions decide what it may change (an Associate sees the approval screens but cannot
// approve). SUPERID includes the System Administrator, so the server returns system-admin among its roles: every menu.
const TIS_CASH_REPORTS = ["All Reports", "Financial Reports > SOA/Premium Receivable", "Financial Reports > Collection Report"];
// Accounts > Remittance entry by entry (spec §1.3). Finance and IT keep the whole menu; Insurer Reconciliation is not a
// TISPH menu (its statements open under Remittance > Reconciliation).
const REMITTANCE = (...items) => items.map((item) => `Remittance > ${item}`);
const withoutInsurerRec = (items) => items.filter((item) => item !== "Insurer Reconciliation");
const TIS_CCD = (accounts) => ({ "my work": true, operations: ["Payments"], accounts, reports: TIS_CASH_REPORTS });
// Incentive self-service of a producer (read:incentive, own data only): not the calculation, approval and report screens
const INCENTIVE_SELF_SERVICE = ["Incentive > My Programs", "Incentive > Statement"];
// the post-dated cheque log is read by every persona (RBAC v4 PDC Management: others R)
const TIS_SALES = { ...roleMenuPermissions.sales, accounts: ["Receipts", "Collections", "Post-Dated Cheques", ...INCENTIVE_SELF_SERVICE] };
// Sales & Marketing item by item, for the personas that lack the permission of some of its screens
const SALES_MARKETING = ["Prospects", "Quick Quote", "Request for Quotation", "Quotations", "Placement Slips", "Lead Assignment", "Dealer Programmes",
  "Comparison Reports", "Campaigns", "Sales Activities"];
const salesMarketingWithout = (...left) => SALES_MARKETING.filter((item) => !left.includes(item)).map((item) => `Sales & Marketing > ${item}`);
const operationsWithout = (...left) => OPERATIONS_ALL.filter((item) => item !== "Sales & Marketing" && !left.includes(item));
const TIS_OPERATIONS = {
  dashboard: ["Executive Dashboard", "Processing Dashboard", "Claims Dashboard"],
  "product configurator": ["Dashboard", "Product Templates"],
  "my work": true,
  // campaigns are Sales' (read:campaigns)
  operations: [...operationsWithout(), ...salesMarketingWithout("Campaigns"), "Claim Documents", "Motor Claim Repairs"],
  accounts: ["Receipts", "Collections", "Post-Dated Cheques", ...REMITTANCE("Remittances")],
  reports: ["All Reports", "Operational Reports", "Report Builder"],
  master: ["Insurance Management > Distribution Channels", "Insurance Management > Claim Document Checklist", "Insurance Management > Repair Shops"],
};
// Operations officers and unit heads work the rates-missing and confirmation exceptions and read insurer billing
const TIS_OPS_REMITTANCE = REMITTANCE("Exceptions", "Insurer billing");
Object.assign(roleMenuPermissions, {
  "tis-sales-associate": TIS_SALES,
  "tis-sales-officer": TIS_SALES,
  "tis-sales-unit-head": { ...TIS_SALES, accounts: [...TIS_SALES.accounts, "Disbursement", "Payables", "Incentive"] },
  "tis-ops-associate": TIS_OPERATIONS,
  "tis-ops-officer": { ...TIS_OPERATIONS, accounts: [...TIS_OPERATIONS.accounts, ...TIS_OPS_REMITTANCE, "Journal Voucher", "Fixed Assets"] },
  "tis-ops-unit-head": { ...TIS_OPERATIONS, accounts: [...TIS_OPERATIONS.accounts, ...TIS_OPS_REMITTANCE, "Journal Voucher", "Fixed Assets", "Disbursement", "Payables"] },
  "tis-ccd-pdu": TIS_CCD(["Post-Dated Cheques", "Receipts"]),
  // Cash Control: the remittance reconciliation and the exceptions it works (no proof of payment); Recon also decides
  // insurer statements (approve:insurer-reconciliation) and reads payments and billing. The claim settlement funds an
  // insurer remits are banked by Cash Control (write:receipts).
  "tis-ccd-pdc": TIS_CCD(["Post-Dated Cheques", "Receipts", "Collections", "Bank Reconciliation", ...REMITTANCE("Remittances", "Reconciliation", "Exceptions")]),
  "tis-ccd-bp": TIS_CCD(["Receipts", "Collections", "Post-Dated Cheques", "Claims Settlements", "Bank Reconciliation", ...REMITTANCE("Remittances", "Reconciliation", "Exceptions")]),
  "tis-ccd-recon": TIS_CCD(["Receipts", "Collections", "Post-Dated Cheques", "Claims Settlements", "Bank Reconciliation", "Open Entry Matching", "Open Entry Unmatching",
    "Disbursement", ...REMITTANCE("Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Insurer billing")]),
  // Finance & General Accounting: the Accounting menus, plus the audit trail and the schedules (interface monitor)
  "tis-finance": {
    ...roleMenuPermissions.accounting,
    accounts: withoutInsurerRec(roleMenuPermissions.accounting.accounts),
    master: [...roleMenuPermissions.accounting.master, "System Configuration > Audit Trail", "System Configuration > Schedules"],
  },
  // IT AppSupport / Admin: administration and the reference masters; the business screens read only.
  "tis-it-admin": {
    dashboard: ["Executive Dashboard"],
    "my work": true,
    // reads the business registers; not the quick quote (write:quotations), campaigns, sales activities, fleet schedules
    // and open covers (read:campaigns, read:sales-activities, read:fleet, read:marine)
    operations: [...operationsWithout("Fleet Schedules", "Marine Open Covers"), ...salesMarketingWithout("Quick Quote", "Campaigns", "Sales Activities")],
    accounts: ["Receipts", "Collections", "Post-Dated Cheques", "Disbursement", "Journal Voucher", "Payables", "Fixed Assets", "Remittance"],
    commission: ["Commission Dashboard"],
    reports: ["All Reports", "Operational Reports", "Financial Reports"],
    master: ["Organization", "Insurance Management", "Location", "Employee Management", "User Management", "System Configuration", "Finance > Currency",
      "Finance > Exchange Rate", "Finance > Bank", "Finance > Transaction Code", "Finance > Premium Taxes & LGU Rates", "Finance > Insurer Rate Tables",
      "Finance > Commission Rate Matrix", "Finance > Package Bundles"],
    "product configurator": roleMenuPermissions.processing["product configurator"],
  },
  // TIS General Manager: the front office with its approvals; accounting, commission and administration read only
  "tis-general-manager": {
    dashboard: ["Executive Dashboard", "Sales Dashboard", "Processing Dashboard", "Claims Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    "my work": true,
    operations: [...OPERATIONS_ALL, "Claim Documents", "Motor Claim Repairs"],
    // Remittance without Setup; Approvals to decide what approve:remittance gives it
    accounts: [...withoutInsurerRec(roleMenuPermissions.accounting.accounts).filter((item) => item !== "Remittance"),
      ...REMITTANCE("Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Insurer billing", "Settlement")],
    commission: roleMenuPermissions.accounting.commission,
    reports: ["All Reports", "Operational Reports", "Financial Reports"],
    master: ["User Management > User", "User Management > Role", "User Management > User Access Matrix", "User Management > Role Permissions",
      "User Management > Authority Matrix", "User Management > Segregation of Duties", "System Configuration > Audit Trail", "Insurance Management > Distribution Channels"],
  },
});

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

/** The menu tree reduced to what any of the given roles may see. */
export const filterMenuForRoles = (menuList, roles) => {
  const list = (roles || []).map(norm).filter(Boolean);
  if (!list.length) return [];
  if (list.some((r) => roleMenuPermissions[r]?.all)) return menuList;
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
export const firstAllowedPath = (menuList, roles) => {
  const walk = (items, skip) => {
    for (const item of items || []) {
      if (skip && item.landing === false) continue;
      if (item.path && !item.submenu) return item.path;
      const inner = walk(item.submenu, skip);
      if (inner) return inner;
    }
    return null;
  };
  const allowed = filterMenuForRoles(menuList, roles);
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

/**
 * Route guard: a path that belongs to a menu screen is allowed only when that screen is in the
 * user's filtered menu. Paths outside the menu (profile, notifications, detail pages reached from
 * an allowed screen) are allowed.
 */
export const isPathAllowed = (pathname, menuList, roles) => {
  const all = collectPaths(menuList).filter((p) => matches(pathname, p));
  if (!all.length) return true;
  const allowed = collectPaths(filterMenuForRoles(menuList, roles));
  return allowed.some((p) => matches(pathname, p));
};
