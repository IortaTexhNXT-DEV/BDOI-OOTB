import { filterConflicts, ruleProblems, sodStats, visibleRules } from "./sod";

const conflicts = [
  { key: "1:a", ruleId: 1, userId: "a", userName: "Gene Jaen", department: "Cash Control", state: "open" },
  { key: "2:a", ruleId: 2, userId: "a", userName: "Gene Jaen", department: "Cash Control", state: "accepted", exception: { validUntil: "2026-10-20" } },
  { key: "1:b", ruleId: 1, userId: "b", userName: "Marta Dapula", department: "Cash Control", state: "accepted", exception: { validUntil: "2027-03-31" } },
];

describe("segregation of duties rules", () => {
  it("counts users, open users, exceptions and those ending within 30 days", () => {
    const rules = [{ active: true, platform: false }, { active: true, platform: true }, { active: false, platform: false }];
    expect(sodStats(conflicts, rules, "2026-10-10")).toEqual({ users: 2, openUsers: 1, accepted: 2, endingSoon: 1, rulesOn: 1, platformOn: 1 });
  });

  it("filters the conflicts by user, rule and state, and hides base platform rules", () => {
    expect(filterConflicts(conflicts, { userId: "a" }).map((c) => c.key)).toEqual(["1:a", "2:a"]);
    expect(filterConflicts(conflicts, { ruleId: "1", states: ["open"] }).map((c) => c.key)).toEqual(["1:a"]);
    expect(filterConflicts(conflicts, { search: "marta" }).map((c) => c.key)).toEqual(["1:b"]);
    expect(visibleRules([{ platform: true }, { platform: false }])).toHaveLength(1);
  });

  it("asks for two different roles or access that does not overlap", () => {
    expect(ruleProblems({ name: "x", kind: "roles", roleA: "a", roleB: "a" })).toEqual({ roleB: "same" });
    expect(ruleProblems({ name: "", kind: "access", accessA: ["w"], accessB: ["w"] })).toEqual({ name: "required", accessB: "overlap" });
  });
});
