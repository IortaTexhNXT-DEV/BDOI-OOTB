/** A small GET /access-control/role-access answer for the Role Permissions tests. */
const perm = (code, area, module, level, meaning, extra = {}) => ({ code, area, module, level, meaning, checked: true, baseline: false, ...extra });

export const catalogue = {
  areas: [
    { code: "sales", name: "Sales & Marketing", order: 1 },
    { code: "accounts", name: "Accounts", order: 3 },
    { code: "basic", name: "Basic and special access", order: 9 },
  ],
  modules: [
    { code: "quotations", area: "sales", name: "Quotations and placement", screens: ["Quick Quote", "Placement Slips"], order: 2, levels: ["view", "edit", "approve"] },
    { code: "campaigns", area: "sales", name: "Marketing campaigns", screens: ["Campaigns"], order: 5, levels: ["view", "edit"] },
    { code: "receipts", area: "accounts", name: "Receipts", screens: ["Receipts", "Post-Dated Cheques"], order: 14, levels: ["view", "edit"] },
    { code: "bank-reconciliation", area: "accounts", name: "Bank reconciliation", screens: ["Bank Reconciliation"], order: 21, levels: ["view", "edit", "approve"] },
    { code: "profile", area: "basic", name: "Basic access", screens: ["My Profile"], order: 39, levels: ["view"] },
    { code: "pii", area: "basic", name: "Full personal data", screens: [], order: 41, levels: ["special"] },
  ],
  permissions: [
    perm("read:quotations", "sales", "quotations", "view", "See quotations"),
    perm("write:quotations", "sales", "quotations", "edit", "Create quotations"),
    perm("approve:quotations", "sales", "quotations", "approve", "Approve a quotation created by another user"),
    perm("read:campaigns", "sales", "campaigns", "view", "See campaigns"),
    perm("write:campaigns", "sales", "campaigns", "edit", "Prepare and send campaigns"),
    perm("read:receipts", "accounts", "receipts", "view", "See receipts and post-dated cheques"),
    perm("write:receipts", "accounts", "receipts", "edit", "Issue official receipts"),
    perm("read:bank-reconciliation", "accounts", "bank-reconciliation", "view", "See bank reconciliations"),
    perm("write:bank-reconciliation", "accounts", "bank-reconciliation", "edit", "Prepare bank reconciliations"),
    perm("approve:bank-reconciliation", "accounts", "bank-reconciliation", "approve", "Approve and reopen bank reconciliations"),
    perm("read:profile", "basic", "profile", "view", "Own profile", { baseline: true }),
    perm("write:profile", "basic", "profile", "edit", "Not used by any screen", { checked: false }),
    perm("view:pii", "basic", "pii", "special", "See personal data unmasked"),
  ],
  levels: [{ code: "view", name: "View" }, { code: "edit", name: "Create and edit" }, { code: "approve", name: "Approve" }, { code: "special", name: "Special" }],
};

const role = (code, name, extra = {}) => ({
  id: extra.id || 1, code, name, description: "", summary: null, status: "active", inherits: [], department: null, order: 0, platform: false, fullAccess: false, includedBy: [],
  users: { active: 1, inactive: 0 }, own: ["read:profile"], included: {}, pending: null, editBlocked: null, ...extra,
});

export const pendingChange = {
  id: 12, ref: "CFG-12", kind: "role-access", kindLabel: "Role access", target: "tis-finance", targetLabel: "TIS Finance & General Accounting",
  summary: ["Added: Accounts › Bank reconciliation › Approve", "Removed: Accounts › Receipts › View"], payload: { grant: ["approve:bank-reconciliation"], revoke: ["read:receipts"],
    reasonCode: "ACC-REDESIGN", reason: "Role redesign", warnings: [] }, changeNote: "Role redesign", status: "pending", requestedBy: "Maria Cruz", requestedById: "usr_2",
  requestedAt: "2026-10-09T02:15:00Z", canDecide: true, canWithdraw: true, link: "/master/generals/usermanagement/role-permissions?view=pending&change=12",
};

export const overview = () => ({
  asOf: "2026-10-09",
  approval: true,
  catalogue,
  departments: [{ name: "Sales", order: 1 }, { name: "Cash Control", order: 3 }, { name: "Finance and Accounting", order: 4 }, { name: "IT", order: 5 }],
  roles: [
    role("tis-sales-associate", "TIS Sales Associate", { id: 8, department: "Sales", order: 100, users: { active: 12, inactive: 1 }, own: ["read:profile", "read:quotations", "write:quotations"] }),
    role("tis-sales-officer", "TIS Sales Officer", { id: 9, department: "Sales", order: 101, users: { active: 5, inactive: 0 },
      own: ["read:profile", "read:quotations", "write:quotations", "approve:quotations", "read:campaigns", "write:campaigns", "view:pii"] }),
    role("tis-ccd-bp", "CCD-BP / QRPh (Receipting)", { id: 16, department: "Cash Control", order: 300, own: ["read:profile", "read:receipts", "write:receipts"] }),
    role("tis-finance", "TIS Finance & General Accounting", { id: 18, department: "Finance and Accounting", order: 400, users: { active: 6, inactive: 0 },
      own: ["read:profile", "read:receipts", "read:bank-reconciliation", "write:bank-reconciliation"], pending: pendingChange, editBlocked: "pending" }),
    role("tis-it-admin", "TIS IT AppSupport / Admin", { id: 19, department: "IT", order: 500, users: { active: 2, inactive: 0 }, editBlocked: "own-role" }),
    role("tis-superid", "SUPERID (UAT only)", { id: 21, department: "IT", order: 501, inherits: ["system-admin"], fullAccess: true, editBlocked: "full-access" }),
    role("system-admin", "System Administrator (Super Admin Access)", { id: 1, platform: true, order: 100001, fullAccess: true, includedBy: ["tis-superid"], editBlocked: "full-access" }),
    role("accounting", "Accounting", { id: 6, platform: true, order: 100006, own: ["read:profile", "read:receipts", "write:receipts"], includedBy: ["accounting-manager"] }),
    role("accounting-manager", "Accounting Manager", { id: 7, platform: true, order: 100007, inherits: ["accounting"], own: ["read:profile", "approve:bank-reconciliation"],
      included: { "read:receipts": "accounting", "write:receipts": "accounting" } }),
  ],
  pendingCount: 1,
  abilities: { edit: true, approve: true },
});
