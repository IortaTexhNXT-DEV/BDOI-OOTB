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
  it("allows finance into accounts", () => {
    expect(isPathAllowed("/accounts/journalvoucher", menu, ["finance"])).toBe(true);
  });
  it("leaves paths outside the menu open (profile, detail pages)", () => {
    expect(isPathAllowed("/profile", menu, ["sales"])).toBe(true);
  });
  it("gives administrators everything", () => {
    expect(filterMenuForRoles(menu, ["it-admin"])).toHaveLength(3);
  });
});

describe("persona walk: menu grants match the API (D100-D104)", () => {
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

  it("agents renew their own policies but do not get the renewals workspace", () => {
    expect(isPathAllowed("/agent/expired-policies", walkMenu, ["agent"])).toBe(true);
    for (const p of ["/agent/renewal-batch", "/renewal/queue", "/renewal/analytics"]) {
      expect(isPathAllowed(p, walkMenu, ["agent"])).toBe(false);
    }
  });
  it("finance reaches incentives and reinsurance reconciliation", () => {
    expect(isPathAllowed("/incentive/statement", walkMenu, ["finance"])).toBe(true);
    expect(isPathAllowed("/reinsurance/reconciliation", walkMenu, ["finance"])).toBe(true);
  });
  it("finance gets the finance reports and the catalogue, not the production register", () => {
    expect(isPathAllowed("/reports/catalogue", walkMenu, ["finance"])).toBe(true);
    expect(isPathAllowed("/reports/run/trial-balance", walkMenu, ["finance"])).toBe(true);
    expect(isPathAllowed("/reports/operationalreports/remittance", walkMenu, ["finance"])).toBe(true);
    expect(isPathAllowed("/reports/operationalreports/production", walkMenu, ["finance"])).toBe(false);
    expect(isPathAllowed("/reports/catalogue", walkMenu, ["agent"])).toBe(false);
  });
});

describe("bank reconciliation menu", () => {
  it("finance (and the finance manager through inheritance) reaches the workspace, runs, reports and masters; sales does not", () => {
    for (const p of ["/accounts/bank-reconciliation", "/accounts/bank-reconciliation/reconciliations", "/accounts/bank-reconciliation/reports/bank-book",
      "/master/finance/bank-statement-formats", "/master/finance/bank-transaction-types"]) {
      expect(isPathAllowed(p, menuList, ["finance"])).toBe(true);
      expect(isPathAllowed(p, menuList, ["sales"])).toBe(false);
    }
  });
});
