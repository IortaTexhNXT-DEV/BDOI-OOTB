/**
 * Skeleton blocks of the final size, shown where figures, charts or a record's details are about to appear, so a
 * screen is never blank and nothing moves when the data arrives. They fade in after 150 ms (theme/bdoi/enterprise.scss),
 * so a quick answer shows none. Tables get theirs from components/DataTable.
 */
import React from "react";
import { Skeleton } from "primereact/skeleton";

/** The figure of a KPI card (one line of large digits). */
export const KpiValueSkeleton = ({ width = "7rem" }) => (
  <Skeleton className="bv-skeleton-block" width={width} height="2rem" borderRadius="6px" />
);

/** A chart of the given height. */
export const ChartSkeleton = ({ height = "250px" }) => (
  <div className="bv-chart-skeleton" style={{ height }} role="status" aria-label="Loading" aria-busy="true">
    <Skeleton width="100%" height="100%" borderRadius="8px" />
  </div>
);

/** Label / value pairs of a record (detail pages): `rows` lines in `columns` columns. */
export const FieldsSkeleton = ({ rows = 4, columns = 3 }) => (
  <div
    className="bv-fields-skeleton"
    style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "1.25rem 1.5rem" }}
    role="status"
    aria-label="Loading"
    aria-busy="true"
  >
    {Array.from({ length: rows * columns }, (_, i) => (
      <div key={i}>
        <Skeleton width="40%" height="0.75rem" className="mb-2" />
        <Skeleton width={`${55 + ((i * 17) % 35)}%`} height="1.1rem" />
      </div>
    ))}
  </div>
);

/** A whole detail page that has nothing to show before its record arrives: title, a card of fields, a table. */
export const DetailPageSkeleton = () => (
  <div className="bv-page-skeleton" role="status" aria-label="Loading" aria-busy="true">
    <Skeleton width="16rem" height="1.75rem" className="mb-2" />
    <Skeleton width="10rem" height="0.9rem" className="mb-4" />
    <div className="bv-page-skeleton__card">
      <FieldsSkeleton rows={3} columns={3} />
    </div>
    <div className="bv-page-skeleton__card">
      <FieldsSkeleton rows={2} columns={4} />
    </div>
  </div>
);
