import { filterUsers, hasFlag, matrixStats } from "./userAccess";

const users = [
  { id: "a", displayName: "Gene Jaen", username: "gene", status: "active", department: "Cash Control", roles: ["tis-ccd-bp"], effectiveRoles: ["tis-ccd-bp"], twoFactor: false,
    dormant: false, sodConflicts: [{ state: "open" }], pending: [] },
  { id: "b", displayName: "Mariela Valentino", username: "mariela", status: "active", department: "Finance and Accounting", roles: ["tis-finance"],
    effectiveRoles: ["tis-finance"], twoFactor: true, dormant: true, sodConflicts: [{ state: "accepted" }], pending: [{ ref: "CFG-4" }] },
  { id: "c", displayName: "UAT Super", username: "super", status: "inactive", department: "IT", roles: ["tis-superid"], effectiveRoles: ["tis-superid", "system-admin"],
    twoFactor: false, dormant: false, sodConflicts: [{ state: "expired" }], pending: [] },
];

describe("user access matrix rules", () => {
  it("counts the stat cards on active users and open conflicts only", () => {
    expect(matrixStats(users)).toEqual({ active: 2, dormant: 1, conflicts: 1, twoStep: 1, pending: 1 });
    expect(hasFlag(users[1], "conflicts")).toBe(false);
  });

  it("shows active users by default and filters by department, role held through another role, flag and search", () => {
    expect(filterUsers(users).map((u) => u.id)).toEqual(["a", "b"]);
    expect(filterUsers(users, { status: "all", role: "system-admin" }).map((u) => u.id)).toEqual(["c"]);
    expect(filterUsers(users, { departments: ["Cash Control"] }).map((u) => u.id)).toEqual(["a"]);
    expect(filterUsers(users, { flag: "pending" }).map((u) => u.id)).toEqual(["b"]);
    expect(filterUsers(users, { search: "MARIELA" }).map((u) => u.id)).toEqual(["b"]);
  });
});
