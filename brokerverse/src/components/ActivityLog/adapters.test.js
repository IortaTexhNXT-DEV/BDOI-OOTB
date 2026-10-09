import "../../i18n";
import {
  fromAssignmentHistory, fromAuditEvents, fromCollectionActions, fromConfigurationHistory, fromJobRuns, fromLifecycle, fromPostingRuleHistory,
  fromRemittanceActivity, fromRemittanceApprovals, fromRemittanceAudit, fromStatusHistory, fromWarrantyActions,
} from "./adapters";
import { setDateFormat } from "../../utility/dateFormat";

beforeEach(() => setDateFormat("DD/MM/YYYY"));

describe("activity log adapters", () => {
  it("takes the audit events of a record, the status change becoming the status line", () => {
    const [e] = fromAuditEvents([{ id: "812", at: "2026-10-02T01:49:37Z", day: "2026-10-02", date: "02/10/2026", time: "09:49", action: "Settlement Submitted",
      title: "Settlement submitted", note: "Month end", user: { username: "j.claims", displayName: "Jasmine Cruz", roles: ["Claims Officer", "Viewer"] },
      source: { channel: "screen", label: "Screen", name: "Operations > Claims" },
      changes: [{ key: "claimStatus", label: "Claim status", from: "Processing", to: "Pending approval" }, { key: "status", label: "Status", from: "Open", to: "Pending" },
        { key: "tin", label: "TIN", from: null, to: "***", masked: true }] }]);
    expect(e).toMatchObject({ id: "812", actionCode: "Settlement Submitted", actionLabel: "Settlement submitted", date: "02/10/2026", time: "09:49",
      user: { displayName: "Jasmine Cruz", username: "j.claims", role: "Claims Officer, Viewer" }, fromStatus: "Open", toStatus: "Pending", remarks: "Month end" });
    expect(e.changes).toEqual([{ field: "claimStatus", label: "Claim status", before: "Processing", after: "Pending approval", masked: false },
      { field: "tin", label: "TIN", before: null, after: "***", masked: true }]);
  });

  it("reads the remittance activity log of this release and of earlier ones", () => {
    const [now, before] = fromRemittanceActivity([
      { id: "5", at: "2026-10-10T01:03:00Z", date: "10/10/2026", time: "09:03", action: "submit", by: "r.finance", actionCode: "submit", actionLabel: "Remittance submitted",
        user: { username: "r.finance", displayName: "Rosa Finance", roles: ["Finance Officer"] }, fromStatus: "Draft", toStatus: "Pending Approval", remarks: null, changes: [] },
      { action: "approve", by: "f.head", at: "2026-10-11T01:00:00Z", notes: "Checked" },
    ]);
    expect(now).toMatchObject({ actionLabel: "Remittance submitted", user: { displayName: "Rosa Finance", role: "Finance Officer" }, toStatus: "Pending Approval" });
    expect(before).toMatchObject({ actionCode: "approve", user: { displayName: "f.head" }, remarks: "Checked", fromStatus: null, toStatus: null });
  });

  it("reads the remittance audit trail and approval history, their UTC text as instants", () => {
    const [a] = fromRemittanceAudit([{ id: 3, actionType: "approve", actionLabel: "Approved", previousValue: "Pending Approval", newValue: "Approved", changedBy: "f.head",
      changedByName: "Fe Head", changedByRoles: ["Finance Manager"], changeDate: "2026-09-26 15:45", reason: "OK" }]);
    expect(a).toMatchObject({ at: "2026-09-26T15:45Z", user: { displayName: "Fe Head", username: "f.head", role: "Finance Manager" }, fromStatus: "Pending Approval", remarks: "OK" });
    const [same] = fromRemittanceAudit([{ id: 4, actionType: "update", previousValue: "Draft", newValue: "Draft", changedBy: null }]);
    expect(same).toMatchObject({ fromStatus: null, toStatus: null, user: { displayName: null } });
    const [ap] = fromRemittanceApprovals([{ referenceNo: "REM-1", action: "Approved", actionDate: "2026-10-01 02:00", actionBy: "Fe Head", remarks: null, level: 1 }]);
    expect(ap).toMatchObject({ actionCode: "Approved", at: "2026-10-01T02:00Z", user: { displayName: "Fe Head" } });
    expect(ap.changes).toEqual([{ field: "level", label: "Approval level", before: null, after: "1" }]);
  });

  it("reads configuration histories: product configurator and posting rules", () => {
    const [c] = fromConfigurationHistory([{ id: 1, action: "update", actionLabel: "Updated", at: "2026-01-01T00:00:00Z", user: "admin", userName: "Administrator", roles: ["System Administrator"],
      changes: [{ field: "status", label: "Status", from: "Draft", to: "Active" }, { field: "minPremium", from: 500, to: 650 }] }]);
    expect(c).toMatchObject({ fromStatus: "Draft", toStatus: "Active", user: { displayName: "Administrator", role: "System Administrator" } });
    expect(c.changes).toEqual([{ field: "minPremium", label: "Min premium", before: 500, after: 650 }]);
    const [p] = fromPostingRuleHistory([{ action: "create-version", actionLabel: "Create version", username: "BrokerVerse", displayName: "BrokerVerse Administrator",
      roles: ["System Administrator"], at: "2026-09-29T08:00:00Z", version: 2, changeNote: "VAT line added", ruleId: 7 }]);
    expect(p).toMatchObject({ actionLabel: "Create version", remarks: "VAT line added", user: { displayName: "BrokerVerse Administrator" } });
    expect(p.changes[0]).toMatchObject({ label: "Version", after: "2" });
  });

  it("reads status histories with their labels and source, the system for a job", () => {
    const [h] = fromStatusHistory([{ from: "open", to: "soft-closed", remarks: "August", changedBy: "system", changedAt: "2026-09-05T02:00:00Z", source: "close-run" }],
      { statusLabels: { "soft-closed": "Soft closed" } });
    expect(h).toMatchObject({ actionCode: "status", fromStatus: "Open", toStatus: "Soft closed", remarks: "August", user: { displayName: null },
      source: { channel: "screen", label: "Month-end close" } });
  });

  it("reads lead assignment, premium warranty, collection follow-up and job run histories", () => {
    const [la] = fromAssignmentHistory([{ id: 1, action: "auto", reason: null, assignedAt: "2026-10-01T00:00:00Z", fromName: null, toName: "Ana Sales", ruleName: "Motor leads", assignedBy: null }]);
    expect(la).toMatchObject({ actionCode: "auto", user: { displayName: null } });
    expect(la.changes.map((c) => [c.label, c.after])).toEqual([["Assigned to", "Ana Sales"], ["Rule", "Motor leads"]]);
    const [w] = fromWarrantyActions([{ id: 2, action: "request-cancellation", notes: "Unpaid", endorsementNumber: "END-1", createdBy: "Rosa Finance", createdAt: "2026-10-01T00:00:00Z" }],
      { actionLabels: { "request-cancellation": "Cancellation requested" } });
    expect(w).toMatchObject({ actionLabel: "Cancellation requested", user: { displayName: "Rosa Finance" }, remarks: "Unpaid" });
    const [f] = fromCollectionActions([{ id: 3, actionType: "Call", actionDate: "2026-10-01T03:00:00Z", actionBy: "c.agent", callOutcome: "WrongNumber", notes: "No answer", commitmentDate: "2026-10-15" }]);
    expect(f.changes.map((c) => c.after)).toEqual(["Wrong number", "15/10/2026"]);
    const [r] = fromJobRuns([{ id: 9, startedAt: "2026-10-01T22:00:00Z", status: "failed", error: "SMTP refused", triggeredBy: "schedule" }]);
    expect(r).toMatchObject({ actionCode: "run", toStatus: "Failed", remarks: "SMTP refused", user: { displayName: null }, source: { channel: "job", label: "Scheduled job" } });
  });

  it("builds the lifecycle of a record from its own fields, the steps that happened only", () => {
    const steps = [
      { action: "create", at: "calculationDate", by: "createdBy" },
      { action: "submit", at: "submittedDate", by: "submittedBy", toStatus: "Pending approval" },
      { action: "reject", at: "rejectionDate", by: "rejectedBy", remarks: "rejectionReason", toStatus: "Rejected" },
      { action: "pay", at: "paymentDate" },
    ];
    const log = fromLifecycle({ calculationDate: "2026-09-30", createdBy: "Rosa Finance", submittedDate: "2026-10-01", submittedBy: "Rosa Finance",
      rejectionDate: "2026-10-02", rejectedBy: "Fe Head", rejectionReason: "Wrong period" }, steps);
    expect(log.map((e) => e.actionCode)).toEqual(["create", "submit", "reject"]);
    expect(log[2]).toMatchObject({ user: { displayName: "Fe Head" }, toStatus: "Rejected", remarks: "Wrong period" });
    expect(fromLifecycle(null, steps)).toEqual([]);
  });
});
