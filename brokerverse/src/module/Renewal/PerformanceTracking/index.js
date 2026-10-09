import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Chart } from "primereact/chart";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import renewalsWorkspaceService, { periodRange, productLabel } from "../../../services/renewalsWorkspaceService";
import StatCards from "../../../components/StatCards";
import { EmptyState, FilterBar, SectionCard, StatusChip } from "../../../components/RecordPage";
import { calendarDateFormat, formatDate } from "../../../utility/dateFormat";
import { formatPercent, formatWithUnit } from "../../../utility/numberFormat";
import { RenewalHeader } from "../shared";
import "./index.scss";

const PERIODS = ["Current Month", "Last 3 Months", "Last 6 Months", "Year to Date", "Custom Range"];

/** The KPI is met when the achieved value reaches the target (at or below it for cycle time, where lower is better). */
const isMet = (kpi) => (kpi.lowerIsBetter ? kpi.achieved <= kpi.target : kpi.achieved >= kpi.target);

/**
 * Operations > Renewals > Performance: renewal KPIs of the renewals due in the period against the targets of the
 * renewal settings (renewals.target_*), as a scorecard, per account executive, per product line and by month.
 */
const PerformanceTracking = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("Current Month");
  const [range, setRange] = useState(null);
  const [line, setLine] = useState("");
  const [data, setData] = useState({});
  const [targets, setTargets] = useState({});
  const [tab, setTab] = useState(0);
  const tables = { kpi: useRef(null), agents: useRef(null), products: useRef(null), trend: useRef(null) };

  useEffect(() => {
    renewalsWorkspaceService.getSettings("renewals").then(setTargets).catch(() => setTargets({}));
  }, []);

  const load = useCallback(async () => {
    if (period === "Custom Range" && !(range?.[0] && range?.[1])) return;
    setLoading(true);
    try {
      setData(await renewalsWorkspaceService.getPerformance(periodRange(period, range || [])));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message, life: 5000 });
    } finally {
      setLoading(false);
    }
  }, [period, range, t]);
  useEffect(() => { load(); }, [load]);

  const overall = useMemo(() => data.overall || {}, [data]);
  const kpis = useMemo(() => [
    { key: "renewalRate", target: Number(targets["renewals.target_renewal_rate"] ?? 0), achieved: overall.renewalRate ?? 0, unit: "%" },
    { key: "premiumRetention", target: Number(targets["renewals.target_premium_retention"] ?? 0), achieved: overall.premiumRetention ?? 0, unit: "%" },
    { key: "cycleTime", target: Number(targets["renewals.target_cycle_days"] ?? 0), achieved: overall.avgCycleTime ?? 0, unit: t("perf.days"), lowerIsBetter: true },
  ].map((k) => ({ ...k, label: t(`perf.kpi.${k.key}`), variance: Math.round((k.achieved - k.target) * 100) / 100, met: isMet(k) })), [targets, overall, t]);

  const products = Object.entries(data.byProduct || {}).filter(([key]) => !line || key === line)
    .map(([key, p]) => ({ key, name: productLabel(key), ...p }));
  const agents = data.byAgent || [];
  const months = (data.trends?.monthly || []).map((m) => ({ ...m, label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) }));

  const figures = [
    ...kpis.map((k) => ({ key: k.key, label: k.label, value: formatWithUnit(k.achieved, k.unit), note: t("perf.targetNote", { target: formatWithUnit(k.target, k.unit) }) })),
    { key: "renewed", label: t("perf.renewed"), value: overall.renewed ?? null, note: t("perf.ofDecided", { count: (overall.renewed || 0) + (overall.lapsed || 0) }) },
    { key: "open", label: t("perf.open"), value: overall.open ?? null, note: t("perf.dueInPeriod", { count: overall.total || 0 }) },
  ];

  const primary = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--bv-primary").trim() || "#0072d8" : "#0072d8";
  const chart = {
    labels: months.map((m) => m.label),
    datasets: [{ label: t("perf.kpi.renewalRate"), data: months.map((m) => m.rate), borderColor: primary, backgroundColor: primary, tension: 0, fill: false }],
  };
  const chartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } },
  };

  const exportCurrent = () => {
    const ref = [tables.kpi, tables.agents, tables.products, tables.trend][tab];
    ref.current?.exportCSV();
  };
  const num = { className: "bv-num", headerClassName: "bv-num" };
  const empty = <EmptyState icon="pi-chart-bar" title={t("perf.emptyTitle")} text={t("perf.emptyText")} />;

  return (
    <div className="bv-ops-page performance-page">
      <Toast ref={toast} />
      <RenewalHeader title={t("perf.title")}
        actions={<Button icon="pi pi-download" outlined label={t("perf.export")} onClick={exportCurrent} />} />
      <FilterBar>
        <Dropdown value={period} onChange={(e) => setPeriod(e.value)} aria-label={t("perf.period")}
          options={PERIODS.map((p) => ({ label: t(`perf.periods.${p}`, p), value: p }))} />
        {period === "Custom Range" ? (
          <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" readOnlyInput showIcon dateFormat={calendarDateFormat()}
            placeholder={t("perf.range")} aria-label={t("perf.range")} />
        ) : null}
        <Dropdown value={line} onChange={(e) => setLine(e.value || "")} aria-label={t("perf.line")}
          options={[{ label: t("perf.allLines"), value: "" }, ...Object.keys(data.byProduct || {}).map((k) => ({ label: productLabel(k), value: k }))]} />
        {data.period ? <span className="bv-muted">{t("perf.periodText", { from: formatDate(data.period.from), to: formatDate(data.period.to) })}</span> : null}
      </FilterBar>
      <StatCards items={figures} />

      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)} className="bv-tabbar">
        <TabPanel header={t("perf.tabs.kpi")} />
        <TabPanel header={t("perf.tabs.agents")} />
        <TabPanel header={t("perf.tabs.products")} />
        <TabPanel header={t("perf.tabs.trend")} />
      </TabView>

      {tab === 0 ? (
        <SectionCard flush title={t("perf.tabs.kpi")} hint={t("perf.kpiHint")}>
          <DataTable ref={tables.kpi} value={kpis} dataKey="key" size="small" loading={loading} exportFilename="renewal-kpis">
            <Column field="label" header={t("perf.col.kpi")} />
            <Column field="target" header={t("perf.col.target")} body={(k) => formatWithUnit(k.target, k.unit)} {...num} />
            <Column field="achieved" header={t("perf.col.achieved")} body={(k) => formatWithUnit(k.achieved, k.unit)} {...num} />
            <Column field="variance" header={t("perf.col.variance")} body={(k) => `${k.variance > 0 ? "+" : ""}${formatWithUnit(k.variance, k.unit)}`} {...num} />
            <Column field="met" header={t("perf.col.status")} body={(k) => <StatusChip label={k.met ? t("perf.met") : t("perf.notMet")} severity={k.met ? "success" : "warning"} />} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 1 ? (
        <SectionCard flush title={t("perf.tabs.agents")}>
          <DataTable ref={tables.agents} value={agents} dataKey="agentName" size="small" loading={loading} sortField="renewalRate" sortOrder={-1}
            exportFilename="renewal-performance-by-account-executive" emptyMessage={empty}>
            <Column field="agentName" header={t("perf.col.agent")} sortable />
            <Column field="renewalRate" header={t("perf.kpi.renewalRate")} sortable body={(a) => formatPercent(a.renewalRate)} {...num} />
            <Column field="policiesRenewed" header={t("perf.col.renewed")} sortable {...num} />
            <Column field="premiumRetained" header={t("perf.col.premiumRetained")} sortable body={(a) => formatCurrency(a.premiumRetained)} {...num} />
            <Column field="avgCycleTime" header={t("perf.kpi.cycleTime")} sortable body={(a) => formatWithUnit(a.avgCycleTime, t("perf.days"))} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 2 ? (
        <SectionCard flush title={t("perf.tabs.products")}>
          <DataTable ref={tables.products} value={products} dataKey="key" size="small" loading={loading} exportFilename="renewal-performance-by-line" emptyMessage={empty}>
            <Column field="name" header={t("perf.col.line")} sortable />
            <Column field="renewalRate" header={t("perf.kpi.renewalRate")} sortable body={(p) => formatPercent(p.renewalRate)} {...num} />
            <Column field="renewed" header={t("perf.col.renewed")} sortable {...num} />
            <Column field="lapsed" header={t("perf.col.lapsed")} sortable {...num} />
            <Column field="open" header={t("perf.col.open")} sortable {...num} />
            <Column field="avgPremium" header={t("perf.col.avgPremium")} sortable body={(p) => formatCurrency(p.avgPremium)} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 3 ? (
        <SectionCard title={t("perf.tabs.trend")} hint={t("perf.trendHint")}>
          {months.length ? (
            <div className="performance-page__chart"><Chart type="line" data={chart} options={chartOptions} /></div>
          ) : empty}
          <DataTable ref={tables.trend} value={months} dataKey="month" size="small" className={months.length ? "mt-3" : "hidden"} exportFilename="renewal-rate-by-month">
            <Column field="label" header={t("perf.col.month")} />
            <Column field="rate" header={t("perf.kpi.renewalRate")} body={(m) => formatPercent(m.rate)} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}
    </div>
  );
};

export default PerformanceTracking;
