import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import { remittanceService } from "../../../services/remittanceService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import RemittanceRecord from ".";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    getRemittance: jest.fn(), approveApproval: jest.fn(), rejectApproval: jest.fn(), remindApprovers: jest.fn(), submitRemittances: jest.fn(), download: jest.fn(),
    remittanceActivityPath: jest.fn((id) => `/remittance/remittances/${id}/activity?format=xlsx`),
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ rows: [] }) } }));

const SUBMITTER = "You submitted this remittance. Another user with remittance authority must approve it.";
const APPROVERS = [{ id: "u9", name: "J. Cruz", role: "TIS Finance & General Accounting", limit: 1000000 }, { id: "u7", name: "A. Tan", role: "General Manager", limit: null }];
const DOWNLOADS = [
  { code: "download-schedule-xlsx", label: "Download schedule (XLSX)", allowed: true, href: "/remittance/remittances/rm_21/schedule.xlsx" },
  { code: "download-schedule-pdf", label: "Download schedule (PDF)", allowed: true, href: "/remittance/remittances/rm_21/schedule.pdf" },
];
const approval = (extra = {}) => ({
  id: 21, version: 1, status: "Pending", level: { current: 1, required: 1, label: "1 of 1" }, submittedBy: { id: "u4", name: "M. Reyes" }, submittedAt: "2026-10-06T02:12:00.000Z",
  sla: { label: "Due in 18 h", overdue: false }, reminder: { allowed: true }, outcome: null, authorityType: "Remittance", amount: 409141.43,
  contentVersion: 3, submittedVersion: 3, contentUnchanged: true,
  checks: [{ code: "content-unchanged", label: "Content unchanged since submission", result: "pass", detail: "v3 · unchanged since submission" },
    { code: "period-open", label: "Period Oct 2026 open", result: "pass", detail: null }],
  actions: [{ code: "approve", label: "Approve", allowed: false, blockedCode: "SUBMITTER", blockedReason: SUBMITTER }, { code: "reject", label: "Reject", allowed: false },
    { code: "remind", label: "Remind approver", allowed: true }],
  ...extra,
});
const record = (extra = {}) => ({
  id: "rm_21", remittanceNo: "REM-2026-00021", statusCode: "for-approval", statusLabel: "Pending approval", status: "Pending Approval",
  insurer: { id: 3, name: "Pioneer Insurance" }, productLine: "Motor", basisLabel: "Net", coverageWeek: { from: "2026-10-05", to: "2026-10-09" },
  dueDate: "2026-10-16", source: { code: "weekly-run", label: "Weekly run" }, flags: { offCycle: false, overdue: false },
  policyCount: 1, premium: 64159.68, commission: 24022.5, tax: 0, adjustments: 0, dueToInsurer: 40137.18, version: 3,
  createdAt: "2026-10-05T22:15:00.000Z", createdBy: { id: null, name: "System" }, submittedAt: "2026-10-06T02:12:00.000Z", submittedBy: { id: "u4", name: "M. Reyes" },
  decision: { canDecide: false, blockedCode: "SUBMITTER", blockedReason: SUBMITTER, myLimit: null, amount: 40137.18, eligibleApprovers: APPROVERS },
  nextStep: { code: "approve", label: "Awaiting remittance approver: J. Cruz, A. Tan" },
  lines: [{ id: 1, policyId: "p1", policyNo: "TISPH-PC-0001234", insuredName: "J. Santos", product: "Motor", premium: 64159.68, commission: 24022.5, tax: 0, netAmount: 40137.18, status: "Active" }],
  actions: [{ code: "view", label: "View", allowed: true }, ...DOWNLOADS], downloads: [{ code: "schedule-xlsx", label: "schedule (XLSX)", href: DOWNLOADS[0].href },
    { code: "schedule-pdf", label: "schedule (PDF)", href: DOWNLOADS[1].href }],
  payment: null, voucher: null, documents: [],
  activityLog: [{ id: "1", at: "2026-10-06T02:12:00.000Z", actionCode: "submit", actionLabel: "Remittance submitted", user: { displayName: "M. Reyes", role: "Accounting" } }],
  approval: approval(),
  ...extra,
});
const checker = (extra = {}) => record({
  decision: { canDecide: true, blockedCode: null, blockedReason: null, myLimit: 1000000, amount: 40137.18, eligibleApprovers: APPROVERS },
  approval: approval({ actions: [{ code: "approve", label: "Approve", allowed: true }, { code: "reject", label: "Reject", allowed: true }, { code: "remind", label: "Remind approver", allowed: false }] }),
  ...extra,
});

const show = () => render(
  <MemoryRouter initialEntries={["/finance/remittance/remittances/rm_21"]}>
    <Routes><Route path="/finance/remittance/remittances/:id" element={<RemittanceRecord />} /><Route path="/finance/remittance/remittances" element={<div>Register</div>} /></Routes>
    <ConfirmDialogHost />
  </MemoryRouter>
);
const failWith = (status, message = "Failed") => Object.assign(new Error(message), { status });

