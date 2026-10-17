import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import CommissionService from "../../../services/commissionService";
import ReferrerAccounts from ".";

jest.mock("../../../services/commissionService", () => ({
  __esModule: true,
  default: { getReferrerAccounts: jest.fn(), listRequests: jest.fn(), getReferrerOptions: jest.fn(), createReferrer: jest.fn(), updateReferrer: jest.fn(), verifyReferrer: jest.fn(),
    getReferrerAccount: jest.fn() },
}));

const payees = [
  { id: "ref-dlr", name: "Toyota Dealer Alabang", type: "Dealer", level: null, policies: 2, netPayable: 1200, whtType: "Company 10%", whtApplicable: true, bankAccount: "BDO ***6655", status: "Active", verificationStatus: "verified" },
  { id: "ref-new", name: "Liza Verify", type: "Agent", level: "L1", policies: 0, netPayable: 0, whtType: "Individual 5%", whtApplicable: true, bankAccount: "BPI ***0001", status: "Active",
    verificationStatus: "pending", verificationChanges: { enrolment: { from: null, to: "new payee" } } },
];
const options = { types: ["Agent", "Dealer"], levels: ["L1", "L2"], vendorGroups: ["Agents", "Dealers"], whtCodes: [{ code: "WI515", label: "WI515 · 5%" }], verificationRequired: true };
const signIn = (permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  CommissionService.getReferrerAccounts.mockResolvedValue({ data: { summary: { cycleLabel: "Oct 2026", dueThisCycle: 1200, readyToPay: 0 }, referrers: payees } });
  CommissionService.listRequests.mockResolvedValue({ data: [] });
  CommissionService.getReferrerOptions.mockResolvedValue({ data: options });
});

describe("Agents / Referrer Accounts: payee enrolment", () => {
  it("adds a payee with its vendor fields and says that it awaits verification", async () => {
    signIn(["read:commission", "write:commission"]);
    CommissionService.createReferrer.mockResolvedValue({ data: { referrer: { id: "ref-ana", verificationStatus: "pending" } }, message: "Created" });
    render(<MemoryRouter><ReferrerAccounts /></MemoryRouter>);
    expect(await screen.findByText("Toyota Dealer Alabang")).toBeInTheDocument();
    expect(screen.getByText("Awaiting verification")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add payee" }));
    expect(await screen.findByText("A new payee is verified by a second user before its commission is approved or paid.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana Reyes" } });
    fireEvent.change(screen.getByLabelText("Vendor code"), { target: { value: "AGT-001" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Makati City" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(CommissionService.createReferrer).toHaveBeenCalledWith(expect.objectContaining({ name: "Ana Reyes", vendorCode: "AGT-001", address: "Makati City", type: "Agent" })));
    // no Verify for a user without approve:commission
    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
  });

  it("refuses to save a payee without a name and shows the server's field errors", async () => {
    signIn(["read:commission", "write:commission"]);
    CommissionService.createReferrer.mockRejectedValue({ response: { data: { message: "Validation failed", errors: [{ path: "vendorGroup", message: "Choose a vendor group of Agents, Dealers" }] } } });
    render(<MemoryRouter><ReferrerAccounts /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Add payee" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter the name of the payee (at least 2 characters)")).toBeInTheDocument();
    expect(CommissionService.createReferrer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana Reyes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Choose a vendor group of Agents, Dealers")).toBeInTheDocument();
  });

  it("lets an approver verify a pending payee; a reader gets no Add payee", async () => {
    signIn(["read:commission", "approve:commission"]);
    CommissionService.verifyReferrer.mockResolvedValue({ data: {} });
    render(<MemoryRouter><ReferrerAccounts /></MemoryRouter>);
    expect(await screen.findByText("Liza Verify")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add payee" })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Verify" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("Verify Payee Liza Verify")).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Verify" }).pop();
    fireEvent.click(confirm);
    await waitFor(() => expect(CommissionService.verifyReferrer).toHaveBeenCalledWith("ref-new", {}));
  });
});
