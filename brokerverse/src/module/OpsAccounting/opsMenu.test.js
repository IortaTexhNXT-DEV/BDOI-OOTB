import { isPathAllowed } from "../../utils/menuPermissions";
import { menuList } from "../../components/SideBar/list";
import { helpSectionFor } from "../../components/HelpPanel/helpRoutes";

describe("operations and accounting screens: menu grants match the API permissions", () => {
  it("Sales, Processing and Operations issue cover notes and cancel policies; Accounting does not", () => {
    for (const role of ["sales", "processing", "operations"]) {
      expect(isPathAllowed("/operations/cover-notes", menuList, [role])).toBe(true);
      expect(isPathAllowed("/operations/policy-cancellation", menuList, [role])).toBe(true);
    }
    expect(isPathAllowed("/operations/cover-notes", menuList, ["accounting"])).toBe(false);
  });
  it("Claims works the claim documents, motor repairs and their masters", () => {
    expect(isPathAllowed("/agent/claim/documents", menuList, ["claims"])).toBe(true);
    expect(isPathAllowed("/agent/claim/motor-repairs", menuList, ["claims"])).toBe(true);
    expect(isPathAllowed("/master/insurance/repair-shops", menuList, ["claims"])).toBe(true);
    expect(isPathAllowed("/master/insurance/claim-document-checklist", menuList, ["claims"])).toBe(true);
    expect(isPathAllowed("/master/insurance/short-period-rates", menuList, ["claims"])).toBe(false);
  });
  it("Claim Documents and Motor Claim Repairs are tabs of Claims, kept to the roles granted them", () => {
    for (const role of ["claims", "tis-ops-associate", "tis-general-manager", "system-admin"]) {
      expect(isPathAllowed("/agent/claim/documents", menuList, [role])).toBe(true);
      expect(isPathAllowed("/agent/claim/motor-repairs", menuList, [role])).toBe(true);
    }
    // Sales and Operations read Claims but were never given the two screens: the tabs stay closed to them
    for (const role of ["sales", "operations"]) {
      expect(isPathAllowed("/agent/claim", menuList, [role])).toBe(true);
      expect(isPathAllowed("/agent/claim/documents", menuList, [role])).toBe(false);
    }
    expect(isPathAllowed("/agent/claim/motor-repairs", menuList, ["tis-sales-officer"])).toBe(false);
  });
  it("Accounting reaches post-dated cheques, claims settlements, payables, fixed assets and asset classes", () => {
    for (const p of ["/accounts/post-dated-cheques", "/accounts/claims-settlements", "/accounts/payables/invoices", "/accounts/payables/suppliers", "/accounts/fixed-assets/register",
      "/accounts/fixed-assets/depreciation", "/master/finance/asset-classes"]) {
      expect(isPathAllowed(p, menuList, ["accounting"])).toBe(true);
    }
    expect(isPathAllowed("/accounts/payables/invoices", menuList, ["sales"])).toBe(false);
    expect(isPathAllowed("/master/insurance/short-period-rates", menuList, ["system-admin"])).toBe(true);
  });
  it("every new screen has its user manual section", () => {
    expect(helpSectionFor("/accounts/payables/ageing").id).toBe("accounts-payable");
    expect(helpSectionFor("/operations/cover-notes").id).toBe("cover-notes-binders");
    expect(helpSectionFor("/master/insurance/repair-shops").id).toBe("motor-claim-repairs-and-letters-of-authority");
  });
});
