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

import { numberLocale } from "../../utility/currencyConverter";
import { menuList } from "../../components/SideBar/list";
import { getUserRoles, isPathAllowed } from "../../utils/menuPermissions";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";

const SETTINGS_PATH = "/master/configuration/system-settings";
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
  { label: "executiveDashboard.underwriting", icon: "pi pi-check-square", path: "/underwriting/dashboard" },
  { label: "executiveDashboard.newQuote", icon: "pi pi-plus", severity: "success", path: "/agent/createlead" },
  { label: "executiveDashboard.reports", icon: "pi pi-chart-bar", severity: "info", path: "/reports/operationalreports/production" },
  { label: "executiveDashboard.policiesLabel", icon: "pi pi-briefcase", path: "/agent/policy" },
  { label: "executiveDashboard.analytics", icon: "pi pi-chart-line", severity: "warning", path: "/agent/home" },
];

const CHART_COLORS = [
  "#0066CC",
  "#E65100",
  "#4CAF50",
  "#00C851",
  "#FFA500",
  "#9C27B0",
  "#00BCD4",
  "#FF5252",
  "#607D8B",
];

const CLAIM_STATUS_COLORS = ["#00C851", "#FFA500", "#2196F3", "#FF5252", "#9C27B0", "#607D8B", "#00BCD4"];

const CURRENCY_KPIS = ["totalRevenue", "newBusiness"];
const PERCENT_KPIS = ["claimsRatio", "retentionRate", "customerSatisfaction"];

const formatChange = (change) =>
  change === undefined || change === null ? null : `${change >= 0 ? "+" : ""}${change}%`;

const ExecutiveDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const [quickActions] = useState(() => {
    const roles = getUserRoles();
    return QUICK_ACTIONS.filter((a) => isPathAllowed(a.path, menuList, roles));
  });
  const toast = useRef(null);
  // Settings opens System Settings (dashboard targets live there); only for roles that may open it
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
      window.open(report.downloadUrl, "_blank", "noopener");
    } catch (error) {
      showError(error);
    }
  };

  const money = (value) => formatCurrency(value, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

  const formatKpiValue = (key, value) => {
    if (value === null || value === undefined) return "-";
    if (CURRENCY_KPIS.includes(key)) return money(value);
    if (PERCENT_KPIS.includes(key)) return `${value}%`;
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
    Object.entries(dashboard?.executiveKPIs || {}).map(([key, kpi]) => [
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
        backgroundColor: CHART_COLORS,
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
        borderColor: "#0066CC",
        backgroundColor: "rgba(0, 102, 204, 0.1)",
        tension: 0.4,
        fill: true,
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
        backgroundColor: CLAIM_STATUS_COLORS,
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
        backgroundColor: CHART_COLORS,
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
      <ProgressBar
        value={rowData.marketShare}
        showValue={true}
        style={{ height: "20px" }}
      />
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
            <p>{t("executiveDashboard.subtitle")}</p>
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
              severity="info"
              onClick={handleExport}
            />
            {canOpenSettings && (
              <Button
                label={t("executiveDashboard.settings")}
                icon="pi pi-cog"
                severity="secondary"
                onClick={() => navigate(SETTINGS_PATH)}
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
          <Button label={t("executiveDashboard.exportReport")} icon="pi pi-download" severity="info" onClick={handleExport} />
          {canOpenSettings && (
            <Button label={t("executiveDashboard.settings")} icon="pi pi-cog" severity="secondary" onClick={() => navigate(SETTINGS_PATH)} />
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
                <ProgressBar
                  value={kpi.achievement}
                  showValue={false}
                  style={{ height: "6px" }}
                />
              </div>
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
            <Chart
              type="line"
              data={monthlyTrendData}
              options={{
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
                    tension: 0.4,
                  },
                },
              }}
              style={{ height: "350px", width: "1200px" }}
            />
          </div>
        </Card>

        {/* Revenue Distribution */}
        <Card title={t("executiveDashboard.revenueByProductLine")} className="revenue-card">
          <Chart
            type="doughnut"
            data={revenueByProductData}
            options={{
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
            }}
            style={{ height: "350px" }}
          />
        </Card>

        {/* Regional Performance Table */}
        <Card title={t("executiveDashboard.regionalPerformance")} className="regional-card">
          <DataTable
            value={regionalPerformance}
            size="small"
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
            className="products-table"
          >
            <Column field="product" header={t("executiveDashboard.product")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => money(row.premium)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
            <Column field="claimRatio" header={t("executiveDashboard.claimRatio")} body={(row) => `${row.claimRatio}%`} />
          </DataTable>
        </Card>

        {/* Agent Performance */}
        <Card title={t("executiveDashboard.topAgentsPerformance")} className="agents-card">
          <DataTable
            value={agentPerformance}
            size="small"
            className="agents-table"
          >
            <Column field="name" header={t("executiveDashboard.agent")} />
            <Column field="branch" header={t("executiveDashboard.branch")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => money(row.premium)} />
            <Column field="conversion" header={t("executiveDashboard.conversion")} body={(row) => `${row.conversion}%`} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
          </DataTable>
        </Card>

        {/* Quick Stats */}
        <div className="quick-stats">
          {/* Claims Analytics */}
          <Card title={t("executiveDashboard.claimsStatusDistribution")} className="claims-card">
            <Chart
              type="pie"
              data={claimsAnalytics}
              options={{
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                },
              }}
              style={{ height: "250px" }}
            />
          </Card>

          {/* Customer Segmentation */}
          <Card title={t("executiveDashboard.customerSegmentation")} className="segment-card">
            <Chart
              type="bar"
              data={customerSegmentData}
              options={{
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
              }}
              style={{ height: "250px" }}
            />
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
                  severity={a.severity}
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
