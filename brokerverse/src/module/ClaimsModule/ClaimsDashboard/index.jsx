import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { useNavigate } from "react-router-dom";
import { Toast } from "primereact/toast";
import authService from "../../../services/authService";
import { BASE_URL } from "../../../utility/constant";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import StatCards from "../../../components/StatCards";
import { ChartCard, DashboardToolbar, LISTS, ShareChart, ThemedChart, changeOf, drillDown, formatValue, periodRange } from "../../../components/Dashboard";
import { useChartTheme } from "../../../theme/chartTheme";
import { formatPercent, progressValue } from "../../../utility/numberFormat";
import "./index.scss";

const APPROVED_STATUSES = ["Approved", "Settled", "Closed"];
const AGEING = ["recent", "moderate", "high", "critical"];

/** Claims per reported month (submitted / approved-or-settled / rejected) from the detailed rows. */
const buildTrend = (claims) => {
  const months = [...new Set(claims.map((c) => String(c.reportedDate || "").slice(0, 7)))].filter(Boolean).sort();
  const count = (month, match) => claims.filter((c) => String(c.reportedDate || "").startsWith(month) && match(c)).length;
  return months.map((month) => ({
    month,
    submitted: count(month, () => true),
    approved: count(month, (c) => APPROVED_STATUSES.includes(c.claimStatus)),
    rejected: count(month, (c) => c.claimStatus === "Rejected"),
  }));
};

