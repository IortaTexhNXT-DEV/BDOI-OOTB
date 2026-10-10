import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import dashboardService from "../../../services/dashboardService";
import StatCards from "../../../components/StatCards";
import { ChartCard, DashboardToolbar, LISTS, ThemedChart, drillDown, formatValue } from "../../../components/Dashboard";
import { businessDate, formatDate as formatAppDate } from "../../../utility/dateFormat";
import { useChartTheme } from "../../../theme/chartTheme";
import { statusLabel } from "../../../utils/statusSeverity";
import "./index.scss";

const OPEN_TASK_LIMIT = 5;
/** Stages of a submission in flight, in the order they are worked (the ordinal ramp follows this order). */
const STAGES = ["PendingCustomer", "CustomerAccepted", "SubmittedToInsurer", "Approved"];

const isOverdue = (row, today) => row.requirementDue && String(row.requirementDue).slice(0, 10) < today;
const monthKey = (date) => (date ? String(date).slice(0, 7) : "-");
const stageRank = (s) => { const i = STAGES.indexOf(s); return i < 0 ? STAGES.length : i; };

/**
 * Processing Workbench: the quotations waiting on the customer or the insurers right now (a snapshot, so no period),
 * their age, cycle time and data-quality alerts, the workload per account executive by stage, what falls due by month
 * and the volume by line of business.
 */
const UnderwritingDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const toast = useRef(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    dashboardService
      .getProcessing()
      .then(setDashboard)
      .catch((error) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: error.message }))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const metrics = dashboard?.workbenchMetrics;
  const alerts = metrics?.openAlerts || {};
  const myCases = useMemo(() => dashboard?.myCases || [], [dashboard]);
  const today = businessDate();
  const unassigned = myCases.filter((row) => !row.agent).length;
  const openQuotations = () => drillDown(navigate, LISTS.quotations());

  const kpis = [
    { key: "new", label: t("underwritingDashboard.newlyReceivedSubmissions"), value: metrics ? metrics.newSubmissions : null, note: t("underwritingDashboard.last7Days"), onClick: openQuotations },
    { key: "older", label: t("underwritingDashboard.olderSubmissions"), value: metrics ? metrics.olderSubmissions : null, note: t("underwritingDashboard.olderThan7Days"),
      status: metrics?.olderSubmissions > 0 ? { severity: "warning", label: t("underwritingDashboard.followUp") } : null, onClick: openQuotations },
    { key: "cycle", label: t("underwritingDashboard.avgCycleTime"), value: metrics ? formatValue("hours", Math.round(Number(metrics.avgCycleHours) || 0)) : null, note: t("underwritingDashboard.cycleNote") },
    { key: "unassigned", label: t("underwritingDashboard.unassigned"), value: dashboard ? unassigned : null, note: t("underwritingDashboard.ofInFlight", { count: myCases.length }) },
    { key: "alerts", label: t("underwritingDashboard.openAlerts"), value: metrics ? alerts.totalAlerts : null,
      note: metrics ? t("underwritingDashboard.alertsNote", { duplicates: alerts.duplicateSubmission || 0, dates: alerts.missingDates || 0, lob: alerts.missingLOB || 0 }) : null,
      status: alerts.totalAlerts > 0 ? { severity: "warning", label: t("underwritingDashboard.needsAttention") } : null },
  ];

  // workload per account executive, stacked by stage in the order the stages are worked (one ordinal ramp)
  const workload = useMemo(() => {
    const agents = [...new Set(myCases.map((row) => row.agent || t("underwritingDashboard.unassigned")))];
    const stages = [...new Set(myCases.map((row) => row.status))].sort((a, b) => stageRank(a) - stageRank(b));
    const colors = chart.sequential(stages.length);
    const count = (agent, stage) => myCases.filter((row) => (row.agent || t("underwritingDashboard.unassigned")) === agent && row.status === stage).length;
    return {
      data: {
        labels: agents,
        datasets: stages.map((stage, i) => ({ label: statusLabel(stage), data: agents.map((a) => count(a, stage)), backgroundColor: colors[i], borderColor: chart.surface, borderWidth: 2, borderRadius: 0, borderSkipped: false })),
      },
      rows: agents.map((agent) => Object.fromEntries([["agent", agent], ...stages.map((st) => [st, count(agent, st)])])),
      stages,
    };
  }, [myCases, chart, t]);

  // what falls due by month: overdue in the critical status colour, the rest in the neutral grey (emphasis)
  const due = useMemo(() => {
    const months = [...new Set(myCases.map((row) => monthKey(row.requirementDue)))].sort();
    const countFor = (month, overdue) => myCases.filter((row) => monthKey(row.requirementDue) === month && !!isOverdue(row, today) === overdue).length;
    const rows = months.map((month) => ({ month, onTime: countFor(month, false), overdue: countFor(month, true) }));
    return {
      rows,
      data: {
        labels: months,
        datasets: [
          { label: t("underwritingDashboard.inProgressTasks"), data: rows.map((r) => r.onTime), backgroundColor: chart.other, borderColor: chart.surface, borderWidth: 2, borderRadius: 0, borderSkipped: false },
          { label: t("underwritingDashboard.overdueTasks"), data: rows.map((r) => r.overdue), backgroundColor: chart.status("critical"), borderColor: chart.surface, borderWidth: 2, borderRadius: 0, borderSkipped: false },
        ],
      },
    };
  }, [myCases, chart, t, today]);

  const lobRows = (dashboard?.volumeByLOB?.labels || []).map((label, i) => ({ label: label || "-", count: dashboard.volumeByLOB.data[i] })).sort((a, b) => b.count - a.count);
  const lobData = { labels: lobRows.map((r) => r.label), datasets: [{ label: t("underwritingDashboard.submissions"), data: lobRows.map((r) => r.count), backgroundColor: chart.primary }] };

  const openTasks = [...myCases]
    .filter((row) => row.requirementDue)
    .sort((a, b) => String(a.requirementDue).localeCompare(String(b.requirementDue)))
    .slice(0, OPEN_TASK_LIMIT);

  const openCase = (rowData) => navigate(`/agent/quotedetailview/${rowData.quotationId}`);

  const statusBodyTemplate = (rowData) => {
    const severity = { Approved: "success", CustomerAccepted: "success", SubmittedToInsurer: "warning", PendingCustomer: "info", Rejected: "danger" }[rowData.status] || null;
    return <Tag value={rowData.status} severity={severity} />;
  };
  const priorityBodyTemplate = (rowData) => {
    const severity = { high: "danger", medium: "warning", low: "success" }[rowData.priority] || "secondary";
    return <Tag value={String(rowData.priority || "-")} severity={severity} />;
  };
  const riskScoreBodyTemplate = (rowData) => {
    if (rowData.riskScore === undefined || rowData.riskScore === null) return "-";
    return (
      <div className="bv-meter">
        <ProgressBar value={rowData.riskScore} showValue={false} />
        <span className="bv-meter__value">{`${rowData.riskScore} of 100`}</span>
      </div>
    );
  };
  const actionBodyTemplate = (rowData) => (
    <Button icon="pi pi-eye" rounded text onClick={() => openCase(rowData)} aria-label={t("common.view", "View")} tooltip={t("common.view", "View")} tooltipOptions={{ position: "top" }} />
  );
  const stacked = { indexAxis: "y", scales: { x: { stacked: true }, y: { stacked: true } } };

  return (
    <div className="underwriting-dashboard bv-dash-page">
      <Toast ref={toast} />
      <DashboardToolbar title={t("underwritingDashboard.myWorkbench")} asOf={dashboard?.asOf} onRefresh={load} loading={loading}
        actions={<Button label={t("underwritingDashboard.newSubmission")} icon="pi pi-plus" onClick={() => navigate("/agent/createlead")} />}>
        <span className="underwriting-dashboard__snapshot">{t("underwritingDashboard.snapshot")}</span>
      </DashboardToolbar>

      <StatCards items={kpis} className="bv-stat-cards--wide underwriting-dashboard__kpis" />

      <div className="bv-dash-grid">
        <ChartCard title={t("underwritingDashboard.workloadMetrics")} subtitle={t("underwritingDashboard.workloadHint")}
          table={{ columns: [{ field: "agent", header: t("underwritingDashboard.agent") }, ...workload.stages.map((st) => ({ field: st, header: statusLabel(st), format: "count" }))], rows: workload.rows }}
          exportName="processing-workload">
          <ThemedChart type="bar" data={workload.data} options={stacked} height={Math.max(180, workload.data.labels.length * 40 + 80)} directLabels={false} />
        </ChartCard>

        <ChartCard title={t("underwritingDashboard.inProgressVsOverdue")} subtitle={t("underwritingDashboard.byDueMonth")}
          table={{ columns: [{ field: "month", header: t("underwritingDashboard.dueMonth") }, { field: "onTime", header: t("underwritingDashboard.inProgressTasks"), format: "count" }, { field: "overdue", header: t("underwritingDashboard.overdueTasks"), format: "count" }], rows: due.rows }}
          exportName="processing-due-by-month">
          <ThemedChart type="bar" data={due.data} options={{ scales: { x: { stacked: true }, y: { stacked: true } } }} directLabels={false} height={240} />
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("underwritingDashboard.volumeByLob")}
          table={{ columns: [{ field: "label", header: t("underwritingDashboard.productType") }, { field: "count", header: t("underwritingDashboard.submissions"), format: "count" }], rows: lobRows }}
          exportName="processing-volume-by-lob">
          <ThemedChart type="bar" data={lobData} options={{ indexAxis: "y" }} height={Math.max(120, lobRows.length * 34 + 40)} />
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("underwritingDashboard.submissionsList")}>
          <DataTable value={myCases} paginator rows={20} rowsPerPageOptions={[20, 50, 100]} className="submissions-table" loading={!dashboard} size="small">
            <Column field="caseId" header={t("underwritingDashboard.caseId")} />
            <Column field="proposedInsured" header={t("underwritingDashboard.proposedInsured")} />
            <Column field="agent" header={t("underwritingDashboard.agent")} body={(row) => row.agent || "-"} />
            <Column field="faceAmount" header={t("underwritingDashboard.faceAmount")} body={(row) => formatCurrency(row.faceAmount)} className="bv-num" headerClassName="bv-num" />
            <Column field="productType" header={t("underwritingDashboard.productType")} />
            <Column body={riskScoreBodyTemplate} header={t("underwritingDashboard.riskScore")} />
            <Column field="requirementDue" header={t("underwritingDashboard.nextRequirementDue")} body={(row) => formatAppDate(row.requirementDue)} />
            <Column body={priorityBodyTemplate} header={t("underwritingDashboard.priority")} />
            <Column body={statusBodyTemplate} header={t("underwritingDashboard.status")} />
            <Column body={actionBodyTemplate} header="" style={{ width: "4rem" }} />
          </DataTable>
        </ChartCard>

        <ChartCard className="bv-dash-grid__wide" title={t("underwritingDashboard.openTasks")}>
          <div className="tasks-list">
            {openTasks.map((task) => (
              <div className="task-item" key={task.caseId}>
                <div className="task-info">
                  <i className={isOverdue(task, today) ? "pi pi-exclamation-triangle task-icon task-icon--overdue" : "pi pi-clock task-icon"} aria-hidden="true" />
                  <div>
                    <span className="task-title">{`${task.proposedInsured || "-"} (${task.productType || "-"})`}</span>
                    <span className="task-meta">
                      {`${task.caseId} · ${formatAppDate(task.requirementDue)}`}
                      {isOverdue(task, today) ? ` · ${t("underwritingDashboard.overdue")}` : ""}
                    </span>
                  </div>
                </div>
                <Button icon="pi pi-eye" rounded text size="small" onClick={() => openCase(task)} aria-label={t("common.view", "View")} tooltip={t("common.view", "View")} tooltipOptions={{ position: "top" }} />
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default UnderwritingDashboard;
