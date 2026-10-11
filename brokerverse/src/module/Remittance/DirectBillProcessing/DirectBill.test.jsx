import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import remittanceService, { apiRequest, masterService } from "../../../services/remittanceService";
import DirectBillProcessing, { noteActions } from ".";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  default: { directBillSummary: jest.fn(), listDebitNotes: jest.fn(), getDebitNote: jest.fn(), billingRuns: jest.fn(), runBilling: jest.fn() },
  remittanceService: {},
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
}));
jest.mock("../../../hooks/useFormatCurrency", () => ({ useFormatCurrency: () => ({ formatCurrency: (v) => `PHP ${Number(v || 0).toFixed(2)}`, currencyCode: "PHP" }) }));
let mockPerms = [];
jest.mock("../../../utils/canOpen", () => ({ ...jest.requireActual("../../../utils/canOpen"), hasPermission: (p) => mockPerms.includes(p) }));
jest.mock("../../../services/reportsService", () => ({ __esModule: true, default: { generateReport: jest.fn() } }));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ rows: [] }) } }));

const MAKER = { canDecide: false, blockedCode: "MAKER", blockedReason: "You raised DN-2026-00004. Another user must approve it." };
const note = (extra = {}) => ({
  id: "dn_4", dnNumber: "DN-2026-00004", dnDate: "2026-10-01", dueDate: "2026-10-31", insurerName: "Pioneer Insurance", policyCount: 2, commission: 1000, vat: 120,
  amount: 1120, collectedAmount: 0, balance: 1120, status: "Pending Approval", statusCode: "for-approval", basis: "direct", lines: [], collections: [], decision: MAKER, ...extra,
});

const show = (path = "/finance/remittance/billing") => render(<MemoryRouter initialEntries={[path]}><DirectBillProcessing /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  remittanceService.directBillSummary.mockResolvedValue({ unbilled: 0, billedOutstanding: 1120, overdue: 0, total: 1120, pendingApproval: 1 });
  remittanceService.listDebitNotes.mockResolvedValue({ data: [note()], total: 1, summary: { amount: 1120, outstanding: 1120 } });
  remittanceService.getDebitNote.mockResolvedValue(note());
  masterService.options.mockResolvedValue([]);
  apiRequest.mockResolvedValue({ data: [] });
  mockPerms = [];
  remittanceService.billingRuns.mockResolvedValue({ nextBillingDates: ["2026-10-26", "2026-11-13"],
    runs: [{ id: 1, billingDate: "2026-10-15", trigger: "job", statements: 2, result: "success", message: "Billing run done: 2 billing statement(s) drafted." }] });
  remittanceService.runBilling.mockResolvedValue({ message: "Billing run done: 1 billing statement(s) drafted.", notes: [] });
});

describe("Insurer billing", () => {
  it("shows neutral KPI cards and no setting key or rule sentence", async () => {
    show();
    expect(await screen.findByText("Unbilled commission")).toBeInTheDocument();
    expect(await screen.findByText("1 debit note awaiting approval")).toBeInTheDocument();
    expect(screen.queryByText(/direct_bill\.|System Settings/)).not.toBeInTheDocument();
  });

  it("the maker of a note pending approval reads why instead of Approve and Reject", async () => {
    show();
    fireEvent.click(screen.getByText("Debit notes"));
    expect(await screen.findByText(MAKER.blockedReason)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for DN-2026-00004" }));
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((m) => m.textContent);
    expect(items[0]).toBe("View");
    expect(items).not.toContain("Approve");
    expect(items).not.toContain("Reject");
  });

  it("?note= opens the debit note with the reason in place of the decision buttons", async () => {
    show("/finance/remittance/billing?note=dn_4");
    expect(await screen.findByText("DN-2026-00004 · Pioneer Insurance")).toBeInTheDocument();
    expect(remittanceService.getDebitNote).toHaveBeenCalledWith("dn_4");
    expect(screen.getAllByText(MAKER.blockedReason).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("offers Approve and Reject only when the server allows the decision", () => {
    const codes = (row) => noteActions(row).map((a) => a.code);
    expect(codes(note())).not.toContain("approve");
    expect(codes(note({ decision: { canDecide: true } }))).toEqual(["view", "print", "approve", "reject", "cancel"]);
    expect(codes(note({ statusCode: "open" }))).toEqual(["view", "print", "collect", "email", "cancel"]);
  });

  it("a settled billing statement can still be cancelled but not collected", () => {
    const codes = noteActions(note({ statusCode: "settled", status: "Settled by retention", basis: "net", balance: 0 })).map((a) => a.code);
    expect(codes).toContain("cancel");
    expect(codes).not.toContain("collect");
  });

  it("the billing run tab lists the runs and the next billing dates; Run billing needs write:remittance", async () => {
    show();
    fireEvent.click(screen.getByText("Billing run"));
    expect(await screen.findByText("Billing run done: 2 billing statement(s) drafted.")).toBeInTheDocument();
    expect(screen.getByText("Scheduled job")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run billing" })).not.toBeInTheDocument();
  });

  it("a remittance user runs the billing for a billing date", async () => {
    mockPerms = ["write:remittance"];
    show();
    fireEvent.click(screen.getByText("Billing run"));
    fireEvent.click(await screen.findByRole("button", { name: "Run billing" }));
    expect(await screen.findByText("Billing run done: 1 billing statement(s) drafted.")).toBeInTheDocument();
    expect(remittanceService.runBilling).toHaveBeenCalledWith(expect.objectContaining({ billingDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });
});
