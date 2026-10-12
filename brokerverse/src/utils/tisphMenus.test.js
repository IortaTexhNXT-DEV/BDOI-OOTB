import fs from "fs";
import path from "path";
import { filterMenuForRoles, isPathAllowed, meetsRequires, roleMenuPermissions } from "./menuPermissions";
import { menuList } from "../components/SideBar/list";
import { helpSectionFor } from "../components/HelpPanel/helpRoutes";
import { flattenLeaves } from "../components/SideBar/menuTree";
import { requiresOf } from "../components/SideBar/requires";
import rolePermissions from "./tisphRolePermissions.json";

const TIS_ROLES = ["tis-sales-associate", "tis-sales-officer", "tis-sales-unit-head", "tis-ops-associate", "tis-ops-officer", "tis-ops-unit-head", "tis-ccd-pdu",
  "tis-ccd-pdc", "tis-ccd-bp", "tis-ccd-recon", "tis-finance", "tis-it-admin", "tis-general-manager", "tis-auditor"];
const norm = (s) => String(s).trim().toLowerCase();

/** A grant ("Item", "Group > Item") that names no screen of the menu. */
const deadGrants = (role) => Object.entries(roleMenuPermissions[role]).flatMap(([top, grants]) => {
  const menu = menuList.find((m) => norm(m.name) === top);
  if (!menu) return [`${role}: ${top}`];
  if (grants === true) return [];
  return grants.filter((g) => {
    let items = menu.submenu || [];
    for (const part of g.split(">").map(norm)) {
      const hit = items.find((i) => norm(i.name) === part);
      if (!hit) return true;
      items = hit.submenu || [];
    }
    return false;
  }).map((g) => `${role}: ${top} > ${g}`);
});

