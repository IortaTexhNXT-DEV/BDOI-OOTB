import { ENDORSEMENT_FILTERS, endorsementRoute } from "./EndorsementWorklist";

describe("Endorsements work list", () => {
  it("opens a rejected endorsement on its rejected view and the others on the summary with the workflow", () => {
    expect(endorsementRoute({ endorsementId: "end_1", status: "Rejected" })).toBe("/agent/endorsement/rejected/end_1");
    expect(endorsementRoute({ endorsementId: "end_2", status: "PendingApproval" })).toBe("/agent/endorsement/summary/end_2");
  });
  it("offers the statuses in the order of the flow, starting with those awaiting approval", () => {
    expect(ENDORSEMENT_FILTERS[0]).toBe("PendingApproval");
    expect(ENDORSEMENT_FILTERS).toContain("");
  });
});
