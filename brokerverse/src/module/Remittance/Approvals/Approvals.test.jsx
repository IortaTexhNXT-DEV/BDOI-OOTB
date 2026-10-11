import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import { remittanceService, masterService } from "../../../services/remittanceService";
import opsAccountingService from "../../../services/opsAccountingService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import Approvals from ".";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    approvalInbox: jest.fn(), getApproval: jest.fn(), decideApprovals: jest.fn(), approveApproval: jest.fn(), rejectApproval: jest.fn(),
    remindApprovers: jest.fn(), download: jest.fn(), approvalExportPath: jest.fn(() => "/remittance/approvals/export.xlsx"),
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const SUBMITTER = "You submitted this remittance. Another user with remittance authority must approve it.";
const APPROVERS = [{ id: "u9", name: "J. Cruz", role: "TIS Finance & General Accounting", limit: 1000000 }, { id: "u7", name: "A. Tan", role: "General Manager", limit: null }];
const can = (extra = {}) => ({ canDecide: true, blockedCode: null, blockedReason: null, myLimit: 1000000, amount: 409141.43, eligibleApprovers: APPROVERS, ...extra });
const row = (id, extra = {}) => ({
  id, version: 1, type: "remittance", typeLabel: "Remittance", reference: `REM-2026-000${id}`, entity: "remittance", entityId: `rm_${id}`,
  recordLink: `/finance/remittance/remittances/rm_${id}`, insurer: { id: 3, name: "Pioneer Insurance" }, productLine: "Motor", amount: 409141.43,
  submittedBy: { id: "u4", name: "M. Reyes" }, submittedAt: "2026-10-09T16:30:00.000Z", status: "Pending", statusLabel: "Pending approval",
  level: { current: 1, required: 1, label: "1 of 1" }, sla: { label: "Due in 6 h", overdue: false }, decision: can(),
  nextStep: { code: "approve", label: "Awaiting remittance approver: J. Cruz, A. Tan" }, reminder: { allowed: true }, outcome: null,
  actions: [{ code: "view", label: "View", allowed: true }, { code: "approve", label: "Approve", allowed: true }, { code: "reject", label: "Reject", allowed: true }],
  ...extra,
});
const kpis = (extra = {}) => ({ awaitingMine: { count: 0, amount: 0 }, pastSla: { count: 0, oldestHours: 0 }, submittedByMe: { count: 0 }, decidedByMeToday: { count: 0, approved: 0, rejected: 0 }, ...extra });
const authority = (extra = {}) => ({ permission: true, canDecide: true, limit: 1000000, unlimited: false, limitSourceLabel: "Role limit: TIS Finance", covering: [], ...extra });
const inbox = (rows, extra = {}) => ({ data: rows, total: rows.length, totals: { count: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) }, kpis: kpis(), authority: authority(), ...extra });
const panel = (r, extra = {}) => ({
  ...r, record: { id: r.entityId, remittanceNo: r.reference, statusCode: "for-approval", insurer: r.insurer, period: "2026-10", dueDate: "2026-10-16", source: { label: "Weekly run" }, offCycle: false },
  totals: { policies: 12, premium: 520000, commission: 98000, tax: 12858.57, dueToInsurer: 409141.43 }, lines: [{ policyNo: "POL-2026-95021", client: "J. Santos", premium: 64159.68, dueToInsurer: 40857.86 }],
  lineCount: 12, previous: { remittanceNo: "REM-2026-00017", amount: 371210, changePercent: 10.22 },
  checks: [{ code: "content-unchanged", label: "Content unchanged since submission", result: "pass", detail: "v3 · unchanged since submission" }],
  exceptions: { count: 0, items: [] }, activity: [], ...extra,
});

const show = (path = "/finance/remittance/approvals") => render(
  <MemoryRouter initialEntries={[path]}><Approvals /><ConfirmDialogHost /></MemoryRouter>
);
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  jest.clearAllMocks();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:remittance", "approve:remittance"]));
  masterService.options.mockResolvedValue([{ label: "Pioneer Insurance", code: "PIONEER", id: 3 }]);
  opsAccountingService.masterRecords.mockResolvedValue({ rows: [{ code: "RRJ-RATES", name: "Rates to be corrected", context: "remittance_reject", status: "Active", sortOrder: 1 }] });
});

