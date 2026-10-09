import {
  cellState, compareRows, holds, indexCatalogue, moduleMatches, modulesWithAccess, nextInGroup, roleGroups, stagedDelta, toggleLevel, viewDependents, visibleRoles,
} from "./roleAccess";
import { catalogue, overview } from "./roleAccess.fixture";

const data = overview();
const idx = indexCatalogue(catalogue);
const role = (code) => data.roles.find((r) => r.code === code);

describe("roles by department", () => {
  it("lists the TISPH roles by department in order and the base platform roles only when asked", () => {
    const groups = roleGroups(visibleRoles(data.roles, false), data.departments);
    expect(groups.map((g) => g.key)).toEqual(["Sales", "Cash Control", "Finance and Accounting", "IT"]);
    expect(groups[0].items.map((r) => r.code)).toEqual(["tis-sales-associate", "tis-sales-officer"]);
    expect(groups.flatMap((g) => g.items).some((r) => r.platform)).toBe(false);
    const withBase = roleGroups(visibleRoles(data.roles, true), data.departments, { base: true });
    expect(withBase.map((g) => g.key)).toEqual(["Sales", "Cash Control", "Finance and Accounting", "IT", "platform"]);
    expect(withBase[4].items.map((r) => r.code)).toEqual(["system-admin", "accounting", "accounting-manager"]);
  });

  it("puts a role in no department under the other roles, and compares a role with the next one of its department", () => {
    const extra = { ...role("tis-sales-associate"), code: "new-role", name: "New role", department: null };
    const groups = roleGroups([...visibleRoles(data.roles), extra], data.departments);
    expect(groups[groups.length - 1]).toMatchObject({ key: "other", items: [extra] });
    expect(nextInGroup(groups, "tis-sales-associate")).toBe("tis-sales-officer");
    expect(nextInGroup(groups, "tis-sales-officer")).toBe("tis-sales-associate");
    expect(nextInGroup(groups, "tis-finance")).toBeNull();
  });
});

describe("effective access", () => {
  it("counts the grants of included roles and full access", () => {
    expect(holds(role("accounting-manager"), "write:receipts")).toEqual({ granted: true, how: "included", via: "accounting" });
    expect(holds(role("accounting-manager"), "approve:bank-reconciliation")).toMatchObject({ granted: true, how: "own" });
    expect(holds(role("tis-superid"), "write:campaigns")).toMatchObject({ granted: true, how: "full" });
    expect(holds(role("tis-ccd-bp"), "write:campaigns").granted).toBe(false);
  });

  it("locks included levels and Basic access, shows a level the module does not have as unavailable and marks pending changes", () => {
    expect(cellState(idx, role("accounting-manager"), {}, "receipts", "edit")).toMatchObject({ on: true, locked: true, via: "accounting" });
    expect(cellState(idx, role("tis-ccd-bp"), {}, "profile", "view")).toMatchObject({ on: true, locked: true });
    expect(cellState(idx, role("tis-ccd-bp"), {}, "receipts", "approve")).toMatchObject({ code: null, locked: true });
    // write:profile is not checked by the system: no level
    expect(idx.code("profile", "edit")).toBeNull();
    expect(cellState(idx, role("tis-finance"), {}, "bank-reconciliation", "approve").pending).toBe("added");
    expect(cellState(idx, role("tis-finance"), {}, "receipts", "view").pending).toBe("removed");
  });

  it("counts the modules of an area with access", () => {
    expect(modulesWithAccess(idx, role("tis-ccd-bp"), {}, "accounts").map((m) => m.code)).toEqual(["receipts"]);
    expect(modulesWithAccess(idx, role("tis-superid"), {}, "accounts")).toHaveLength(2);
  });
});

describe("editing", () => {
  it("turns View on with Create and edit or Approve, and off with the levels that need it", () => {
    const r = role("tis-ccd-bp");
    const on = toggleLevel(idx, r, {}, "bank-reconciliation", "approve", true);
    expect(on.staged).toEqual({ "approve:bank-reconciliation": true, "read:bank-reconciliation": true });
    expect(on.implied).toEqual(["read:bank-reconciliation"]);
    expect(viewDependents(idx, r, on.staged, "bank-reconciliation").map((c) => c.code)).toEqual(["approve:bank-reconciliation"]);
    const off = toggleLevel(idx, r, on.staged, "bank-reconciliation", "view", false);
    expect(off.staged).toEqual({});
    expect(off.dropped).toEqual(["approve:bank-reconciliation"]);
    const removed = toggleLevel(idx, r, {}, "receipts", "view", false);
    expect(stagedDelta(removed.staged)).toEqual({ grant: [], revoke: ["read:receipts", "write:receipts"] });
  });

  it("never changes an included level or Basic access, and drops a change turned back", () => {
    const m = role("accounting-manager");
    expect(toggleLevel(idx, m, {}, "receipts", "edit", false).staged).toEqual({});
    expect(toggleLevel(idx, role("tis-ccd-bp"), {}, "profile", "view", false).staged).toEqual({});
    const r = role("tis-sales-associate");
    const once = toggleLevel(idx, r, {}, "campaigns", "view", true).staged;
    expect(stagedDelta(once)).toEqual({ grant: ["read:campaigns"], revoke: [] });
    expect(toggleLevel(idx, r, once, "campaigns", "view", false).staged).toEqual({});
  });
});

describe("search and comparison", () => {
  it("finds a module by its area, name, screen or level meaning, and by code with technical names", () => {
    const receipts = idx.module("receipts");
    expect(moduleMatches(idx, receipts, "post-dated")).toBe(true);
    expect(moduleMatches(idx, receipts, "ACCOUNTS")).toBe(true);
    expect(moduleMatches(idx, receipts, "official receipts")).toBe(true);
    expect(moduleMatches(idx, receipts, "write:receipts")).toBe(false);
    expect(moduleMatches(idx, receipts, "write:receipts", { technical: true })).toBe(true);
    expect(moduleMatches(idx, receipts, "ใบเสร็จ", { names: () => ["ใบเสร็จรับเงิน"] })).toBe(true);
  });

  it("lists every module with the levels of each role and keeps the differences only when asked", () => {
    const roles = [role("tis-sales-associate"), role("tis-sales-officer")];
    const rows = compareRows(idx, roles);
    const quotations = rows.find((r) => r.key === "quotations");
    expect(quotations.differs).toBe(true);
    expect(quotations.cells["tis-sales-officer"].map((x) => x.level)).toEqual(["view", "edit", "approve"]);
    expect(rows.find((r) => r.key === "profile").differs).toBe(false);
    expect(compareRows(idx, roles, { diffOnly: true }).map((r) => r.key)).toEqual(["quotations", "campaigns", "pii"]);
    expect(compareRows(idx, [role("tis-sales-associate"), role("tis-sales-associate")], { diffOnly: true })).toEqual([]);
  });
});
