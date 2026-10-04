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
const skeleton = () => screen.queryByRole("status", { name: "Loading" });

describe("DataTable loading pattern", () => {
  it("draws the column headings and as many skeleton rows as the page size while the first page loads", () => {
    render(table({ value: [], loading: true, paginator: true, rows: 20, lazy: true, totalRecords: 0 }));
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByTestId("bv-table-skeleton-row")).toHaveLength(20);
    expect(skeleton()).not.toBeNull();
    expect(screen.queryByText("No records")).toBeNull();
  });
  it("shows the rows once they arrive, and keeps them under the veil on a refresh", () => {
    const { rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: false }));
    expect(skeleton()).toBeNull();
    expect(screen.getByText("Alpha")).toBeTruthy();
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: true }));
    expect(skeleton()).toBeNull();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });
  it("says No records when the load finished empty", () => {
    const { rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [], loading: false }));
    expect(skeleton()).toBeNull();
    expect(screen.getByText("No records")).toBeTruthy();
  });
  it("gives a new empty table a short grace before No records", () => {
    jest.useFakeTimers();
    render(table({ value: [] }));
    expect(screen.getAllByTestId("bv-table-skeleton-row")).toHaveLength(5);
    act(() => {
      jest.advanceTimersByTime(FIRST_LOAD_GRACE_MS + 10);
    });
    expect(screen.getByText("No records")).toBeTruthy();
    jest.useRealTimers();
  });
});
