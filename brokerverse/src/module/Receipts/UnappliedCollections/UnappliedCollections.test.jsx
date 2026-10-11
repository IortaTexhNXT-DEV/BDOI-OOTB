import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import { receiptsService } from "../../../services/receiptsService";
import UnappliedCollections from ".";
import { allocationProblem, unappliedActions } from "./model";

let mockPerms = [];
jest.mock("../../../utils/canOpen", () => ({ ...jest.requireActual("../../../utils/canOpen"), hasPermission: (p) => mockPerms.includes(p) }));
jest.mock("../../../services/receiptsService", () => ({ __esModule: true, receiptsService: {
  listUnapplied: jest.fn(), getUnapplied: jest.fn(), getOpenReceivables: jest.fn(), allocateUnapplied: jest.fn(), recordUnapplied: jest.fn(), refundUnapplied: jest.fn(), reverseUnapplied: jest.fn(),
} }));
jest.mock("../../../utility/toastUtils", () => ({ showErrorMessage: jest.fn(), showSuccessMessage: jest.fn() }));
jest.mock("../../../components/ActivityLog", () => ({ RecordActivityLog: () => null }));

const excess = { id: "uac_1", kind: "excess", kindText: "Excess payment", status: "open", amount: 1500, balance: 1500, receiptId: "rct_1", receiptNumber: "OR-2026-00120",
  clientId: "cl_1", clientCode: "CL-1", clientName: "Andrea Villanueva", policyNumber: "POL-2026-90004", receivedDate: "2026-10-05", allocateBy: "2026-10-07", overdue: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms = [];
  receiptsService.listUnapplied.mockResolvedValue({ rows: [excess], summary: { open: 1, openAmount: 1500, overdue: 1 } });
  receiptsService.getOpenReceivables.mockResolvedValue([{ receivableId: "rcv_9", billNumber: "INV-2026-00104", policyNumber: "POL-2026-90005", customerName: "Andrea Villanueva", balance: 1000, dueDate: "2026-10-20" }]);
  receiptsService.allocateUnapplied.mockResolvedValue({ message: "PHP 1,000.00 allocated; PHP 500.00 left to allocate" });
});

describe("Unapplied collections", () => {
  it("offers allocate and refund to a receipting user; reverse only for a payment without a receipt", () => {
    const codes = (row, perms) => unappliedActions(row, perms).map((a) => a.code);
    expect(codes(excess, [])).toEqual(["view"]);
    expect(codes(excess, ["write:receipts", "reverse:receipts"])).toEqual(["view", "allocate", "refund"]);
    expect(codes({ ...excess, receiptId: null, kind: "floating", clientId: null }, ["write:receipts", "reverse:receipts"])).toEqual(["view", "allocate", "reverse"]);
    expect(allocationProblem([{ amount: 1200, billBalance: 1000 }], 1500)).toBe("aboveBill");
    expect(allocationProblem([{ amount: 1000, billBalance: 1000 }, { amount: 600, billBalance: 900 }], 1500)).toBe("aboveBalance");
    expect(allocationProblem([{ amount: null, billBalance: 1000 }], 1500)).toBe("chooseBill");
  });

  it("lists what is to allocate with the overdue mark, without actions for a reader", async () => {
    render(<MemoryRouter><UnappliedCollections /></MemoryRouter>);
    expect(await screen.findByText("OR-2026-00120")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
  });

  it("allocates to an open bill of the client", async () => {
    mockPerms = ["write:receipts"];
    render(<MemoryRouter><UnappliedCollections /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for OR-2026-00120" }));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Allocate"));
    const input = await screen.findByLabelText("Amount to allocate to INV-2026-00104");
    expect(receiptsService.getOpenReceivables).toHaveBeenCalledWith({ customerCode: "CL-1" });
    fireEvent.change(input, { target: { value: "1000" } });
    fireEvent.blur(input);
    const allocate = screen.getByRole("button", { name: "Allocate" });
    await waitFor(() => expect(allocate).toBeEnabled());
    fireEvent.click(allocate);
    await waitFor(() => expect(receiptsService.allocateUnapplied).toHaveBeenCalledWith("uac_1", [{ receivableId: "rcv_9", amount: 1000 }]));
  });
});
