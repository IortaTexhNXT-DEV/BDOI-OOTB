import { findActiveTrail, matchLength, searchMenu } from "./menuTree";
import { menuList } from "./list";

const label = (name) => name;

describe("active menu entry", () => {
  it("the home route matches only itself", () => {
    expect(matchLength({ includes: ["/"] }, "/")).toBe(1);
    expect(matchLength({ includes: ["/"] }, "/agent/policy")).toBe(0);
  });
  it("takes the most specific entry", () => {
    // "/" is Home (My Work with the role preset), the landing page after sign-in
    expect(findActiveTrail(menuList, "/")).toEqual(["Home"]);
    expect(findActiveTrail(menuList, "/executive/dashboard")).toEqual(["Dashboard", "Executive Dashboard"]);
    expect(findActiveTrail(menuList, "/agent/policydetailedview/123")).toEqual(["Operations", "Clients"]);
    expect(findActiveTrail(menuList, "/agent/policy")).toEqual(["Operations", "Policy"]);
    expect(findActiveTrail(menuList, "/renewal/queue")).toEqual(["Operations", "Renewals", "Renewal Queue"]);
    expect(findActiveTrail(menuList, "/master/finance/taxation")).toEqual(["Master", "Finance", "Taxation"]);
    expect(findActiveTrail(menuList, "/agent/home")).toEqual(["Home"]);
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
