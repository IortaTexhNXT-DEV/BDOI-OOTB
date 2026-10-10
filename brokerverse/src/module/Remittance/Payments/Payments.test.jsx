import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../../../i18n";
import { remittanceService, masterService } from "../../../services/remittanceService";
import integrationsService from "../../../services/integrationsService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import Payments from ".";
import { segmentOf, segmentsShown, selectedIds, timelineSteps } from "./paymentsModel";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  remittanceService: {
    listPayments: jest.fn(), getPayment: jest.fn(), revealPaymentAccount: jest.fn(), legacyTransfers: jest.fn(), getTransfer: jest.fn(), download: jest.fn(),
    exportPaymentsPath: jest.fn(() => "/remittance/payments/export.xlsx?segment=to-pay"),
  },
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
  default: {},
}));
jest.mock("../../../services/integrationsService", () => ({
  __esModule: true,
  default: { layouts: jest.fn(), bankAccounts: jest.fn(), eligibleVouchers: jest.fn(), createBatch: jest.fn() },
}));

const PIONEER = { id: 3, code: "PIONEER", name: "Pioneer Insurance & Surety Corp.", shortName: "Pioneer" };
const view = (no) => ({ code: "view", label: "View payment", allowed: true, link: `/finance/remittance/payments?payment=${no}` });
const payRow = (n, extra = {}) => ({
  id: `pv_${n}`, voucherNo: `PV-2026-00${n}`, voucherStatus: "for-approval", state: "to-pay", stateLabel: "To pay", amount: 1000 * n, currency: "PHP", insurer: PIONEER,
  remittance: { id: `rm_${n}`, remittanceNo: `REM-2026-00${n}`, link: `/finance/remittance/remittances/rm_${n}` }, remittances: [],
  payee: { bank: { code: "MBT", name: "Metrobank" }, accountMasked: "···4821", label: "Metrobank ···4821", chip: { code: "on-file", label: "On file" } },
  method: null, batch: null, cheque: null, valueDate: "2026-10-12", bankReference: null, paidOn: null, failureReason: null,
  nextStep: { code: "create-batch", label: "Create batch" }, selectable: true,
  actions: [view(`PV-2026-00${n}`), { code: "open-remittance", label: "Open remittance", allowed: true, link: `/finance/remittance/remittances/rm_${n}` },
    { code: "pay-by-cheque", label: "Pay by cheque", allowed: true, link: `/accounts/paymentvoucher/detailview/pv_${n}` }],
  ...extra,
});
const noAccount = payRow(103, { selectable: false, payee: { bank: null, accountMasked: null, label: null, chip: { code: "none", label: "No account" } },
  nextStep: { code: "add-account", label: "Add bank account or pay by cheque" } });
const failed = payRow(104, { state: "failed", stateLabel: "Failed", selectable: false, nextStep: { code: "repay", label: "Re-batch or pay by cheque", reason: "Account closed" },
  batch: { id: "bpb_9", number: "BPB-2026-0009", status: "completed", statusLabel: "Completed", link: "/accounts/bank-payment-files?batch=bpb_9" } });
