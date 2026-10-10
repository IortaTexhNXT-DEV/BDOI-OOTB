import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import { directLabelPlugin, hasChartData, patternFill, referenceLinePlugin, useChartTheme } from "../../theme/chartTheme";
import { downloadCsv } from "../../utility/csvExport";
import { businessDate } from "../../utility/dateFormat";
import { formatValue } from "./format";
import { usePatterns } from "./usePatterns";

const PLUGINS = [referenceLinePlugin, directLabelPlugin];
const ROUND = new Set(["pie", "doughnut"]);

const withPatterns = (data, type) => ({
  ...data,
  datasets: (data.datasets || []).map((ds, i) => {
    if (ds.type === "line" || (type === "line" && !ds.type)) return ds;
    const fill = ds.backgroundColor;
    return { ...ds, backgroundColor: Array.isArray(fill) ? fill.map((c, j) => patternFill(c, j)) : patternFill(fill, i) };
  }),
});

/**
 * A chart in the data theme (theme/chartTheme.js): neutral axes, compact values on the value axis and full values in
 * the tooltip, a legend from two series up, direct labels (series names at the end of up to four lines, values at the
 * tip of single-series bars), targets as reference lines, the line texture when the viewer turned patterns on, and an
 * empty state instead of an empty axis.
 */
export const ThemedChart = ({ type, data, options, height, format, reference, directLabels, ariaLabel, emptyText }) => {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const [patterns] = usePatterns();
  const round = ROUND.has(type);
  const horizontal = options?.indexAxis === "y";
  const seriesCount = round ? (data?.labels || []).length : (data?.datasets || []).length;
  const lineLabels = directLabels && type === "line" && seriesCount >= 2 && seriesCount <= 4;
  // room at the right for the longest series name (lines) and above the columns for their values
  const labelRoom = lineLabels ? Math.min(160, Math.max(...(data?.datasets || []).map((ds) => String(ds.label || "").length)) * 6.5 + 16) : 0;
  const valueRoom = directLabels && type === "bar" && !horizontal && seriesCount === 1 ? 18 : 8;

  const built = useMemo(() => {
    const valueAxis = horizontal ? "x" : "y";
    const categoryAxis = horizontal ? "y" : "x";
    const given = options || {};
    const scales = round ? undefined : {
      [categoryAxis]: { ...(given.scales?.[categoryAxis] || {}) },
      ...given.scales,
      [valueAxis]: {
        beginAtZero: true,
        ...(given.scales?.[valueAxis] || {}),
        ticks: { maxTicksLimit: 6, callback: (v) => formatValue(format, v, { compact: true }), ...(given.scales?.[valueAxis]?.ticks || {}) },
      },
    };
    const value = (ctx) => (round ? ctx.parsed : horizontal ? ctx.parsed.x : ctx.parsed.y);
    return theme.options({
      maintainAspectRatio: false,
      interaction: type === "line" ? { mode: "index", intersect: false } : { mode: "nearest", intersect: true },
      ...given,
      ...(scales ? { scales } : {}),
      layout: { ...(given.layout || {}), padding: { top: valueRoom, right: lineLabels ? labelRoom : horizontal && directLabels ? 56 : 8, bottom: 0, left: 0, ...(given.layout?.padding || {}) } },
      plugins: {
        ...(given.plugins || {}),
        legend: { display: seriesCount >= 2, ...(given.plugins?.legend || {}) },
        tooltip: {
          callbacks: { label: (ctx) => ` ${round ? ctx.label : ctx.dataset.label || ctx.label}: ${formatValue(format, value(ctx))}` },
          ...(given.plugins?.tooltip || {}),
        },
        bvReference: { lines: (reference || []).map((r) => ({ axis: valueAxis, color: theme.text, ...r })) },
        bvDirectLabels: { enabled: !!directLabels, color: theme.text, format: (v) => formatValue(format, v, { compact: true }) },
      },
    });
  }, [theme, options, type, format, reference, directLabels, horizontal, round, seriesCount, lineLabels, labelRoom, valueRoom]);

  const shown = useMemo(() => (patterns ? withPatterns(data, type) : data), [data, patterns, type]);

  if (!hasChartData(data)) {
    return (
      <div className="bv-viz-empty" style={{ minHeight: height }}>
        <i className="pi pi-chart-bar" aria-hidden="true" />
        <span>{emptyText || t("dashboards.noData", "No data for this period")}</span>
      </div>
    );
  }
  return (
    <div className="bv-viz-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      <Chart type={type} data={shown} options={built} plugins={PLUGINS} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

ThemedChart.propTypes = {
  type: PropTypes.oneOf(["bar", "line", "doughnut", "pie"]).isRequired,
  data: PropTypes.shape({ labels: PropTypes.array, datasets: PropTypes.array }).isRequired,
  options: PropTypes.object,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  format: PropTypes.oneOfType([PropTypes.oneOf(["currency", "count", "percent", "days", "hours"]), PropTypes.func]),
  reference: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number, label: PropTypes.string })),
  directLabels: PropTypes.bool,
  ariaLabel: PropTypes.string,
  emptyText: PropTypes.node,
};
ThemedChart.defaultProps = { options: null, height: 280, format: "count", reference: null, directLabels: true, ariaLabel: undefined, emptyText: null };

