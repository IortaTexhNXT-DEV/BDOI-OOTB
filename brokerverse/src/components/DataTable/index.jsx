/**
 * PrimeReact DataTable with the loading pattern of every list in the application.
 *
 * `import { DataTable } from "primereact/datatable"` resolves to this module (craco.config.js aliases it), so every
 * screen gets the same behaviour without changes:
 *  - the table, its column headings and its place on the page are drawn at once;
 *  - while the first rows are loading (or the table is new and still empty), the body shows skeleton rows aligned
 *    with the columns: as many as the page size (5 for a table without a paginator), of the final row height, so
 *    nothing moves when the data arrives. The skeleton fades in only after 150 ms, so a quick answer shows none;
 *  - a refresh keeps the current rows under the light veil of the theme (theme/bdoi/enterprise.scss).
 * `skeletonRows` overrides the number of skeleton rows.
 */
import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DataTable as PrimeDataTable } from "primereact/datatable/datatable.esm.js";
import { Skeleton } from "primereact/skeleton";

// A new empty table waits this long for its data before it says "No records" (screens that set `loading` only after
// their first render, or that pass the rows in later).
export const FIRST_LOAD_GRACE_MS = 800;

// bar widths (share of the column) that look like real values, picked by row and column
const WIDTHS = [72, 54, 86, 63, 78, 46, 90, 58];

/** Skeleton rows lined up with the column headings of the table they are drawn in. */
export const TableSkeleton = ({ rows = 5 }) => {
  const ref = useRef(null);
  const [columns, setColumns] = useState([]);

  useLayoutEffect(() => {
    const table = ref.current?.closest("table");
    if (!table) return undefined;
    const measure = () => {
      const heads = table.querySelectorAll(":scope > thead > tr:last-child > th");
      const widths = Array.from(heads).map((th) => th.getBoundingClientRect().width);
      setColumns((prev) => (prev.length === widths.length && prev.every((w, i) => Math.abs(w - widths[i]) < 1) ? prev : widths));
    };
    measure();
    if (typeof window.ResizeObserver !== "function") return undefined;
    const observer = new window.ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);

  // shares of the width (not pixels), so the skeleton never widens the table it measures
  const template = columns.length ? columns.map((w) => `minmax(0, ${Math.max(1, Math.round(w))}fr)`).join(" ") : "repeat(4, minmax(0, 1fr))";
  const count = columns.length || 4;
  return (
    <div ref={ref} className="bv-table-skeleton" role="status" aria-label="Loading" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="bv-table-skeleton__row" data-testid="table-skeleton-row" style={{ gridTemplateColumns: template }}>
          {Array.from({ length: count }, (__, c) => (
            <div key={c} className="bv-table-skeleton__cell">
              <Skeleton height="0.75rem" width={`${WIDTHS[(r * 3 + c) % WIDTHS.length]}%`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const isEmpty = (value) => !Array.isArray(value) || value.length === 0;

export const DataTable = forwardRef(function DataTable(props, ref) {
  const { skeletonRows, ...rest } = props;
  const empty = isEmpty(rest.value);
  // "settled": the table has had its data once (rows arrived, or a load finished, or the grace time is over)
  const [settled, setSettled] = useState(!empty);
  const sawLoading = useRef(!!rest.loading);

  useEffect(() => {
    if (settled) return undefined;
    if (!empty) {
      setSettled(true);
      return undefined;
    }
    if (rest.loading) {
      sawLoading.current = true;
      return undefined;
    }
    if (sawLoading.current) {
      setSettled(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setSettled(true), FIRST_LOAD_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [settled, empty, rest.loading]);

  const skeleton = empty && (!!rest.loading || !settled);
  if (!skeleton) return <PrimeDataTable ref={ref} {...rest} />;

  const rows = skeletonRows || (rest.paginator && rest.rows) || 5;
  return (
    <PrimeDataTable
      ref={ref}
      {...rest}
      loading={false}
      emptyMessage={<TableSkeleton rows={rows} />}
      className={`${rest.className || ""} bv-table-is-loading`.trim()}
    />
  );
});

export default DataTable;
