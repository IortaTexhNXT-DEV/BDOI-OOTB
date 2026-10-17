import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardToolbar from "./DashboardToolbar";
import { readStoredOrigin, resetDashboardOrigin, useDashboardOrigin } from "./useDashboardOrigin";
import dashboardService from "../../services/dashboardService";
import ExecutiveDashboard from "../../module/ExecutiveDashboard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, o) => {
      const text = typeof o === "string" ? o : (o && o.defaultValue) || key;
      return typeof o === "object" ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k] ?? "") : text;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("primereact/chart", () => ({ Chart: () => <canvas data-testid="chart" /> }));
jest.mock("../../services/dashboardService", () => ({
  __esModule: true,
  default: { getSettings: jest.fn(), getExecutive: jest.fn(), getClaims: jest.fn(), getSalesOverview: jest.fn() },
}));
jest.mock("../../services/reportsService", () => ({ __esModule: true, default: { generateReport: jest.fn() } }));

const KEY = "bv.dashboard.origin.usr_exec";
const signIn = () => localStorage.setItem("user", JSON.stringify({ userId: "usr_exec", username: "exec", roles: ["system-admin"] }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  resetDashboardOrigin();
  signIn();
  dashboardService.getSettings.mockResolvedValue({ defaultOrigin: "issued", cutoverDate: "2026-11-01" });
});

describe("DashboardToolbar origin switch", () => {
  it("is shown only when the screen handles it, and reports the view chosen", () => {
    const onOrigin = jest.fn();
    const { rerender } = render(<MemoryRouter><DashboardToolbar title="Executive Dashboard" /></MemoryRouter>);
    expect(screen.queryByTestId("dashboard-origin")).toBeNull();
    rerender(<MemoryRouter><DashboardToolbar title="Executive Dashboard" origin="issued" onOrigin={onOrigin} /></MemoryRouter>);
    expect(screen.getByText("Issued since go-live")).toBeInTheDocument();
    fireEvent.click(screen.getByText("All business"));
    expect(onOrigin).toHaveBeenCalledWith("all");
  });
});

describe("useDashboardOrigin", () => {
  it("opens on the configured default, then keeps the user's choice in this browser", async () => {
    dashboardService.getSettings.mockResolvedValue({ defaultOrigin: "all" });
    const { result } = renderHook(() => useDashboardOrigin());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.origin).toBe("all");
    act(() => result.current.setOrigin("issued"));
    expect(result.current.origin).toBe("issued");
    expect(localStorage.getItem(KEY)).toBe("issued");
    // a later visit starts from the choice, without asking the server
    dashboardService.getSettings.mockClear();
    const { result: later } = renderHook(() => useDashboardOrigin());
    expect(later.current).toMatchObject({ origin: "issued", ready: true });
    expect(dashboardService.getSettings).not.toHaveBeenCalled();
    act(() => later.current.setOrigin("anything"));
    expect(later.current.origin).toBe("issued");
  });

  it("works when the browser blocks storage: the default applies and the switch holds for the visit", async () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      expect(readStoredOrigin()).toBeNull();
      const { result } = renderHook(() => useDashboardOrigin());
      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.origin).toBe("issued");
      act(() => result.current.setOrigin("all"));
      expect(result.current.origin).toBe("all");
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it("falls back to All business when the settings cannot be read", async () => {
    dashboardService.getSettings.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useDashboardOrigin());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.origin).toBe("all");
  });
});

