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
    const again = renderHook(() => useDashboardOrigin());
    expect(again.result.current).toMatchObject({ origin: "issued", ready: true });
    expect(dashboardService.getSettings).not.toHaveBeenCalled();
    act(() => again.result.current.setOrigin("anything"));
    expect(again.result.current.origin).toBe("issued");
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

  it("falls back to Issued since go-live when the settings cannot be read", async () => {
    dashboardService.getSettings.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useDashboardOrigin());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.origin).toBe("issued");
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
});
