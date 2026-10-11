import { findActiveTrail, initialsOf, matchLength, searchMenu, visibleTrail } from "./menuTree";
import { menuList } from "./list";

const label = (name) => name;

describe("active menu entry", () => {
  it("the home route matches only itself", () => {
    expect(matchLength({ includes: ["/"] }, "/")).toBe(1);
    expect(matchLength({ includes: ["/"] }, "/agent/policy")).toBe(0);
  });
  it("takes the most specific entry", () => {
    // "/" is My Work (with the role preset), the first screen after sign-in
    expect(findActiveTrail(menuList, "/")).toEqual(["My Work"]);
    expect(findActiveTrail(menuList, "/my-work")).toEqual(["My Work"]);
    expect(findActiveTrail(menuList, "/operations/my-work")).toEqual(["My Work"]);
    expect(findActiveTrail(menuList, "/executive/dashboard")).toEqual(["Dashboard", "Executive Dashboard"]);
    expect(findActiveTrail(menuList, "/agent/policydetailedview/123")).toEqual(["Operations", "Clients"]);
    expect(findActiveTrail(menuList, "/agent/policy")).toEqual(["Operations", "Policy"]);
    expect(findActiveTrail(menuList, "/renewal/queue")).toEqual(["Operations", "Renewals", "Renewal Queue"]);
    expect(findActiveTrail(menuList, "/master/finance/taxation")).toEqual(["Master", "Finance", "Taxation"]);
    expect(findActiveTrail(menuList, "/agent/home")).toEqual(["My Work"]);
    expect(findActiveTrail(menuList, "/account/profile")).toEqual([]);
  });
});

describe("menu search", () => {
  it("finds screens with their group path, best matches first", () => {
    const found = searchMenu(menuList, "insurance comp", label);
    expect(found[0].item.name).toBe("Insurance Company");
    expect(found[0].ancestors.map((a) => a.name)).toEqual(["Master", "Insurance Management"]);
  });
  it("finds the screens of a group by the group name", () => {
    const names = searchMenu(menuList, "petty cash", label, 50).map((r) => r.item.name);
    expect(names).toEqual(expect.arrayContaining(["Initiate", "Replenish"]));
  });
  it("returns nothing for an empty query", () => {
    expect(searchMenu(menuList, "  ", label)).toEqual([]);
  });
});

describe("abbreviations and groups found only by search", () => {
  const tree = [
    { name: "Accounts", submenu: [{ name: "Post-Dated Cheques", path: "/accounts/pdc" }, { name: "Journal Voucher", path: "/accounts/jv" }] },
    { name: "Reports", submenu: [
      { name: "All Reports", path: "/reports/catalogue", includes: ["/reports/catalogue", "/reports/run/"] },
      { name: "Operational Reports", searchOnly: true, home: "All Reports", submenu: [{ name: "Dealer Production", path: "/reports/run/dealer-production" }] },
    ] },
  ];
  const label = (name) => name;

  it("finds a screen by the initials of its name", () => {
    expect(initialsOf("Post-Dated Cheques")).toBe("pdc");
    expect(searchMenu(tree, "PDC", label).map((r) => r.item.name)).toEqual(["Post-Dated Cheques"]);
    expect(searchMenu(tree, "jv", label).map((r) => r.item.name)).toEqual(["Journal Voucher"]);
  });

  it("still finds a report under a group that the tree does not draw", () => {
    expect(searchMenu(tree, "dealer", label).map((r) => r.item.name)).toEqual(["Dealer Production"]);
  });

  it("lights up the home entry of a hidden group", () => {
    const trail = findActiveTrail(tree, "/reports/run/dealer-production");
    expect(trail).toEqual(["Reports", "Operational Reports", "Dealer Production"]);
    expect(visibleTrail(tree, trail)).toEqual(["Reports", "All Reports"]);
    expect(visibleTrail(tree, ["Accounts", "Journal Voucher"])).toEqual(["Accounts", "Journal Voucher"]);
  });
});
