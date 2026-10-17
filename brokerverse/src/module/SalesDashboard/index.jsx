import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import dashboardService from "../../services/dashboardService";
import StatCards from "../../components/StatCards";
import { ChartCard, DashboardToolbar, LISTS, OriginEmpty, ThemedChart, ViewState, changeOf, drillDown, formatValue, useDashboardOrigin } from "../../components/Dashboard";
import { useStableLoad } from "../../hooks/useStableLoad";
import { calendarDateFormat, formatDate, toIsoDate } from "../../utility/dateFormat";
import { formatPercent } from "../../utility/numberFormat";
import { useChartTheme } from "../../theme/chartTheme";
import "./index.scss";

/** "PendingCustomer" / "QuoteGenerated" as sentence-case text. */
export const stageLabel = (stage) => {
  const words = String(stage || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "-";
};

/**
 * Sales Dashboard: prospects, quotations, conversion and premium over a period against the previous period or the
 * same period last year, the open pipeline by stage and the figures per sales person. Managers see the whole book (or
 * one sales person); scoped sales roles their own book. Policies and premium count the business issued in BrokerVerse
 * since go-live, or all business with the migrated policies (the toolbar switch, kept per user).
 */
const SalesDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const toast = useRef(null);
  const [period, setPeriod] = useState("month");
  const [compare, setCompare] = useState("previous");
  const [range, setRange] = useState(null);
  const [salesPerson, setSalesPerson] = useState(null);
  const { origin, setOrigin, ready, cutoverDate } = useDashboardOrigin();
  // a custom range is used once both ends are picked; otherwise the calendar period. Keyed on the dates, so picking
  // the first end of a range (or the same range again) does not read the figures again.
  const customFrom = range?.[0] && range?.[1] ? toIsoDate(range[0]) : null;
  const customTo = customFrom ? toIsoDate(range[1]) : null;
  // four states (hooks/useStableLoad); the spinner stops when the request settles
  const view = useStableLoad(useCallback(() => {
    const query = customFrom ? { from: customFrom, to: customTo } : { period };
    return dashboardService.getSalesOverview({ ...query, compare, salesPerson: salesPerson || undefined, origin });
  }, [period, compare, customFrom, customTo, salesPerson, origin]), { enabled: ready, isEmpty: (d) => !d });
  const { data } = view;
  const loading = view.loading || view.refreshing;
  const load = view.reload;
  const refreshError = view.status === "loaded" ? view.error : null;
  useEffect(() => {
    if (refreshError) toast.current?.show({ severity: "error", summary: t("common.error"), detail: refreshError, life: 5000 });
  }, [refreshError, t]);

  const money = (v) => formatValue("currency", v, { compact: true });
  const full = (v) => formatValue("currency", v);
  const k = data?.kpis || {};
  const p = data?.previous || {};
  const comparison = t(`dashboards.vs.${compare}`);
  const from = data?.period?.from;
  const to = data?.period?.to;
  const listOrigin = origin === "issued" ? "issued" : "";
  const sinceGoLive = data?.issuedSinceGoLive;

  const personOptions = [
    { label: t("salesDashboard.allSalesPersons"), value: null },
    ...(data?.salesPersons || []).map((x) => ({ label: x.name, value: x.id })),
  ];

  const tiles = [
    { key: "prospects", label: t("salesDashboard.newProspects"), value: data ? k.newProspects : null, change: changeOf(k.newProspects, p.newProspects), comparison,
      note: t("salesDashboard.totalProspects", { count: k.prospects ?? 0 }), onClick: () => drillDown(navigate, LISTS.prospects()) },
    { key: "quotations", label: t("salesDashboard.quotations"), value: data ? k.quotations : null, change: changeOf(k.quotations, p.quotations), comparison,
      note: `${t("salesDashboard.quoted")}: ${money(k.quotedPremium)}`, onClick: () => drillDown(navigate, LISTS.quotations()) },
    { key: "conversion", label: t("salesDashboard.conversion"), value: data ? formatPercent(k.prospectConversionRate) : null, change: changeOf(k.prospectConversionRate, p.prospectConversionRate), comparison,
      note: `${t("salesDashboard.quoteConversion")}: ${formatPercent(k.quoteConversionRate)}` },
    { key: "policies", label: t("salesDashboard.policies"), value: data ? k.policies : null, change: changeOf(k.policies, p.policies), comparison,
      onClick: () => drillDown(navigate, LISTS.policiesIssued(from, to, "", listOrigin)) },
    { key: "premium", label: t("salesDashboard.premium"), value: data ? money(k.premium) : null, change: changeOf(k.premium, p.premium), comparison,
      onClick: () => drillDown(navigate, LISTS.policiesIssued(from, to, "", listOrigin)) },
    { key: "pipeline", label: t("salesDashboard.pipeline"), value: data ? money(k.pipelineValue) : null, note: t("salesDashboard.openQuotations", { count: k.pipelineCount ?? 0 }),
      onClick: () => drillDown(navigate, LISTS.quotations()) },
    ...(sinceGoLive ? [{ key: "issuedSinceGoLive", label: t("dashboards.sinceGoLive.title", "Issued since go-live"), value: money(sinceGoLive.premium),
      note: t("dashboards.sinceGoLive.note", { count: sinceGoLive.policies, date: formatDate(sinceGoLive.cutoverDate), defaultValue: "{{count}} policies since {{date}}" }),
      onClick: () => drillDown(navigate, LISTS.policiesIssued(sinceGoLive.cutoverDate, null, "", "issued")) }] : []),
  ];

  // premium and activity by month: two charts, never two scales on one plot
  const trend = data?.monthlyTrend || {};
  const months = (trend.labels || []).map((label, i) => ({ label, month: trend.months?.[i] || label, premium: trend.premium?.[i], prospects: trend.leads?.[i], quotations: trend.quotes?.[i] }));
  const [prospectColor, quoteColor] = chart.series(2);
  const premiumData = { labels: trend.labels || [], datasets: [{ label: t("salesDashboard.premium"), data: trend.premium || [], backgroundColor: chart.primary }] };
  const activityData = {
    labels: trend.labels || [],
    datasets: [
      { label: t("salesDashboard.prospects"), data: trend.leads || [], borderColor: prospectColor, backgroundColor: prospectColor, pointBackgroundColor: prospectColor },
      { label: t("salesDashboard.quotations"), data: trend.quotes || [], borderColor: quoteColor, backgroundColor: quoteColor, pointBackgroundColor: quoteColor },
    ],
  };
  const product = data?.premiumByProduct || {};
  const products = (product.labels || []).map((label, i) => ({ label, premium: product.data[i], policies: product.policies?.[i] })).sort((a, b) => b.premium - a.premium);
  const productData = { labels: products.map((x) => x.label), datasets: [{ label: t("salesDashboard.premium"), data: products.map((x) => x.premium), backgroundColor: chart.primary }] };
  const right = { className: "text-right", headerClassName: "text-right" };
  // tables: no "No records" before the answer, the rows kept under the veil while a refresh runs
  const tableState = { loading, emptyMessage: view.status === "error" ? view.error : t("salesDashboard.noRecords") };
  // "Issued since go-live" with no policy issued since: say why and offer All business
  const nothingIssued = origin === "issued" && !!data && !Number(k.policies) && !(trend.premium || []).some((v) => Number(v)) && !Number(sinceGoLive?.policies);
  const goLive = sinceGoLive?.cutoverDate || cutoverDate;
  const emptyChart = nothingIssued ? <OriginEmpty inline cutoverDate={goLive} onOrigin={setOrigin} /> : null;

  return (
    <div className="sales-dashboard bv-dash-page">
      <Toast ref={toast} />
      <DashboardToolbar title={t("salesDashboard.title")} period={period} onPeriod={(v) => { setRange(null); setPeriod(v); }} compare={compare} onCompare={setCompare}
        origin={origin} onOrigin={setOrigin}
        range={data?.period ? { from, to, previousFrom: data.period.comparedFrom, previousTo: data.period.comparedTo } : null}
        asOf={data?.asOf} onRefresh={load} loading={loading}
        actions={<Button label={t("salesDashboard.viewProspects")} icon="pi pi-list" outlined onClick={() => drillDown(navigate, LISTS.prospects())} />}>
        <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" dateFormat={calendarDateFormat()} showIcon readOnlyInput placeholder={t("salesDashboard.customRange")} />
        {!data?.scoped && (
          <Dropdown value={salesPerson} options={personOptions} onChange={(e) => setSalesPerson(e.value)} filter placeholder={t("salesDashboard.allSalesPersons")} aria-label={t("salesDashboard.salesPerson")} />
        )}
      </DashboardToolbar>
      {data?.scoped ? <p className="sales-dashboard__scope">{t("salesDashboard.ownBook")}</p> : null}

      {nothingIssued ? <OriginEmpty cutoverDate={goLive} onOrigin={setOrigin} /> : null}

      <ViewState state={view} skeleton={<StatCards items={tiles} loading className="bv-stat-cards--wide sales-dashboard__kpis" />}>
        <StatCards items={tiles} refreshing={view.refreshing} className="bv-stat-cards--wide sales-dashboard__kpis" />
      </ViewState>

      <div className="bv-dash-grid">
        <ChartCard title={t("salesDashboard.premiumByMonth")} subtitle={t("executiveDashboard.last12Months")}
          table={{ columns: [{ field: "month", header: t("executiveDashboard.month") }, { field: "premium", header: t("salesDashboard.premium"), format: "currency" }], rows: months }}
          exportName="sales-premium-by-month" state={view}>
          <ThemedChart type="bar" data={premiumData} format="currency" directLabels={false} emptyText={emptyChart} />
        </ChartCard>
        <ChartCard title={t("salesDashboard.activityByMonth")} subtitle={t("executiveDashboard.last12Months")}
          table={{ columns: [{ field: "month", header: t("executiveDashboard.month") }, { field: "prospects", header: t("salesDashboard.prospects"), format: "count" }, { field: "quotations", header: t("salesDashboard.quotations"), format: "count" }], rows: months }}
          exportName="sales-activity-by-month" state={view}>
          <ThemedChart type="line" data={activityData} />
        </ChartCard>
        <ChartCard className="bv-dash-grid__wide" title={t("salesDashboard.premiumByProduct")} subtitle={t("salesDashboard.issuedInPeriod")}
          table={{ columns: [{ field: "label", header: t("executiveDashboard.product") }, { field: "premium", header: t("salesDashboard.premium"), format: "currency" }, { field: "policies", header: t("salesDashboard.policies"), format: "count" }], rows: products }}
          exportName="sales-premium-by-product" state={view} height={Math.max(160, products.length * 34 + 40)}>
          <ThemedChart type="bar" data={productData} format="currency" options={{ indexAxis: "y" }} height={Math.max(160, products.length * 34 + 40)} emptyText={emptyChart || t("salesDashboard.noPolicies")} />
        </ChartCard>

        <ChartCard title={t("salesDashboard.prospectPipeline")}>
          <DataTable value={data?.pipeline?.prospects || []} size="small" {...tableState}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} {...right} />
          </DataTable>
        </ChartCard>
        <ChartCard title={t("salesDashboard.quotationPipeline")}>
          <DataTable value={data?.pipeline?.quotations || []} size="small" {...tableState}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} {...right} />
            <Column field="premium" header={t("salesDashboard.premium")} body={(r) => full(r.premium)} {...right} />
          </DataTable>
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("salesDashboard.bySalesPerson")}>
          <DataTable value={data?.bySalesPerson || []} size="small" sortField="premium" sortOrder={-1} {...tableState}>
            <Column field="name" header={t("salesDashboard.salesPerson")} sortable />
            <Column field="branch" header={t("salesDashboard.branch")} body={(r) => r.branch || "-"} />
            <Column field="prospects" header={t("salesDashboard.prospects")} sortable {...right} />
            <Column field="quotations" header={t("salesDashboard.quotations")} sortable {...right} />
            <Column field="policies" header={t("salesDashboard.policies")} sortable {...right} />
            <Column field="premium" header={t("salesDashboard.premium")} sortable body={(r) => full(r.premium)} {...right} />
            <Column field="conversionRate" header={t("salesDashboard.conversion")} sortable body={(r) => formatPercent(r.conversionRate)} {...right} />
          </DataTable>
        </ChartCard>
      </div>
    </div>
  );
};

export default SalesDashboard;
