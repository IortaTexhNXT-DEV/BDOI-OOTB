import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "../../i18n";
import LockInAccounts from "./LockInAccounts";
import AtRiskAnalysis from "./AtRiskAnalysis";
import { NoticeChip } from "./shared";
import service from "../../services/renewalsWorkspaceService";

jest.mock("../../services/renewalsWorkspaceService", () => ({
  __esModule: true,
  default: { getLockIns: jest.fn(), lockInsWorkbook: jest.fn(), setLoanStatus: jest.fn(), getAtRisk: jest.fn(), getRenewal: jest.fn() },
}));

const store = configureStore({ reducer: { systemSettingsReducer: () => ({ displayCurrency: "PHP" }) } });
const wrap = (ui, path = "/") => render(<Provider store={store}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></Provider>);

const LOCK_IN = {
  policyId: "pol_9", renewalId: "rnw_9", policyNumber: "TIS-MC-2024-00031", clientName: "Ramon Villanueva", expiryDate: "2026-12-01", daysToExpiry: 52,
  source: "promotion", sourceLabel: "Promotion lock-in", year: 2, lockIn: { years: 3, reference: "PROMO-2024-07" }, reviewDate: "2026-10-02", reviewDue: true,
  loanStatus: "current", loanStatusLabel: "Current", tfsLoanAccount: "TFS-0045812", noticeTreatment: { code: "lock-in", label: "Lock-in: not sent" }, owner: "Ana Reyes",
};
const PAGE = {
  asOf: "2026-10-10", items: [LOCK_IN],
  sources: { promotion: "Promotion lock-in", scheme2: "Scheme 2" },
  loanStatuses: { current: "Current", "past-due": "Past due", closed: "Closed" },
  treatments: { send: "Sent as scheduled", "lock-in": "Lock-in: not sent", held: "Held" },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:renewals", "write:renewals"]));
  service.getLockIns.mockResolvedValue(PAGE);
});

describe("Lock-in Accounts", () => {
  it("lists the lock-in accounts with their year, review date, loan status and notice treatment", async () => {
    wrap(<LockInAccounts />);
    expect(await screen.findByText("TIS-MC-2024-00031")).toBeInTheDocument();
    expect(screen.getByText("Year 2 of 3")).toBeInTheDocument();
    expect(screen.getAllByText("Review due").length).toBeGreaterThan(0);
    expect(screen.getByText("TFS-0045812")).toBeInTheDocument();
    expect(screen.getAllByText("Lock-in: not sent").length).toBeGreaterThan(0);
  });

  it("opens the loan status change with the loan account and its current status", async () => {
    wrap(<LockInAccounts />);
    await screen.findByText("TIS-MC-2024-00031");
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(await screen.findByText("Set loan status"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("TFS-0045812")).toBeInTheDocument();
    expect(within(dialog).getByText("Current status")).toBeInTheDocument();
    expect(service.setLoanStatus).not.toHaveBeenCalled();
  });

  it("does not offer the loan status change without write:renewals", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:renewals"]));
    wrap(<LockInAccounts />);
    await screen.findByText("TIS-MC-2024-00031");
    expect(screen.queryByText("Set loan status")).toBeNull();
  });
});

describe("Notice treatment chip", () => {
  it("shows nothing while the notices go out and a chip when they are held", () => {
    const { container } = render(<NoticeChip treatment={{ code: "send", label: "Send" }} />);
    expect(container).toBeEmptyDOMElement();
    render(<NoticeChip treatment={{ code: "held", label: "Held" }} />);
    expect(screen.getByText("Held")).toBeInTheDocument();
  });
});

describe("Renewal link", () => {
  it("opens the renewal named in the address", async () => {
    service.getAtRisk.mockResolvedValue([{
      id: "rnw_1", renewalNumber: "RN-2026-00001", policyId: "pol_1", policyNumber: "POL-2025-00014", insuredName: "Mindanao Agri Trading Inc.", expiryDate: "2026-11-12",
      daysToExpiry: 34, status: "Quote Sent", riskScore: 60, riskCategory: "High", riskFactors: [], scoreBreakdown: [], recommendedActions: [], assignedAgent: "Ana Reyes",
    }]);
    service.getRenewal.mockResolvedValue({ activities: [], notices: [] });
    wrap(<AtRiskAnalysis />, "/renewal/at-risk?renewal=rnw_1");
    expect(await screen.findByRole("heading", { name: "Score breakdown" })).toBeInTheDocument();
    await waitFor(() => expect(service.getRenewal).toHaveBeenCalledWith("rnw_1"));
  });
});
