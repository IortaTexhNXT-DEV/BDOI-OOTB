import { isPathAllowed, filterMenuForRoles, firstAllowedPath } from "./menuPermissions";
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
  it("accounting reaches incentives", () => {
    expect(isPathAllowed("/incentive/statement", walkMenu, ["accounting"])).toBe(true);
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
    expect(items(["system-admin"])).toEqual(["Prospects", "Quick Quote", "Request for Quotation", "Quotations", "Placement Slips",
      "Lead Assignment", "Dealer Programmes", "Comparison Reports", "Campaigns", "Sales Activities"]);
    for (const role of ["sales", "operations"]) expect(items([role])).toHaveLength(10);
  });
  it("the Processing Team works the market side but does not create quick quotes; claims has no sales menu", () => {
    expect(items(["processing"])).toEqual(["Prospects", "Request for Quotation", "Quotations", "Placement Slips", "Dealer Programmes", "Comparison Reports", "Sales Activities"]);
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

describe("menu structure", () => {
  const depth = (items) => Math.max(0, ...(items || []).map((i) => 1 + depth(i.submenu)));
  const all = (items) => (items || []).flatMap((i) => [i, ...all(i.submenu)]);

  it("is at most three levels deep, with icons on the top level only", () => {
    expect(depth(menuList)).toBeLessThanOrEqual(3);
    for (const top of menuList) {
      expect(typeof top.icon).toBe("string");
      for (const inner of all(top.submenu)) expect(inner.icon).toBeUndefined();
    }
  });
  it("Master holds sections of screens, no deeper groups", () => {
    const master = menuList.find((m) => m.name === "Master");
    for (const section of master.submenu) {
      expect(section.section).toBe(true);
      for (const screen of section.submenu) expect(screen.submenu).toBeUndefined();
    }
  });
  it("My Work is the first top-level entry of every delivered role, not inside Operations", () => {
    expect(menuList[0].name).toBe("My Work");
    expect(menuList.find((m) => m.name === "Operations").submenu.map((i) => i.name)).not.toContain("My Work");
    expect(menuList.map((m) => m.name)).not.toContain("Home");
    // the Accounting Manager inherits Accounting: the server returns both roles
    for (const roles of [["sales"], ["processing"], ["operations"], ["claims"], ["accounting"], ["accounting", "accounting-manager"], ["system-admin"]]) {
      expect(filterMenuForRoles(menuList, roles).map((m) => m.name)).toContain("My Work");
      expect(isPathAllowed("/my-work", menuList, roles)).toBe(true);
      expect(isPathAllowed("/agent/home", menuList, roles)).toBe(true);
      expect(isPathAllowed("/", menuList, roles)).toBe(true);
    }
  });
  it("every role lands on My Work (with the role preset) after sign-in", () => {
    for (const role of ["sales", "claims", "accounting", "system-admin"]) {
      expect(firstAllowedPath(menuList, [role])).toBe("/my-work");
    }
    // an entry marked landing: false is taken only when nothing else is open
    const withLanding = [{ name: "My Work", path: "/my-work", landing: false, includes: ["/my-work"] }, { name: "Dashboard", submenu: [{ name: "Claims Dashboard", path: "/claims/dashboard" }] }];
    expect(firstAllowedPath(withLanding, ["claims"])).toBe("/claims/dashboard");
    expect(firstAllowedPath(withLanding.slice(0, 1), ["claims"])).toBe("/my-work");
  });
  it("the Master sections keep the grants of Accounting and Operations", () => {
    for (const p of ["/master/finance/taxation", "/master/finance/posting-rules"]) {
      expect(isPathAllowed(p, menuList, ["accounting"])).toBe(true);
    }
    expect(isPathAllowed("/master/insurance/channels", menuList, ["operations"])).toBe(true);
    expect(isPathAllowed("/master/generals/usermanagement/user", menuList, ["operations"])).toBe(false);
  });
});

describe("Accounts > Remittance (R1)", () => {
  const remittanceOf = (roles) => {
    const accounts = filterMenuForRoles(menuList, roles).find((m) => m.name === "Accounts");
    return accounts?.submenu.find((s) => s.name === "Remittance")?.submenu.map((i) => i.name) || [];
  };

  it("has the eight entries and Settlement, in that order, and no screen of earlier releases", () => {
    expect(remittanceOf(["accounting"])).toEqual(["Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Held policies", "Insurer billing", "Setup", "Settlement"]);
    expect(JSON.stringify(menuList)).not.toMatch(/"\/finance\/remittance\/(automated|tracking|scheduling|electronictransfer|approval"|agencybill|analytics)/);
  });

  it("an item grant (Remittance > Reconciliation) keeps only that entry and guards the others", () => {
    expect(remittanceOf(["tis-ccd-bp"])).toEqual(["Remittances", "Reconciliation", "Exceptions", "Held policies"]);
    expect(isPathAllowed("/finance/remittance/reconciliation/statements/12", menuList, ["tis-ccd-bp"])).toBe(true);
    expect(isPathAllowed("/finance/remittance/setup/schedules", menuList, ["tis-ccd-bp"])).toBe(false);
    expect(isPathAllowed("/finance/remittance/approvals", menuList, ["tis-ccd-bp"])).toBe(false);
  });

  it("leaves the landing and the retired addresses open, so they can send the user on", () => {
    expect(isPathAllowed("/finance/remittance", menuList, ["tis-ccd-bp"])).toBe(true);
    expect(isPathAllowed("/finance/remittance/scheduling", menuList, ["tis-ccd-bp"])).toBe(true);
  });
});