const kpis = { toPay: { count: 2, amount: 3000 }, inPayment: { count: 1, amount: 9000 }, paidThisWeek: { count: 1, amount: 5000 }, failed: { count: 1, amount: 4000 } };
const BATCHING = { allowed: true, code: null, reason: null, bankCode: "MBT", layout: { code: "MBT-BULK", name: "Metrobank fund transfer" }, chequeAllowed: true };
const page = (rows, extra = {}) => ({
  data: rows, total: rows.length, segment: "to-pay", totals: { count: rows.length, amount: 3000 }, kpis,
  segments: { "to-pay": 2, "in-payment": 1, paid: 1, failed: 1, all: 5 }, batching: BATCHING, legacyTransfers: 0, ...extra,
});
const record = {
  ...payRow(101), payee: { ...payRow(101).payee, accountName: "Pioneer Insurance & Surety Corp.", canReveal: true, verification: { code: "on-file", label: "On file" }, insurer: PIONEER },
  remittances: [{ id: "rm_21", remittanceNo: "REM-2026-00021", link: "/finance/remittance/remittances/rm_21" }],
  payment: { method: null, amount: 101000, valueDate: "2026-10-12", debitAccount: null, bankReference: null, paidOn: null, failureReason: null },
  amounts: { dueToInsurer: 101000, refundCredits: 0, voucherAmount: 101000, bankAmount: null, check: { code: "pass", label: "Pass", difference: 0 } },
  links: { remittances: [{ remittanceNo: "REM-2026-00021", link: "/finance/remittance/remittances/rm_21", schedule: "/remittance/remittances/rm_21/schedule.xlsx" }],
    voucher: { number: "PV-2026-00101", link: "/accounts/paymentvoucher/detailview/pv_101" }, batch: null, bankFile: null, statusFile: null, cheque: null, journal: null },
  approvals: { remittances: [{ remittanceNo: "REM-2026-00021", by: "J. Cruz", at: "2026-10-12T02:32:00.000Z", limitAtDecision: 1000000, limitSourceLabel: "Role limit: TIS Finance" }],
    voucherMaker: { name: "M. Reyes", at: "2026-10-12T03:00:00.000Z" }, batchCreatedBy: null, batchApprovedBy: null, fileGeneratedBy: null, resultImportedBy: null },
  timeline: [{ code: "voucher-raised", label: "Voucher raised", done: true, at: "2026-10-12T03:00:00.000Z", by: "M. Reyes" }, { code: "in-batch", label: "In batch", done: false }],
  activity: [],
};
const transfer = {
  id: "rmi_3", reference: "TRF-2026-00001", beneficiary: "Malayan Insurance Co., Inc.", bank: "Metrobank", accountMasked: "···6612", amount: 125000, method: "PESONet",
  status: "Approved", statusLabel: "Approved", approvedBy: { name: "Fe Approver", at: "2026-09-27T02:00:00.000Z" }, journal: { id: "jv_1", number: "JV-2026-00031" },
  reversal: { reversed: false, number: null, date: null, label: "Not reversed" }, readOnly: true, chip: { code: "legacy", label: "Recorded outside a payment voucher" },
  date: "2026-09-26", createdBy: "R. Finance", createdAt: "2026-09-26T02:00:00.000Z", approval: { status: "Approved", decisions: [] }, activity: [],
};

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
};
const show = (path = "/finance/remittance/payments") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="*" element={<><Payments /><Where /></>} /></Routes>
  </MemoryRouter>
);
const signIn = (roles, permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  signIn(["tis-finance"], ["read:remittance", "write:remittance", "read:disbursements", "write:disbursements"]);
  masterService.options.mockResolvedValue([{ label: "Pioneer Insurance & Surety Corp.", code: "PIONEER", id: 3 }]);
  remittanceService.getPayment.mockResolvedValue(record);
  remittanceService.getTransfer.mockResolvedValue(transfer);
  remittanceService.legacyTransfers.mockResolvedValue({ data: [transfer], total: 1, totals: { count: 1, amount: 125000 } });
  remittanceService.download.mockResolvedValue();
});

