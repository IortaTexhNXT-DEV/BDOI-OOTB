/**
 * Role-based menu and route access.
 *
 * Deny by default: a role that is not listed here sees no menu and cannot open a menu route.
 * `all: true` grants every menu. Each other entry maps a top-level menu name (lower case) to the
 * second-level items the role may open (case-insensitive; a nested group such as "Renewals" or
 * "Petty Cash" grants all of its children; "Group > Item" grants one item of a group or of a Master
 * section such as "Finance"), or to `true` for the whole menu (a top-level entry such as Home).
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
  "My Work",
  "Payments",
  // CTPL COC authentication (read:policies; authenticate, enter a code, COC series: write:policies)
  "CTPL Authentication",
];

// The Processing Team reads prospects (read:leads) and works the market side: requests for quotation (broker slips),
// quotations and placement slips. Quick Quote creates prospects and quotations, which is Sales and Operations work.
const OPERATIONS_PROCESSING = [
  ...OPERATIONS_ALL.filter((item) => item !== "Sales & Marketing"),
  "Sales & Marketing > Prospects",
  "Sales & Marketing > Request for Quotation",
  "Sales & Marketing > Quotations",
  "Sales & Marketing > Placement Slips",
];

/** The administrator role (System Administrator, Super Admin Access): every menu. The one place the front end names it. */
export const ADMIN_ROLE = "system-admin";
export const ADMIN_ROLES = [ADMIN_ROLE];

export const roleMenuPermissions = {
  // The administrator sees every menu. Master > Go-Live Data Load (configuration and migration workbooks,
  // read:data-load / write:data-load) is granted to no other role: it stays System Administrator only.
  [ADMIN_ROLE]: { all: true },
  // Sales & Marketing (Account Executive): prospects, leads, clients, quotation requests, renewals follow-up, own production
  sales: {
    dashboard: ["Executive Dashboard", "Sales Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    home: true,
    operations: OPERATIONS_ALL,
    commission: ["Commission Dashboard"],
    reports: ["All Reports", "Operational Reports"],
  },
  // Processing Team (Placement & Policy Processing): broker slips, offer comparison, quotation / placement slips,
  // insurer confirmation, policy checking and issuance, endorsement processing, reinsurance, product templates
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
    home: true,
    operations: OPERATIONS_PROCESSING,
    reinsurance: [
      "Treaty Dashboard",
      "Cession Tracking",
      "Claims Recovery",
      "Reconciliation",
      "Analytics",
    ],
    reports: ["All Reports", "Operational Reports"],
  },
  // Operations (Client Servicing): client servicing, endorsement requests, renewals, My Work, documents
  operations: {
    dashboard: ["Executive Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    home: true,
    operations: OPERATIONS_ALL,
    reports: ["All Reports", "Operational Reports"],
    // data subject requests and the consent register (read:privacy / write:privacy)
    master: ["Data Privacy"],
    // prepares the EDD reviews of High-risk clients (approval: compliance officer, approve:aml)
    compliance: ["EDD Reviews"],
  },
  // Compliance Officer (AML/CFT): the Compliance menu (read:aml, write:aml, approve:aml), client onboarding and the client,
  // policy and claim records it reviews
  "compliance-officer": {
    home: true,
    compliance: true,
    operations: ["Clients", "Policy", "Claims"],
    reports: ["All Reports", "Operational Reports"],
  },
  claims: {
    dashboard: ["Claims Dashboard"],
    home: true,
    operations: ["Clients", "Policy", "Claims", "My Work"],
    reinsurance: ["Claims Recovery"],
    reports: ["All Reports", "Operational Reports"],
  },
  // Accounting: billing, collection, official receipts, remittance, commission, period end, BIR. The Accounting Manager
  // inherits Accounting (the server returns both roles), so it needs no entry of its own.
  accounting: {
    dashboard: ["Executive Dashboard"],
    operations: ["My Work", "Payments"],
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
    ],
    // Account Determination and Posting Rules: Accounting reads them; the Accounting Manager proposes changes and approves
    // those of another user on Configuration Approvals (the administrator configures too)
    master: ["Finance > Taxation", "Finance > Close Checklist", "Finance > Bank Statement Formats", "Finance > Bank Transaction Types",
      "Finance > Account Determination", "Finance > Posting Rules", "Finance > Configuration Approvals", "Finance > Accounting Flow", "Finance > Insurer Statement Formats",
      // premium taxes (write:premium-charges) and the payment links collected through the gateways
      "Finance > Premium Taxes & LGU Rates", "Finance > Payment Gateways",
      // bank payment file layouts and payee bank accounts (write:disbursements)
      "Finance > Bank File Layouts"],
    commission: ["Commission Dashboard", "Agents/Referrer Accounts",
      // overriding, profit and contingent commission from insurers (read:commission / write:commission)
      "Insurer Overrides"],
    // reinsurer statement reconciliation is an Accounting task
    reinsurance: ["Reconciliation"],
    // the production, claims and renewal registers are not accounting reports (report catalogue roles)
    reports: ["All Reports", "Financial Reports", "Operational Reports > Remittance", "Operational Reports > Broker Commission"],
  },
};

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

/** First screen the roles may open (landing page for roles without a dashboard); entries marked `landing: false` (Home) only when nothing else is open. */
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