describe("Approvals", () => {
  it("the submitter sees their item under Submitted by me with who it waits on, and its panel has no decision and no comment box", async () => {
    const mine = row(21, { decision: can({ canDecide: false, blockedCode: "SUBMITTER", blockedReason: SUBMITTER, myLimit: null }),
      actions: [{ code: "view", label: "View", allowed: true }, { code: "approve", label: "Approve", allowed: false, blockedCode: "SUBMITTER", blockedReason: SUBMITTER },
        { code: "remind", label: "Remind approver", allowed: true }] });
    remittanceService.approvalInbox.mockImplementation(async ({ view }) => (view === "submitted"
      ? inbox([mine], { kpis: kpis({ submittedByMe: { count: 1 } }) }) : inbox([], { kpis: kpis({ submittedByMe: { count: 1 } }) })));
    remittanceService.getApproval.mockResolvedValue(panel(mine));
    show();
    expect(await screen.findByText("Awaiting remittance approver: J. Cruz, A. Tan")).toBeInTheDocument();
    expect(remittanceService.approvalInbox).toHaveBeenLastCalledWith(expect.objectContaining({ view: "submitted" }));
    expect(screen.getByText("No · You submitted it")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review REM-2026-00021" }));
    expect(await screen.findByText(SUBMITTER)).toBeInTheDocument();
    expect(screen.getByText("Can decide: J. Cruz, A. Tan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /comment/i })).not.toBeInTheDocument();
    expect(screen.getByText("REM-2026-00017 · PHP 371,210.00 · +10.2%")).toBeInTheDocument();
  });

  it("an item above the approver's limit is under All pending only, as No · Above your limit", async () => {
    const big = row(30, { amount: 1820000, decision: can({ canDecide: false, blockedCode: "ABOVE_LIMIT", blockedReason: "PHP 1,820,000.00 is above your approval limit of PHP 1,000,000.00.", amount: 1820000 }) });
    remittanceService.approvalInbox.mockImplementation(async ({ view }) => (view === "all" ? inbox([big]) : inbox([], { kpis: kpis({ awaitingMine: { count: 1, amount: 17000 } }) })));
    show("/finance/remittance/approvals?segment=all");
    expect(await screen.findByText("No · Above your limit (PHP 1,000,000.00)")).toBeInTheDocument();
    expect(screen.getByText("Remittance up to PHP 1,000,000.00")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 rows can be approved by you")).toBeInTheDocument();
  });

  it("without a remittance limit: the No approval authority chip, no Awaiting segment and nothing to approve", async () => {
    const r = row(22, { decision: can({ canDecide: false, blockedCode: "NO_AUTHORITY", blockedReason: "You have no approval limit for Remittance approval.", myLimit: null }) });
    remittanceService.approvalInbox.mockResolvedValue(inbox([r], { authority: authority({ canDecide: false, limit: null }) }));
    show();
    expect(await screen.findByText("No approval authority for remittances")).toBeInTheDocument();
    await waitFor(() => expect(remittanceService.approvalInbox).toHaveBeenLastCalledWith(expect.objectContaining({ view: "all" })));
    expect(screen.queryByText(/^Awaiting my decision \(/)).not.toBeInTheDocument();
    expect(await screen.findByText("No · No approval authority")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve selected/ })).not.toBeInTheDocument();
  });

  it("a delegate sees whom they cover and until when", async () => {
    remittanceService.approvalInbox.mockResolvedValue(inbox([], { authority: authority({ covering: [{ name: "A. Santos", until: "2026-10-16" }] }) }));
    show("/finance/remittance/approvals?segment=all");
    expect(await screen.findByText("Covering for A. Santos until 16/10/2026")).toBeInTheDocument();
  });

  it("shows submission times in Manila time, also between 00:00 and 08:00", async () => {
    remittanceService.approvalInbox.mockResolvedValue(inbox([row(23, { submittedAt: "2026-10-09T16:30:00.000Z" })], { kpis: kpis({ awaitingMine: { count: 1, amount: 409141.43 } }) }));
    show();
    expect(await screen.findByText("10/10/2026 00:30")).toBeInTheDocument();
  });

  it("bulk approve decides each row on the server, shows the result per row and reloads", async () => {
    const rows = [row(41), row(42), row(43)];
    remittanceService.approvalInbox.mockResolvedValue(inbox(rows, { kpis: kpis({ awaitingMine: { count: 3, amount: 1227424.29 } }) }));
    remittanceService.decideApprovals.mockResolvedValue({ action: "approve", decided: 2, refused: 1, results: [
      { id: 41, reference: "REM-2026-00041", ok: true, status: "Approved", message: "Approved" },
      { id: 42, reference: "REM-2026-00042", ok: true, status: "Approved", message: "Approved" },
      { id: 43, ok: false, code: "ALREADY_DECIDED", message: "Already approved by J. Cruz at 10:32." }] });
    show("/finance/remittance/approvals?segment=mine");
    expect(await screen.findByText("3 of 3 rows can be approved by you")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Approve selected (3)" }));
    expect(await screen.findByText("Approve 3 items for PHP 1,227,424.29? Settlement and payment follow in Disbursement.")).toBeInTheDocument();
    const calls = remittanceService.approvalInbox.mock.calls.length;
    fireEvent.click(within(dialog()).getByRole("button", { name: "Approve 3 items" }));
    expect(await screen.findByText("2 approved · 1 not approved")).toBeInTheDocument();
    expect(remittanceService.decideApprovals).toHaveBeenCalledWith({ items: [{ id: 41, version: 1 }, { id: 42, version: 1 }, { id: 43, version: 1 }], action: "approve" });
    expect(screen.getByText("Already approved by J. Cruz at 10:32.")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(remittanceService.approvalInbox.mock.calls.length).toBeGreaterThan(calls));
    expect(screen.queryByRole("button", { name: /reject selected/i })).not.toBeInTheDocument();
  });

  it("the deep link opens the panel; Approve asks with the R1 text and a lost race turns the panel read-only", async () => {
    const r = row(51);
    remittanceService.approvalInbox.mockResolvedValue(inbox([r], { kpis: kpis({ awaitingMine: { count: 1, amount: r.amount } }) }));
    remittanceService.getApproval.mockResolvedValueOnce(panel(r)).mockResolvedValue(panel(r, {
      decision: can({ canDecide: false, blockedCode: "ALREADY_DECIDED", blockedReason: "Approved by J. Cruz at 10:32." }) }));
    const err = Object.assign(new Error("Approved by J. Cruz at 10:32."), { status: 409 });
    remittanceService.approveApproval.mockRejectedValue(err);
    show("/finance/remittance/approvals?approval=remittance:51");
    await waitFor(() => expect(remittanceService.getApproval).toHaveBeenCalledWith("51"));
    expect(await screen.findByText("Your limit PHP 1,000,000.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approve REM-2026-00051 for PHP 409,141.43? Settlement and payment follow in Disbursement.")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Approve" }));
    expect(remittanceService.approveApproval).toHaveBeenCalledWith(51, { version: 1 });
    expect(await screen.findByText("Approved by J. Cruz at 10:32.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("Reject needs a reason code and returns the item to the maker", async () => {
    const r = row(61);
    remittanceService.approvalInbox.mockResolvedValue(inbox([r], { kpis: kpis({ awaitingMine: { count: 1, amount: r.amount } }) }));
    remittanceService.getApproval.mockResolvedValue(panel(r));
    remittanceService.rejectApproval.mockResolvedValue({ id: 61, status: "Rejected" });
    show("/finance/remittance/approvals?approval=61");
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(await screen.findByText("REM-2026-00061 · PHP 409,141.43 returns to M. Reyes.")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reject and return to maker" }));
    expect(await within(dialog()).findByText("Choose the reason")).toBeInTheDocument();
    expect(remittanceService.rejectApproval).not.toHaveBeenCalled();
    fireEvent.keyDown(within(dialog()).getByLabelText(/^Reason/), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
    fireEvent.click(await screen.findByRole("option", { name: "Rates to be corrected", hidden: true }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reject and return to maker" }));
    expect(remittanceService.rejectApproval).toHaveBeenCalledWith(61, { reasonCode: "RRJ-RATES", note: undefined }, 1);
    expect(await screen.findByText("Remittance returned to the maker.")).toBeInTheDocument();
  });

  it("Remind is offered to the submitter once per interval, with when it can be sent again", async () => {
    const mine = row(71, { decision: can({ canDecide: false, blockedCode: "SUBMITTER", blockedReason: SUBMITTER }),
      actions: [{ code: "view", label: "View", allowed: true }, { code: "remind", label: "Remind approver", allowed: false, blockedReason: "Reminded 10:15 · next from 14:15" }] });
    remittanceService.approvalInbox.mockResolvedValue(inbox([mine], { kpis: kpis({ submittedByMe: { count: 1 } }) }));
    show("/finance/remittance/approvals?segment=submitted");
    fireEvent.click(await screen.findByRole("button", { name: "Actions for REM-2026-00071" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Reminded 10:15 · next from 14:15")).toBeInTheDocument();
    expect(within(menu).queryByText("Approve")).not.toBeInTheDocument();
  });

  it("empty and error states", async () => {
    remittanceService.approvalInbox.mockResolvedValueOnce(inbox([], { kpis: kpis({ submittedByMe: { count: 2 } }) }));
    const { unmount } = show("/finance/remittance/approvals?segment=mine");
    expect(await screen.findByText("Nothing is waiting for your decision.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Submitted by me (2)" }).length).toBeGreaterThan(0);
    unmount();
    remittanceService.approvalInbox.mockRejectedValueOnce(new Error("down")).mockResolvedValue(inbox([]));
    show("/finance/remittance/approvals?segment=all");
    expect(await screen.findByText("The approvals could not be loaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nothing is pending approval.", {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
