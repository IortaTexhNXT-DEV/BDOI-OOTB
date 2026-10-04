import React from "react";
import { act, render, screen } from "@testing-library/react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { FIRST_LOAD_GRACE_MS } from "./index";

const table = (props) => (
  <DataTable emptyMessage="No records" {...props}>
    <Column field="code" header="Code" />
    <Column field="name" header="Name" />
  </DataTable>
);

describe("DataTable loading pattern", () => {
  it("draws the column headings and as many skeleton rows as the page size while the first page loads", () => {
    render(table({ value: [], loading: true, paginator: true, rows: 20, lazy: true, totalRecords: 0 }));
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByTestId("table-skeleton-row")).toHaveLength(20);
    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("No records")).toBeNull();
  });
  it("shows the rows once they arrive, and keeps them under the veil on a refresh", () => {
    const { rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: false }));
    expect(screen.queryByTestId("table-skeleton-row")).toBeNull();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: true }));
    expect(screen.queryByTestId("table-skeleton-row")).toBeNull();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
  it("says No records when the load finished empty", () => {
    const { rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [], loading: false }));
    expect(screen.queryByTestId("table-skeleton-row")).toBeNull();
    expect(screen.getByText("No records")).toBeInTheDocument();
  });
  it("gives a new empty table a short grace before No records", () => {
    jest.useFakeTimers();
    render(table({ value: [] }));
    expect(screen.getAllByTestId("table-skeleton-row")).toHaveLength(5);
    act(() => {
      jest.advanceTimersByTime(FIRST_LOAD_GRACE_MS + 10);
    });
    expect(screen.getByText("No records")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
