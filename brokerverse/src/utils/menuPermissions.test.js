import { isPathAllowed, filterMenuForRoles } from "./menuPermissions";

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
