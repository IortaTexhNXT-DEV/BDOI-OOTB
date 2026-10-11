import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../../i18n";
import QuotationValidityPanel from "./QuotationValidityPanel";
import quotationService from "../../../services/quotationService";

jest.mock("../../../services/quotationService", () => ({
  __esModule: true,
  default: { getQuotationVersions: jest.fn(), getQuotationVersion: jest.fn(), extendQuotation: jest.fn() },
}));

const validity = (extra = {}) => ({
  validUntil: "2026-11-09", issuedOn: "2026-10-10", latestValidUntil: "2026-12-09", daysLeft: 30, expired: false, extensionCount: 0, maxExtensions: 1,
  extensionDays: 30, extendedAt: null, extendedBy: null, extensionRemarks: null, extendable: true, ...extra,
});
const QUOTE = { quotationId: "qt_1", quotationNumber: "QT-2026-00031", version: 2, currency: "PHP", validity: validity() };
const VERSIONS = {
  quotationNumber: "QT-2026-00031", currentVersion: 2,
  versions: [
    { version: 2, current: true, status: "Draft", grossPremium: 21850, currency: "PHP", validUntil: "2026-11-09" },
    { version: 1, current: false, status: "PendingCustomer", grossPremium: 22950, currency: "PHP", validUntil: "2026-11-09", supersededAt: "2026-10-12T03:00:00Z",
      supersededBy: "Maria Santos", changeReason: "Higher discount" },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations", "extend:quotations"]));
  quotationService.getQuotationVersions.mockResolvedValue(VERSIONS);
});

describe("quotation validity and versions", () => {
  it("shows the validity, the days left and the superseded version read-only", async () => {
    quotationService.getQuotationVersion.mockResolvedValue({ quotationNumber: "QT-2026-00031", version: 1, quotationStatus: "PendingCustomer", grossPremium: 22950,
      netPremium: 18000, discount: 500, currency: "PHP", readOnly: true, changeReason: "Higher discount" });
    render(<QuotationValidityPanel quotation={QUOTE} />);
    expect(screen.getByText("Validity and versions")).toBeInTheDocument();
    expect(screen.getByText("30 days left")).toBeInTheDocument();
    expect(screen.getByText("09/11/2026")).toBeInTheDocument();
    expect(await screen.findByText("v2 (current)")).toBeInTheDocument();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("v1"));
    expect(within(row).getByText("Maria Santos")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByText("Quotation QT-2026-00031 version 1")).toBeInTheDocument();
    expect(quotationService.getQuotationVersion).toHaveBeenCalledWith("qt_1", 1);
  });

  it("extends the validity after confirmation", async () => {
    const onChanged = jest.fn();
    quotationService.extendQuotation.mockResolvedValue({});
    render(<QuotationValidityPanel quotation={QUOTE} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Extend validity" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Loan release pending" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Extend validity" }));
    await waitFor(() => expect(quotationService.extendQuotation).toHaveBeenCalledWith("qt_1", "Loan release pending"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers no extension once extended, when expired or without the permission", async () => {
    const { rerender } = render(<QuotationValidityPanel quotation={{ ...QUOTE, validity: validity({ extendable: false, extensionCount: 1, extendedBy: "Ana Cruz", extendedAt: "2026-10-15T02:00:00Z" }) }} />);
    expect(await screen.findByText("v2 (current)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extend validity" })).toBeNull();
    expect(screen.getByText("Ana Cruz")).toBeInTheDocument();
    rerender(<QuotationValidityPanel quotation={{ ...QUOTE, validity: validity({ expired: true, extendable: false }) }} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:quotations", "write:quotations"]));
    rerender(<QuotationValidityPanel quotation={{ ...QUOTE, version: 3 }} />);
    await waitFor(() => expect(quotationService.getQuotationVersions).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Extend validity" })).toBeNull();
  });
});
