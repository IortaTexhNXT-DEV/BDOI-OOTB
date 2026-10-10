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
import { ChartCard, DashboardToolbar, LISTS, ThemedChart, changeOf, drillDown, formatValue } from "../../components/Dashboard";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
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
 * one sales person); scoped sales roles their own book.
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    // a custom range is used once both ends are picked; otherwise the calendar period
    const custom = range?.[0] && range?.[1];
    const query = custom ? { from: toIsoDate(range[0]), to: toIsoDate(range[1]) } : { period };
    setLoading(true);
    dashboardService
      .getSalesOverview({ ...query, compare, salesPerson: salesPerson || undefined })
      .then(setData)
      .catch((e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 }))
      .finally(() => setLoading(false));
  }, [period, compare, range, salesPerson, t]);
  useEffect(() => { load(); }, [load]);

  const money = (v) => formatValue("currency", v, { compact: true });
  const full = (v) => formatValue("currency", v);
  const k = data?.kpis || {};
  const p = data?.previous || {};
  const comparison = t(`dashboards.vs.${compare}`);
  const from = data?.period?.from;
  const to = data?.period?.to;

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
      onClick: () => drillDown(navigate, LISTS.policiesIssued(from, to)) },
    { key: "premium", label: t("salesDashboard.premium"), value: data ? money(k.premium) : null, change: changeOf(k.premium, p.premium), comparison,
      onClick: () => drillDown(navigate, LISTS.policiesIssued(from, to)) },
    { key: "pipeline", label: t("salesDashboard.pipeline"), value: data ? money(k.pipelineValue) : null, note: t("salesDashboard.openQuotations", { count: k.pipelineCount ?? 0 }),
      onClick: () => drillDown(navigate, LISTS.quotations()) },
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

  return (
    <div className="sales-dashboard bv-dash-page">
      <Toast ref={toast} />
      <DashboardToolbar title={t("salesDashboard.title")} period={period} onPeriod={(v) => { setRange(null); setPeriod(v); }} compare={compare} onCompare={setCompare}
        range={data?.period ? { from, to, previousFrom: data.period.comparedFrom, previousTo: data.period.comparedTo } : null}
        asOf={data?.asOf} onRefresh={load} loading={loading}
        actions={<Button label={t("salesDashboard.viewProspects")} icon="pi pi-list" outlined onClick={() => drillDown(navigate, LISTS.prospects())} />}>
        <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" dateFormat={calendarDateFormat()} showIcon readOnlyInput placeholder={t("salesDashboard.customRange")} />
        {!data?.scoped && (
          <Dropdown value={salesPerson} options={personOptions} onChange={(e) => setSalesPerson(e.value)} filter placeholder={t("salesDashboard.allSalesPersons")} aria-label={t("salesDashboard.salesPerson")} />
        )}
      </DashboardToolbar>
      {data?.scoped ? <p className="sales-dashboard__scope">{t("salesDashboard.ownBook")}</p> : null}

      <StatCards items={tiles} className="bv-stat-cards--wide sales-dashboard__kpis" />

      <div className="bv-dash-grid">
        <ChartCard title={t("salesDashboard.premiumByMonth")} subtitle={t("executiveDashboard.last12Months")}
          table={{ columns: [{ field: "month", header: t("executiveDashboard.month") }, { field: "premium", header: t("salesDashboard.premium"), format: "currency" }], rows: months }}
          exportName="sales-premium-by-month">
          <ThemedChart type="bar" data={premiumData} format="currency" directLabels={false} />
        </ChartCard>
        <ChartCard title={t("salesDashboard.activityByMonth")} subtitle={t("executiveDashboard.last12Months")}
          table={{ columns: [{ field: "month", header: t("executiveDashboard.month") }, { field: "prospects", header: t("salesDashboard.prospects"), format: "count" }, { field: "quotations", header: t("salesDashboard.quotations"), format: "count" }], rows: months }}
          exportName="sales-activity-by-month">
          <ThemedChart type="line" data={activityData} />
        </ChartCard>
        <ChartCard className="bv-dash-grid__wide" title={t("salesDashboard.premiumByProduct")} subtitle={t("salesDashboard.issuedInPeriod")}
          table={{ columns: [{ field: "label", header: t("executiveDashboard.product") }, { field: "premium", header: t("salesDashboard.premium"), format: "currency" }, { field: "policies", header: t("salesDashboard.policies"), format: "count" }], rows: products }}
          exportName="sales-premium-by-product">
          <ThemedChart type="bar" data={productData} format="currency" options={{ indexAxis: "y" }} height={Math.max(160, products.length * 34 + 40)} emptyText={t("salesDashboard.noPolicies")} />
        </ChartCard>

        <ChartCard title={t("salesDashboard.prospectPipeline")}>
          <DataTable value={data?.pipeline?.prospects || []} size="small" emptyMessage={t("salesDashboard.noRecords")}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} {...right} />
          </DataTable>
        </ChartCard>
        <ChartCard title={t("salesDashboard.quotationPipeline")}>
          <DataTable value={data?.pipeline?.quotations || []} size="small" emptyMessage={t("salesDashboard.noRecords")}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} {...right} />
            <Column field="premium" header={t("salesDashboard.premium")} body={(r) => full(r.premium)} {...right} />
          </DataTable>
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("salesDashboard.bySalesPerson")}>
          <DataTable value={data?.bySalesPerson || []} size="small" sortField="premium" sortOrder={-1} emptyMessage={t("salesDashboard.noRecords")}>
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
