import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import FinancialStatements from "./FinancialStatements";
import { monthsText, rangeOf, sidedAmount, statementAmount } from "./statementHelpers";
import service from "../../services/periodEndService";

jest.mock("../../services/periodEndService", () => ({
  __esModule: true,
  default: { statementPeriods: jest.fn(), statement: jest.fn(), statementFile: jest.fn(), journalLines: jest.fn() },
}));

const month = (y, m, no) => {
  const mm = String(m).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { period: `${y}-${mm}`, periodNo: no, startDate: `${y}-${mm}-01`, endDate: `${y}-${mm}-${last}`, status: no < 6 ? "closed" : "open" };
};
const fy2027 = { code: "FY2027", startDate: "2026-04-01", endDate: "2027-03-31", status: "open",
  periods: Array.from({ length: 12 }, (_, i) => month(2026 + Math.floor((3 + i) / 12), ((3 + i) % 12) + 1, i + 1)) };
const calendar = { today: "2026-10-09", current: { fiscalYear: "FY2027", period: "2026-10" }, fiscalYears: [fy2027] };

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const incomeStatement = {
  rows: [],
  statement: {
    type: "income-statement", from: "2026-10-01", to: "2026-10-31", fiscalYear: "FY2027",
    measures: [{ key: "currentPeriod", from: "2026-10-01", to: "2026-10-31" }, { key: "yearToDate", from: "2026-04-01", to: "2026-10-31" }],
    sections: [
      { key: "income", label: "Income", total: { currentPeriod: 1905, yearToDate: 93653.75 },
        groups: [{ label: "Revenue", total: { currentPeriod: 1905, yearToDate: 93653.75 },
          lines: [{ accountCode: "3201001", accountName: "Brokerage Commission Income", values: { currentPeriod: 1905, yearToDate: 93653.75 }, drill: true }] }] },
      { key: "expense", label: "Expenses", total: { currentPeriod: 77975.44, yearToDate: 126032.39 },
        groups: [
          { label: "Cost of Services", total: { currentPeriod: -6826.35, yearToDate: 41230.6 },
            lines: [{ accountCode: "4401010", accountName: "Commission Expense – Agents and Referrers (Comsub)", values: { currentPeriod: -6826.35, yearToDate: 41230.6 }, drill: true }] },
          { label: "Operating Expenses", total: { currentPeriod: 84801.79, yearToDate: 84801.79 },
            lines: [{ accountCode: "658000", accountName: "Auditing Fees", values: { currentPeriod: 84801.79, yearToDate: 84801.79 }, drill: true }] }] },
    ],
    result: { key: "netIncome", values: { currentPeriod: -76070.44, yearToDate: -32378.64 } },
    cards: { totalIncome: 1905, totalExpense: 77975.44, netIncome: -76070.44, netIncomeYearToDate: -32378.64 },
  },
};
const balanceSheet = {
  rows: [],
  statement: {
    type: "balance-sheet", from: null, to: "2026-10-31", fiscalYear: "FY2027",
    measures: [{ key: "balance", from: null, to: "2026-10-31" }, { key: "priorYearEnd", from: null, to: "2026-03-31" }],
    sections: [
      { key: "asset", label: "Assets", total: { balance: 1000, priorYearEnd: 0 },
        groups: [{ label: "Current Assets", total: { balance: 1000, priorYearEnd: 0 }, lines: [{ accountCode: "1101001", accountName: "Cash on Hand", values: { balance: 1000, priorYearEnd: 0 }, drill: true }] }] },
      { key: "liability", label: "Liabilities", total: { balance: 600, priorYearEnd: 0 },
        groups: [{ label: "Current Liabilities", total: { balance: 600, priorYearEnd: 0 }, lines: [{ accountCode: "2201001", accountName: "Premiums Payable", values: { balance: 600, priorYearEnd: 0 }, drill: true }] }] },
      { key: "equity", label: "Equity", total: { balance: 400, priorYearEnd: 0 },
        groups: [{ label: "Equity", total: { balance: 400, priorYearEnd: 0 }, lines: [{ accountCode: "CYE", accountName: "Current year earnings", values: { balance: 400, priorYearEnd: 0 }, drill: false }] }] },
    ],
    result: { key: "liabilitiesAndEquity", values: { balance: 1000, priorYearEnd: 0 } },
    cards: { totalAssets: 1000, totalLiabilities: 600, totalEquity: 400, difference: 0, balanced: true },
  },
};
const ledger = {
  rows: [
    { accountCode: "4401010", date: "2026-10-01", openingBalance: 41230.6 + 6826.35, journalNumber: null },
    { accountCode: "4401010", date: "2026-10-07", journalNumber: "JV-2026-00067", description: "Comsub clawback", source: "commission", debit: null, credit: 6826.35, runningBalance: 41230.6 },
  ],
  summary: { closingBalance: 41230.6 },
};

beforeEach(() => {
  jest.clearAllMocks();
  service.statementPeriods.mockResolvedValue(calendar);
});

