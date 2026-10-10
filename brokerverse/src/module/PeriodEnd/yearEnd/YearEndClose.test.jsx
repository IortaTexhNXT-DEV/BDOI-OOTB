import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import YearEndClose from "../YearEndClose";
import periodEndService from "../../../services/periodEndService";
import { stepTone } from "./Stepper";
import { checkResult } from "./CheckList";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }), initReactI18next: { type: "3rdParty", init: () => {} } }));
jest.mock("../../../services/periodEndService");
jest.mock("../../../services/opsAccountingService", () => ({ masterRecords: jest.fn(() => Promise.resolve({ rows: [] })) }));

const year = { code: "FY2026", startDate: "2025-04-01", endDate: "2026-03-31", status: "open", adjustmentPeriod: "2026-13" };
const checks = [
  { code: "periods_closed", step: "prerequisites", status: "failed", data: { required: "closed", total: 12, closed: 10, open: [{ period: "2026-02", status: "open" }, { period: "2026-03", status: "soft_closed" }] } },
  { code: "trial_balance", step: "prerequisites", status: "passed", data: { debit: 100, credit: 100, difference: 0 } },
  { code: "adjustment_period", step: "adjustments", status: "passed", data: { period: "2026-13", status: "open" } },
];
const empty = { fiscalYear: year, run: null, runs: [], steps: [], currentStep: "prerequisites", checks, adjustments: [], closing: null, opening: null, activity: [],
  actions: { start: { allowed: true, reason: null } } };
const run = { id: "yec_1", runNumber: "YEC-2026-00001", fiscalYear: "FY2026", status: "draft", preparedBy: "usr_1", preparedByName: "Ana Santos", preparedAt: "2026-10-09T08:00:00Z" };
const started = {
  ...empty,
  fiscalYear: { ...year, status: "closing" },
  run,
  steps: [{ key: "prerequisites", status: "failed" }, { key: "adjustments", status: "passed" }, { key: "closing", status: "pending" }, { key: "approval", status: "blocked" }, { key: "opening", status: "pending" }],
  closing: { source: "preview", period: "2026-13", date: "2026-03-31", lines: [{ accountCode: "3201001", accountName: "Commission Income", accountType: "income", balance: -500, debit: 500, credit: 0 }],
    totalIncome: 500, totalExpense: 0, netIncome: 500, transfer: -500, currentYearPl: { code: "5102001", name: "Current Year P/L" }, retainedEarnings: { code: "5101001", name: "Retained Earnings" }, journals: [] },
  opening: { source: "preview", fiscalYear: "FY2027", lines: [], totalDebit: 0, totalCredit: 0 },
  activity: [{ id: 1, runNumber: run.runNumber, action: "start", fromStatus: null, toStatus: "draft", byName: "Ana Santos", roles: ["Accounting Manager"], at: "2026-10-09T08:00:00Z" }],
  actions: { start: null, check: { allowed: true, reason: null }, cancel: { allowed: true, reason: null }, adjust: { allowed: true, reason: null }, close: { allowed: false, reason: "checks" } },
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const renderScreen = () => render(<MemoryRouter initialEntries={["/accounts/period-end/year-end"]}><YearEndClose /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  periodEndService.yearEnd.mockResolvedValue([{ code: "FY2027", status: "open" }, { code: "FY2026", status: "open" }]);
});

