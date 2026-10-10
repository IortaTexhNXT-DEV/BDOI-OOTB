import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import service from "../../services/integrationsService";
import BankPaymentFiles from "./BankPaymentFiles";

jest.mock("../../services/integrationsService", () => ({
  __esModule: true,
  default: { batches: jest.fn(), batch: jest.fn(), layouts: jest.fn(), bankAccounts: jest.fn(), eligibleVouchers: jest.fn() },
}));
jest.mock("../Remittance/shared", () => ({ loadInsurerOptions: () => Promise.resolve([]) }));

const BATCH = {
  id: "bpb_19", batchNumber: "BPB-2026-0019", layoutName: "Metrobank fund transfer", channel: "bulk_credit", valueDate: "2026-10-12", status: "for-approval",
  lineCount: 1, totalAmount: 409141.43, paidCount: 0, rejectedCount: 0, createdBy: "M. Reyes", createdAt: "2026-10-12T03:00:00.000Z", lines: [],
};

const open = (batch) => {
  service.batches.mockResolvedValue({ rows: [batch], total: 1, counts: {} });
  service.batch.mockResolvedValue(batch);
  render(<MemoryRouter initialEntries={[`/accounts/bank-payment-files?batch=${batch.id}`]}><BankPaymentFiles /></MemoryRouter>);
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.removeItem("USER_PERMISSIONS");
});

describe("Bank Payment Files decision block", () => {
  it("?batch= opens the batch; the batch maker reads why instead of Approve and Reject", async () => {
    open({ ...BATCH, decision: { canDecide: false, blockedCode: "MAKER", blockedReason: "You prepared this batch. Another user must approve it." } });
    expect(await screen.findByText("You prepared this batch. Another user must approve it.")).toBeInTheDocument();
    expect(service.batch).toHaveBeenCalledWith("bpb_19");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return to draft" })).not.toBeInTheDocument();
  });

  it("a voucher maker reads the voucher they prepared", async () => {
    open({ ...BATCH, decision: { canDecide: false, blockedCode: "VOUCHER_MAKER", blockedReason: "You prepared payment voucher PV-2026-00102 in this batch. Another user must approve it." } });
    expect(await screen.findByText(/You prepared payment voucher PV-2026-00102/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("a reader of the batches sees no workflow step, and the payee's account by its last four digits", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:disbursements"]));
    open({ ...BATCH, decision: { canDecide: false, blockedCode: "NO_PERMISSION", blockedReason: "You can view payment batches but not approve them." },
      lines: [{ id: 1, seq: 1, voucherNumber: "PV-2026-00013", payeeName: "Pioneer", accountName: "Pioneer", bankCode: "BPI", accountNumber: "3081-9988-01", amount: 89026, status: "pending" }] });
    expect(await screen.findByText("BPI ···8801")).toBeInTheDocument();
    expect(screen.queryByText(/3081-9988-01/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel batch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New batch" })).not.toBeInTheDocument();
    expect(screen.getAllByText("PHP 89,026.00").length).toBeGreaterThan(0);
  });

  it("a user who may decide gets Approve and Reject", async () => {
    open({ ...BATCH, decision: { canDecide: true, blockedCode: null, blockedReason: null } });
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to draft" })).toBeInTheDocument();
  });
});
