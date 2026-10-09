import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { TabView, TabPanel } from "primereact/tabview";
import { Dropdown } from "primereact/dropdown";
import { Badge } from "primereact/badge";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import dashboardService from "../../../services/dashboardService";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { useChartTheme } from "../../../theme/chartTheme";
import "./index.scss";

const OPEN_TASK_LIMIT = 5;

const countBy = (rows, keyOf) =>
  rows.reduce((acc, row) => {
    const key = keyOf(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const isOverdue = (row) => row.requirementDue && new Date(row.requirementDue) < new Date();

const monthKey = (date) => (date ? String(date).slice(0, 7) : "-");

/** An alert count is coloured only while there is something to look at. */
const alertSeverity = (count, severity) => (Number(count) > 0 ? severity : "secondary");

const UnderwritingDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    dashboardService
      .getProcessing()
      .then(setDashboard)
      .catch((error) =>
        toast.current?.show({ severity: "error", summary: "Error", detail: error.message })
      );
  }, []);

  const periodOptions = useMemo(
    () => [
      { label: t("underwritingDashboard.thisWeek"), value: "week" },
      { label: t("underwritingDashboard.thisMonth"), value: "month" },
      { label: t("underwritingDashboard.thisQuarter"), value: "quarter" },
      { label: t("underwritingDashboard.thisYear"), value: "year" },
    ],
    [t]
  );

  // Workbench Metrics
  const workbenchMetrics = dashboard?.workbenchMetrics || {
    newSubmissions: 0,
    olderSubmissions: 0,
    avgCycleTime: "-",
    openAlerts: { duplicateSubmission: 0, missingDates: 0, missingLOB: 0, totalAlerts: 0 },
  };

  // My Cases Data (quotations awaiting a decision)
  const myCases = useMemo(() => dashboard?.myCases || [], [dashboard]);

  // Group Workload by Assignment: cases per agent, stacked by status
  const workloadData = useMemo(() => {
    const agents = Object.keys(countBy(myCases, (row) => row.agent || "-"));
    const statuses = Object.keys(countBy(myCases, (row) => row.status));
    const colors = chart.statuses(statuses);
    return {
      labels: agents,
      datasets: statuses.map((status, index) => ({
        label: status,
        data: agents.map(
          (agent) => myCases.filter((row) => (row.agent || "-") === agent && row.status === status).length
        ),
        backgroundColor: colors[index],
      })),
    };
  }, [myCases, chart]);

  // In Progress vs Overdue Tasks by requirement due month
  const tasksData = useMemo(() => {
    const months = Object.keys(countBy(myCases, (row) => monthKey(row.requirementDue))).sort();
    const countFor = (month, overdue) =>
      myCases.filter((row) => monthKey(row.requirementDue) === month && isOverdue(row) === overdue).length;
    return {
      labels: months,
      datasets: [
        {
          label: t("underwritingDashboard.inProgressTasks"),
          data: months.map((month) => countFor(month, false)),
          backgroundColor: chart.primary,
          borderColor: chart.primary,
          borderWidth: 1,
        },
        {
          label: t("underwritingDashboard.overdueTasks"),
          data: months.map((month) => countFor(month, true)),
          backgroundColor: chart.danger,
          borderColor: chart.danger,
          borderWidth: 1,
        },
      ],
    };
  }, [myCases, t, chart]);

  // Volume by LOB Chart
  const volumeByLOBData = {
    labels: dashboard?.volumeByLOB?.labels || [],
    datasets: [
      {
        data: dashboard?.volumeByLOB?.data || [],
        backgroundColor: chart.series((dashboard?.volumeByLOB?.labels || []).length),
        borderColor: chart.surface,
      },
    ],
  };

  // Submission Assignment Chart
  const assignedCount = myCases.filter((row) => row.agent).length;
  const submissionAssignmentData = {
    labels: [t("underwritingDashboard.assignedToUw"), t("underwritingDashboard.unassigned")],
    datasets: [
      {
        data: [assignedCount, myCases.length - assignedCount],
        backgroundColor: chart.series(2),
        borderColor: chart.surface,
      },
    ],
  };

  const openTasks = [...myCases]
    .filter((row) => row.requirementDue)
    .sort((a, b) => String(a.requirementDue).localeCompare(String(b.requirementDue)))
    .slice(0, OPEN_TASK_LIMIT);

  const openCase = (rowData) => navigate(`/agent/quotedetailview/${rowData.quotationId}`);

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "Approved":
        case "CustomerAccepted":
          return "success";
        case "SubmittedToInsurer":
          return "warning";
        case "PendingCustomer":
          return "info";
        case "Rejected":
          return "danger";
        default:
          return null;
      }
    };
    return (
      <Tag value={rowData.status} severity={getSeverity(rowData.status)} />
    );
  };

  const priorityBodyTemplate = (rowData) => {
    const getPrioritySeverity = (priority) => {
      switch (priority) {
        case "high":
          return "danger";
        case "medium":
          return "warning";
        case "low":
          return "success";
        default:
          return "secondary";
      }
    };
    return <Tag value={String(rowData.priority || "-")} severity={getPrioritySeverity(rowData.priority)} />;
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
    <div className="flex gap-2">
      <Button icon="pi pi-eye" rounded text onClick={() => openCase(rowData)} aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
    </div>
  );

  return (
    <div className="underwriting-dashboard">
      <Toast ref={toast} />
      <div className="dashboard-header">
        <div className="header-left">
          <h2>{t("underwritingDashboard.myWorkbench")}</h2>
        </div>
        <div className="header-right">
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => setSelectedPeriod(e.value)}
          />
          <Button
            label={t("underwritingDashboard.newSubmission")}
            icon="pi pi-plus"
            onClick={() => navigate("/agent/createlead")}
          />
        </div>
        <div className="mobile-header-actions">
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => setSelectedPeriod(e.value)}
          />
          <Button
            label={t("underwritingDashboard.newSubmission")}
            icon="pi pi-plus"
            onClick={() => navigate("/agent/createlead")}
          />
        </div>
      </div>

      {/* Workbench Metrics */}
      <div className="metrics-row">
        <div className="metrics-scroll-container">
          <Card className="metric-card">
            <div className="metric-content">
              <span className="metric-label">{t("underwritingDashboard.newlyReceivedSubmissions")}</span>
              <span className="metric-value">
                {workbenchMetrics.newSubmissions}
              </span>
              <i className="pi pi-info-circle metric-info"></i>
            </div>
          </Card>

          <Card className="metric-card">
            <div className="metric-content">
              <span className="metric-label">{t("underwritingDashboard.olderSubmissions")}</span>
              <span className="metric-value">
                {workbenchMetrics.olderSubmissions}
              </span>
              <i className="pi pi-info-circle metric-info"></i>
            </div>
          </Card>

          <Card className="metric-card">
            <div className="metric-content">
              <span className="metric-label">{t("underwritingDashboard.avgCycleTime")}</span>
              <span className="metric-value">
                {workbenchMetrics.avgCycleTime}
              </span>
              <i className="pi pi-info-circle metric-info"></i>
            </div>
          </Card>

          <Card className="metric-card open-alerts">
            <div className="metric-content">
              <span className="metric-label">{t("underwritingDashboard.openAlerts")}</span>
              <div className="alerts-breakdown">
                <div className="alert-item">
                  <span>{t("underwritingDashboard.duplicateSubmissionDetected")}</span>
                  <Badge
                    value={workbenchMetrics.openAlerts.duplicateSubmission}
                    severity={alertSeverity(workbenchMetrics.openAlerts.duplicateSubmission, "danger")}
                  />
                </div>
                <div className="alert-item">
                  <span>{t("underwritingDashboard.missingTivAndDates")}</span>
                  <Badge
                    value={workbenchMetrics.openAlerts.missingDates}
                    severity={alertSeverity(workbenchMetrics.openAlerts.missingDates, "warning")}
                  />
                </div>
                <div className="alert-item">
                  <span>{t("underwritingDashboard.missingLobTypeBroker")}</span>
                  <Badge
                    value={workbenchMetrics.openAlerts.missingLOB}
                    severity={alertSeverity(workbenchMetrics.openAlerts.missingLOB, "warning")}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Workload Metrics Section */}
        <Card title={t("underwritingDashboard.workloadMetrics")} className="workload-section">
          <TabView
            activeIndex={activeIndex}
            onTabChange={(e) => setActiveIndex(e.index)}
          >
            <TabPanel header={t("underwritingDashboard.assignmentGroups")}>
              <div className="workload-chart">
                <Chart
                  type="bar"
                  data={workloadData}
                  options={chart.options({
                    indexAxis: "y",
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                      },
                    },
                    scales: {
                      x: {
                        stacked: true,
                        beginAtZero: true,
                      },
                      y: {
                        stacked: true,
                      },
                    },
                  })}
                  style={{ height: "300px" }}
                />
              </div>
            </TabPanel>
            <TabPanel header={t("underwritingDashboard.groupWorkloadTop5")}>
              <div className="workload-chart">
                <Chart
                  type="bar"
                  data={workloadData}
                  options={chart.options({
                    indexAxis: "y",
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                      },
                    },
                  })}
                  style={{ height: "300px" }}
                />
              </div>
            </TabPanel>
          </TabView>
        </Card>

        {/* Submissions List */}
        <Card title={t("underwritingDashboard.submissionsList")} className="submissions-section">
          <DataTable
            value={myCases}
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            className="submissions-table"
          >
            <Column field="caseId" header={t("underwritingDashboard.caseId")} />
            <Column field="proposedInsured" header={t("underwritingDashboard.proposedInsured")} />
            <Column field="agent" header={t("underwritingDashboard.agent")} />
            <Column field="faceAmount" header={t("underwritingDashboard.faceAmount")} body={(row) => formatCurrency(row.faceAmount)} />
            <Column field="productType" header={t("underwritingDashboard.productType")} />
            <Column body={riskScoreBodyTemplate} header={t("underwritingDashboard.riskScore")} />
            <Column field="requirementDue" header={t("underwritingDashboard.nextRequirementDue")} body={(row) => formatAppDate(row.requirementDue)} />
            <Column body={priorityBodyTemplate} header={t("underwritingDashboard.priority")} />
            <Column body={statusBodyTemplate} header={t("underwritingDashboard.status")} />
            <Column
              body={actionBodyTemplate}
              header=""
              style={{ width: "120px" }}
            />
          </DataTable>
        </Card>

        {/* Charts Row */}
        <div className="charts-row">
          <Card
            title={t("underwritingDashboard.inProgressVsOverdue")}
            className="chart-card"
          >
            <Chart
              type="bar"
              data={tasksData}
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
            />
          </Card>

          <Card title={t("underwritingDashboard.volumeByLob")} className="chart-card">
            <Chart
              type="pie"
              data={volumeByLOBData}
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
            />
          </Card>

          <Card title={t("underwritingDashboard.submissionAssignment")} className="chart-card">
            <Chart
              type="doughnut"
              data={submissionAssignmentData}
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
            />
          </Card>
        </div>

        {/* Open Tasks Section */}
        <Card title={t("underwritingDashboard.openTasks")} className="tasks-section">
          <div className="tasks-list">
            {openTasks.map((task) => (
              <div className="task-item" key={task.caseId}>
                <div className="task-info">
                  <i
                    className={isOverdue(task) ? "pi pi-exclamation-triangle task-icon" : "pi pi-clock task-icon"}
                    style={isOverdue(task) ? { color: "var(--color-warning)" } : undefined}
                  ></i>
                  <div>
                    <span className="task-title">{`${task.proposedInsured || "-"} (${task.productType || "-"})`}</span>
                    <span className="task-meta">{`${task.caseId} · ${formatAppDate(task.requirementDue)}`}</span>
                  </div>
                </div>
                <Button icon="pi pi-eye" rounded text size="small" onClick={() => openCase(task)} aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UnderwritingDashboard;