describe("Year-End Close", () => {
  it("starts the close without the page going blank and then shows the five steps", async () => {
    const reload = deferred();
    periodEndService.yearEndOverview.mockResolvedValueOnce(empty).mockReturnValueOnce(reload.promise);
    periodEndService.createYearEnd.mockResolvedValue(run);
    renderScreen();

    expect(await screen.findByText("yearEndClose.empty")).toBeInTheDocument();
    expect(screen.getByText("yearEndClose.check.periods_closed.label")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "yearEndClose.start" }));
    // the start is confirmed first, with the facts of the year
    const confirm = await screen.findByRole("dialog");
    expect(periodEndService.createYearEnd).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "yearEndClose.start" }));
    await waitFor(() => expect(periodEndService.createYearEnd).toHaveBeenCalledWith("FY2026"));
    await waitFor(() => expect(periodEndService.yearEndOverview).toHaveBeenCalledTimes(2));
    expect(periodEndService.yearEndOverview).toHaveBeenLastCalledWith("FY2026");
    // while the year reloads, what was on screen stays there
    expect(screen.getByText("yearEndClose.empty")).toBeInTheDocument();

    await act(async () => { reload.resolve(started); });
    expect(await screen.findByRole("navigation", { name: "yearEndClose.stepsLabel" })).toBeInTheDocument();
    const steps = within(screen.getByRole("navigation", { name: "yearEndClose.stepsLabel" })).getAllByRole("button");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("YEC-2026-00001")).toBeInTheDocument();
    expect(screen.queryByText("yearEndClose.empty")).not.toBeInTheDocument();
    expect(await screen.findByText("periodEnd.yearEndStarted")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "yearEndClose.activity.title" })).toBeInTheDocument();
    expect(screen.getByText("Accounting Manager")).toBeInTheDocument();
  });

  it("shows the preparer why the close is not theirs to take", async () => {
    periodEndService.yearEndOverview.mockResolvedValue({
      ...started,
      steps: started.steps.map((s) => ({ ...s, status: ["prerequisites", "adjustments"].includes(s.key) ? "passed" : s.key === "approval" ? "pending-approval" : s.status })),
      currentStep: "approval",
      checks: checks.map((c) => ({ ...c, status: "passed" })),
      actions: { ...started.actions, close: { allowed: false, reason: "maker-checker" } },
    });
    renderScreen();
    const close = await screen.findByRole("button", { name: "yearEndClose.approval.close" });
    expect(close).toBeDisabled();
    expect(screen.getByText("yearEndClose.reason.closeMaker")).toBeInTheDocument();
    expect(periodEndService.closeYearEnd).not.toHaveBeenCalled();
  });

  it("asks for a reason from the list before a reversal is requested", async () => {
    periodEndService.yearEndOverview.mockResolvedValue({
      ...started,
      fiscalYear: { ...year, status: "closed" },
      run: { ...run, status: "closed", closedByName: "Ben Cruz", closedAt: "2026-10-10T08:00:00Z", netIncome: 500, nextFiscalYear: "FY2027" },
      steps: started.steps.map((s) => ({ ...s, status: "done" })),
      currentStep: "approval",
      actions: { requestReversal: { allowed: true, reason: null } },
    });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "yearEndClose.reversal.request" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "yearEndClose.reversal.request" }));
    expect(await within(dialog).findByText("reasonPicker.reasonRequired")).toBeInTheDocument();
    expect(periodEndService.requestYearEndReversal).not.toHaveBeenCalled();
  });
});

describe("year-end helpers", () => {
  const t = (k, o = {}) => [k, ...Object.entries(o).filter(([key]) => key !== "defaultValue").map(([key, v]) => `${key}=${v}`)].join("|");
  it("draws each step status with one of four marks", () => {
    expect(["passed", "posted", "done", "failed", "blocked", "pending-approval", "pending"].map(stepTone))
      .toEqual(["done", "done", "done", "attention", "attention", "waiting", "todo"]);
  });

  it("words a check from its figures and lists the periods still open", () => {
    expect(checkResult(t, checks[0])).toBe("yearEndClose.check.periods_closed.count|closed=10|total=12; yearEndClose.check.periods_closed.open|list=2026-02 (periodEnd.status.open), 2026-03 (periodEnd.status.soft_closed)");
    expect(checkResult(t, { code: "previous_year", status: "not-applicable", data: { fiscalYear: null } })).toBe("yearEndClose.check.previous_year.first");
    expect(checkResult(t, { code: "unknown", status: "failed", message: "Server message", data: {} })).toBe("Server message");
  });
});
