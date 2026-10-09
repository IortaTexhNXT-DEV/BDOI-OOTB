import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import UploadJournalVouchers from "./UploadJournalVouchers";
import journalVoucherService from "../../services/journalVoucherService";

jest.mock("../../services/journalVoucherService", () => ({
  __esModule: true,
  apiErrorMessage: (e, fallback) => e?.response?.data?.message || fallback,
  default: { upload: jest.fn(), downloadTemplate: jest.fn() },
}));

// the hidden file input of the dialog (labelled like the button that opens it)
const choose = (name) => {
  const input = screen.getAllByLabelText("Choose file").find((el) => el.type === "file");
  fireEvent.change(input, { target: { files: [new File(["Voucher Ref"], name, { type: "text/csv" })] } });
};

describe("journal voucher upload", () => {
  it("lists the vouchers parked for approval", async () => {
    journalVoucherService.upload.mockResolvedValue({ message: "2 journal vouchers uploaded for approval",
      data: { total: 4, vouchers: [{ id: "jv_1", voucherRef: "ACCR-1", transactionNumber: "JV-2026-00010", date: "2026-10-31", lineCount: 2, totalDebit: 25000 }] } });
    const onUploaded = jest.fn();
    journalVoucherService.downloadTemplate.mockResolvedValue();
    render(<UploadJournalVouchers visible onHide={() => {}} onUploaded={onUploaded} />);
    fireEvent.click(screen.getByRole("button", { name: /Download template/ }));
    expect(journalVoucherService.downloadTemplate).toHaveBeenCalled();
    choose("jv.csv");
    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));
    expect(await screen.findByText("JV-2026-00010")).toBeInTheDocument();
    expect(screen.getByText("2 journal vouchers uploaded for approval")).toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalled();
  });

  it("shows every row to fix when nothing was saved", async () => {
    journalVoucherService.upload.mockRejectedValue({ response: { data: { message: "Validation failed: nothing was saved",
      errors: [{ path: "row 4 (UNBAL)", message: "Journal is not balanced: debit 100 vs credit 99" }] } } });
    render(<UploadJournalVouchers visible onHide={() => {}} onUploaded={() => {}} />);
    choose("jv.csv");
    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));
    expect(await screen.findByText("row 4 (UNBAL)")).toBeInTheDocument();
    expect(screen.getByText(/not balanced/)).toBeInTheDocument();
  });
});
