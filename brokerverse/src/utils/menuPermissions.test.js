import { isPathAllowed, filterMenuForRoles } from "./menuPermissions";
import { menuList } from "../components/SideBar/list";

const menu = [
  { name: "Dashboard", submenu: [{ name: "Executive Dashboard", path: "/", includes: ["/"] }] },
  { name: "Operations", submenu: [{ name: "Policy", path: "/agent/policy", includes: ["/agent/policy"] }] },
  { name: "Accounts", submenu: [{ name: "Journal Voucher", path: "/accounts/journalvoucher", includes: ["/accounts/journalvoucher/addjournalvoucture"] }] },
];

describe("route guard", () => {
  it("does not let the home route '/' open every screen", () => {
    expect(isPathAllowed("/accounts/journalvoucher", menu, ["sales"])).toBe(false);
    expect(isPathAllowed("/accounts/journalvoucher/addjournalvoucture", menu, ["sales"])).toBe(false);
  });
  it("allows the role's own screens and the home route", () => {
    expect(isPathAllowed("/", menu, ["sales"])).toBe(true);
    expect(isPathAllowed("/agent/policy", menu, ["sales"])).toBe(true);
  });
  it("allows accounting into accounts", () => {
    expect(isPathAllowed("/accounts/journalvoucher", menu, ["accounting"])).toBe(true);
  });
  it("leaves paths outside the menu open (profile, detail pages)", () => {
    expect(isPathAllowed("/profile", menu, ["sales"])).toBe(true);
  });
  it("gives administrators everything", () => {
    expect(filterMenuForRoles(menu, ["system-admin"])).toHaveLength(3);
  });
});

describe("persona walk: menu grants match the API", () => {
  const walkMenu = [
    {
      name: "Operations",
      submenu: [
        {
          name: "Renewals",
          submenu: [
            { name: "Renewal Policy", path: "/agent/expired-policies", includes: ["/agent/expired-policies"] },
            { name: "Renewal Batch", path: "/agent/renewal-batch", includes: ["/agent/renewal-batch"] },
            { name: "Renewal Queue", path: "/renewal/queue", includes: ["/renewal/queue"] },
            { name: "Retention Analytics", path: "/renewal/analytics", includes: ["/renewal/analytics"] },
          ],
        },
      ],
    },
    {
      name: "Accounts",
      submenu: [{ name: "Incentive", submenu: [{ name: "Statement", path: "/incentive/statement", includes: ["/incentive/statement"] }] }],
    },
    { name: "Reinsurance", submenu: [{ name: "Reconciliation", path: "/reinsurance/reconciliation", includes: ["/reinsurance/reconciliation"] }] },
    {
      name: "Reports",
      submenu: [
        { name: "All Reports", path: "/reports/catalogue", includes: ["/reports/catalogue", "/reports/run/"] },
        {
          name: "Operational Reports",
          submenu: [
            { name: "Production", path: "/reports/operationalreports/production", includes: ["/reports/operationalreports/production"] },
            { name: "Remittance", path: "/reports/operationalreports/remittance", includes: ["/reports/operationalreports/remittance"] },
          ],
        },
      ],
    },
  ];

  it("operations and processing get the renewals workspace; accounting does not", () => {
    for (const role of ["operations", "processing", "sales"]) {
      expect(isPathAllowed("/renewal/queue", walkMenu, [role])).toBe(true);
    }
    expect(isPathAllowed("/renewal/queue", walkMenu, ["accounting"])).toBe(false);
  });
  it("accounting reaches incentives and reinsurance reconciliation", () => {
    expect(isPathAllowed("/incentive/statement", walkMenu, ["accounting"])).toBe(true);
    expect(isPathAllowed("/reinsurance/reconciliation", walkMenu, ["accounting"])).toBe(true);
  });
  it("accounting gets the financial reports and the catalogue, not the production register", () => {
    expect(isPathAllowed("/reports/catalogue", walkMenu, ["accounting"])).toBe(true);
    expect(isPathAllowed("/reports/run/trial-balance", walkMenu, ["accounting"])).toBe(true);
    expect(isPathAllowed("/reports/operationalreports/remittance", walkMenu, ["accounting"])).toBe(true);
    expect(isPathAllowed("/reports/operationalreports/production", walkMenu, ["accounting"])).toBe(false);
  });
  it("the Accounting Manager (accounting-manager + inherited accounting) gets the accounting menu", () => {
    expect(isPathAllowed("/incentive/statement", walkMenu, ["accounting-manager", "accounting"])).toBe(true);
  });
  it("withdrawn role codes (a token issued before the rename) grant nothing", () => {
    for (const old of ["it-admin", "ba", "user-access-admin", "underwriting", "customer-services", "finance", "finance-manager", "agent"]) {
      expect(filterMenuForRoles(walkMenu, [old])).toEqual([]);
    }
  });
});

describe("bank reconciliation menu", () => {
  it("accounting (and the accounting manager through inheritance) reaches the workspace, runs, reports and masters; sales does not", () => {
    for (const p of ["/accounts/bank-reconciliation", "/accounts/bank-reconciliation/reconciliations", "/accounts/bank-reconciliation/reports/bank-book",
      "/master/finance/bank-statement-formats", "/master/finance/bank-transaction-types"]) {
      expect(isPathAllowed(p, menuList, ["accounting"])).toBe(true);
      expect(isPathAllowed(p, menuList, ["sales"])).toBe(false);
    }
  });
});
