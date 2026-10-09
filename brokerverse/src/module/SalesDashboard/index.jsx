import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import dashboardService from "../../services/dashboardService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { formatPercent } from "../../utility/numberFormat";
import { numberLocale } from "../../utility/currencyConverter";
import { useChartTheme } from "../../theme/chartTheme";
import "./index.scss";

/** "PendingCustomer" / "QuoteGenerated" as sentence-case text. */
export const stageLabel = (stage) => {
  const words = String(stage || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "-";
};

/**
 * Sales Dashboard: prospects, quotations, conversion and premium over a period, the open pipeline by stage and the
 * figures per sales person. Managers see the whole book (or one sales person); scoped sales roles their own book.
 */
const SalesDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const chart = useChartTheme();
  const toast = useRef(null);
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState(null);
  const [salesPerson, setSalesPerson] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // a custom range is used once both ends are picked; otherwise the calendar period
    const custom = range?.[0] && range?.[1];
    const query = custom ? { from: toIsoDate(range[0]), to: toIsoDate(range[1]) } : { period };
    setLoading(true);
    dashboardService
      .getSalesOverview({ ...query, salesPerson: salesPerson || undefined })
      .then(setData)
      .catch((e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 }))
      .finally(() => setLoading(false));
  }, [period, range, salesPerson, t]);

  const money = (v) => formatCurrency(v, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const count = (v) => (v === null || v === undefined ? "-" : Number(v).toLocaleString(numberLocale()));
  const k = data?.kpis || {};

  const periodOptions = [
    { label: t("salesDashboard.thisMonth"), value: "month" },
    { label: t("salesDashboard.thisQuarter"), value: "quarter" },
    { label: t("salesDashboard.thisYear"), value: "year" },
  ];
  const personOptions = [
    { label: t("salesDashboard.allSalesPersons"), value: null },
    ...(data?.salesPersons || []).map((p) => ({ label: p.name, value: p.id })),
  ];

  const tiles = [
    { key: "prospects", label: t("salesDashboard.prospects"), value: count(k.prospects), note: t("salesDashboard.newInPeriod", { count: count(k.newProspects) }), to: "/agent/leadlisting" },
    { key: "quotations", label: t("salesDashboard.quotations"), value: count(k.quotations), note: `${t("salesDashboard.quoted")}: ${money(k.quotedPremium)}`, to: "/agent/Quotation" },
    { key: "conversion", label: t("salesDashboard.conversion"), value: formatPercent(k.prospectConversionRate), note: `${t("salesDashboard.quoteConversion")}: ${formatPercent(k.quoteConversionRate)}` },
    { key: "policies", label: t("salesDashboard.policies"), value: count(k.policies), note: t("salesDashboard.issuedInPeriod") },
    { key: "premium", label: t("salesDashboard.premium"), value: money(k.premium), note: t("salesDashboard.issuedInPeriod") },
    { key: "pipeline", label: t("salesDashboard.pipeline"), value: money(k.pipelineValue), note: t("salesDashboard.openQuotations", { count: count(k.pipelineCount) }) },
  ];

  const trend = data?.monthlyTrend || {};
  const [barColor, prospectColor, quoteColor] = chart.series(3);
  const trendData = {
    labels: trend.labels || [],
    datasets: [
      { type: "bar", label: t("salesDashboard.premium"), data: trend.premium || [], backgroundColor: barColor, yAxisID: "y" },
      { type: "line", label: t("salesDashboard.prospects"), data: trend.leads || [], borderColor: prospectColor, backgroundColor: prospectColor, tension: 0, yAxisID: "y1" },
      { type: "line", label: t("salesDashboard.quotations"), data: trend.quotes || [], borderColor: quoteColor, backgroundColor: quoteColor, tension: 0, yAxisID: "y1" },
    ],
  };
  const trendOptions = chart.options({
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => money(v) } },
      y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
    },
  });
  const product = data?.premiumByProduct || {};
  const productData = { labels: product.labels || [], datasets: [{ label: t("salesDashboard.premium"), data: product.data || [], backgroundColor: chart.primary }] };
  const productOptions = chart.options({ indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { callback: (v) => money(v) } } } });

  const periodText = data?.period ? `${toDate(data.period.from)?.toLocaleDateString(numberLocale())} - ${toDate(data.period.to)?.toLocaleDateString(numberLocale())}` : "";

  return (
    <div className="sales-dashboard">
      <Toast ref={toast} />
      <div className="sales-dashboard__header">
        <div>
          <h1>{t("salesDashboard.title")}</h1>
          <p>{[data?.scoped ? t("salesDashboard.ownBook") : null, periodText].filter(Boolean).join(" · ") || "\u00a0"}</p>
        </div>
        <div className="sales-dashboard__filters">
          {!data?.scoped && (
            <Dropdown value={salesPerson} options={personOptions} onChange={(e) => setSalesPerson(e.value)} filter placeholder={t("salesDashboard.allSalesPersons")} aria-label={t("salesDashboard.salesPerson")} />
          )}
          <Dropdown value={period} options={periodOptions} onChange={(e) => { setRange(null); setPeriod(e.value); }} aria-label={t("salesDashboard.period")} />
          <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" dateFormat={calendarDateFormat()} showIcon readOnlyInput placeholder={t("salesDashboard.customRange")} />
          <Button label={t("salesDashboard.viewProspects")} icon="pi pi-list" outlined onClick={() => navigate("/agent/leadlisting")} />
        </div>
      </div>

      <div className="sales-dashboard__tiles">
        {tiles.map((tile) => (
          <Card key={tile.key} className={`sales-tile${tile.to ? " sales-tile--link" : ""}`} onClick={tile.to ? () => navigate(tile.to) : undefined}>
            <div className="sales-tile__label">{tile.label}</div>
            <div className="sales-tile__value">{loading && !data ? "" : tile.value}</div>
            <div className="sales-tile__note">{tile.note}</div>
          </Card>
        ))}
      </div>

      <div className="sales-dashboard__grid">
        <Card title={t("salesDashboard.trend")} className="chart-card">
          <div className="sales-chart"><Chart type="bar" data={trendData} options={trendOptions} /></div>
        </Card>
        <Card title={t("salesDashboard.premiumByProduct")} className="chart-card">
          {product.labels?.length ? (
            <div className="sales-chart"><Chart type="bar" data={productData} options={productOptions} /></div>
          ) : (
            <div className="sales-empty">{t("salesDashboard.noPolicies")}</div>
          )}
        </Card>
      </div>

      <div className="sales-dashboard__grid">
        <Card title={t("salesDashboard.prospectPipeline")}>
          <DataTable value={data?.pipeline?.prospects || []} size="small" emptyMessage={t("salesDashboard.noRecords")}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} className="text-right" headerClassName="text-right" />
          </DataTable>
        </Card>
        <Card title={t("salesDashboard.quotationPipeline")}>
          <DataTable value={data?.pipeline?.quotations || []} size="small" emptyMessage={t("salesDashboard.noRecords")}>
            <Column field="stage" header={t("salesDashboard.stage")} body={(r) => stageLabel(r.stage)} />
            <Column field="count" header={t("salesDashboard.count")} className="text-right" headerClassName="text-right" />
            <Column field="premium" header={t("salesDashboard.premium")} body={(r) => money(r.premium)} className="text-right" headerClassName="text-right" />
          </DataTable>
        </Card>
      </div>

      <Card title={t("salesDashboard.bySalesPerson")} className="mt-3">
        <DataTable value={data?.bySalesPerson || []} size="small" sortField="premium" sortOrder={-1} emptyMessage={t("salesDashboard.noRecords")}>
          <Column field="name" header={t("salesDashboard.salesPerson")} sortable />
          <Column field="branch" header={t("salesDashboard.branch")} body={(r) => r.branch || "-"} />
          <Column field="prospects" header={t("salesDashboard.prospects")} sortable className="text-right" headerClassName="text-right" />
          <Column field="quotations" header={t("salesDashboard.quotations")} sortable className="text-right" headerClassName="text-right" />
          <Column field="policies" header={t("salesDashboard.policies")} sortable className="text-right" headerClassName="text-right" />
          <Column field="premium" header={t("salesDashboard.premium")} sortable body={(r) => money(r.premium)} className="text-right" headerClassName="text-right" />
          <Column field="conversionRate" header={t("salesDashboard.conversion")} sortable body={(r) => formatPercent(r.conversionRate)} className="text-right" headerClassName="text-right" />
        </DataTable>
      </Card>
    </div>
  );
};

export default SalesDashboard;