describe("Financial statements", () => {
  it("opens on the current period with the cards of the income statement and natural signs in parentheses", async () => {
    service.statement.mockResolvedValue(incomeStatement);
    render(<MemoryRouter><FinancialStatements /></MemoryRouter>);
    expect(await screen.findByText(/October 2026 · 01\/10\/2026 – 31\/10\/2026/)).toBeInTheDocument();
    expect(service.statement).toHaveBeenCalledWith("income-statement", { FromDate: "2026-10-01", ToDate: "2026-10-31" });
    expect(screen.getByText("Net loss")).toBeInTheDocument();
    expect(screen.getByText("₱76,070.44")).toBeInTheDocument();
    expect(screen.getByText("Net loss, year to date")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /4401010/ });
    expect(within(row).getByText("(₱6,826.35)")).toBeInTheDocument();
    expect(screen.getByText("Total Cost of Services")).toBeInTheDocument();
    expect(screen.getByText("Net income (loss)")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Year to date\s*Apr – Oct 2026/ })).toHaveAttribute("title", "01/04/2026 – 31/10/2026");
    expect(screen.getByRole("columnheader", { name: /This period\s*October 2026/ })).toBeInTheDocument();
  });

  it("keeps the statement on screen while the next one loads, then shows the balance sheet and its checks", async () => {
    const next = deferred();
    service.statement.mockImplementation((type) => (type === "balance-sheet" ? next.promise : Promise.resolve(incomeStatement)));
    render(<MemoryRouter><FinancialStatements /></MemoryRouter>);
    await screen.findByRole("button", { name: /4401010/ });
    fireEvent.click(screen.getByRole("tab", { name: "Balance Sheet" }));
    await waitFor(() => expect(service.statement).toHaveBeenCalledWith("balance-sheet", { FromDate: undefined, ToDate: "2026-10-31" }));
    // the income statement stays mounted until the balance sheet arrives
    expect(screen.getByRole("button", { name: /4401010/ })).toBeInTheDocument();
    expect(screen.getByText("Net loss")).toBeInTheDocument();
    next.resolve(balanceSheet);
    expect(await screen.findByText("Total assets")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /4401010/ })).not.toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Total liabilities and equity")).toBeInTheDocument();
    expect(screen.getByText(/As of 31\/10\/2026 · Amounts in PHP/)).toBeInTheDocument();
    // the earnings line has no single account to open
    expect(screen.getByText("Current year earnings")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Current year earnings/ })).not.toBeInTheDocument();
  });

  it("opens the general ledger of an account line for the statement's range", async () => {
    service.statement.mockImplementation((type) => Promise.resolve(type === "gl-detail" ? ledger : incomeStatement));
    render(<MemoryRouter><FinancialStatements /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /4401010/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(service.statement).toHaveBeenCalledWith("gl-detail", { Account: "4401010", FromDate: "2026-10-01", ToDate: "2026-10-31" }));
    expect(await within(dialog).findByText("JV-2026-00067")).toBeInTheDocument();
    expect(within(dialog).getByText("₱48,056.95 Dr")).toBeInTheDocument();
    expect(within(dialog).getAllByText("₱41,230.60 Dr").length).toBeGreaterThan(0);
  });

  it("exports the statement on screen", async () => {
    service.statement.mockResolvedValue(incomeStatement);
    service.statementFile.mockResolvedValue({ blob: new Blob(["x"]), fileName: "income-statement_2026-10-01_2026-10-31.xlsx" });
    global.URL.createObjectURL = jest.fn(() => "blob:statement");
    global.URL.revokeObjectURL = jest.fn();
    render(<MemoryRouter><FinancialStatements /></MemoryRouter>);
    await screen.findByRole("button", { name: /4401010/ });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByText("Excel workbook"));
    await waitFor(() => expect(service.statementFile).toHaveBeenCalledWith("income-statement", { FromDate: "2026-10-01", ToDate: "2026-10-31" }, "xlsx"));
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Export" })).toBeEnabled());
  });
});

describe("statement helpers", () => {
  const choice = { fiscalYear: "FY2027", period: "2026-11", view: "month" };
  it("turns a period choice into dates", () => {
    expect(rangeOf(calendar, choice, "income-statement")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(rangeOf(calendar, { ...choice, view: "quarter" }, "income-statement")).toEqual({ from: "2026-10-01", to: "2026-11-30", quarter: 3 });
    expect(rangeOf(calendar, { ...choice, view: "ytd" }, "trial-balance")).toEqual({ from: "2026-04-01", to: "2026-11-30" });
    expect(rangeOf(calendar, { ...choice, view: "quarter" }, "balance-sheet")).toEqual({ from: null, to: "2026-11-30" });
  });

  it("waits for a complete custom range", () => {
    const custom = { ...choice, view: "custom" };
    expect(rangeOf(calendar, { ...custom, from: "2026-10-05", to: null }, "income-statement")).toEqual({ error: "required" });
    expect(rangeOf(calendar, { ...custom, from: "2026-10-09", to: "2026-10-05" }, "income-statement")).toEqual({ error: "range" });
    expect(rangeOf(calendar, { ...custom, from: "2026-10-05", to: "2026-10-09" }, "income-statement")).toEqual({ from: "2026-10-05", to: "2026-10-09" });
    expect(rangeOf(calendar, { ...custom, from: null, to: "2026-10-09" }, "balance-sheet")).toEqual({ from: null, to: "2026-10-09" });
  });

  it("names whole-month ranges by their months", () => {
    expect(monthsText("2026-10-01", "2026-10-31")).toBe("October 2026");
    expect(monthsText("2026-04-01", "2026-10-31")).toBe("Apr – Oct 2026");
    expect(monthsText("2025-10-01", "2026-03-31")).toBe("Oct 2025 – Mar 2026");
    expect(monthsText("2026-10-05", "2026-10-31")).toBeNull();
    expect(monthsText(null, "2026-10-31")).toBeNull();
  });

  it("formats statement amounts and ledger balances", () => {
    expect(statementAmount(-6826.35)).toBe("(₱6,826.35)");
    expect(statementAmount(1905)).toBe("₱1,905.00");
    expect(sidedAmount(-6826.35)).toBe("₱6,826.35 Cr");
    expect(sidedAmount(0)).toBe("₱0.00");
  });
});
