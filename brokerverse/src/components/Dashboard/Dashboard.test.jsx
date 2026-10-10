import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StatCards from "../StatCards";
import ChartCard, { ThemedChart, tableOf } from "./ChartCard";
import { deltaText, deltaTone } from "./KpiCard";
import { changeOf, periodRange } from "./periods";
import { defaultDashboard } from "./personas";
import { LISTS, drillDown } from "./drill";
import { formatValue } from "./format";

jest.mock("primereact/chart", () => ({ Chart: () => <canvas data-testid="chart" /> }));

describe("periods in business dates", () => {
  it("runs a period from its first day to today, compared with the same days before or a year earlier", () => {
    expect(periodRange("month", "previous", "2026-10-10")).toEqual({ from: "2026-10-01", to: "2026-10-10", previousFrom: "2026-09-01", previousTo: "2026-09-10" });
    expect(periodRange("month", "previous", "2026-03-31")).toMatchObject({ previousFrom: "2026-02-01", previousTo: "2026-02-28" });
    expect(periodRange("quarter", "previous", "2026-10-10")).toMatchObject({ from: "2026-10-01", previousFrom: "2026-07-01", previousTo: "2026-07-10" });
    expect(periodRange("year", "lastYear", "2026-10-10")).toEqual({ from: "2026-01-01", to: "2026-10-10", previousFrom: "2025-01-01", previousTo: "2025-10-10" });
  });

  it("gives the change in percent, none against nothing", () => {
    expect(changeOf(110, 100)).toBe(10);
    expect(changeOf(5, 0)).toBeNull();
    expect(changeOf(null, 3)).toBeNull();
  });
});

describe("KPI cards", () => {
  it("show the change with its direction and whether it is good news", () => {
    expect(deltaText(12.345)).toBe("+12.3%");
    expect(deltaText(-4)).toBe("-4%");
    expect(deltaText(5000)).toBe("> +999%");
    expect(deltaText(null)).toBeNull();
    expect(deltaTone(5, "up")).toEqual({ direction: "up", tone: "good" });
    expect(deltaTone(5, "down")).toEqual({ direction: "up", tone: "bad" });
    expect(deltaTone(-5, "neutral")).toEqual({ direction: "down", tone: "neutral" });
  });

  it("render label, value, change against the named period, note and state, and open the list behind", () => {
    const open = jest.fn();
    render(<StatCards items={[
      { key: "a", label: "Premium written", value: "₱1.2M", change: 8.5, comparison: "vs previous period", note: "Target ₱5M", onClick: open },
      { key: "b", label: "Claims ratio", value: "44%", status: { severity: "serious", label: "Off target" } },
    ]} />);
    expect(screen.getByText("₱1.2M")).toBeInTheDocument();
    expect(screen.getByText("+8.5%")).toBeInTheDocument();
    expect(screen.getByText("vs previous period")).toBeInTheDocument();
    expect(screen.getByText("Off target")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Premium written"));
    expect(open).toHaveBeenCalled();
  });
});

describe("chart cards", () => {
  const data = { labels: ["Motor", "CTPL"], datasets: [{ label: "Premium", data: [1200000, 300000] }] };

  it("switch between the chart and its table, and show an empty state instead of an empty axis", () => {
    render(
      <ChartCard title="Premium by line" table={tableOf(data, "currency")}>
        <ThemedChart type="bar" data={data} format="currency" />
      </ChartCard>,
    );
    expect(screen.getByTestId("chart")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^(Table|dashboards\.table)$/));
    expect(screen.getAllByText("Motor").length).toBeGreaterThan(0);
    render(<ThemedChart type="bar" data={{ labels: ["Motor"], datasets: [{ data: [0] }] }} />);
    expect(screen.getByText(/No data for this period|dashboards\.noData/)).toBeInTheDocument();
  });

  it("format pesos compact on cards and in full in tables", () => {
    expect(formatValue("currency", 1234567, { compact: true })).toBe("₱1.2M");
    expect(formatValue("currency", 1234567)).toBe("₱1,234,567.00");
    expect(formatValue("percent", 12.5)).toBe("12.5%");
  });
});

describe("persona dashboards and drill-down", () => {
  // dashboards outside the menu are open to every role (utils/menuPermissions isPathAllowed)
  const menu = [];

  it("land each persona on its own dashboard, and a role without one on the first it may open", () => {
    expect(defaultDashboard(["sales"], menu)?.key).toBe("sales");
    expect(defaultDashboard(["tis-ccd-recon"], menu)?.key).toBe("collections");
    expect(defaultDashboard(["claims", "sales"], menu)?.key).toBe("sales");
    expect(defaultDashboard(["auditor"], menu)?.key).toBe("executive");
  });

  it("open the list behind a figure with the same filter", () => {
    const navigate = jest.fn();
    drillDown(navigate, LISTS.policiesIssued("2026-10-01", "2026-10-10"));
    expect(navigate).toHaveBeenCalledWith("/agent/policy");
    const stored = JSON.parse(window.sessionStorage.getItem("bv-list:policies"));
    expect(stored.applied).toMatchObject({ issuedDateFrom: "2026-10-01", issuedDateTo: "2026-10-10" });
    expect(JSON.parse(window.sessionStorage.getItem("bv-list:policies:page")).first).toBe(0);
  });

  it("render in a router", () => {
    render(<MemoryRouter><StatCards items={[{ key: "x", label: "Open items", value: 3 }]} /></MemoryRouter>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
