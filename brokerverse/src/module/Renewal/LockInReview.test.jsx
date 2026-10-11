import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import LockInReview from "./LockInReview";
import { lockInService as service } from "../../services/dealerSchemesService";

jest.mock("../../services/dealerSchemesService", () => ({
  __esModule: true,
  saveBlob: jest.fn(),
  lockInService: { reviews: jest.fn(), review: jest.fn(), decide: jest.fn(), approve: jest.fn(), report: jest.fn(), uploads: jest.fn(), uploadsTemplate: jest.fn(), failedRows: jest.fn(),
    uploadStatus: jest.fn() },
}));
jest.mock("../../components/ReasonPicker", () => ({
  __esModule: true,
  default: ({ onChange }) => <button type="button" onClick={() => onChange({ reasonCode: "LKR-CONFIRMED", note: "" })}>pick reason</button>,
  reasonPayload: (v) => ({ reasonCode: v?.reasonCode, note: v?.note || undefined }),
  reasonProblem: (v) => (v?.reasonCode ? null : "reason"),
}));

const ACCOUNT = {
  policyId: "pol_1", policyNumber: "POL-2026-00120", insured: "Ramon Villanueva", source: "scheme1-ara", sourceLabel: "Scheme 1 ARA", yearLabel: "2 of 5", expiryDate: "2026-11-10",
  daysToExpiry: 30, reviewDate: "2026-09-10", loanStatus: "past-due", loanStatusLabel: "Past due", loanAccount: "8003000001", treatment: { code: "held", label: "Held: TFS loan Past due" },
  reviewId: "lkr_1", reviewStatus: "review-due", reviewStatusLabel: "Review due", owner: "Ana Reyes",
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ID", "usr_sales");
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:lock-in", "write:lock-in"]));
  service.reviews.mockResolvedValue({ data: { asOf: "2026-10-11", items: [ACCOUNT] }, counts: { due: 1, held: 1, pending: 0, "in-lock-in": 4 } });
  service.review.mockResolvedValue({ id: "lkr_1", status: "review-due", statusLabel: "Review due", account: ACCOUNT, loanHistory: [] });
  service.uploads.mockResolvedValue([{ id: "lsb_1", batchNumber: "LS-2026-90001", fileName: "tfs.xlsx", rowsTotal: 7, updated: 3, notChanged: 0, failed: 4, noticesHeld: 1 }]);
});

describe("Lock-in Review", () => {
  it("lists the accounts due for review with the lock-in year, TFS loan status and notice treatment; tab counts", async () => {
    render(<MemoryRouter><LockInReview /></MemoryRouter>);
    expect(await screen.findByText("POL-2026-00120")).toBeInTheDocument();
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Held: TFS loan Past due")).toBeInTheDocument();
    expect(screen.getByText("Review Due (1)")).toBeInTheDocument();
    expect(screen.getByText("In Lock-in (4)")).toBeInTheDocument();
  });

  it("records the decision with a reason and a remark; the server message is shown when refused", async () => {
    service.decide.mockRejectedValue(Object.assign(new Error("The TFS loan is Past due; choose Hold, Release or Not for renewal"), { errors: [{ path: "decision", message: "The TFS loan is Past due; choose Hold, Release or Not for renewal" }] }));
    render(<MemoryRouter><LockInReview /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /view/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("pick reason"));
    fireEvent.change(within(dialog).getByLabelText("Remark (at least 10 characters)"), { target: { value: "Client confirmed the renewal" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save decision" }));
    expect((await within(dialog).findAllByText("The TFS loan is Past due; choose Hold, Release or Not for renewal")).length).toBeGreaterThan(0);
    expect(service.decide).toHaveBeenCalledWith("lkr_1", expect.objectContaining({ decision: "renew", reasonCode: "LKR-CONFIRMED", remark: "Client confirmed the renewal" }));
  });

  it("the uploads tab lists the TFS account status uploads with their failed rows", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:lock-in", "write:loan-status"]));
    render(<MemoryRouter><LockInReview /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Loan Status Uploads"));
    expect(await screen.findByText("LS-2026-90001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Failed rows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload loan status" })).toBeEnabled();
  });
});