describe("TISPH roles (RBAC v4): menus", () => {
  it("every TIS persona has menus, and each grant names a screen of the menu", () => {
    expect(TIS_ROLES.filter((role) => !filterMenuForRoles(menuList, [role]).length)).toEqual([]);
    expect(TIS_ROLES.flatMap(deadGrants)).toEqual([]);
  });

  it("Sales and Operations both reach quotations, placement slips, policies and renewals", () => {
    const refused = ["tis-sales-associate", "tis-sales-officer", "tis-ops-associate", "tis-ops-unit-head"].flatMap((role) =>
      ["/agent/Quotation", "/placement/placement-slips", "/agent/policy", "/renewal/queue", "/operations/policy-cancellation"]
        .filter((p) => !isPathAllowed(p, menuList, [role])).map((p) => `${role} ${p}`));
    expect(refused).toEqual([]);
    expect(isPathAllowed("/agent/claim", menuList, ["tis-ops-associate"])).toBe(true);
    expect(isPathAllowed("/agent/claim/documents", menuList, ["tis-sales-officer"])).toBe(false);
  });

  it("Sales associates and officers open their own incentive programs and statement, not the calculations", () => {
    for (const role of ["tis-sales-associate", "tis-sales-officer"]) {
      expect(isPathAllowed("/incentive/my-programs", menuList, [role])).toBe(true);
      expect(isPathAllowed("/incentive/statement", menuList, [role])).toBe(true);
      expect(["/incentive/calculations", "/incentive/approvals", "/incentive/reports"].filter((p) => isPathAllowed(p, menuList, [role]))).toEqual([]);
    }
  });

  it("Cash Control sees its cash screens only; Finance the accounting menus with the audit trail", () => {
    expect(isPathAllowed("/accounts/post-dated-cheques", menuList, ["tis-ccd-pdu"])).toBe(true);
    expect(isPathAllowed("/accounts/journalvoucher", menuList, ["tis-ccd-pdu"])).toBe(false);
    expect(isPathAllowed("/accounts/bank-reconciliation", menuList, ["tis-ccd-recon"])).toBe(true);
    expect(isPathAllowed("/accounts/bank-reconciliation", menuList, ["tis-ccd-pdu"])).toBe(false);
    expect(isPathAllowed("/agent/policy", menuList, ["tis-ccd-bp"])).toBe(false);
    // the insurer's claim settlement funds are banked by Cash Control
    expect(isPathAllowed("/accounts/claims-settlements", menuList, ["tis-ccd-bp"])).toBe(true);
    expect(["/accounts/journalvoucher", "/accounts/period-end/close", "/master/configuration/audit-trail"].filter((p) => !isPathAllowed(p, menuList, ["tis-finance"]))).toEqual([]);
  });

  it("the IT administrator reaches users, roles and masters; SUPERID (System Administrator included) sees every menu", () => {
    expect(["/master/generals/usermanagement/user", "/master/generals/usermanagement/role", "/master/insurance/lead-sources", "/master/insurance/reason-codes",
      "/master/configuration/settings"].filter((p) => !isPathAllowed(p, menuList, ["tis-it-admin"]))).toEqual([]);
    expect(isPathAllowed("/master/generals/usermanagement/user", menuList, ["tis-general-manager"])).toBe(true);
    expect(isPathAllowed("/master/configuration/settings", menuList, ["tis-general-manager"])).toBe(false);
    // every menu but the platform section of the iorta TechNXT platform administrator (features and releases)
    const tenantMenu = menuList.map((m) => (m.submenu ? { ...m, submenu: m.submenu.filter((s) => !s.platform) } : m));
    expect(filterMenuForRoles(menuList, ["tis-superid", "system-admin"])).toEqual(tenantMenu);
  });

  it("Data Migration & Go-Live opens to the roles of the migration and to the auditor, every tab by its address", () => {
    const tabs = ["", "/templates", "/loads", "/loads/12", "/reconciliation", "/reconciliation/7", "/runs", "/runs/3", "/cutover", "/decision", "/hypercare"]
      .map((p) => `/master/configuration/go-live${p}`);
    for (const role of ["tis-it-admin", "tis-finance", "tis-ops-unit-head", "tis-general-manager", "tis-auditor"]) {
      expect(tabs.filter((p) => !isPathAllowed(p, menuList, [role])).map((p) => `${role} ${p}`)).toEqual([]);
    }
    for (const role of ["tis-ops-associate", "tis-ops-officer", "tis-sales-officer", "tis-ccd-recon"]) {
      expect(isPathAllowed("/master/configuration/go-live/loads", menuList, [role])).toBe(false);
    }
    // the auditor sees the workspace and the audit trail, and nothing else
    expect(filterMenuForRoles(menuList, ["tis-auditor"]).map((m) => m.name)).toEqual(["Master"]);
    expect(isPathAllowed("/master/configuration/audit-trail", menuList, ["tis-auditor"])).toBe(true);
    expect(isPathAllowed("/master/configuration/settings", menuList, ["tis-auditor"])).toBe(false);
    expect(helpSectionFor("/master/configuration/go-live/loads/12").matched).toBe(true);
  });

  it("the Lead Sources and Reason Codes masters have their manual section", () => {
    expect(isPathAllowed("/master/insurance/lead-sources", menuList, ["tis-sales-officer"])).toBe(false);
    expect(helpSectionFor("/master/insurance/lead-sources").id).toBe("lead-sources-and-reason-codes");
    expect(helpSectionFor("/master/insurance/reason-codes").id).toBe("lead-sources-and-reason-codes");
  });

  it("shows a persona only the screens its permissions open: no campaigns or quick quote (no TISPH requirement), no maker or unread screens for IT", () => {
    const ops = ["tis-ops-associate", "tis-ops-officer", "tis-ops-unit-head"];
    expect(ops.filter((role) => isPathAllowed("/sales/campaigns", menuList, [role]))).toEqual([]);
    expect(ops.filter((role) => !isPathAllowed("/sales/activities", menuList, [role]) || !isPathAllowed("/operations/fleet-schedules", menuList, [role]))).toEqual([]);
    expect(isPathAllowed("/sales/campaigns", menuList, ["tis-sales-officer"])).toBe(false);
    expect(isPathAllowed("/sales/quick-quote", menuList, ["tis-sales-officer"])).toBe(false);
    expect(["/sales/quick-quote", "/sales/campaigns", "/sales/activities", "/operations/fleet-schedules", "/operations/open-covers"]
      .filter((p) => isPathAllowed(p, menuList, ["tis-it-admin"]))).toEqual([]);
    expect(["/agent/leadlisting", "/agent/Quotation", "/agent/clientlisting", "/agent/policy", "/agent/claim"].filter((p) => !isPathAllowed(p, menuList, ["tis-it-admin"]))).toEqual([]);
  });

  it("System Configuration offers the e-mail and document layouts and the signatures, without the theme editor, System Settings or Data Privacy", () => {
    const master = menuList.find((m) => m.name === "Master");
    const system = master.submenu.find((s) => s.name === "System Configuration").submenu.map((i) => i.name);
    expect(system).toEqual(expect.arrayContaining(["E-mail Layout", "Documents and Reports Layout", "Document Signatures", "Configuration"]));
    expect(system).not.toContain("System Settings");
    expect(JSON.stringify(menuList)).not.toContain("/master/configuration/system-settings");
    expect(filterMenuForRoles(menuList, ["tis-superid"]).some((m) => JSON.stringify(m).includes("system-settings"))).toBe(false);
    // no route, help link or configuration link leads to the withdrawn screen
    for (const file of ["../routes/MainRoute.js", "../components/HelpPanel/helpRoutes.js", "../module/Administration/configuration/catalog.js"]) {
      expect(fs.readFileSync(path.join(__dirname, file), "utf8")).not.toContain("configuration/system-settings");
    }
    expect(master.submenu.map((s) => s.name)).not.toContain("Data Privacy");
    expect(master.submenu.map((s) => s.name)).not.toContain("Go-Live and Data");
    const layouts = ["/master/configuration/email-layout", "/master/configuration/documents-layout", "/master/configuration/document-signatures"];
    expect(layouts.filter((p) => !isPathAllowed(p, menuList, ["tis-it-admin"]))).toEqual([]);
    expect(layouts.filter((p) => isPathAllowed(p, menuList, ["tis-general-manager"]) || isPathAllowed(p, menuList, ["tis-ops-unit-head"]))).toEqual([]);
    expect(layouts.map((p) => helpSectionFor(p).matched)).toEqual([true, true, true]);
  });

  it("journal vouchers and disbursements are Finance work; incentives are approved by the Sales Unit Head and the General Manager (TISPH decision)", () => {
    for (const role of ["tis-ops-associate", "tis-ops-officer", "tis-ops-unit-head", "tis-sales-unit-head"]) {
      expect(isPathAllowed("/accounts/journalvoucher", menuList, [role])).toBe(false);
      expect(isPathAllowed("/accounts/paymentvoucher", menuList, [role])).toBe(false);
    }
    expect(["/accounts/journalvoucher", "/accounts/paymentvoucher"].filter((p) => !isPathAllowed(p, menuList, ["tis-finance"]))).toEqual([]);
    expect(isPathAllowed("/incentive/approvals", menuList, ["tis-ops-unit-head"])).toBe(false);
    expect(isPathAllowed("/incentive/calculations", menuList, ["tis-ops-unit-head"])).toBe(true);
    for (const role of ["tis-sales-unit-head", "tis-general-manager"]) expect(isPathAllowed("/incentive/approvals", menuList, [role])).toBe(true);
  });

  it("the servicing roles that raise endorsements have the Endorsements work list; Cash Control does not", () => {
    for (const role of ["tis-sales-officer", "tis-ops-associate", "tis-ops-unit-head", "tis-general-manager", "tis-finance"]) {
      expect(isPathAllowed("/operations/endorsements", menuList, [role])).toBe(true);
      expect(isPathAllowed("/agent/endorsement/summary/end_1", menuList, [role])).toBe(true);
    }
    expect(isPathAllowed("/operations/endorsements", menuList, ["tis-ccd-bp"])).toBe(false);
  });

  describe("Accounts > Remittance (spec §1.1 to §1.3)", () => {
    const ALL = ["Insurer billing", "Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Held policies", "Settlement", "Setup"];
    const remittanceOf = (role) => {
      const accounts = filterMenuForRoles(menuList, [role]).find((m) => m.name === "Accounts");
      return accounts?.submenu.find((s) => s.name === "Remittance")?.submenu.map((i) => i.name) || [];
    };
    const sees = (role) => (path) => isPathAllowed(path, menuList, [role]);

    it("Finance sees the eight entries plus Settlement; IT reads them all", () => {
      expect(remittanceOf("tis-finance")).toEqual(ALL);
      expect(remittanceOf("tis-it-admin")).toEqual(ALL);
    });

    it("gives each persona the entries of its grants", () => {
      expect(remittanceOf("tis-general-manager")).toEqual(ALL.filter((e) => e !== "Setup"));
      expect(remittanceOf("tis-ccd-recon")).toEqual(["Insurer billing", "Remittances", "Approvals", "Insurer payments", "Reconciliation", "Exceptions", "Held policies"]);
      expect(remittanceOf("tis-ccd-bp")).toEqual(["Remittances", "Reconciliation", "Exceptions", "Held policies"]);
      expect(remittanceOf("tis-ccd-pdc")).toEqual(["Remittances", "Reconciliation", "Exceptions", "Held policies"]);
      expect(remittanceOf("tis-ops-associate")).toEqual(["Remittances"]);
      expect(remittanceOf("tis-ops-officer")).toEqual(["Insurer billing", "Remittances", "Exceptions", "Held policies"]);
      expect(remittanceOf("tis-ops-unit-head")).toEqual(["Insurer billing", "Remittances", "Exceptions", "Held policies"]);
      expect(remittanceOf("tis-ccd-pdu")).toEqual([]);
      expect(remittanceOf("tis-sales-officer")).toEqual([]);
      expect(sees("tis-general-manager")("/finance/remittance/setup/schedules")).toBe(false);
      expect(sees("tis-ccd-recon")("/finance/remittance/reconciliation/statements/7")).toBe(true);
      expect(sees("tis-ops-officer")("/finance/remittance/payments")).toBe(false);
    });

    it("the Insurer Reconciliation menu is merged into Remittance > Reconciliation, which opens its statements", () => {
      expect(isPathAllowed("/accounts/insurer-reconciliation/statements", menuList, ["tis-finance"])).toBe(true);
      expect(isPathAllowed("/accounts/insurer-reconciliation/statements", menuList, ["tis-sales-officer"])).toBe(false);
      const withIt = TIS_ROLES.filter((role) => filterMenuForRoles(menuList, [role]).find((m) => m.name === "Accounts")?.submenu.some((s) => s.name === "Insurer Reconciliation"));
      expect(withIt).toEqual([]);
      expect(helpSectionFor("/finance/remittance/reconciliation/insurer-statements").id).toBe("insurer-statement-reconciliation");
      expect(helpSectionFor("/finance/remittance/setup/schedules").id).toBe("remittance-schedules");
    });
  });

  it("opens the department and policy type masters only to the roles that see the Organization and Insurance Management masters", () => {
    for (const p of ["/master/finance/department", "/master/finance/department/departmentadding", "/master/generals/insurancemanagement/policytype",
      "/master/generals/insurancemanagement/policytype/edit/3"]) {
      expect(isPathAllowed(p, menuList, ["tis-it-admin"])).toBe(true);
      for (const role of TIS_ROLES.filter((r) => r !== "tis-it-admin")) expect(isPathAllowed(p, menuList, [role])).toBe(false);
    }
  });

  it("ships the TISPH edition of the user manual, with a chapter per role and a section for every screen of its menus", () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../../help.config.json"), "utf8"));
    const manual = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/help/sections.json"), "utf8"));
    expect(config.edition).toBe("tisph");
    expect(manual.edition).toBe("tisph");
    expect(manual.brandPack).toBe("toyota-insurance-services");
    const ids = new Set(manual.sections.map((s) => s.id));
    expect(Object.keys(manual.roles).sort()).toEqual([...TIS_ROLES].sort());
    expect(Object.values(manual.roles).filter((r) => !ids.has(r.id))).toEqual([]);
    const uncovered = TIS_ROLES.flatMap((role) => flattenLeaves(filterMenuForRoles(menuList, [role])).map((l) => l.item.path))
      .filter((p) => !ids.has(helpSectionFor(p, ids).id));
    expect([...new Set(uncovered)]).toEqual([]);
  });
});

