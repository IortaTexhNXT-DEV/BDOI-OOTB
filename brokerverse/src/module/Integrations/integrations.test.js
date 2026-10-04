import { isPathAllowed } from "../../utils/menuPermissions";
import { menuList } from "../../components/SideBar/list";
import { helpSectionFor } from "../../components/HelpPanel/helpRoutes";
import { isoDay, parseJson } from "./common";

describe("integration screens: menu grants", () => {
  it("the monitor, templates and insurer integration are for the administrator only", () => {
    for (const p of ["/master/configuration/integrations", "/master/configuration/message-templates", "/master/configuration/insurer-integration"]) {
      expect(isPathAllowed(p, menuList, ["system-admin"])).toBe(true);
      for (const role of ["sales", "operations", "accounting", "claims"]) expect(isPathAllowed(p, menuList, [role])).toBe(false);
    }
  });
  it("accounting pays by bank file and keeps the layouts; operations does not", () => {
    expect(isPathAllowed("/accounts/bank-payment-files", menuList, ["accounting"])).toBe(true);
    expect(isPathAllowed("/master/finance/bank-file-layouts", menuList, ["accounting"])).toBe(true);
    expect(isPathAllowed("/accounts/bank-payment-files", menuList, ["operations"])).toBe(false);
  });
  it("CTPL authentication is open to the policy desks, not to accounting", () => {
    for (const role of ["sales", "processing", "operations"]) expect(isPathAllowed("/operations/ctpl-authentication", menuList, [role])).toBe(true);
    expect(isPathAllowed("/operations/ctpl-authentication", menuList, ["accounting"])).toBe(false);
  });
  it("each screen has its section of the user manual", () => {
    expect(helpSectionFor("/master/configuration/integrations").id).toBe("integrations");
    expect(helpSectionFor("/accounts/bank-payment-files").id).toBe("bank-payment-files");
    expect(helpSectionFor("/operations/ctpl-authentication").id).toBe("ctpl-authentication");
  });
});

describe("integration helpers", () => {
  it("reads JSON option editors and reports the error", () => {
    expect(parseJson('{"preset":"semaphore"}', {})).toEqual([{ preset: "semaphore" }, null]);
    expect(parseJson("", { a: 1 })).toEqual([{ a: 1 }, null]);
    expect(parseJson("{oops", {})[1]).toBeTruthy();
  });
  it("sends dates as local calendar days", () => {
    expect(isoDay(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(isoDay(null)).toBeUndefined();
  });
});