beforeEach(() => {
  jest.clearAllMocks();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  localStorage.setItem("USER_ROLES", JSON.stringify(["accounting"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:remittance", "write:remittance"]));
});

describe("Remittance record", () => {
  it("the submitter sees no Approve or Reject anywhere; the banner names who can decide", async () => {
    remittanceService.getRemittance.mockResolvedValue(record());
    show();
    expect((await screen.findAllByText("REM-2026-00021")).length).toBeGreaterThan(0);
    expect(screen.getByText(SUBMITTER)).toBeInTheDocument();
    expect(screen.getByText("Can decide: J. Cruz, A. Tan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remind approver" })).toBeInTheDocument();
    expect(screen.getByText("Prepared System · Submitted M. Reyes")).toBeInTheDocument();
    expect(screen.getByText("Coverage 05/10/2026–09/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checks 2/2" })).toBeInTheDocument();
    // the stepper, in Manila time
    expect(screen.getByText("06/10/2026 10:12 · M. Reyes")).toBeInTheDocument();
  });

  it("an eligible checker approves with the R1 confirmation; a lost race leaves the action undone with Reload", async () => {
    remittanceService.getRemittance.mockResolvedValue(checker());
    remittanceService.approveApproval.mockRejectedValue(failWith(409, "Approved by J. Cruz at 10:32."));
    show();
    expect(await screen.findByText("Awaiting your decision · Your limit PHP 1,000,000.00 · This item PHP 40,137.18")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approve REM-2026-00021 for PHP 409,141.43? Settlement and payment follow in Disbursement.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" })); });
    expect(remittanceService.approveApproval).toHaveBeenCalledWith(21, { version: 1 });
    expect(await screen.findByText("Approved by J. Cruz at 10:32. Reload to see the current version.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(remittanceService.getRemittance).toHaveBeenCalledTimes(2));
  });

  it("the Activity tab shows the decision with the approver's name, the limit at decision and its source and the reason; no raw codes", async () => {
    remittanceService.getRemittance.mockResolvedValue(record({
      statusCode: "rejected", statusLabel: "Returned", decision: null, nextStep: { code: "resubmit", label: "Correct and resubmit" },
      returned: { by: "J. Cruz", at: "2026-10-12T02:40:00.000Z", reason: "Rates to be corrected: OD rate of POL-1" },
      actions: [{ code: "view", label: "View", allowed: true }, { code: "submit", label: "Submit for approval", allowed: true }, ...DOWNLOADS],
      approval: approval({ status: "Rejected", checks: [], actions: [], outcome: { action: "Rejected", by: { id: "u9", name: "J. Cruz" }, decidedAt: "2026-10-12T02:40:00.000Z",
        reason: "Rates to be corrected: OD rate of POL-1", limitAtDecision: 1000000, limitSource: "role tis-finance", limitSourceLabel: "Role limit: TIS Finance & General Accounting" } }),
      activityLog: [{ id: "9", at: "2026-10-12T02:40:00.000Z", actionCode: "create-agency-bill", actionLabel: "Remittance returned to the maker", user: { displayName: "J. Cruz" } }],
    }));
    show();
    expect(await screen.findByText("Returned by J. Cruz on 12/10/2026 10:40 · Rates to be corrected: OD rate of POL-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(await screen.findByText("Approval summary")).toBeInTheDocument();
    expect(screen.getByText("PHP 1,000,000.00")).toBeInTheDocument();
    expect(screen.getByText("Role limit: TIS Finance & General Accounting")).toBeInTheDocument();
    expect(screen.getAllByText("Rates to be corrected: OD rate of POL-1").length).toBeGreaterThan(0);
    expect(screen.getByText("Remittance returned to the maker")).toBeInTheDocument();
    expect(screen.queryByText(/create-agency-bill|role tis-finance/)).not.toBeInTheDocument();
  });

  it("downloads the schedule as server XLSX and PDF and never opens the print dialog", async () => {
    const print = jest.spyOn(window, "print").mockImplementation(() => {});
    remittanceService.getRemittance.mockResolvedValue(record());
    remittanceService.download.mockResolvedValue(undefined);
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Documents" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download Remittance schedule (XLSX)" }));
    fireEvent.click(screen.getByRole("button", { name: "Download Remittance schedule (PDF)" }));
    expect(remittanceService.download).toHaveBeenCalledWith("/remittance/remittances/rm_21/schedule.xlsx", "schedule.xlsx");
    expect(remittanceService.download).toHaveBeenCalledWith("/remittance/remittances/rm_21/schedule.pdf", "schedule.pdf");
    fireEvent.click(screen.getByRole("tab", { name: "Payment" }));
    expect(await screen.findByText("No voucher yet. It is raised when the remittance is included in a settlement.")).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
  });

  it.each([
    [404, "Remittance not found."],
    [403, "You do not have access to remittances."],
  ])("a %s shows its state", async (status, text) => {
    remittanceService.getRemittance.mockRejectedValue(failWith(status));
    show();
    expect(await screen.findByText(text)).toBeInTheDocument();
    if (status === 404) {
      fireEvent.click(screen.getByRole("button", { name: "Back to Remittances" }));
      expect(await screen.findByText("Register")).toBeInTheDocument();
    }
  });

  it("a load error offers Try again", async () => {
    remittanceService.getRemittance.mockRejectedValueOnce(failWith(500)).mockResolvedValue(record());
    show();
    expect(await screen.findByText("The remittance could not be loaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(SUBMITTER)).toBeInTheDocument();
  });
});
