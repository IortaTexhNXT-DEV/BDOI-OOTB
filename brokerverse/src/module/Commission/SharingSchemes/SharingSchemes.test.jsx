import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import CommissionService from "../../../services/commissionService";
import numberingService from "../../../services/numberingService";
import SharingSchemes from ".";

jest.mock("../../../services/commissionService", () => ({
  __esModule: true,
  default: { listSchemes: jest.fn(), schemeOptions: jest.fn(), schemeAssignments: jest.fn(), createScheme: jest.fn(), updateScheme: jest.fn(), schemeAction: jest.fn(), schemeExample: jest.fn(), assignScheme: jest.fn(), getReferrerAccounts: jest.fn(), listChannels: jest.fn() },
}));
jest.mock("../../../services/numberingService", () => ({ __esModule: true, default: { options: jest.fn() } }));

const scheme = {
  id: 1, code: "DLR-STD", name: "Dealer standard share", partyTypes: ["Dealer"], productIds: [2], productNames: ["Motor Car"], policyType: "any", effectiveFrom: "2026-12-01", effectiveTo: null,
  status: "active", statusLabel: "Active", version: 1, assignments: { referrers: 0, channels: 2 },
  lines: [{ lineNo: 1, paidTo: "channel", basis: "commission-pct", perils: ["OD", "AON"], defaultValue: 40, min: 30, max: 50, paidToLabel: "Dealer / partner of the channel", basisLabel: "% of commission" }],
};
const options = { approvalRequired: true, partyTypes: ["Agent", "Dealer"], shareBases: [{ code: "variance", label: "Variance" }, { code: "commission-pct", label: "% of commission" }], paidTo: [{ code: "referrer", label: "Referrer" }, { code: "channel", label: "Channel" }] };
const signIn = (permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  CommissionService.listSchemes.mockResolvedValue({ data: [scheme] });
  CommissionService.schemeOptions.mockResolvedValue({ data: options });
  CommissionService.schemeAssignments.mockResolvedValue({ data: { referrers: [], channels: [{ id: "ch_1", code: "TDG", name: "Toyota Dealer Group", channelType: "dealer_group", override: 45 }] } });
  numberingService.options.mockResolvedValue([{ label: "Motor Car", value: 2 }]);
});

describe("Sharing Schemes", () => {
  it("lists the schemes with their split lines and status; Finance can add one", async () => {
    signIn(["read:sharing-schemes", "write:sharing-schemes"]);
    render(<MemoryRouter><SharingSchemes /></MemoryRouter>);
    expect(await screen.findByText("DLR-STD")).toBeInTheDocument();
    expect(screen.getByText("Dealer standard share")).toBeInTheDocument();
    expect(screen.getByText(/40% \(30–50\)/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add scheme" })).toBeInTheDocument();
  });

  it("offers no Add scheme and no approver actions to a reader", async () => {
    signIn(["read:sharing-schemes"]);
    render(<MemoryRouter><SharingSchemes /></MemoryRouter>);
    expect(await screen.findByText("DLR-STD")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add scheme" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for scheme DLR-STD" }));
    expect(await screen.findByRole("menuitem", { name: "View" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("lets an approver suspend a scheme with a remark", async () => {
    signIn(["read:sharing-schemes", "approve:sharing-schemes"]);
    CommissionService.schemeAction.mockResolvedValue({ data: { ...scheme, status: "suspended", statusLabel: "Suspended" } });
    render(<MemoryRouter><SharingSchemes /></MemoryRouter>);
    expect(await screen.findByText("DLR-STD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for scheme DLR-STD" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend" }));
    expect(await screen.findByText("Suspend Sharing Scheme")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Remark" }), { target: { value: "Terms under review" } });
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(CommissionService.schemeAction).toHaveBeenCalledWith(1, "suspend", { note: "Terms under review" }));
  });
});
