import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import ViewState from "./ViewState";
import KpiCard from "../Dashboard/KpiCard";
import { ThemedChart } from "../Dashboard/ChartCard";

jest.mock("primereact/chart", () => ({ Chart: () => <canvas data-testid="chart" /> }));

const skeleton = <div data-testid="skeleton" />;
const view = (state, props = {}) => render(<ViewState state={state} skeleton={skeleton} {...props}><p>Figures</p></ViewState>);

describe("ViewState: the four states of an async view", () => {
  it("loading: the skeleton only", () => {
    view({ status: "loading" });
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Figures")).toBeNull();
    expect(screen.getByTestId("view-state")).toHaveAttribute("aria-busy", "true");
  });

  it("loaded: the content, kept under a veil (not blanked, no skeleton) while a refresh runs", () => {
    const { rerender } = view({ status: "loaded" });
    expect(screen.getByText("Figures")).toBeInTheDocument();
    expect(screen.getByTestId("view-state")).toHaveAttribute("data-state", "loaded");
    rerender(<ViewState state={{ status: "loaded", refreshing: true }} skeleton={skeleton}><p>Figures</p></ViewState>);
    expect(screen.getByText("Figures")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
    expect(screen.getByTestId("view-state")).toHaveClass("bv-view-state--refreshing");
    expect(screen.getByTestId("view-state")).toHaveAttribute("aria-busy", "true");
  });

  it("empty: one line naming why, with the next step", () => {
    view({ status: "empty" }, { empty: <>No policies yet. <a href="#all">Switch</a></> });
    expect(screen.getByRole("status")).toHaveTextContent("No policies yet.");
    expect(screen.getByText("Switch")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("empty without a message renders the content (a chart with its own empty state)", () => {
    view({ status: "empty" });
    expect(screen.getByText("Figures")).toBeInTheDocument();
  });

  it("error: the reason with Retry; a timeout says so", () => {
    const reload = jest.fn();
    const { rerender } = view({ status: "error", error: "Server unavailable", reload });
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    fireEvent.click(screen.getByText("Retry"));
    expect(reload).toHaveBeenCalled();
    rerender(<ViewState state={{ status: "error", error: "x", timedOut: true, reload }} skeleton={skeleton}><p>Figures</p></ViewState>);
    expect(screen.getByRole("alert")).toHaveTextContent("This is taking too long to load.");
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });
});

describe("KpiCard figures", () => {
  it("shows a real zero as 0 and a figure that does not apply as an en dash with its reason", () => {
    const { rerender } = render(<KpiCard label="Policies" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    rerender(<KpiCard label="Retention" value={null} naReason="No renewal closed yet" />);
    expect(screen.getByTitle("No renewal closed yet")).toHaveTextContent("–");
    rerender(<KpiCard label="Ratio" value="-" naReason="Nothing written" />);
    expect(screen.getByTitle("Nothing written")).toHaveTextContent("–");
  });

  it("shows a skeleton of the figure on the first load, then the figure (also while refreshing)", () => {
    const { rerender } = render(<KpiCard label="Premium" value="₱0" loading note="Target" />);
    expect(screen.getByRole("status", { name: /^Loading/ })).toBeInTheDocument();
    expect(screen.queryByText("₱0")).toBeNull();
    rerender(<KpiCard label="Premium" value="₱0" refreshing />);
    expect(screen.getByText("₱0")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /^Loading/ })).toBeNull();
  });
});

describe("ThemedChart empty state", () => {
  it("shows the empty message inside the chart area, not a grey block", () => {
    render(<ThemedChart type="bar" data={{ labels: ["Oct"], datasets: [{ data: [0] }] }} emptyText="No policies issued since go-live." height={280} />);
    expect(screen.getByTestId("chart-empty")).toHaveTextContent("No policies issued since go-live.");
    expect(screen.getByTestId("chart-empty")).toHaveStyle({ minHeight: "280px" });
    expect(screen.queryByRole("status", { name: /^Loading/ })).toBeNull();
    expect(screen.queryByTestId("chart")).toBeNull();
  });
});
