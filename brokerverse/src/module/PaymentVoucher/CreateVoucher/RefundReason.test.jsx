import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../i18n";
import RefundReason, { refundReasonError } from "./RefundReason";
import opsAccountingService from "../../../services/opsAccountingService";

jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const CUSTOMER = { name: "Customer", code: "Customer" };

describe("refund reason on Create Voucher (GAP-CASH-17)", () => {
  beforeEach(() => {
    opsAccountingService.masterRecords.mockResolvedValue({ rows: [{ code: "REF-CANCEL", name: "Cancellation refund", context: "refund", requiresNote: true, status: "Active" }] });
  });

  it("shows the refund reasons for a Customer payee", async () => {
    render(<RefundReason payeeType={CUSTOMER} value={null} onChange={() => {}} />);
    expect(await screen.findByText("Refund reason")).toBeInTheDocument();
    expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", expect.objectContaining({ context: "refund" }));
  });

  it("is not shown for another payee", () => {
    const { container } = render(<RefundReason payeeType={{ name: "Insurer", code: "Insurer" }} value={null} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Refund reason")).toBeNull();
  });

  it("is required for a Customer payee, with its note, and not asked of other payees", () => {
    expect(refundReasonError({ PayeeType: CUSTOMER })).toBe("paymentVoucher.refundReasonRequired");
    expect(refundReasonError({ PayeeType: "Customer", RefundReason: { reasonCode: "REF-CANCEL", noteRequired: true, note: "" } })).toBe("paymentVoucher.refundNoteRequired");
    expect(refundReasonError({ PayeeType: CUSTOMER, RefundReason: { reasonCode: "REF-CANCEL", noteRequired: true, note: "Mid-term cancellation" } })).toBeNull();
    expect(refundReasonError({ PayeeType: { code: "Insurer" } })).toBeNull();
    expect(refundReasonError({ PayeeType: "Agent/Referrer" })).toBeNull();
  });
});
