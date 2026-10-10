import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import remittanceService from "../../../services/remittanceService";
import opsAccountingService from "../../../services/opsAccountingService";
import { setDateFormat, setTimeZone } from "../../../utility/dateFormat";
import RemittanceExceptions, { dueBy, exceptionActions } from ".";

jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  default: { listExceptions: jest.fn(), assignException: jest.fn(), resolveException: jest.fn(), escalateException: jest.fn() },
  remittanceService: {},
  masterService: { options: jest.fn() },
  apiRequest: jest.fn(),
}));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn().mockResolvedValue({ rows: [] }) } }));

const EXC = (n, extra = {}) => ({
  id: `rmi_${n}`, exceptionId: `EXC-2026-000${n}`, type: "Amount Mismatch", severity: "High", remittanceNo: "REM-2026-00021", remittanceId: "rm_21", amount: 800,
  difference: 200, age: 2, assignedTo: "", status: "Open", description: "Short credit", sla: "2 days", createdAt: "2026-10-08T01:00:00.000Z", lastModified: null, ...extra,
});

const show = (path = "/finance/remittance/exceptions") => render(<MemoryRouter initialEntries={[path]}><RemittanceExceptions /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setDateFormat("DD/MM/YYYY");
  setTimeZone("Asia/Manila");
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:remittance", "write:remittance"]));
  remittanceService.listExceptions.mockResolvedValue([EXC(1), EXC(2, { status: "Escalated", escalationReason: "Past SLA" })]);
});

describe("Exceptions", () => {
  it("lists the exceptions with neutral KPI cards and a row menu that starts with View; no free-text prompt", async () => {
    show();
    expect(await screen.findByText("EXC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
    expect(screen.queryByText(/direct_bill|remittance\./)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for EXC-2026-0001" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["View", "Start", "Escalate", "Resolve"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "View" }));
    expect(await screen.findByText("Short credit")).toBeInTheDocument();
  });

  it("Escalate asks for a reason of the exception_escalate context", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for EXC-2026-0001" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Escalate" }));
    expect(await screen.findByText("Escalate EXC-2026-0001")).toBeInTheDocument();
    expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "exception_escalate" });
  });

  it("Resolve needs the resolution and a note before it calls the server", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Actions for EXC-2026-0001" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
    expect(await within(dialog).findByText("Choose the resolution and enter a note.")).toBeInTheDocument();
    expect(remittanceService.resolveException).not.toHaveBeenCalled();
  });

  it("a read-only user sees View only and View alone", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:remittance"]));
    show();
    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(exceptionActions(EXC(1), false).map((a) => a.code)).toEqual(["view"]);
    expect(exceptionActions(EXC(1, { status: "Escalated" }), true).map((a) => a.code)).toEqual(["view", "resolve"]);
    expect(dueBy(EXC(1))).toBe("2026-10-10T01:00:00.000Z");
    expect(dueBy({ ...EXC(1), sla: null })).toBeNull();
  });
});
