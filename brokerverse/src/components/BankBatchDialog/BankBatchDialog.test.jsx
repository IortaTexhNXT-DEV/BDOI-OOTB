import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import service from "../../services/integrationsService";
import BankBatchDialog, { defaultLayout, firstWorkingDay, valueDateProblem } from ".";

jest.mock("../../services/integrationsService", () => ({
  __esModule: true,
  default: { layouts: jest.fn(), bankAccounts: jest.fn(), eligibleVouchers: jest.fn(), createBatch: jest.fn() },
}));

const LAYOUTS = [
  { code: "BDO-BULK", name: "BDO bulk credit", bankCode: "BDO", channels: ["bulk_credit"], isExample: false },
  { code: "MBT-BULK", name: "Metrobank fund transfer", bankCode: "MBT", channels: ["bulk_credit", "pesonet"], isExample: false },
];
const ACCOUNTS = [
  { code: "ACC-BDO-001", name: "Operating", bankCode: "BDO", accountNumber: "001" },
  { code: "ACC-MBT-001", name: "TISPH Metrobank", bankCode: "MBT", accountNumber: "0012" },
];
const VOUCHERS = [
  { disbursementId: "pv_102", voucherNumber: "PV-2026-00102", payeeType: "Insurer", payeeName: "Pioneer Insurance", amount: 409141.43, bankCode: "MBT", accountNumber: "4821", ready: true },
  { disbursementId: "pv_103", voucherNumber: "PV-2026-00103", payeeType: "Insurer", payeeName: "AXA Philippines", amount: 1000, bankCode: "MBT", accountNumber: "1111", ready: true },
  { disbursementId: "pv_104", voucherNumber: "PV-2026-00104", payeeType: "Insurer", payeeName: "Stronghold", amount: 500, bankCode: null, accountNumber: null, ready: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  service.layouts.mockResolvedValue({ data: LAYOUTS });
  service.bankAccounts.mockResolvedValue(ACCOUNTS);
  service.eligibleVouchers.mockResolvedValue(VOUCHERS);
  service.createBatch.mockResolvedValue({ data: { id: "bpb_19", batchNumber: "BPB-2026-0019" }, message: "Batch BPB-2026-0019 created with 1 payment(s)" });
});

describe("BankBatchDialog", () => {
  it("lists only the preselected vouchers, all included, with the Metrobank layout and debit account chosen", async () => {
    const onCreated = jest.fn();
    render(<BankBatchDialog visible preselectedIds={["pv_102", "pv_999"]} payeeType="Insurer" bankCode="MBT" onHide={() => {}} onCreated={onCreated} />);
    expect(await screen.findByText("PV-2026-00102")).toBeInTheDocument();
    expect(screen.queryByText("PV-2026-00103")).not.toBeInTheDocument();
    expect(service.eligibleVouchers).toHaveBeenCalledWith({ payeeType: "Insurer" });
    expect(screen.getByText("Included payments")).toBeInTheDocument();
    expect(screen.getByText("1 selected payment can no longer go on a batch.")).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create batch with 1 payment" });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "bpb_19", batchNumber: "BPB-2026-0019" }, "Batch BPB-2026-0019 created with 1 payment(s)"));
    expect(service.createBatch).toHaveBeenCalledWith(expect.objectContaining({ layoutCode: "MBT-BULK", bankAccountCode: "ACC-MBT-001", channel: "bulk_credit", disbursementIds: ["pv_102"] }));
    expect(service.createBatch.mock.calls[0][0].valueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("without a preselection lists every voucher; one without an account cannot be ticked; nothing ticked means no batch", async () => {
    render(<BankBatchDialog visible bankCode="BDO" onHide={() => {}} onCreated={() => {}} />);
    expect(await screen.findByText("PV-2026-00104")).toBeInTheDocument();
    expect(screen.getByText("No bank account on file")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Include PV-2026-00104" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create batch with 0 payments" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include PV-2026-00103" }));
    expect(screen.getByRole("button", { name: "Create batch with 1 payment" })).toBeEnabled();
    expect(screen.getByText(/1 payment ·/)).toBeInTheDocument();
  });

  it("keeps a refusal of the server in the dialog", async () => {
    service.createBatch.mockRejectedValue(new Error("Some vouchers cannot be paid by this batch"));
    const onCreated = jest.fn();
    render(<BankBatchDialog visible preselectedIds={["pv_102"]} bankCode="MBT" onHide={() => {}} onCreated={onCreated} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create batch with 1 payment" }));
    expect(await screen.findByText("Some vouchers cannot be paid by this batch")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("chooses the layout of the bank and checks the value date", () => {
    expect(defaultLayout(LAYOUTS, { bankCode: "mbt" }).code).toBe("MBT-BULK");
    expect(defaultLayout(LAYOUTS, { layoutCode: "BDO-BULK", bankCode: "MBT" }).code).toBe("BDO-BULK");
    expect(defaultLayout(LAYOUTS, {})).toBeNull();
    expect(defaultLayout([{ code: "X", bankCode: "MBT", isExample: true }, { code: "Y", bankCode: "MBT", isExample: false }], { bankCode: "MBT" }).code).toBe("Y");
    expect(valueDateProblem("2026-10-09", "2026-10-12")).toBe("past");
    expect(valueDateProblem("2026-10-17", "2026-10-12")).toBe("weekend");
    expect(valueDateProblem("2026-10-12", "2026-10-12")).toBeNull();
    expect(valueDateProblem("", "2026-10-12")).toBe("required");
    expect(firstWorkingDay("2026-10-10")).toBe("2026-10-12");
    expect(firstWorkingDay("2026-10-13")).toBe("2026-10-13");
  });
});