/** Chart data as table rows: one row per label, one column per series. */
export const tableOf = (data, format) => {
  const labels = data?.labels || [];
  const datasets = data?.datasets || [];
  const series = datasets.length === 1 ? [{ field: "v0", header: datasets[0].label || "", format }] : datasets.map((ds, i) => ({ field: `v${i}`, header: ds.label || "", format }));
  return {
    columns: [{ field: "label", header: "" }, ...series],
    rows: labels.map((label, j) => Object.fromEntries([["label", label], ...datasets.map((ds, i) => [`v${i}`, ds.data?.[j]])])),
  };
};

/**
 * The frame of every dashboard chart: title, a Chart / Table switch (the table is the accessible twin of the chart and
 * is printed with it), the pattern switch and a CSV export of the figures. `table` = { columns: [{ field, header,
 * format }], rows }; tableOf(data, format) builds it from the chart data.
 */
const ChartCard = ({ title, subtitle, actions, table, exportName, className, children }) => {
  const { t } = useTranslation();
  const [view, setView] = useState("chart");
  const [patterns, togglePatterns] = usePatterns();
  const columns = table?.columns || [];
  const rows = table?.rows || [];
  const cell = (row, c) => (c.format ? formatValue(c.format, row[c.field]) : row[c.field] ?? "-");
  const exportCsv = () => downloadCsv(`${exportName || "chart"}-${businessDate()}.csv`, rows, columns.map((c) => ({ header: c.header || title, field: c.field })));
  const tableView = (
    <table className="bv-viz-table">
      <thead>
        <tr>{columns.map((c) => <th key={c.field} scope="col" className={c.format ? "bv-num" : undefined}>{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <tr key={i}>{columns.map((c) => <td key={c.field} className={c.format ? "bv-num" : undefined}>{cell(row, c)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <section className={`bv-chart-card ${className || ""}`}>
      <header className="bv-chart-card__head">
        <div className="bv-chart-card__titles">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="bv-chart-card__tools">
          {actions}
          {table ? (
            <div className="bv-viz-switch" role="group" aria-label={t("dashboards.view", "View")}>
              <button type="button" className={view === "chart" ? "active" : ""} aria-pressed={view === "chart"} onClick={() => setView("chart")}>{t("dashboards.chart", "Chart")}</button>
              <button type="button" className={view === "table" ? "active" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}>{t("dashboards.table", "Table")}</button>
            </div>
          ) : null}
          {table ? (
            <Button type="button" icon="pi pi-palette" text rounded size="small" className={patterns ? "bv-viz-tool active" : "bv-viz-tool"} aria-pressed={patterns}
              aria-label={t("dashboards.patterns", "Patterns for colour-blind viewing and print")} tooltip={t("dashboards.patterns", "Patterns for colour-blind viewing and print")}
              tooltipOptions={{ position: "top" }} onClick={togglePatterns} />
          ) : null}
          {table && rows.length ? (
            <Button type="button" icon="pi pi-download" text rounded size="small" className="bv-viz-tool" aria-label={t("dashboards.exportCsv", "Export CSV")}
              tooltip={t("dashboards.exportCsv", "Export CSV")} tooltipOptions={{ position: "top" }} onClick={exportCsv} />
          ) : null}
        </div>
      </header>
      <div className="bv-chart-card__body">
        {view === "table" && table ? tableView : children}
      </div>
      {table && view === "chart" && rows.length ? <div className="bv-chart-card__print">{tableView}</div> : null}
    </section>
  );
};

ChartCard.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  table: PropTypes.shape({ columns: PropTypes.array, rows: PropTypes.array }),
  exportName: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};
ChartCard.defaultProps = { subtitle: null, actions: null, table: null, exportName: null, className: "", children: null };

export default ChartCard;
