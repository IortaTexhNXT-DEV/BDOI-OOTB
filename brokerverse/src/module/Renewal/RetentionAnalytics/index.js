import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import renewalsWorkspaceService, { periodRange, productLabel } from "../../../services/renewalsWorkspaceService";
import StatCards from "../../../components/StatCards";
import { EmptyState, FilterBar, SectionCard } from "../../../components/RecordPage";
import { calendarDateFormat, formatDate, toIsoDate } from "../../../utility/dateFormat";
import { downloadCsv } from "../../../utility/csvExport";
import { useChartTheme } from "../../../theme/chartTheme";
import { DataAsOf, ThemedChart } from "../../../components/Dashboard";
import { formatPercent, formatWithUnit } from "../../../utility/numberFormat";
import { RenewalHeader } from "../shared";
import "./index.scss";

const PERIODS = ["Last 3 Months", "Last 6 Months", "Last 12 Months", "Year to Date", "Custom Range"];

/**
 * Operations > Renewals > Retention Analytics: how many renewals due in the period were renewed or lapsed, the premium
 * kept, by month, line of business and account executive, and the profile of the renewals still open (risk, claims,
 * unpaid premium, no contact yet) with a link to the list that works them.
 */
const RetentionAnalytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const chart = useChartTheme();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("Last 12 Months");
  const [range, setRange] = useState(null);
  const [line, setLine] = useState("");
  const [agent, setAgent] = useState("");
  const [data, setData] = useState({});
  const [open, setOpen] = useState([]);
  const [tab, setTab] = useState(0);
  const [targets, setTargets] = useState({});
  const [asOf, setAsOf] = useState(null);

  useEffect(() => {
    renewalsWorkspaceService.getSettings("renewals").then(setTargets).catch(() => setTargets({}));
  }, []);

  const load = useCallback(async () => {
    if (period === "Custom Range" && !(range?.[0] && range?.[1])) return;
    setLoading(true);
    try {
      const [performance, queue] = await Promise.all([
        renewalsWorkspaceService.getPerformance(periodRange(period, range || [])),
        renewalsWorkspaceService.getQueue(),
      ]);
      setData(performance);
      setOpen(queue.items || []);
      setAsOf(new Date());
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message, life: 5000 });
    } finally {
      setLoading(false);
    }
  }, [period, range, t]);
  useEffect(() => { load(); }, [load]);

  const overall = data.overall || {};
  const lines = Object.entries(data.byProduct || {}).filter(([k]) => !line || k === line).map(([key, p]) => ({ key, name: productLabel(key), ...p }));
  const agents = (data.byAgent || []).filter((a) => !agent || a.agentName === agent);
  const months = (data.trends?.monthly || []).map((m) => ({ ...m, label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) }));

  const profile = useMemo(() => {
    const total = open.length;
    const row = (key, count, link) => ({ key, label: t(`retention.profile.${key}`), count, share: total ? Math.round((count / total) * 1000) / 10 : 0, link });
    return [
      row("highRisk", open.filter((i) => ["High", "Critical"].includes(i.retentionRisk)).length, "/renewal/at-risk"),
      row("claims", open.filter((i) => Number(i.claimsHistory?.totalClaims) > 0).length, "/renewal/at-risk"),
      row("unpaid", open.filter((i) => Number(i.outstandingPremium) > 0).length, "/renewal/queue"),
      row("noContact", open.filter((i) => !i.contactAttempts && !i.noticeStage).length, "/renewal/queue"),
      row("grace", open.filter((i) => i.inGracePeriod).length, "/renewal/lapse-management"),
    ];
  }, [open, t]);

  const rateTarget = Number(targets["renewals.target_renewal_rate"] ?? 0);
  const figures = [
    { key: "rate", label: t("retention.renewalRate"), value: formatPercent(overall.renewalRate ?? 0), note: t("retention.renewedLapsed", { renewed: overall.renewed ?? 0, lapsed: overall.lapsed ?? 0 }),
      status: rateTarget ? { severity: (overall.renewalRate ?? 0) >= rateTarget ? "good" : "warning", label: (overall.renewalRate ?? 0) >= rateTarget ? t("perf.met") : t("perf.notMet") } : null },
    { key: "retention", label: t("retention.premiumRetention"), value: formatPercent(overall.premiumRetention ?? 0), note: t("retention.retained", { amount: formatCurrency(overall.premiumRetained || 0) }) },
    { key: "cycle", label: t("retention.cycleTime"), value: formatWithUnit(overall.avgCycleTime ?? 0, t("perf.days")), note: t("retention.cycleNote") },
    { key: "open", label: t("retention.openNow"), value: open.length, note: t("retention.openNote", { count: profile[0]?.count || 0 }), onClick: () => navigate("/renewal/queue") },
  ];

  const trendData = {
    labels: months.map((m) => m.label),
    datasets: [{ label: t("retention.renewalRate"), data: months.map((m) => m.rate), borderColor: chart.primary, backgroundColor: chart.primary, pointBackgroundColor: chart.primary }],
  };
  // the target is a reference line, not a second series
  const trendReference = rateTarget ? [{ value: rateTarget, label: t("perf.targetLine", { target: formatPercent(rateTarget) }) }] : null;
  const num = { className: "bv-num", headerClassName: "bv-num" };
  const empty = <EmptyState icon="pi-chart-line" title={t("perf.emptyTitle")} text={t("perf.emptyText")} />;

  // the export of each tab: the rows the tab shows
  const tabExports = [
    { name: "retention-by-month", rows: months, columns: [
      { header: t("perf.col.month"), field: "label" },
      { header: t("retention.renewalRate"), field: "rate" },
    ] },
    { name: "retention-by-line", rows: lines, columns: [
      { header: t("perf.col.line"), field: "name" },
      { header: t("retention.renewalRate"), field: "renewalRate" },
      { header: t("perf.col.renewed"), field: "renewed" },
      { header: t("perf.col.lapsed"), field: "lapsed" },
      { header: t("perf.col.open"), field: "open" },
      { header: t("perf.col.avgPremium"), field: "avgPremium" },
    ] },
    { name: "retention-by-account-executive", rows: agents, columns: [
      { header: t("perf.col.agent"), field: "agentName" },
      { header: t("retention.renewalRate"), field: "renewalRate" },
      { header: t("perf.col.renewed"), field: "policiesRenewed" },
      { header: t("perf.col.premiumRetained"), field: "premiumRetained" },
      { header: t("retention.cycleTime"), field: "avgCycleTime" },
    ] },
    { name: "open-renewals-profile", rows: profile, columns: [
      { header: t("retention.col.indicator"), field: "label" },
      { header: t("retention.col.renewals"), field: "count" },
      { header: t("retention.col.share"), field: "share" },
    ] },
  ];
  const exportCurrent = () => {
    const { name, rows, columns } = tabExports[tab];
    downloadCsv(`${name}-${toIsoDate(new Date())}.csv`, rows, columns);
    toast.current?.show({ severity: "success", summary: t("renewal.exportStarted"), detail: t("renewal.rowsExported", { count: rows.length }), life: 3000 });
  };

  return (
    <div className="bv-ops-page retention-page">
      <Toast ref={toast} />
      <RenewalHeader title={t("retention.title")}
        actions={(
          <Button icon="pi pi-download" outlined label={t("perf.export")} tooltip={t("renewal.exportToCsv")} tooltipOptions={{ position: "top" }}
            onClick={exportCurrent} disabled={!tabExports[tab].rows.length} />
        )} />
      <FilterBar>
        <Dropdown value={period} onChange={(e) => setPeriod(e.value)} aria-label={t("perf.period")}
          options={PERIODS.map((p) => ({ label: t(`retention.periods.${p}`, p), value: p }))} />
        {period === "Custom Range" ? (
          <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" readOnlyInput showIcon dateFormat={calendarDateFormat()}
            placeholder={t("perf.range")} aria-label={t("perf.range")} />
        ) : null}
        <Dropdown value={line} onChange={(e) => setLine(e.value || "")} aria-label={t("perf.line")}
          options={[{ label: t("perf.allLines"), value: "" }, ...Object.keys(data.byProduct || {}).map((k) => ({ label: productLabel(k), value: k }))]} />
        <Dropdown value={agent} onChange={(e) => setAgent(e.value || "")} filter aria-label={t("perf.col.agent")}
          options={[{ label: t("queue.allAgents"), value: "" }, ...(data.byAgent || []).map((a) => ({ label: a.agentName, value: a.agentName }))]} />
        {data.period ? <span className="bv-muted">{t("perf.periodText", { from: formatDate(data.period.from), to: formatDate(data.period.to) })}</span> : null}
        <DataAsOf asOf={asOf} />
      </FilterBar>
      <StatCards items={figures} />

      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)} className="bv-tabbar">
        <TabPanel header={t("perf.tabs.trend")} />
        <TabPanel header={t("perf.tabs.products")} />
        <TabPanel header={t("perf.tabs.agents")} />
        <TabPanel header={t("retention.tabOpen")} />
      </TabView>

      {tab === 0 ? (
        <SectionCard title={t("perf.tabs.trend")} hint={t("perf.trendHint")}>
          {months.length ? <ThemedChart type="line" data={trendData} format="percent" options={{ scales: { y: { max: 100 } } }} reference={trendReference} height={280} /> : empty}
          <DataTable value={months} dataKey="month" size="small" className={months.length ? "mt-3" : "hidden"}>
            <Column field="label" header={t("perf.col.month")} />
            <Column field="rate" header={t("retention.renewalRate")} body={(m) => formatPercent(m.rate)} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 1 ? (
        <SectionCard flush title={t("perf.tabs.products")}>
          <DataTable value={lines} dataKey="key" size="small" loading={loading} emptyMessage={empty}>
            <Column field="name" header={t("perf.col.line")} sortable />
            <Column field="renewalRate" header={t("retention.renewalRate")} sortable body={(p) => formatPercent(p.renewalRate)} {...num} />
            <Column field="renewed" header={t("perf.col.renewed")} sortable {...num} />
            <Column field="lapsed" header={t("perf.col.lapsed")} sortable {...num} />
            <Column field="open" header={t("perf.col.open")} sortable {...num} />
            <Column field="avgPremium" header={t("perf.col.avgPremium")} sortable body={(p) => formatCurrency(p.avgPremium)} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 2 ? (
        <SectionCard flush title={t("perf.tabs.agents")}>
          <DataTable value={agents} dataKey="agentName" size="small" loading={loading} sortField="renewalRate" sortOrder={-1} emptyMessage={empty}>
            <Column field="agentName" header={t("perf.col.agent")} sortable />
            <Column field="renewalRate" header={t("retention.renewalRate")} sortable body={(a) => formatPercent(a.renewalRate)} {...num} />
            <Column field="policiesRenewed" header={t("perf.col.renewed")} sortable {...num} />
            <Column field="premiumRetained" header={t("perf.col.premiumRetained")} sortable body={(a) => formatCurrency(a.premiumRetained)} {...num} />
            <Column field="avgCycleTime" header={t("retention.cycleTime")} sortable body={(a) => formatWithUnit(a.avgCycleTime, t("perf.days"))} {...num} />
          </DataTable>
        </SectionCard>
      ) : null}

      {tab === 3 ? (
        <SectionCard flush title={t("retention.tabOpen")} hint={t("retention.openHint", { count: open.length })}>
          <DataTable value={profile} dataKey="key" size="small" loading={loading}>
            <Column field="label" header={t("retention.col.indicator")} />
            <Column field="count" header={t("retention.col.renewals")} {...num} />
            <Column field="share" header={t("retention.col.share")} body={(r) => formatPercent(r.share)} {...num} />
            <Column header={t("retention.col.workOn")} className="bv-actions" headerClassName="bv-actions"
              body={(r) => <Button text size="small" icon="pi pi-arrow-right" iconPos="right" label={t(`retention.links.${r.link.split("/").pop()}`)} onClick={() => navigate(r.link)} />} />
          </DataTable>
        </SectionCard>
      ) : null}
    </div>
  );
};

export default RetentionAnalytics;
