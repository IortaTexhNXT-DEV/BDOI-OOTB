import { byDepartment, toRoleRow } from "./roleMapping";

describe("role list rows", () => {
  it("carries the department, the platform flag and the last change of a role", () => {
    const row = toRoleRow({ id: 9, code: "tis-sales-associate", name: "TIS Sales Associate", department: "Sales", groupOrder: 0, platform: false,
      modifiedBy: "Ana Reyes", modifiedAt: "2026-10-09T08:00:00.000Z", createdAt: "2026-10-01T08:00:00.000Z", permissions: [] });
    expect(row).toMatchObject({ department: "Sales", platform: false, modifiedBy: "Ana Reyes", modifiedOn: "2026-10-09" });
    expect(toRoleRow({ id: 2, code: "sales", name: "Sales", platform: true, createdAt: "2026-10-01T08:00:00.000Z" })).toMatchObject({ platform: true, modifiedBy: "", modifiedOn: "2026-10-01" });
  });

  it("lists the roles of a department first, in the order of the user form", () => {
    const rows = [{ id: 2, groupOrder: null }, { id: 12, groupOrder: 100 }, { id: 9, groupOrder: 0 }, { id: 30, groupOrder: null }];
    expect([...rows].sort(byDepartment).map((r) => r.id)).toEqual([9, 12, 2, 30]);
  });
});
