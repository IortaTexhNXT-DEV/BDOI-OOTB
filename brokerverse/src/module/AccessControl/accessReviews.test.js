import { OTHER, decisionProblems, effectiveOutcome, filterItems, keepable, nextToReview, sortItems } from "./accessReviews";

const items = [
  { id: 1, displayName: "Wendy", department: "Cash Control", decision: "pending", canDecide: true, needsNote: false, rolesNow: ["tis-ccd-recon"] },
  { id: 2, displayName: "Gene", department: "Cash Control", decision: "keep", canDecide: true, needsNote: true, rolesNow: ["tis-ccd-bp", "tis-ccd-recon"] },
  { id: 3, displayName: "Admin", department: null, decision: "pending", canDecide: false, needsNote: false, rolesNow: ["system-admin"] },
  { id: 4, displayName: "Ana", department: "Sales", decision: "pending", canDecide: true, needsNote: true, rolesNow: ["tis-sales-associate"] },
];
const departments = [{ name: "Sales" }, { name: "Cash Control" }];

describe("access review rules", () => {
  it("orders the lines by department, the users without one last", () => {
    expect(sortItems(items, departments).map((i) => [i.id, i.group])).toEqual([[4, "Sales"], [2, "Cash Control"], [1, "Cash Control"], [3, OTHER]]);
  });

  it("filters and finds the lines a bulk keep may decide", () => {
    expect(filterItems(items, { toReview: true }).map((i) => i.id)).toEqual([1, 3, 4]);
    expect(filterItems(items, { department: OTHER }).map((i) => i.id)).toEqual([3]);
    expect(keepable(items).map((i) => i.id)).toEqual([1]);
  });

  it("asks for a reason to remove, a note to keep a user who needs one, and treats removing every role as deactivating", () => {
    expect(decisionProblems({ outcome: "remove-roles", removeRoles: [] }, items[0], { reasonMissing: true })).toEqual({ removeRoles: "required", reason: "required" });
    expect(decisionProblems({ outcome: "keep", note: "" }, items[3])).toEqual({ note: "required" });
    expect(effectiveOutcome({ outcome: "remove-roles", removeRoles: ["tis-ccd-recon"] }, items[0])).toBe("deactivate");
    expect(effectiveOutcome({ outcome: "remove-roles", removeRoles: ["tis-ccd-recon"] }, items[1])).toBe("remove-roles");
  });

  it("moves to the next user to review", () => {
    expect(nextToReview(items, 1).id).toBe(4);
    expect(nextToReview(items, 4).id).toBe(1);
  });
});
