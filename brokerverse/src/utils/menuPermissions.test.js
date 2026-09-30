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

describe("finance control screens", () => {
  it("accounting and the accounting manager reach the insurer reconciliation, its formats, account determination and posting rules; sales does not", () => {
    for (const p of ["/accounts/insurer-reconciliation/statements", "/accounts/insurer-reconciliation/statements/isr_1", "/master/finance/insurer-statement-formats",
      "/master/finance/account-determination", "/master/finance/posting-rules", "/master/finance/configuration-approvals", "/master/finance/accounting-flow", "/accounts/credit-control/instalments", "/accounts/credit-control/warranty",
      "/accounts/credit-control/limits", "/accounts/credit-control/remittance-ageing"]) {
      expect(isPathAllowed(p, menuList, ["accounting"])).toBe(true);
      expect(isPathAllowed(p, menuList, ["accounting-manager", "accounting"])).toBe(true);
      expect(isPathAllowed(p, menuList, ["sales"])).toBe(false);
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

describe("Sales & Marketing menu", () => {
  const items = (roles) =>
    (filterMenuForRoles(menuList, roles).find((m) => m.name === "Operations")?.submenu || [])
      .find((i) => i.name === "Sales & Marketing")?.submenu.map((i) => i.name) || [];

  it("groups prospects, quick quote, requests for quotation, quotations and placement slips", () => {
    expect(items(["system-admin"])).toEqual(["Prospects", "Quick Quote", "Request for Quotation", "Quotations", "Placement Slips"]);
    for (const role of ["sales", "operations"]) expect(items([role])).toHaveLength(5);
  });
  it("the Processing Team works the market side but does not create quick quotes; claims has no sales menu", () => {
    expect(items(["processing"])).toEqual(["Prospects", "Request for Quotation", "Quotations", "Placement Slips"]);
    expect(isPathAllowed("/sales/quick-quote", menuList, ["processing"])).toBe(false);
    expect(items(["claims"])).toEqual([]);
  });
  it("keeps the old addresses working", () => {
    for (const p of ["/agent/leadlisting", "/agent/createlead/fire-allied-perils", "/agent/quotedetailview/qt_1", "/agent/Quotation",
      "/placement/broker-slips", "/placement/broker-slips/new", "/placement/placement-slips/plc_1", "/sales/quick-quote"]) {
      expect(isPathAllowed(p, menuList, ["sales"])).toBe(true);
    }
    expect(isPathAllowed("/placement/broker-slips/bs_1", menuList, ["processing"])).toBe(true);
    expect(isPathAllowed("/agent/leadlisting", menuList, ["claims"])).toBe(false);
  });
});

describe("bespoke placement menu", () => {
  const placementItems = (roles) =>
    (filterMenuForRoles(menuList, roles).find((m) => m.name === "Operations")?.submenu || [])
      .find((i) => i.name === "Placement")?.submenu.map((i) => i.name) || [];
  const masterItems = (roles) => (filterMenuForRoles(menuList, roles).find((m) => m.name === "Master")?.submenu || []).map((i) => i.name);

  it("the Processing Team and the administrator get every bespoke screen and the wording masters", () => {
    const all = ["Slip Composer", "Underwriter Room", "Layering & Co-insurance", "Facultative RI"];
    expect(placementItems(["system-admin"])).toEqual(all);
    expect(placementItems(["processing"])).toEqual(all);
    expect(masterItems(["processing"])).toEqual(["Clause Library", "Slip Templates"]);
    for (const p of ["/placement/bespoke/composer/csl_1", "/placement/bespoke/rooms/uwr_1", "/master/placement/clause-library", "/master/placement/slip-templates"]) {
      expect(isPathAllowed(p, menuList, ["processing"])).toBe(true);
    }
  });
  it("Operations composes slips, runs rooms and keeps layers, and reads the clause library", () => {
    expect(placementItems(["operations"])).toEqual(["Slip Composer", "Underwriter Room", "Layering & Co-insurance"]);
    expect(masterItems(["operations"])).toEqual(["Clause Library"]);
    expect(isPathAllowed("/placement/bespoke/facultative", menuList, ["operations"])).toBe(false);
    expect(isPathAllowed("/master/placement/slip-templates", menuList, ["operations"])).toBe(false);
  });
  it("Accounting and the Accounting Manager reconcile layers and settle facultative binders", () => {
    for (const roles of [["accounting"], ["accounting-manager", "accounting"]]) {
      expect(placementItems(roles)).toEqual(["Layering & Co-insurance", "Facultative RI"]);
      expect(isPathAllowed("/placement/bespoke/facultative/fac_1", menuList, roles)).toBe(true);
      expect(isPathAllowed("/placement/bespoke/composer", menuList, roles)).toBe(false);
    }
  });
  it("sales and claims do not see the bespoke screens", () => {
    for (const role of ["sales", "claims"]) {
      expect(placementItems([role])).toEqual([]);
      expect(isPathAllowed("/placement/bespoke/layering", menuList, [role])).toBe(false);
    }
  });
});