const fetchReport = async ({ from, to }, includeData) => {
  const response = await fetch(`${BASE_URL}/claims/report?startDate=${from}&endDate=${to}&includeData=${includeData}`, {
    headers: { ...authService.getAuthHeader(), "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Failed to fetch dashboard data");
  return (await response.json()).data;
};

/**
 * Claims Dashboard: the claims reported in the period against the previous period or the same period last year, what
 * is still open and past its due date, by month, line of business, stage and province, the ageing of the open claims
 * and the latest claims. Each figure opens the claims register.
 */
const ClaimsDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const toast = useRef(null);
  const [period, setPeriod] = useState("year");
  const [compare, setCompare] = useState("previous");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const range = periodRange(period, compare);

  const load = useCallback(async () => {
    const r = periodRange(period, compare);
    setLoading(true);
    try {
      const [current, before] = await Promise.all([
        fetchReport(r, true),
        fetchReport({ from: r.previousFrom, to: r.previousTo }, false),
      ]);
      setData(current);
      setPrevious(before);
      setAsOf(new Date());
    } catch {
      toast.current?.show({ severity: "error", summary: t("claimsDashboard.error"), detail: t("claimsDashboard.failedToLoad") });
    } finally {
      setLoading(false);
    }
  }, [period, compare, t]);
  useEffect(() => { load(); }, [load]);

  const handleExportReport = async () => {
    try {
      const response = await fetch(`${BASE_URL}/claims/report?startDate=${range.from}&endDate=${range.to}&includeData=true&format=excel`, {
        headers: { ...authService.getAuthHeader(), "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to export report");
      const blob = await response.blob();
      // eslint-disable-next-line no-undef
      const downloadUrl = globalThis.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `claims-report-${range.from}-to-${range.to}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // eslint-disable-next-line no-undef
      globalThis.URL.revokeObjectURL(downloadUrl);
      toast.current?.show({ severity: "success", summary: t("claimsDashboard.success"), detail: t("claimsDashboard.excelDownloaded") });
    } catch {
      toast.current?.show({ severity: "error", summary: t("claimsDashboard.error"), detail: t("claimsDashboard.failedToExport") });
    }
  };

  const s = data?.summary || {};
  const p = previous?.summary || {};
  const comparison = t(`dashboards.vs.${compare}`);
  const money = (v) => formatValue("currency", v, { compact: true });
  const kpis = [
    { key: "reported", label: t("claimsDashboard.claimsReported"), value: data ? s.totalClaims : null, change: changeOf(s.totalClaims, p.totalClaims), good: "down", comparison,
      note: t("claimsDashboard.todayNote", { count: s.todaysClaims ?? 0 }), onClick: () => drillDown(navigate, LISTS.claims("")) },
    { key: "open", label: t("claimsDashboard.totalOpenClaims"), value: data ? s.totalOpenClaims : null, note: t("claimsDashboard.reportedInPeriod"), onClick: () => drillDown(navigate, LISTS.claims("open")) },
    { key: "overdue", label: t("claimsDashboard.claimsOverdue"), value: data ? s.totalAgingClaims : null,
      status: s.totalAgingClaims > 0 ? { severity: "serious", label: t("claimsDashboard.pastDueDate") } : null, onClick: () => drillDown(navigate, LISTS.claims("open")) },
    { key: "estimate", label: t("claimsDashboard.estimatedAmount"), value: data ? money(s.totalEstimatedAmount) : null, change: changeOf(s.totalEstimatedAmount, p.totalEstimatedAmount), good: "down", comparison },
    { key: "settled", label: t("claimsDashboard.settledAmount"), value: data ? money(s.totalSettledAmount) : null, change: changeOf(s.totalSettledAmount, p.totalSettledAmount), good: "neutral", comparison,
      onClick: () => drillDown(navigate, LISTS.claims("settled")) },
  ];

  const detailed = data?.detailedClaims || [];
  const trend = buildTrend(detailed);
  const [cReported, cApproved, cRejected] = chart.series(3);
  const line = (label, values, color) => ({ label, data: values, borderColor: color, backgroundColor: color, pointBackgroundColor: color });
  const trendData = {
    labels: trend.map((m) => m.month),
    datasets: [
      line(t("claimsDashboard.claimsSubmitted"), trend.map((m) => m.submitted), cReported),
      line(t("claimsDashboard.claimsApproved"), trend.map((m) => m.approved), cApproved),
      line(t("claimsDashboard.claimsRejected"), trend.map((m) => m.rejected), cRejected),
    ],
  };

  const byLob = data?.breakdown?.byLOB || [];

  const byStatus = data?.breakdown?.byStatus || [];
  const statusData = { labels: byStatus.map((r) => r.status), datasets: [{ label: t("claimsDashboard.claimsCount"), data: byStatus.map((r) => r.count), backgroundColor: chart.primary }] };

  // ageing of the open claims (claims.aging_thresholds): ordered buckets on one ramp, older = darker
  const ageing = data?.breakdown?.agingBreakdown || {};
  const ageingRows = AGEING.map((key) => ({ key, label: t(`claimsDashboard.ageing.${key}`), count: ageing[key] || 0 }));
  const ageingData = { labels: ageingRows.map((r) => r.label), datasets: [{ label: t("claimsDashboard.openClaims"), data: ageingRows.map((r) => r.count), backgroundColor: chart.sequential(AGEING.length) }] };

  const claimsByState = (data?.breakdown?.byState || []).map((st) => ({ state: st.state, value: st.count, percentage: st.percentage }));

  const recentClaims = detailed.slice(0, 10).map((claim) => ({
    claimId: claim.claimNumber,
    lob: claim.lob,
    customer: claim.customerName,
    policy: claim.policyNumber,
    lossDate: claim.dateOfIncident,
    reportedDate: claim.reportedDate,
    reporter: claim.reportedByName || claim.handlerName || "-",
    priority: claim.claimPriority?.toLowerCase() || "low",
    status: claim.claimStatus,
    amount: claim.estimatedClaimAmount,
  }));

  const statusBodyTemplate = (rowData) => {
    const severity = {
      Closed: "success", Settled: "success", Approved: "info", "In Progress": "warning", Pending: "warning", "Under Investigation": "warning",
      "Under Assessment": "warning", "Pending Approval": "warning", "Documents Required": "danger", Rejected: "danger",
    }[rowData.status] || null;
    return <Tag value={rowData.status} severity={severity} />;
  };
  const priorityBodyTemplate = (rowData) => {
    if (!rowData.priority) return "-";
    const severity = { high: "danger", medium: "warning", low: "success" }[rowData.priority] || "secondary";
    return <Tag value={rowData.priority} severity={severity} />;
  };
  const actionBodyTemplate = (rowData) => (
    <div className="flex gap-2">
      <Button icon="pi pi-eye" rounded text onClick={() => navigate(`/agent/claimdetail/${rowData.claimId}`)} aria-label={t("common.view", "View")} tooltip={t("common.view", "View")} tooltipOptions={{ position: "top" }} />
      <Button icon="pi pi-pencil" rounded text onClick={() => navigate(`/agent/claimaudittrail/${rowData.claimId}`)} aria-label={t("common.edit", "Edit")} tooltip={t("common.edit", "Edit")} tooltipOptions={{ position: "top" }} />
    </div>
  );

  return (
    <div className="claims-dashboard bv-dash-page">
      <Toast ref={toast} />
      <DashboardToolbar title={t("claimsDashboard.title")} period={period} onPeriod={setPeriod} compare={compare} onCompare={setCompare} range={range}
        asOf={asOf} onRefresh={load} loading={loading}
        actions={<Button label={t("claimsDashboard.exportReport")} icon="pi pi-download" onClick={handleExportReport} />} />

      <StatCards items={kpis} className="bv-stat-cards--wide claims-dashboard__kpis" />

      <div className="bv-dash-grid">
        <ChartCard className="bv-dash-grid__wide" title={t("claimsDashboard.claimsTrendAnalysis")} subtitle={t("claimsDashboard.byReportedMonth")}
          table={{ columns: [{ field: "month", header: t("claimsDashboard.month") }, { field: "submitted", header: t("claimsDashboard.claimsSubmitted"), format: "count" },
            { field: "approved", header: t("claimsDashboard.claimsApproved"), format: "count" }, { field: "rejected", header: t("claimsDashboard.claimsRejected"), format: "count" }], rows: trend }}
          exportName="claims-by-month">
          <ThemedChart type="line" data={trendData} height={260} />
        </ChartCard>

        <ChartCard title={t("claimsDashboard.claimsByLob")}
          table={{ columns: [{ field: "lob", header: t("claimsDashboard.lob") }, { field: "count", header: t("claimsDashboard.claimsCount"), format: "count" }], rows: byLob }} exportName="claims-by-lob">
          <ShareChart items={byLob.map((r) => ({ label: r.lob, amount: r.count }))} dimension="lob" label={t("claimsDashboard.claimsCount")} format="count" />
        </ChartCard>

        <ChartCard title={t("claimsDashboard.ageingOfOpenClaims")} subtitle={t("claimsDashboard.ageingHint")}
          table={{ columns: [{ field: "label", header: t("claimsDashboard.age") }, { field: "count", header: t("claimsDashboard.openClaims"), format: "count" }], rows: ageingRows }} exportName="claims-ageing">
          <ThemedChart type="bar" data={ageingData} height={220} />
        </ChartCard>

        <ChartCard title={t("claimsDashboard.claimsByStage")}
          table={{ columns: [{ field: "status", header: t("claimsDashboard.status") }, { field: "count", header: t("claimsDashboard.claimsCount"), format: "count" }], rows: byStatus }} exportName="claims-by-stage">
          <ThemedChart type="bar" data={statusData} options={{ indexAxis: "y" }} height={Math.max(160, byStatus.length * 34 + 40)} />
        </ChartCard>

        <ChartCard title={t("claimsDashboard.claimsByState")}>
          {claimsByState.length ? claimsByState.map((st) => (
            <div key={st.state} className="state-item">
              <div className="state-info">
                <span className="state-name">{st.state}</span>
                <span className="state-value">{`${st.value} ${t("claimsDashboard.claims")}`}</span>
              </div>
              <div className="bv-meter">
                <ProgressBar value={progressValue(st.percentage)} showValue={false} />
                <span className="bv-meter__value">{formatPercent(st.percentage)}</span>
              </div>
            </div>
          )) : <div className="bv-viz-empty" style={{ minHeight: 160 }}><span>{t("dashboards.noData")}</span></div>}
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("claimsDashboard.recentClaims")}>
          <DataTable value={recentClaims} loading={loading && !data} className="claims-table" size="small" emptyMessage={t("dashboards.noData")}>
            <Column field="claimId" header={t("claimsDashboard.claimId")} />
            <Column field="lob" header={t("claimsDashboard.lob")} />
            <Column field="customer" header={t("claimsDashboard.customer")} />
            <Column field="policy" header={t("claimsDashboard.policy")} />
            <Column body={(row) => formatAppDate(row.lossDate)} field="lossDate" header={t("claimsDashboard.lossDate")} />
            <Column body={(row) => formatAppDate(row.reportedDate)} field="reportedDate" header={t("claimsDashboard.reported")} />
            <Column field="reporter" header={t("claimsDashboard.reporter")} />
            <Column body={priorityBodyTemplate} header={t("claimsDashboard.priority")} />
            <Column body={statusBodyTemplate} header={t("claimsDashboard.status")} />
            <Column field="amount" header={t("claimsDashboard.amount")} body={(row) => (row.amount ? formatCurrency(row.amount) : "-")} className="bv-num" headerClassName="bv-num" />
            <Column body={actionBodyTemplate} header="" style={{ width: "100px" }} />
          </DataTable>
        </ChartCard>
      </div>
    </div>
  );
};

export default ClaimsDashboard;
