/* The skeleton rows and the loading class are presentational (no role or text to query), so this test reads the DOM. */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import { act, render } from "@testing-library/react";
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
    const { container } = render(table({ value: [], loading: true, paginator: true, rows: 20, lazy: true, totalRecords: 0 }));
    expect(container.querySelectorAll("thead th")).toHaveLength(2);
    expect(container.querySelectorAll(".bv-table-skeleton__row")).toHaveLength(20);
    expect(container.querySelector(".p-datatable").className).toContain("bv-table-is-loading");
    expect(container.textContent).not.toContain("No records");
  });
  it("shows the rows once they arrive, and keeps them under the veil on a refresh", () => {
    const { container, rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: false }));
    expect(container.querySelector(".bv-table-skeleton")).toBeNull();
    expect(container.textContent).toContain("Alpha");
    rerender(table({ value: [{ code: "A", name: "Alpha" }], loading: true }));
    expect(container.querySelector(".bv-table-skeleton")).toBeNull();
    expect(container.textContent).toContain("Alpha");
  });
  it("says No records when the load finished empty", () => {
    const { container, rerender } = render(table({ value: [], loading: true }));
    rerender(table({ value: [], loading: false }));
    expect(container.querySelector(".bv-table-skeleton")).toBeNull();
    expect(container.textContent).toContain("No records");
  });
  it("gives a new empty table a short grace before No records", () => {
    jest.useFakeTimers();
    const { container } = render(table({ value: [] }));
    expect(container.querySelectorAll(".bv-table-skeleton__row")).toHaveLength(5);
    act(() => {
      jest.advanceTimersByTime(FIRST_LOAD_GRACE_MS + 10);
    });
    expect(container.textContent).toContain("No records");
    jest.useRealTimers();
  });
});