// A role never sees an entry it cannot use: each entry it is shown loads with the permissions it holds (no refusal on
// opening), and its menu grants name no entry its permissions cannot load. The permissions are those of db/seed.js
// (tisphRolePermissions.json, kept equal by the back end's tisph-menu-permissions test).
describe("TISPH roles: every menu entry opens without a refusal", () => {
  const paths = (menu) => flattenLeaves(menu).map((l) => l.item.path).filter(Boolean);

  it("every screen of the menu states the permissions it needs to load", () => {
    expect(flattenLeaves(menuList).filter((l) => l.item.path && !requiresOf(l.item)).map((l) => l.item.path)).toEqual([]);
  });

  it("every entry a TIS role is shown loads with the role's permissions", () => {
    const refused = TIS_ROLES.flatMap((role) => flattenLeaves(filterMenuForRoles(menuList, [role], rolePermissions[role]))
      .filter((l) => l.item.path && !meetsRequires(requiresOf(l.item), rolePermissions[role])).map((l) => `${role} ${l.item.path}`));
    expect(refused).toEqual([]);
  });

  it("the menu grants of a TIS role give no entry its permissions cannot load", () => {
    const unusable = TIS_ROLES.flatMap((role) => {
      const usable = new Set(paths(filterMenuForRoles(menuList, [role], rolePermissions[role])));
      return paths(filterMenuForRoles(menuList, [role], null)).filter((p) => !usable.has(p)).map((p) => `${role} ${p}`);
    });
    expect(unusable).toEqual([]);
  });

  it("an address of an entry the permissions cannot load is refused", () => {
    expect(isPathAllowed("/agent/payments", menuList, ["tis-ccd-pdc"], rolePermissions["tis-ccd-pdc"])).toBe(true);
    expect(isPathAllowed("/agent/payments", menuList, ["tis-ccd-pdc"], ["read:pdc"])).toBe(false);
  });
});