describe("Insurer payments", () => {
  it("shows the KPI cards, the five segments, On file and No account chips, and no transfer to create", async () => {
    remittanceService.listPayments.mockResolvedValue(page([payRow(101), payRow(102), noAccount]));
    show();
    expect(await screen.findByText("PV-2026-00101")).toBeInTheDocument();
    expect(remittanceService.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ segment: "to-pay", perPage: 50 }));
    ["To pay (2)", "In payment (1)", "Paid (1)", "Failed (1)", "All (5)"].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.queryByText(/Legacy transfers/)).not.toBeInTheDocument();
    expect(screen.getByText("Paid this week")).toBeInTheDocument();
    expect(screen.getAllByText("On file")).toHaveLength(2);
    expect(screen.getAllByText("No account").length).toBeGreaterThan(0);
    expect(screen.queryByRole("checkbox", { name: "Select PV-2026-00103" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select payments to batch" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /transfer/i })).not.toBeInTheDocument();
  });

  it("View payment opens the payment panel with its five sections, never a toast", async () => {
    remittanceService.listPayments.mockResolvedValue(page([payRow(101)]));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for PV-2026-00101" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")[0]).toHaveTextContent("View payment");
    fireEvent.click(screen.getByRole("menuitem", { name: "View payment" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("payment=PV-2026-00101"));
    expect(await screen.findByText("Voucher raised")).toBeInTheDocument();
    expect(remittanceService.getPayment).toHaveBeenCalledWith("PV-2026-00101");
    ["Payee", "Amounts", "Links", "Approvals"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
    expect(screen.getAllByText("Payment").length).toBeGreaterThan(0);
    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("?payment= opens the same panel, and Show full number asks the server", async () => {
    remittanceService.listPayments.mockResolvedValue(page([payRow(101)]));
    remittanceService.revealPaymentAccount.mockResolvedValue({ accountNumber: "0071-5566-4821" });
    show("/finance/remittance/payments?payment=PV-2026-00101");
    fireEvent.click(await screen.findByRole("button", { name: "Show full number" }));
    expect(await screen.findByText("0071-5566-4821")).toBeInTheDocument();
    expect(remittanceService.revealPaymentAccount).toHaveBeenCalledWith("pv_101");
  });

  it("Create Metrobank batch preselects the ticked vouchers and reports the draft batch", async () => {
    remittanceService.listPayments.mockResolvedValue(page([payRow(101), payRow(102)]));
    integrationsService.layouts.mockResolvedValue({ data: [{ code: "MBT-BULK", name: "Metrobank fund transfer", bankCode: "MBT", channels: ["bulk_credit"] }] });
    integrationsService.bankAccounts.mockResolvedValue([{ code: "ACC-MBT-001", name: "TISPH Metrobank", bankCode: "MBT", accountNumber: "0012" }]);
    integrationsService.eligibleVouchers.mockResolvedValue([
      { disbursementId: "pv_101", voucherNumber: "PV-2026-00101", payeeType: "Insurer", payeeName: "Pioneer", amount: 101000, ready: true },
      { disbursementId: "pv_102", voucherNumber: "PV-2026-00102", payeeType: "Insurer", payeeName: "Pioneer", amount: 102000, ready: true },
    ]);
    integrationsService.createBatch.mockResolvedValue({ data: { id: "bpb_19", batchNumber: "BPB-2026-0019" }, message: "Batch BPB-2026-0019 created" });
    show();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select PV-2026-00102" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Metrobank batch (1)" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("PV-2026-00102")).toBeInTheDocument();
    expect(within(dialog).queryByText("PV-2026-00101")).not.toBeInTheDocument();
    expect(integrationsService.eligibleVouchers).toHaveBeenCalledWith({ payeeType: "Insurer" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create batch with 1 payment" }));
    expect(await screen.findByText("Batch BPB-2026-0019 created. Submit it in Bank Payment Files.")).toBeInTheDocument();
    expect(integrationsService.createBatch).toHaveBeenCalledWith(expect.objectContaining({ layoutCode: "MBT-BULK", bankAccountCode: "ACC-MBT-001", disbursementIds: ["pv_102"] }));
  });

  it("with no Metrobank layout the primary button is disabled with the reason, and Pay by cheque stays", async () => {
    const noLayout = { allowed: false, code: "NO_LAYOUT", reason: "No Metrobank layout configured. Pay by cheque or ask the administrator.", bankCode: "MBT", layout: null, chequeAllowed: true };
    remittanceService.listPayments.mockResolvedValue(page([payRow(101, { selectable: false })], { batching: noLayout }));
    show();
    expect(await screen.findByText("No Metrobank layout configured. Pay by cheque or ask the administrator.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Metrobank batch" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Actions for PV-2026-00101" }));
    expect(screen.getByRole("menuitem", { name: "Pay by cheque" })).toBeInTheDocument();
  });

  it("a failed row shows the bank's reason in Next step", async () => {
    remittanceService.listPayments.mockResolvedValue(page([failed], { segment: "failed" }));
    show("/finance/remittance/payments?segment=failed");
    expect(await screen.findByText("Account closed")).toBeInTheDocument();
    expect(screen.getByText("Re-batch or pay by cheque")).toBeInTheDocument();
  });

  it("a read-only user sees View only, no tick box and no primary button", async () => {
    signIn(["tis-general-manager"], ["read:remittance", "read:disbursements"]);
    remittanceService.listPayments.mockResolvedValue(page([payRow(101, { selectable: false })], { batching: { allowed: false, code: "NO_PERMISSION", reason: "You can view insurer payments but not pay them." } }));
    show();
    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Metrobank batch|Select payments/ })).not.toBeInTheDocument();
  });

  it("Legacy transfers appear only with TRF- items and open read-only with the journal and the reversal", async () => {
    remittanceService.listPayments.mockResolvedValue(page([], { legacyTransfers: 1 }));
    show("/finance/remittance/payments?segment=legacy");
    expect(await screen.findByText("Legacy transfers (1)")).toBeInTheDocument();
    expect(await screen.findByText("TRF-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Creation disabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "TRF-2026-00001" }));
    expect(await screen.findByText("Recorded outside a payment voucher")).toBeInTheDocument();
    expect(remittanceService.getTransfer).toHaveBeenCalledWith("TRF-2026-00001");
    expect(screen.getAllByText("JV-2026-00031").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not reversed").length).toBeGreaterThan(1);
  });

  it("a load error offers Try again", async () => {
    remittanceService.listPayments.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([payRow(101)]));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("PV-2026-00101")).toBeInTheDocument();
  });
});

describe("payments model", () => {
  it("segments, selection and timeline", () => {
    expect(segmentOf("paid")).toBe("paid");
    expect(segmentOf("nope")).toBe("to-pay");
    expect(segmentsShown(0, "to-pay")).not.toContain("legacy");
    expect(segmentsShown(2, "to-pay")).toContain("legacy");
    expect(segmentsShown(0, "legacy")).toContain("legacy");
    expect(selectedIds([{ id: "a" }, { id: "b" }, { id: "c" }], [{ id: "c" }, { id: "a" }])).toEqual(["a", "c"]);
    expect(timelineSteps([{ code: "a", label: "A", done: true }, { code: "b", label: "B", done: false }, { code: "c", label: "Rejected", done: true, reason: "Closed" }, { code: "d", label: "D" }])
      .map((s) => [s.label, s.state])).toEqual([["A", "done"], ["B", "current"], ["Rejected · Closed", "done"], ["D", "pending"]]);
  });
});
