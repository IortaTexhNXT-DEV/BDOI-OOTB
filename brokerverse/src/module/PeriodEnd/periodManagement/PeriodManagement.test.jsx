import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import PeriodManagement, { nextFiscalYear } from "../PeriodManagement";
import periodEndService from "../../../services/periodEndService";
import { canOpen, hasPermission } from "../../../utils/canOpen";

jest.mock("../../../services/periodEndService", () => ({
  __esModule: true,
  default: {
    fiscalYears: jest.fn(), fiscalYear: jest.fn(), createFiscalYear: jest.fn(), setPeriodStatus: jest.fn(), statusPreview: jest.fn(), periodHistory: jest.fn(), periodChecks: jest.fn(),
  },
}));
jest.mock("../../../utils/canOpen", () => ({ __esModule: true, canOpen: jest.fn(), hasPermission: jest.fn(), default: jest.fn() }));
// a plain list in place of the Reason Codes dropdown; the helpers stay the real ones
jest.mock("../../../components/ReasonPicker", () => {
  const actual = jest.requireActual("../../../components/ReasonPicker");
  const Picker = ({ context, value, onChange }) => (
    <select aria-label="Reason" data-context={context} value={value?.reasonCode || ""}
      onChange={(e) => onChange({ reasonCode: e.target.value, reasonLabel: e.target.value, note: "", noteRequired: false })}>
      <option value="">-</option>
      <option value="PCL-MONTHEND">Month-end close completed</option>
      <option value="PRO-LATEDOC">Late insurer statement</option>
    </select>
  );
  return { __esModule: true, ...actual, default: Picker };
});

const YEARS = [{ code: "FY2028", startDate: "2027-04-01", endDate: "2028-03-31", status: "open" }, { code: "FY2027", startDate: "2026-04-01", endDate: "2027-03-31", status: "closed" }];
const period = (p, extra = {}) => ({ period: p, periodNo: 1, startDate: `${p}-01`, endDate: `${p}-30`, isAdjustment: false, status: "open", closeRun: null, lastChange: null,
  actions: { softClose: { allowed: true }, close: { allowed: true } }, ...extra });
const FY = {
  code: "FY2028", startDate: "2027-04-01", endDate: "2028-03-31", status: "open",
  periods: [
    period("2027-04"),
    period("2027-05", {
      status: "soft_closed",
      lastChange: { to: "soft_closed", at: "2027-06-02T02:00:00Z", byName: "Ana Santos", reasonCode: "PCL-MONTHEND", reasonName: "Month-end close completed", remarks: "Month-end close completed", source: "manual" },
      actions: { close: { allowed: true }, reopen: { allowed: false, reason: "permission", message: "Reopening a period requires permission approve:period-end" } },
    }),
  ],
};
const FAILED = { period: "2027-04", from: "open", to: "soft_closed", allowed: false, reason: "checks", reasonContext: "period_close",
  checks: [{ code: "unposted_journals", label: "No unposted or pending journals in the period", severity: "blocking", status: "failed", count: 2, amount: null },
    { code: "trial_balance", label: "Trial balance balances", severity: "blocking", status: "passed", count: 0, amount: 0 }] };
const PASSED = { ...FAILED, allowed: true, reason: null, checks: FAILED.checks.map((c) => ({ ...c, status: "passed", count: 0 })) };

const renderPage = () => render(<MemoryRouter><PeriodManagement /></MemoryRouter>);
const rowOf = async (p) => {
  await screen.findByText(p);
  return screen.getAllByRole("row").find((r) => within(r).queryByText(p));
};

