import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import dashboardService from "../../services/dashboardService";
import reportsService from "../../services/reportsService";
import StatCards from "../../components/StatCards";
import { ChartCard, DashboardToolbar, LISTS, ThemedChart, drillDown, formatValue } from "../../components/Dashboard";
import { ChartSkeleton } from "../../components/Skeletons";
import { useChartTheme } from "../../theme/chartTheme";
import { menuList } from "../../components/SideBar/list";
import { getUserRoles, isPathAllowed } from "../../utils/menuPermissions";
import { formatPercent, progressValue } from "../../utility/numberFormat";
import { statusLabel } from "../../utils/statusSeverity";
import "./index.scss";

const SETTINGS_PATH = "/master/configuration/settings";

/** Quick actions of the dashboard; each is shown only when the user's roles may open its screen (same rules as the side menu). */
const QUICK_ACTIONS = [
  { label: "executiveDashboard.viewClaims", icon: "pi pi-file", path: "/claims/dashboard" },
  { label: "executiveDashboard.processing", icon: "pi pi-check-square", path: "/processing/dashboard" },
  { label: "executiveDashboard.newQuote", icon: "pi pi-plus", path: "/agent/createlead" },
  { label: "executiveDashboard.reports", icon: "pi pi-chart-bar", path: "/reports/operationalreports/production" },
  { label: "executiveDashboard.policiesLabel", icon: "pi pi-briefcase", path: "/agent/policy" },
  { label: "executiveDashboard.analytics", icon: "pi pi-chart-line", path: "/sales/dashboard" },
];

/** State of a ratio against its target: within it (good), or above / below it (serious), with the word to show. */
const targetStatus = (t, value, target, lowerIsBetter) => {
  if (target === null || target === undefined || value === null || value === undefined) return null;
  const met = lowerIsBetter ? value <= target : value >= target;
  return met ? { severity: "good", label: t("dashboards.onTarget", "On target") } : { severity: "serious", label: t("dashboards.offTarget", "Off target") };
};

/**
 * Executive Dashboard: premium written, policies in force, new business, claims ratio, retention and what the broker is
 * owed, for the period to date against the previous period or the same period last year; premium by month and by
 * product line, claims by stage, and the regions, products and sales persons behind the figures. Each figure opens the
 * list behind it.
 */
const ExecutiveDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [quickActions] = useState(() => {
    const roles = getUserRoles();
    return QUICK_ACTIONS.filter((a) => isPathAllowed(a.path, menuList, roles));
  });
  const toast = useRef(null);
  // Settings opens Configuration > Reports & Dashboards (the dashboard targets); only for roles that may open it
  const [canOpenSettings] = useState(() => isPathAllowed(SETTINGS_PATH, menuList, getUserRoles()));
  const [period, setPeriod] = useState("month");
  const [compare, setCompare] = useState("previous");
  const [dashboard, setDashboard] = useState(null);
  const [claimsSummary, setClaimsSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const showError = (error) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: error.message });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      dashboardService.getExecutive(period, compare).then(setDashboard),
      dashboardService.getClaims().then(setClaimsSummary),
    ]).catch(showError).finally(() => setLoading(false));
  }, [period, compare]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const range = dashboard?.period ? {
    from: dashboard.period.from, to: dashboard.period.to, previousFrom: dashboard.period.comparedFrom, previousTo: dashboard.period.comparedTo,
  } : null;

  const handleExport = async () => {
    try {
      const report = await reportsService.generateReport("production-register", { ReportCriteria: "Overall", FromDate: range?.from || "", ToDate: range?.to || "" });
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

  const money = (v) => formatValue("currency", v, { compact: true });
  const comparison = t(`dashboards.vs.${compare}`, compare === "lastYear" ? "vs same period last year" : "vs previous period");
  const k = dashboard?.executiveKPIs || {};
  const issued = () => drillDown(navigate, LISTS.policiesIssued(range?.from, range?.to));
  const targetNote = (key, format) => (k[key]?.target ? t("dashboards.targetNote", { target: formatValue(format, k[key].target, { compact: true }), achieved: formatPercent(k[key].achievement ?? 0), defaultValue: "Target {{target}} · {{achieved}} achieved" }) : null);
  const receivables = dashboard?.receivables;

  const kpis = [
    { key: "totalRevenue", label: t("executiveDashboard.totalRevenue"), value: dashboard ? money(k.totalRevenue?.value) : null, change: k.totalRevenue?.change, comparison, note: targetNote("totalRevenue", "currency"), onClick: issued },
    { key: "newBusiness", label: t("executiveDashboard.newBusiness"), value: dashboard ? money(k.newBusiness?.value) : null, change: k.newBusiness?.change, comparison, note: targetNote("newBusiness", "currency"), onClick: issued },
    { key: "activePolicies", label: t("executiveDashboard.activePolicies"), value: k.activePolicies?.value ?? null, change: k.activePolicies?.change, comparison, note: targetNote("activePolicies", "count"),
      onClick: () => navigate("/agent/policy") },
    { key: "claimsRatio", label: t("executiveDashboard.claimsRatio"), value: dashboard ? formatPercent(k.claimsRatio?.value) : null, note: k.claimsRatio?.target ? t("dashboards.targetMax", { target: formatPercent(k.claimsRatio.target), defaultValue: "Target at most {{target}}" }) : null,
      status: targetStatus(t, k.claimsRatio?.value, k.claimsRatio?.target, true), onClick: () => drillDown(navigate, LISTS.claims("")) },
    { key: "retentionRate", label: t("executiveDashboard.retentionRate"), value: dashboard ? formatPercent(k.retentionRate?.value) : null, note: k.retentionRate?.target ? t("dashboards.targetMin", { target: formatPercent(k.retentionRate.target), defaultValue: "Target {{target}}" }) : null,
      status: targetStatus(t, k.retentionRate?.value, k.retentionRate?.target, false), onClick: () => navigate("/renewal/analytics") },
    { key: "receivableClients", label: t("executiveDashboard.premiumReceivable", "Premium receivable"), value: receivables ? money(receivables.premiumFromClients) : null,
      note: receivables ? t("executiveDashboard.overdueNote", { amount: money(receivables.premiumOverdue), defaultValue: "{{amount}} overdue" }) : null,
      status: receivables && Number(receivables.premiumOverdue) > 0 ? { severity: "warning", label: t("dashboards.overdue", "Overdue items") } : null, onClick: () => navigate("/agent/collections") },
    { key: "receivableInsurers", label: t("executiveDashboard.commissionReceivable", "Commission receivable"), value: receivables ? money(receivables.commissionFromInsurers) : null,
      note: receivables ? t("executiveDashboard.unbilledOverdueNote", { unbilled: money(receivables.commissionUnbilled), overdue: money(receivables.commissionOverdue), defaultValue: "{{unbilled}} unbilled · {{overdue}} overdue" }) : null,
      onClick: () => navigate("/finance/remittance/directbill") },
  ];

  // premium written by month (12 months to date); the period target is drawn as a reference line on a monthly view
  const trend = dashboard?.monthlyTrend || {};
  const trendData = { labels: trend.labels || [], datasets: [{ label: t("executiveDashboard.grossWrittenPremium"), data: trend.premium || [], backgroundColor: chart.primary }] };
  const monthTarget = period === "month" && k.totalRevenue?.target ? [{ value: Number(k.totalRevenue.target), label: t("dashboards.targetLine", { value: money(k.totalRevenue.target), defaultValue: "Target {{value}}" }) }] : null;

  // premium by product line: sorted bars (more than five lines never go into a pie)
  const products = (dashboard?.revenueByProduct?.labels || []).map((label, i) => ({ label, premium: dashboard.revenueByProduct.data[i], policies: dashboard.revenueByProduct.policies?.[i] }))
    .sort((a, b) => b.premium - a.premium);
  const productData = { labels: products.map((p) => p.label), datasets: [{ label: t("executiveDashboard.premium"), data: products.map((p) => p.premium), backgroundColor: chart.primary }] };

  const claimsByStatus = [...(claimsSummary?.claimsByStatus || [])].map((r) => ({ ...r, status: statusLabel(r.status) })).sort((a, b) => b.count - a.count);
  const claimsData = { labels: claimsByStatus.map((r) => r.status), datasets: [{ label: t("executiveDashboard.claimsCount", "Claims"), data: claimsByStatus.map((r) => r.count), backgroundColor: chart.primary }] };

  const growthTemplate = (rowData) => {
    const value = rowData.growth;
    if (!value) return "-";
    const isPositive = String(value).startsWith("+");
    return <Tag value={value} severity={isPositive ? "success" : "danger"} icon={isPositive ? "pi pi-arrow-up" : "pi pi-arrow-down"} />;
  };
  const marketShareTemplate = (rowData) => (
    <div className="bv-meter">
      <ProgressBar value={progressValue(rowData.marketShare, 1)} showValue={false} />
      <span className="bv-meter__value">{formatPercent(rowData.marketShare)}</span>
    </div>
  );
  const full = (v) => formatValue("currency", v);
  const num = { className: "bv-num", headerClassName: "bv-num" };

  return (
    <div className="executive-dashboard bv-dash-page">
      <Toast ref={toast} />
      <DashboardToolbar title={t("executiveDashboard.title")} period={period} onPeriod={setPeriod} compare={compare} onCompare={setCompare}
        range={range} asOf={dashboard?.asOf} onRefresh={load} loading={loading}
        actions={(
          <>
            <Button label={t("executiveDashboard.exportReport")} icon="pi pi-download" onClick={handleExport} />
            {canOpenSettings && (
              <Button label={t("executiveDashboard.settings")} icon="pi pi-cog" severity="secondary" outlined onClick={() => navigate(`${SETTINGS_PATH}?area=reports`)} />
            )}
          </>
        )} />

      <StatCards items={kpis} className="bv-stat-cards--wide executive-kpis" />

      <div className="bv-dash-grid">
        <ChartCard className="bv-dash-grid__wide" title={t("executiveDashboard.premiumByMonth", "Premium written by month")} subtitle={t("executiveDashboard.last12Months", "Last 12 months")}
          table={{ columns: [{ field: "label", header: t("executiveDashboard.month", "Month") }, { field: "premium", header: t("executiveDashboard.premium"), format: "currency" }],
            rows: (trend.labels || []).map((label, i) => ({ label: trend.months?.[i] || label, premium: trend.premium?.[i] })) }}
          exportName="premium-by-month">
          {!dashboard ? <ChartSkeleton height="280px" /> : (
            <ThemedChart type="bar" data={trendData} format="currency" reference={monthTarget} directLabels={false} ariaLabel={t("executiveDashboard.premiumByMonth", "Premium written by month")} />
          )}
        </ChartCard>

        <ChartCard title={t("executiveDashboard.revenueByProductLine")} subtitle={t("executiveDashboard.inForceBook", "Whole book, sorted by premium")}
          table={{ columns: [{ field: "label", header: t("executiveDashboard.product") }, { field: "premium", header: t("executiveDashboard.premium"), format: "currency" }, { field: "policies", header: t("executiveDashboard.policies"), format: "count" }], rows: products }}
          exportName="premium-by-product-line">
          {!dashboard ? <ChartSkeleton height="280px" /> : (
            <ThemedChart type="bar" data={productData} format="currency" options={{ indexAxis: "y" }} height={Math.max(200, products.length * 34 + 40)} />
          )}
        </ChartCard>

        <ChartCard title={t("executiveDashboard.claimsStatusDistribution")} subtitle={t("executiveDashboard.claimsByStage", "Claims by stage, all open and closed")}
          table={{ columns: [{ field: "status", header: t("claimsDashboard.status") }, { field: "count", header: t("executiveDashboard.claimsCount", "Claims"), format: "count" }, { field: "estimate", header: t("executiveDashboard.estimate", "Estimate"), format: "currency" }], rows: claimsByStatus }}
          exportName="claims-by-stage">
          {!claimsSummary ? <ChartSkeleton height="280px" /> : (
            <ThemedChart type="bar" data={claimsData} options={{ indexAxis: "y" }} height={Math.max(200, claimsByStatus.length * 34 + 40)} />
          )}
        </ChartCard>

        <ChartCard title={t("executiveDashboard.regionalPerformance")}>
          <DataTable value={dashboard?.regionalPerformance || []} size="small" loading={!dashboard} className="regional-table">
            <Column field="region" header={t("executiveDashboard.region")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => full(row.premium)} {...num} />
            <Column field="policies" header={t("executiveDashboard.policies")} {...num} />
            <Column field="growth" header={t("executiveDashboard.growth")} body={growthTemplate} />
            <Column field="marketShare" header={t("executiveDashboard.marketShare")} body={marketShareTemplate} />
          </DataTable>
        </ChartCard>

        <ChartCard title={t("executiveDashboard.topPerformingProducts")}>
          <DataTable value={dashboard?.topProducts || []} size="small" loading={!dashboard} className="products-table"
            onRowClick={(e) => drillDown(navigate, LISTS.policiesIssued(null, null, e.data.product))} rowClassName={() => "bv-clickable-row"}>
            <Column field="product" header={t("executiveDashboard.product")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => full(row.premium)} {...num} />
            <Column field="policies" header={t("executiveDashboard.policies")} {...num} />
            <Column field="claimRatio" header={t("executiveDashboard.claimRatio")} body={(row) => formatPercent(row.claimRatio)} {...num} />
          </DataTable>
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("executiveDashboard.topAgentsPerformance")}>
          <DataTable value={dashboard?.agentPerformance || []} size="small" loading={!dashboard} className="agents-table">
            <Column field="name" header={t("executiveDashboard.agent")} />
            <Column field="branch" header={t("executiveDashboard.branch")} body={(row) => row.branch || "-"} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => full(row.premium)} {...num} />
            <Column field="conversion" header={t("executiveDashboard.conversion")} body={(row) => formatPercent(row.conversion)} {...num} />
            <Column field="policies" header={t("executiveDashboard.policies")} {...num} />
          </DataTable>
        </ChartCard>
      </div>

      {/* Quick Actions: only the screens the signed-in user's roles may open */}
      {quickActions.length > 0 && (
        <ChartCard title={t("executiveDashboard.quickActions")}>
          <div className="actions-grid">
            {quickActions.map((a) => (
              <Button key={a.path} label={t(a.label)} icon={a.icon} outlined onClick={() => navigate(a.path)} />
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
