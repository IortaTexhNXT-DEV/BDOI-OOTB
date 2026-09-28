/**
 * Role-based menu and route access.
 *
 * Deny by default: a role that is not listed here sees no menu and cannot open a menu route.
 * `all: true` grants every menu. Each other entry maps a top-level menu name (lower case) to the
 * second-level items the role may open (case-insensitive; a nested group such as "Renewals" or
 * "Petty Cash" grants all of its children).
 *
 * The server enforces the same personas through permissions on every endpoint; this file only
 * decides what the user sees and which screens the router lets them open.
 */

const OPERATIONS_ALL = [
  "Home",
  "Leads/Prospects",
  "Clients",
  "Quotation",
  "Policy",
  "Claims",
  "Renewals",
  "Open Items",
  "Payments",
];

export const roleMenuPermissions = {
  "it-admin": { all: true },
  ba: { all: true },
  sales: {
    dashboard: ["Executive Dashboard", "Agent Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: OPERATIONS_ALL,
    commission: ["Commission Dashboard"],
    reports: ["Operational Reports"],
  },
  underwriting: {
    dashboard: ["Underwriting Dashboard", "Executive Dashboard"],
    "product configurator": [
      "Dashboard",
      "Product Templates",
      "Coverage Builder",
      "Rating Engine",
      "Underwriting Rules",
      "Document Manager",
      "Approval Workflows",
      "Market Mapping",
      "Risk Mapping",
      "Product Analytics",
    ],
    operations: OPERATIONS_ALL,
    reinsurance: [
      "Treaty Dashboard",
      "Cession Tracking",
      "Claims Recovery",
      "Reconciliation",
      "Analytics",
    ],
    reports: ["Operational Reports"],
  },
  "customer-services": {
    dashboard: ["Executive Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: OPERATIONS_ALL,
    reports: ["Operational Reports"],
  },
  claims: {
    dashboard: ["Claims Dashboard"],
    operations: ["Home", "Clients", "Policy", "Claims"],
    reinsurance: ["Claims Recovery"],
    reports: ["Operational Reports"],
  },
  finance: {
    dashboard: ["Executive Dashboard"],
    operations: ["Open Items", "Payments"],
    accounts: [
      "Receipts",
      "Collections",
      "Accounting Query",
      "All Clients Accounting",
      "Open Entry Matching",
      "Open Entry Un-Matching",
      "Disbursement",
      "Petty Cash",
      "Journal Voucher",
      "Correction JV",
      "Reversal JV",
      "Remittance",
      "Incentive",
    ],
    commission: ["Commission Dashboard", "Agents/Referrer Accounts"],
    reinsurance: ["Reconciliation"],
    reports: ["Financial Reports", "Operational Reports"],
  },
  agent: {
    dashboard: ["Agent Dashboard"],
    operations: ["Home", "Leads/Prospects", "Clients", "Quotation", "Policy", "Claims", "Renewals"],
    commission: ["Commission Dashboard"],
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

/** True when one role may open a second-level item of a top-level menu. */
export const checkSubmenuAccess = (role, menuName, submenu) => {
  const perms = roleMenuPermissions[norm(role)];
  if (!perms) return false;
  if (perms.all) return true;
  const allowed = perms[norm(menuName)];
  if (!Array.isArray(allowed)) return false;
  const name = norm(typeof submenu === "object" ? submenu.name : submenu);
  return allowed.some((a) => norm(a) === name);
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
      const submenu = menu.submenu.filter((item) =>
        list.some((r) => checkSubmenuAccess(r, menu.name, item.name))
      );
      return submenu.length ? { ...menu, submenu } : null;
    })
    .filter(Boolean);
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
