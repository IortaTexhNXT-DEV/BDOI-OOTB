import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import dashboardService from "../../services/dashboardService";
import reportsService from "../../services/reportsService";
import "./index.scss";
import { ChartSkeleton, KpiValueSkeleton } from "../../components/Skeletons";
import { useChartTheme } from "../../theme/chartTheme";

import { numberLocale } from "../../utility/currencyConverter";
import { menuList } from "../../components/SideBar/list";
import { getUserRoles, isPathAllowed } from "../../utils/menuPermissions";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { formatPercent, progressValue } from "../../utility/numberFormat";

const SETTINGS_PATH = "/master/configuration/settings";
/**
 * [from, today] of the calendar period the KPIs use: This Month = 1st of the month, This Quarter = 1st of the
 * calendar quarter, This Year = 1 January (the server sends the same range in Manila time as data.period).
 */
const rangeFor = (period) => {
  const to = new Date();
  const firstMonth = period === "year" ? 0 : period === "quarter" ? Math.floor(to.getMonth() / 3) * 3 : to.getMonth();
  return [new Date(to.getFullYear(), firstMonth, 1), to];
};

/** Quick actions of the dashboard; each is shown only when the user's roles may open its screen (same rules as the side menu). */
const QUICK_ACTIONS = [
  { label: "executiveDashboard.viewClaims", icon: "pi pi-file", path: "/claims/dashboard" },
  { label: "executiveDashboard.processing", icon: "pi pi-check-square", path: "/processing/dashboard" },
  { label: "executiveDashboard.newQuote", icon: "pi pi-plus", path: "/agent/createlead" },
  { label: "executiveDashboard.reports", icon: "pi pi-chart-bar", path: "/reports/operationalreports/production" },
  { label: "executiveDashboard.policiesLabel", icon: "pi pi-briefcase", path: "/agent/policy" },
  { label: "executiveDashboard.analytics", icon: "pi pi-chart-line", path: "/sales/dashboard" },
];

const CURRENCY_KPIS = ["totalRevenue", "newBusiness"];
const PERCENT_KPIS = ["claimsRatio", "retentionRate", "customerSatisfaction"];

// a change beyond 999% (a period compared with an almost empty one) is shown as "> 999%" rather than in full
const formatChange = (change) => {
  if (change === undefined || change === null) return null;
  if (Math.abs(change) > 999) return change > 0 ? "> +999%" : "< -999%";
  return `${change >= 0 ? "+" : ""}${formatPercent(change)}`;
};

const ExecutiveDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [quickActions] = useState(() => {
    const roles = getUserRoles();
    return QUICK_ACTIONS.filter((a) => isPathAllowed(a.path, menuList, roles));
  });
  const toast = useRef(null);
  // Settings opens Configuration > Reports & Dashboards (the dashboard targets); only for roles that may open it
  const [canOpenSettings] = useState(() => isPathAllowed(SETTINGS_PATH, menuList, getUserRoles()));
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  // export range: follows the chosen period (the KPIs cover the same rolling window) and can be changed
  const [dateRange, setDateRange] = useState(() => rangeFor("month"));
  const [dashboard, setDashboard] = useState(null);
  const [claimsSummary, setClaimsSummary] = useState(null);

  const showError = (error) =>
    toast.current?.show({ severity: "error", summary: "Error", detail: error.message });

  useEffect(() => {
    setDateRange(rangeFor(selectedPeriod));
    dashboardService
      .getExecutive(selectedPeriod)
      .then((data) => {
        setDashboard(data);
        // the period as the server computed it (business time zone)
        if (data?.period?.from && data?.period?.to) setDateRange([toDate(data.period.from), toDate(data.period.to)]);
      })
      .catch(showError);
  }, [selectedPeriod]);

  useEffect(() => {
    dashboardService.getClaims().then(setClaimsSummary).catch(showError);
  }, []);

  const handleExport = async () => {
    const [from, to] = dateRange || [];
    try {
      const report = await reportsService.generateReport("production-register", {
        ReportCriteria: "Overall",
        FromDate: from ? toIsoDate(from) : "",
        ToDate: to ? toIsoDate(to) : "",
      });
      // a link clicked once the report file is ready: a window opened at this point would be blocked as a pop-up
      if (report.downloadUrl) {
        const link = document.createElement("a");
        link.href = report.downloadUrl;
        link.download = report.fileName || "";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      showError(error);
    }
  };

  const money = (value) => formatCurrency(value, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

  const formatKpiValue = (key, value) => {
    if (value === null || value === undefined) return "-";
    if (CURRENCY_KPIS.includes(key)) return money(value);
    if (PERCENT_KPIS.includes(key)) return formatPercent(value);
    return Number(value).toLocaleString(numberLocale());
  };

  const periodOptions = [
    { label: t("executiveDashboard.thisMonth"), value: "month" },
    { label: t("executiveDashboard.thisQuarter"), value: "quarter" },
    { label: t("executiveDashboard.thisYear"), value: "year" },
  ];

  // KPI title translation keys
  const kpiTitleKeys = {
    totalRevenue: "executiveDashboard.totalRevenue",
    activePolicies: "executiveDashboard.activePolicies",
    customerSatisfaction: "executiveDashboard.customerSatisfaction",
    claimsRatio: "executiveDashboard.claimsRatio",
    newBusiness: "executiveDashboard.newBusiness",
    retentionRate: "executiveDashboard.retentionRate",
  };

  const executiveKPIs = Object.fromEntries(
    Object.entries(dashboard?.executiveKPIs || {})
      // a measure the system does not capture yet (customer satisfaction without survey data) is not shown
      .filter(([, kpi]) => kpi.value !== null && kpi.value !== undefined)
      .map(([key, kpi]) => [
      key,
      {
        value: formatKpiValue(key, kpi.value),
        change: formatChange(kpi.change),
        trend: kpi.trend || "up",
        target: formatKpiValue(key, kpi.target),
        achievement: kpi.achievement ?? 0,
      },
    ])
  );

  // Revenue by Product Line
  const revenueByProductData = {
    labels: dashboard?.revenueByProduct?.labels || [],
    datasets: [
      {
        label: t("executiveDashboard.premium"),
        data: dashboard?.revenueByProduct?.data || [],
        backgroundColor: chart.series((dashboard?.revenueByProduct?.labels || []).length),
        borderColor: chart.surface,
      },
    ],
  };

  // Monthly Performance Trend
  const monthlyTrendData = {
    labels: dashboard?.monthlyTrend?.labels || [],
    datasets: [
      {
        label: t("executiveDashboard.grossWrittenPremium"),
        data: dashboard?.monthlyTrend?.premium || [],
        borderColor: chart.primary,
        backgroundColor: chart.alpha(chart.primary, 0.1),
        pointBackgroundColor: chart.primary,
        tension: 0,
        fill: false,
      },
    ],
  };

  const regionalPerformance = dashboard?.regionalPerformance || [];
  const topProducts = dashboard?.topProducts || [];
  const agentPerformance = dashboard?.agentPerformance || [];

  // Claims Analytics
  const claimsByStatus = claimsSummary?.claimsByStatus || [];
  const claimsAnalytics = {
    labels: claimsByStatus.map((row) => row.status),
    datasets: [
      {
        data: claimsByStatus.map((row) => row.count),
        backgroundColor: chart.statuses(claimsByStatus.map((row) => row.status)),
        borderColor: chart.surface,
      },
    ],
  };

  // Premium share by product line (policies count)
  const customerSegmentData = {
    labels: dashboard?.revenueByProduct?.labels || [],
    datasets: [
      {
        label: t("executiveDashboard.policies"),
        data: dashboard?.revenueByProduct?.policies || [],
        backgroundColor: chart.primary,
      },
    ],
  };

  const growthTemplate = (rowData, field) => {
    const value = rowData[field];
    if (!value) return "-";
    const isPositive = String(value).startsWith("+");
    return (
      <Tag
        value={value}
        severity={isPositive ? "success" : "danger"}
        icon={isPositive ? "pi pi-arrow-up" : "pi pi-arrow-down"}
      />
    );
  };

  const marketShareTemplate = (rowData) => {
    return (
<div className="bv-meter">
        <ProgressBar value={progressValue(rowData.marketShare, 1)} showValue={false} />
        <span className="bv-meter__value">{formatPercent(rowData.marketShare)}</span>
      </div>
    );
  };

  return (
    <div className="executive-dashboard">
      <Toast ref={toast} />
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{t("executiveDashboard.title")}</h1>
          </div>
          <div className="header-right">
            <Calendar
              dateFormat={calendarDateFormat()}
              value={dateRange}
              onChange={(e) => setDateRange(e.value)}
              selectionMode="range"
              placeholder={t("executiveDashboard.selectDateRange")}
            />
            <Dropdown
              value={selectedPeriod}
              options={periodOptions}
              onChange={(e) => setSelectedPeriod(e.value)}
            />
            <Button
              label={t("executiveDashboard.exportReport")}
              icon="pi pi-download"
              onClick={handleExport}
            />
            {canOpenSettings && (
              <Button
                label={t("executiveDashboard.settings")}
                icon="pi pi-cog"
                severity="secondary"
                onClick={() => navigate(`${SETTINGS_PATH}?area=reports`)}
              />
            )}
          </div>
        </div>
        {/* Mobile/Tablet Actions - moved below title */}
        <div className="mobile-header-actions">
          <Calendar
            dateFormat={calendarDateFormat()}
            value={dateRange}
            onChange={(e) => setDateRange(e.value)}
            selectionMode="range"
            placeholder={t("executiveDashboard.selectDateRange")}
          />
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => setSelectedPeriod(e.value)}
          />
          <Button label={t("executiveDashboard.exportReport")} icon="pi pi-download" onClick={handleExport} />
          {canOpenSettings && (
            <Button label={t("executiveDashboard.settings")} icon="pi pi-cog" severity="secondary" onClick={() => navigate(`${SETTINGS_PATH}?area=reports`)} />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-section">
        <div className="kpi-scroll-container">
          {Object.entries(executiveKPIs).map(([key, kpi]) => (
            <Card key={key} className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">
                  {t(kpiTitleKeys[key] || key)}
                </span>
                {kpi.change && (
                  <Tag
                    value={kpi.change}
                    severity={kpi.trend === "up" ? "success" : "danger"}
                    icon={`pi pi-arrow-${kpi.trend}`}
                  />
                )}
              </div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-target">
                <span>{t("executiveDashboard.target")}: {kpi.target}</span>
<div className="bv-meter">
                  <ProgressBar value={progressValue(kpi.achievement)} showValue={false} />
                  <span className="bv-meter__value">{formatPercent(kpi.achievement)}</span>
                </div>
              </div>
            </Card>
          ))}
          {/* before the figures arrive the cards hold their places, so the charts below do not move */}
          {!dashboard && [...Object.keys(kpiTitleKeys), "receivableClients", "receivableInsurers"].map((key) => (
            <Card key={`placeholder-${key}`} className="kpi-card" aria-hidden="true">
              <div className="kpi-header"><span className="kpi-title">{kpiTitleKeys[key] ? t(kpiTitleKeys[key]) : "\u00a0"}</span></div>
              <div className="kpi-value"><KpiValueSkeleton /></div>
              <div className="kpi-target"><span>{"\u00a0"}</span></div>
            </Card>
          ))}
          {dashboard?.receivables && (
            <>
              {/* broker-billed premium owed by clients; direct-bill policies owe nothing to us (the client pays the insurer) */}
              <Card className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">Premium receivable (clients)</span>
                </div>
                <div className="kpi-value">{money(dashboard.receivables.premiumFromClients)}</div>
                <div className="kpi-target">
                  <span>Overdue: {money(dashboard.receivables.premiumOverdue)}</span>
                </div>
              </Card>
              <Card className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">Commission receivable (insurers, direct bill)</span>
                </div>
                <div className="kpi-value">{money(dashboard.receivables.commissionFromInsurers)}</div>
                <div className="kpi-target">
                  <span>Unbilled: {money(dashboard.receivables.commissionUnbilled)} · Overdue: {money(dashboard.receivables.commissionOverdue)}</span>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Performance Trends */}
        <Card title={t("executiveDashboard.performanceTrends")} className="trend-card">
          <div className="chart-scroll-hint">
            <small className="scroll-hint-text">
              <i className="pi pi-arrows-h" style={{ marginRight: "4px" }} />
              {t("executiveDashboard.scrollHint")}
            </small>
          </div>
          <div className="chart-scroll-container">
            {!dashboard ? <ChartSkeleton height="350px" /> : <Chart
              type="line"
              data={monthlyTrendData}
              options={chart.options({
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                  tooltip: {
                    mode: "index",
                    intersect: false,
                  },
                },
                scales: {
                  x: {
                    display: true,
                    ticks: {
                      maxRotation: 45,
                      minRotation: 0,
                    },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function (value) {
                        return money(value);
                      },
                    },
                  },
                },
                interaction: {
                  intersect: false,
                  mode: "index",
                },
                elements: {
                  point: {
                    radius: 4,
                    hoverRadius: 6,
                  },
                  line: {
                    tension: 0,
                  },
                },
              })}
              style={{ height: "350px", width: "1200px" }}
            />}
          </div>
        </Card>

        {/* Revenue Distribution */}
        <Card title={t("executiveDashboard.revenueByProductLine")} className="revenue-card">
          {!dashboard ? <ChartSkeleton height="350px" /> : <Chart
            type="doughnut"
            data={revenueByProductData}
            options={chart.options({
              maintainAspectRatio: false,
              responsive: true,
              plugins: {
                legend: {
                  position: "right",
                },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      return context.label + ": " + money(context.parsed);
                    },
                  },
                },
              },
            })}
            style={{ height: "350px" }}
          />}
        </Card>

        {/* Regional Performance Table */}
        <Card title={t("executiveDashboard.regionalPerformance")} className="regional-card">
          <DataTable
            value={regionalPerformance}
            size="small"
            loading={!dashboard}
            className="regional-table"
          >
            <Column field="region" header={t("executiveDashboard.region")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => money(row.premium)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
            <Column
              field="growth"
              header={t("executiveDashboard.growth")}
              body={(rowData) => growthTemplate(rowData, "growth")}
            />
            <Column
              field="marketShare"
              header={t("executiveDashboard.marketShare")}
              body={marketShareTemplate}
            />
          </DataTable>
        </Card>

        {/* Top Products */}
        <Card title={t("executiveDashboard.topPerformingProducts")} className="products-card">
          <DataTable
            value={topProducts}
            size="small"
            loading={!dashboard}
            className="products-table"
          >
            <Column field="product" header={t("executiveDashboard.product")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => money(row.premium)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
            <Column field="claimRatio" header={t("executiveDashboard.claimRatio")} body={(row) => formatPercent(row.claimRatio)} />
          </DataTable>
        </Card>

        {/* Agent Performance */}
        <Card title={t("executiveDashboard.topAgentsPerformance")} className="agents-card">
          <DataTable
            value={agentPerformance}
            size="small"
            loading={!dashboard}
            className="agents-table"
          >
            <Column field="name" header={t("executiveDashboard.agent")} />
            <Column field="branch" header={t("executiveDashboard.branch")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => money(row.premium)} />
            <Column field="conversion" header={t("executiveDashboard.conversion")} body={(row) => formatPercent(row.conversion)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
          </DataTable>
        </Card>

        {/* Quick Stats */}
        <div className="quick-stats">
          {/* Claims Analytics */}
          <Card title={t("executiveDashboard.claimsStatusDistribution")} className="claims-card">
            {!claimsSummary ? <ChartSkeleton height="250px" /> : <Chart
              type="pie"
              data={claimsAnalytics}
              options={chart.options({
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                },
              })}
              style={{ height: "250px" }}
            />}
          </Card>

          {/* Customer Segmentation */}
          <Card title={t("executiveDashboard.customerSegmentation")} className="segment-card">
            {!dashboard ? <ChartSkeleton height="250px" /> : <Chart
              type="bar"
              data={customerSegmentData}
              options={chart.options({
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function (value) {
                        return value;
                      },
                    },
                  },
                },
              })}
              style={{ height: "250px" }}
            />}
          </Card>
        </div>
      </div>

      {/* Quick Actions: only the screens the signed-in user's roles may open */}
      {quickActions.length > 0 && (
        <div className="quick-actions">
          <Card title={t("executiveDashboard.quickActions")} className="actions-card">
            <div className="actions-grid">
              {quickActions.map((a) => (
                <Button
                  key={a.path}
                  label={t(a.label)}
                  icon={a.icon}
                  outlined
                  onClick={() => navigate(a.path)}
                />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