describe("Period Management", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    hasPermission.mockImplementation((p) => p === "write:period-end");
    canOpen.mockReturnValue(true);
    periodEndService.fiscalYears.mockResolvedValue(YEARS);
    periodEndService.fiscalYear.mockResolvedValue(FY);
  });

  it("shows the latest change of a period with who, when and why, and the reopen disabled with its reason", async () => {
    renderPage();
    const row = await rowOf("2027-05");
    expect(within(row).getByText("Ana Santos")).toBeInTheDocument();
    expect(within(row).getByText("Month-end close completed")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Reopen" })).toBeDisabled();
    expect(within(await rowOf("2027-04")).queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  it("names the action in the panel title, lists the blocking checks and keeps the action disabled while one fails", async () => {
    renderPage();
    periodEndService.statusPreview.mockResolvedValue(FAILED);
    fireEvent.click(within(await rowOf("2027-04")).getByRole("button", { name: "Soft-close" }));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Soft-close period 2027-04")).toBeInTheDocument();
    expect(periodEndService.statusPreview).toHaveBeenCalledWith("2027-04", "soft_closed");
    expect(await within(panel).findByText("No unposted or pending journals in the period")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(within(panel).getByText("A blocking check failed.")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Reason")).toHaveAttribute("data-context", "period_close");
    expect(within(panel).getByRole("button", { name: "Soft-close period" })).toBeDisabled();
    expect(screen.queryByText(/The blocking month-end checks run first/)).toBeNull();
  });

  it("asks for a reason and sends it with the status change", async () => {
    renderPage();
    periodEndService.statusPreview.mockResolvedValue(PASSED);
    periodEndService.setPeriodStatus.mockResolvedValue({ period: "2027-04", status: "soft_closed" });
    fireEvent.click(within(await rowOf("2027-04")).getByRole("button", { name: "Soft-close" }));
    const panel = await screen.findByRole("dialog");
    const go = await within(panel).findByRole("button", { name: "Soft-close period" });
    await waitFor(() => expect(go).toBeEnabled());
    fireEvent.click(go);
    expect(periodEndService.setPeriodStatus).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByLabelText("Reason"), { target: { value: "PCL-MONTHEND" } });
    fireEvent.click(go);
    await waitFor(() => expect(periodEndService.setPeriodStatus).toHaveBeenCalledWith("2027-04", "soft_closed", { reasonCode: "PCL-MONTHEND" }));
    await waitFor(() => expect(periodEndService.fiscalYear).toHaveBeenCalledTimes(2));
  });

  it("asks before creating the next fiscal year and names it", async () => {
    renderPage();
    periodEndService.createFiscalYear.mockResolvedValue({ code: "FY2029" });
    fireEvent.click(await screen.findByRole("button", { name: "Next fiscal year" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Create fiscal year FY2029")).toBeInTheDocument();
    expect(periodEndService.createFiscalYear).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create fiscal year" }));
    await waitFor(() => expect(periodEndService.createFiscalYear).toHaveBeenCalled());
  });

  it("lists the history with the user's name and role, the status move and the reason", async () => {
    renderPage();
    periodEndService.periodHistory.mockResolvedValue([{ id: 1, from: "open", to: "soft_closed", remarks: "Month-end close completed: April", reasonCode: "PCL-MONTHEND",
      source: "manual", changedBy: "Ana Santos", changedByName: "Ana Santos", changedByRoles: ["Accounting Manager"], changedAt: "2027-06-02T02:00:00Z" }]);
    fireEvent.click(within(await rowOf("2027-05")).getByRole("button", { name: "History" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Month-end close completed: April")).toBeInTheDocument();
    expect(within(dialog).getByText(/Ana Santos/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Accounting Manager/)).toBeInTheDocument();
    expect(periodEndService.periodHistory).toHaveBeenCalledWith("2027-05");
  });

  it("works out the next fiscal year from the latest one", () => {
    expect(nextFiscalYear(YEARS)).toEqual({ code: "FY2029", startDate: "2028-04-01", endDate: "2029-03-31" });
    expect(nextFiscalYear([{ code: "FY2026", endDate: "2026-12-31" }])).toEqual({ code: "FY2027", startDate: "2027-01-01", endDate: "2027-12-31" });
    expect(nextFiscalYear([])).toBeNull();
  });
});
