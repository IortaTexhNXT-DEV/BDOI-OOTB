import React, { useState, useMemo } from "react";
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
import { useNavigate } from "react-router-dom";
import "./index.scss";

const UnderwritingDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState("week");

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
  const workbenchMetrics = {
    newSubmissions: 51,
    olderSubmissions: 182,
    avgCycleTime: "8 Hours",
    openAlerts: {
      duplicateSubmission: 3,
      missingDates: 2,
      missingLOB: 1,
      totalAlerts: 6,
    },
  };

  // My Cases Data
  const myCases = [
    {
      caseId: "SUB938416DM",
      initialReview: "Pending",
      finalDecision: "Pending",
      watchedCases: true,
      proposedInsured: "Danka Mockert",
      agent: "Regan Baldrige",
      faceAmount: "₱815,014",
      productType: "Term Life",
      requirementDue: "10/14/2025",
      status: "IN REVIEW",
      priority: "high",
      riskScore: 82,
    },
    {
      caseId: "SUB938627HK",
      initialReview: "Completed",
      finalDecision: "Pending",
      watchedCases: false,
      proposedInsured: "Hayley Klimshuk",
      agent: "Amabelle Maulchin",
      faceAmount: "₱600,704",
      productType: "Whole Life",
      requirementDue: "10/28/2025",
      status: "PENDING REVIEW",
      priority: "medium",
      riskScore: 65,
    },
    {
      caseId: "SUB938563AT",
      initialReview: "Pending",
      finalDecision: "Pending",
      watchedCases: true,
      proposedInsured: "Amalée Traviss",
      agent: "Nappy O'Sheils",
      faceAmount: "₱586,405",
      productType: "Term Life",
      requirementDue: "11/19/2025",
      status: "IN REVIEW",
      priority: "low",
      riskScore: 45,
    },
    {
      caseId: "SUB938665CB",
      initialReview: "Completed",
      finalDecision: "Approved",
      watchedCases: false,
      proposedInsured: "Cyrus Bisseck",
      agent: "Tobye Tunnoch",
      faceAmount: "₱384,064",
      productType: "Term Life",
      requirementDue: "11/30/2025",
      status: "APPROVED",
      priority: "low",
      riskScore: 38,
    },
    {
      caseId: "SUB938566ET",
      initialReview: "Pending",
      finalDecision: "Pending",
      watchedCases: false,
      proposedInsured: "Emmye Tynan",
      agent: "Cordula Peacher",
      faceAmount: "₱758,319",
      productType: "Universal Life",
      requirementDue: "11/06/2025",
      status: "IN REVIEW",
      priority: "high",
      riskScore: 75,
    },
  ];

  // Group Workload by Assignment
  const workloadData = {
    labels: [
      "Andy James",
      "Alex Robinson",
      "Joseph Gomez",
      "Steve Little",
      "Andrea Hock",
    ],
    datasets: [
      {
        label: t("underwritingDashboard.missingCriticalInfo"),
        data: [4, 3, 2, 3, 2],
        backgroundColor: "#4CAF50",
      },
      {
        label: t("underwritingDashboard.inReview"),
        data: [3, 2, 2, 1, 2],
        backgroundColor: "#2196F3",
      },
      {
        label: t("underwritingDashboard.hold"),
        data: [1, 1, 2, 1, 1],
        backgroundColor: "#FFC107",
      },
      {
        label: t("underwritingDashboard.ready"),
        data: [2, 2, 1, 2, 1],
        backgroundColor: "#9C27B0",
      },
    ],
  };

  // In Progress vs Overdue Tasks
  const tasksData = {
    labels: [
      "Jan-23",
      "Feb-23",
      "Mar-23",
      "Apr-23",
      "May-23",
      "Jun-23",
      "Jul-23",
      "Aug-23",
      "Sep-23",
      "Oct-23",
      "Nov-23",
      "Dec-23",
    ],
    datasets: [
      {
        label: t("underwritingDashboard.inProgressTasks"),
        data: [12, 15, 18, 22, 19, 25, 28, 24, 30, 27, 32, 35],
        backgroundColor: "#2196F3",
        borderColor: "#2196F3",
        borderWidth: 1,
      },
      {
        label: t("underwritingDashboard.overdueTasks"),
        data: [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8],
        backgroundColor: "#FF5252",
        borderColor: "#FF5252",
        borderWidth: 1,
      },
    ],
  };

  // Volume by LOB Chart
  const volumeByLOBData = {
    labels: ["Commercial Auto", "Commercial Package", "Commercial Property"],
    datasets: [
      {
        data: [135, 98, 67],
        backgroundColor: ["#2196F3", "#4CAF50", "#00BCD4"],
      },
    ],
  };

  // Submission Assignment Chart
  const submissionAssignmentData = {
    labels: [t("underwritingDashboard.assignedToUw"), t("underwritingDashboard.unassigned")],
    datasets: [
      {
        data: [78, 22],
        backgroundColor: ["#4CAF50", "#FF9800"],
      },
    ],
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "APPROVED":
          return "success";
        case "IN REVIEW":
          return "warning";
        case "PENDING REVIEW":
          return "info";
        case "REJECTED":
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
    const getPriorityColor = (priority) => {
      switch (priority) {
        case "high":
          return "#FF5252";
        case "medium":
          return "#FFC107";
        case "low":
          return "#4CAF50";
        default:
          return "#9E9E9E";
      }
    };
    return (
      <Badge
        value={rowData.priority.toUpperCase()}
        style={{ backgroundColor: getPriorityColor(rowData.priority) }}
      />
    );
  };

  const riskScoreBodyTemplate = (rowData) => {
    const getScoreColor = (score) => {
      if (score >= 80) return "#F44336";
      if (score >= 60) return "#FF9800";
      if (score >= 40) return "#FFC107";
      return "#4CAF50";
    };
    return (
      <div className="risk-score-cell">
        <ProgressBar
          value={rowData.riskScore}
          showValue={false}
          style={{ height: "6px" }}
          color={getScoreColor(rowData.riskScore)}
        />
        <span
          style={{
            color: getScoreColor(rowData.riskScore),
            fontWeight: "bold",
          }}
        >
          {rowData.riskScore}
        </span>
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-eye"
          rounded
          text
          severity="info"
          onClick={() => navigate(`/underwriting/case/${rowData.caseId}`)}
        />
        <Button
          icon="pi pi-pencil"
          rounded
          text
          onClick={() => navigate(`/underwriting/edit/${rowData.caseId}`)}
        />
        <Button
          icon={rowData.watchedCases ? "pi pi-star-fill" : "pi pi-star"}
          rounded
          text
          severity="warning"
        />
      </div>
    );
  };

  return (
    <div className="underwriting-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h2>{t("underwritingDashboard.myWorkbench")}</h2>
          <p>{t("underwritingDashboard.connectedUnderwriting")}</p>
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
            severity="success"
            onClick={() => navigate("/underwriting/new")}
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
            severity="success"
            onClick={() => navigate("/underwriting/new")}
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
                    severity="danger"
                  />
                </div>
                <div className="alert-item">
                  <span>{t("underwritingDashboard.missingTivAndDates")}</span>
                  <Badge
                    value={workbenchMetrics.openAlerts.missingDates}
                    severity="warning"
                  />
                </div>
                <div className="alert-item">
                  <span>{t("underwritingDashboard.missingLobTypeBroker")}</span>
                  <Badge
                    value={workbenchMetrics.openAlerts.missingLOB}
                    severity="info"
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
                  options={{
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
                  }}
                  style={{ height: "300px" }}
                />
              </div>
            </TabPanel>
            <TabPanel header={t("underwritingDashboard.groupWorkloadTop5")}>
              <div className="workload-chart">
                <Chart
                  type="bar"
                  data={workloadData}
                  options={{
                    indexAxis: "y",
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                      },
                    },
                  }}
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
            rows={5}
            rowsPerPageOptions={[5, 10, 25]}
            className="submissions-table"
          >
            <Column field="caseId" header={t("underwritingDashboard.caseId")} />
            <Column field="proposedInsured" header={t("underwritingDashboard.proposedInsured")} />
            <Column field="agent" header={t("underwritingDashboard.agent")} />
            <Column field="faceAmount" header={t("underwritingDashboard.faceAmount")} body={(row) => formatCurrency(parseFloat(String(row.faceAmount || "0").replace(/[^0-9.]/g, "")) || 0)} />
            <Column field="productType" header={t("underwritingDashboard.productType")} />
            <Column body={riskScoreBodyTemplate} header={t("underwritingDashboard.riskScore")} />
            <Column field="requirementDue" header={t("underwritingDashboard.nextRequirementDue")} />
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

          <Card title={t("underwritingDashboard.volumeByLob")} className="chart-card">
            <Chart
              type="pie"
              data={volumeByLOBData}
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

          <Card title={t("underwritingDashboard.submissionAssignment")} className="chart-card">
            <Chart
              type="doughnut"
              data={submissionAssignmentData}
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
        </div>

        {/* Open Tasks Section */}
        <Card title={t("underwritingDashboard.openTasks")} className="tasks-section">
          <div className="tasks-list">
            <div className="task-item">
              <div className="task-info">
                <i className="pi pi-clock task-icon"></i>
                <div>
                  <span className="task-title">{t("underwritingDashboard.followUpLossRun")}</span>
                  <span className="task-meta">SUB1256789 • 3 {t("underwritingDashboard.daysAgo")}</span>
                </div>
              </div>
              <Button label={t("underwritingDashboard.markAsClosed")} size="small" />
            </div>
            <div className="task-item">
              <div className="task-info">
                <i
                  className="pi pi-exclamation-triangle task-icon"
                  style={{ color: "#FF9800" }}
                ></i>
                <div>
                  <span className="task-title">{t("underwritingDashboard.updateSov")}</span>
                  <span className="task-meta">SUB1256790 • {t("underwritingDashboard.yesterday")}</span>
                </div>
              </div>
              <Button label={t("underwritingDashboard.markAsClosed")} size="small" />
            </div>
            <div className="task-item">
              <div className="task-info">
                <i
                  className="pi pi-check-circle task-icon"
                  style={{ color: "#4CAF50" }}
                ></i>
                <div>
                  <span className="task-title">{t("underwritingDashboard.reviewLossHistory")}</span>
                  <span className="task-meta">SUB1378890 • {t("underwritingDashboard.today")}</span>
                </div>
              </div>
              <Button label={t("underwritingDashboard.markAsClosed")} size="small" />
            </div>
            <div className="task-item">
              <div className="task-info">
                <i className="pi pi-user task-icon"></i>
                <div>
                  <span className="task-title">
                    {t("underwritingDashboard.runSanctionCheck")}
                  </span>
                  <span className="task-meta">SUB0321985 • 2 {t("underwritingDashboard.hoursAgo")}</span>
                </div>
              </div>
              <Button label={t("underwritingDashboard.markAsClosed")} size="small" />
            </div>
            <div className="task-item">
              <div className="task-info">
                <i className="pi pi-file task-icon"></i>
                <div>
                  <span className="task-title">{t("underwritingDashboard.runOfac")}</span>
                  <span className="task-meta">SUB0345678 • {t("underwritingDashboard.justNow")}</span>
                </div>
              </div>
              <Button label={t("underwritingDashboard.markAsClosed")} size="small" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UnderwritingDashboard;