describe("Executive Dashboard", () => {
  const figures = (origin) => ({
    executiveKPIs: { totalRevenue: { value: 1000 }, newBusiness: { value: 500 }, activePolicies: { value: 4 }, claimsRatio: { value: 0 }, retentionRate: { value: 0 } },
    issuedSinceGoLive: { cutoverDate: "2026-11-01", policies: 7, premium: 84500, receipts: 3, collected: 20000, endorsements: 1, claims: 0 },
    revenueByProduct: { labels: [], data: [] }, monthlyTrend: { labels: [], premium: [] }, regionalPerformance: [], topProducts: [], agentPerformance: [],
    period: { from: "2026-11-01", to: "2026-11-10" }, origin, asOf: "2026-11-10T02:00:00Z",
  });

  it("opens on Issued since go-live, shows the tile with the server's figures and reloads on All business", async () => {
    dashboardService.getExecutive.mockImplementation((_p, _c, origin) => Promise.resolve(figures(origin)));
    dashboardService.getClaims.mockResolvedValue({ claimsByStatus: [] });
    render(<MemoryRouter><ExecutiveDashboard /></MemoryRouter>);
    await waitFor(() => expect(dashboardService.getExecutive).toHaveBeenCalledTimes(1));
    expect(dashboardService.getExecutive).toHaveBeenCalledWith("month", "previous", "issued");
    expect(await screen.findByText("7 policies since 01/11/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Issued since go-live").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByText("All business"));
    await waitFor(() => expect(dashboardService.getExecutive).toHaveBeenLastCalledWith("month", "previous", "all"));
    expect(dashboardService.getExecutive).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(KEY)).toBe("all");
  });

  it("has no tile before a cutover date is set", async () => {
    dashboardService.getExecutive.mockResolvedValue({ ...figures("issued"), issuedSinceGoLive: null });
    dashboardService.getClaims.mockResolvedValue({ claimsByStatus: [] });
    render(<MemoryRouter><ExecutiveDashboard /></MemoryRouter>);
    await waitFor(() => expect(dashboardService.getExecutive).toHaveBeenCalled());
    await screen.findByText("executiveDashboard.totalRevenue");
    expect(screen.queryByText(/policies since/)).toBeNull();
  });

  // The client report: KPI cards on "-", the premium chart a grey block and the refresh spinner turning, although every
  // request had answered. Nothing issued since go-live is an answer, not a load: zeros, the reason and the way out.
  const zero = { value: 0, change: null, target: null, achievement: null };
  const nothingIssued = {
    executiveKPIs: { totalRevenue: zero, newBusiness: zero, activePolicies: zero, claimsRatio: { value: null }, retentionRate: { value: null } },
    issuedSinceGoLive: { cutoverDate: "2026-11-01", policies: 0, premium: 0 }, revenueByProduct: { labels: [], data: [], policies: [] },
    monthlyTrend: { labels: ["Sep", "Oct"], months: ["2026-09", "2026-10"], premium: [0, 0] }, regionalPerformance: [], topProducts: [], agentPerformance: [],
    receivables: { premiumFromClients: 0, premiumOverdue: 0, commissionFromInsurers: 0, commissionUnbilled: 0, commissionOverdue: 0 },
    period: { from: "2026-10-01", to: "2026-10-11" }, origin: "issued", asOf: "2026-10-11T02:00:00Z",
  };
  const settle = () => act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });

  it("with nothing issued since go-live: real zeros, no skeleton, no spinner, and the switch to All business", async () => {
    localStorage.setItem(KEY, "issued");
    dashboardService.getExecutive.mockResolvedValue(nothingIssued);
    dashboardService.getClaims.mockResolvedValue({ claimsByStatus: [] });
    render(<MemoryRouter><ExecutiveDashboard /></MemoryRouter>);
    await screen.findAllByText("No policies issued since go-live (01/11/2026).");
    await settle();
    // real zeros (premium, new business, receivables, policies in force), not "-"
    expect(screen.getAllByText("₱0").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("0")).toBeInTheDocument();
    // the ratios over nothing do not apply: an en dash with the reason, not 0 %
    expect(screen.getByTitle("No premium written yet: the claims ratio does not apply")).toHaveTextContent("\u2013");
    // the request has finished: no skeleton, and the refresh spinner has stopped
    expect(screen.queryAllByRole("status", { name: /^Loading/ })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(dashboardService.getExecutive).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByTestId("origin-empty-switch")[0]);
    await waitFor(() => expect(dashboardService.getExecutive).toHaveBeenLastCalledWith("month", "previous", "all"));
  });

  it("keeps the claims chart when the figures fail, offers Retry and stops the spinner", async () => {
    dashboardService.getExecutive.mockRejectedValueOnce(new Error("Server unavailable"));
    dashboardService.getClaims.mockResolvedValue({ claimsByStatus: [{ status: "registered", count: 2 }] });
    render(<MemoryRouter><ExecutiveDashboard /></MemoryRouter>);
    expect((await screen.findAllByText("Server unavailable")).length).toBeGreaterThan(0);
    await settle();
    expect(screen.queryAllByRole("status", { name: /^Loading/ })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(screen.getAllByTestId("chart").length).toBe(1);
    dashboardService.getExecutive.mockResolvedValue({ ...nothingIssued, origin: "all", executiveKPIs: { ...nothingIssued.executiveKPIs, totalRevenue: { value: 1000 } } });
    fireEvent.click(screen.getAllByText("Retry")[0]);
    await waitFor(() => expect(screen.queryByText("Server unavailable")).toBeNull());
    expect(await screen.findByText("₱1K")).toBeInTheDocument();
  });
});
