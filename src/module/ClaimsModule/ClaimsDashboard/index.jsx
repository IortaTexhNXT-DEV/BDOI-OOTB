import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { Calendar } from "primereact/calendar";
import { useNavigate } from "react-router-dom";
import { Toast } from "primereact/toast";
import authService from "../../../services/authService";
import { BASE_URL } from "../../../utility/constant";
import "./index.scss";

const ClaimsDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [dateRange, setDateRange] = useState([
    new Date(2025, 0, 1),
    new Date(),
  ]);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0]
        ? dateRange[0].toISOString().split("T")[0]
        : "2025-01-01";
      const endDate = dateRange[1]
        ? dateRange[1].toISOString().split("T")[0]
        : "2025-12-31";

      const response = await fetch(
        `${BASE_URL}/claims/report?startDate=${startDate}&endDate=${endDate}&includeData=true`,
        {
          method: "GET",
          headers: {
            ...authService.getAuthHeader(),
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const result = await response.json();
      setDashboardData(result.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.current?.show({
        severity: "error",
        summary: t("claimsDashboard.error"),
        detail: t("claimsDashboard.failedToLoad"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const handleExportReport = async () => {
    try {
      const startDate = dateRange[0]
        ? dateRange[0].toISOString().split("T")[0]
        : "2025-01-01";
      const endDate = dateRange[1]
        ? dateRange[1].toISOString().split("T")[0]
        : "2025-12-31";

      const url = `${BASE_URL}/claims/report?startDate=${startDate}&endDate=${endDate}&includeData=true&format=excel`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...authService.getAuthHeader(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export report");
      }

      const blob = await response.blob();
      // eslint-disable-next-line no-undef
      const downloadUrl = globalThis.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `claims-report-${startDate}-to-${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // eslint-disable-next-line no-undef
      globalThis.URL.revokeObjectURL(downloadUrl);
      toast.current?.show({
        severity: "success",
        summary: t("claimsDashboard.success"),
        detail: t("claimsDashboard.excelDownloaded"),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.current?.show({
        severity: "error",
        summary: t("claimsDashboard.error"),
        detail: t("claimsDashboard.failedToExport"),
      });
    }
  };

  // KPI Data from API
  const kpiData = dashboardData
    ? {
        totalOpenClaims: dashboardData.summary.totalOpenClaims,
        claimsOverdue: dashboardData.summary.totalAgingClaims,
        todaysClaims: dashboardData.summary.todaysClaims,
        highestClaimsCategory: dashboardData.breakdown.byType[0]?.type || "N/A",
        highestClaimsPercentage: dashboardData.breakdown.byType[0]
          ? Math.round(
              (dashboardData.breakdown.byType[0].count /
                dashboardData.summary.totalOpenClaims) *
                100
            )
          : 0,
        maxClaimsByState:
          dashboardData.summary.maxClaimsByState?.state || "N/A",
        statePercentage:
          dashboardData.summary.maxClaimsByState?.percentage || 0,
        avgProcessingTime: "4.2 days", // This would need a separate calculation
        totalClaimsValue: "₱12,450,000", // This would need a separate calculation
        approvalRate: "78%", // This would need a separate calculation
      }
    : {
        totalOpenClaims: 0,
        claimsOverdue: 0,
        todaysClaims: 0,
        highestClaimsCategory: "N/A",
        highestClaimsPercentage: 0,
        maxClaimsByState: "N/A",
        statePercentage: 0,
        avgProcessingTime: "0 days",
        totalClaimsValue: "₱0",
        approvalRate: "0%",
      };

  // Recent Claims Data from API
  const recentClaims =
    dashboardData?.detailedClaims?.slice(0, 10).map((claim) => ({
      claimId: claim.claimNumber,
      lob: claim.lob,
      customer: claim.customerName,
      policy: claim.policyNumber,
      lossDate: claim.dateOfIncident
        ? new Date(claim.dateOfIncident).toLocaleDateString("en-GB")
        : "N/A",
      reportedDate: new Date(claim.reportedDate).toLocaleDateString("en-GB"),
      reporter: "System", // This field is not in the API response
      priority: claim.claimPriority?.toLowerCase() || "low",
      status: claim.claimStatus,
      amount: claim.estimatedClaimAmount
        ? `₱${claim.estimatedClaimAmount.toLocaleString()}`
        : "N/A",
    })) || [];

  // Claims by State data from API
  const claimsByState =
    dashboardData?.breakdown?.byState?.map((state) => ({
      state: state.state,
      value: state.count,
      percentage: state.percentage,
    })) || [];

  // Claims by Source Chart Data (using LOB data from API)
  const claimsBySourceData = {
    labels: dashboardData?.breakdown?.byLOB?.map((lob) => lob.lob) || [],
    datasets: [
      {
        data: dashboardData?.breakdown?.byLOB?.map((lob) => lob.count) || [],
        backgroundColor: [
          "#0066CC",
          "#4285F4",
          "#7BAAF7",
          "#FFA500",
          "#FFD700",
          "#90EE90",
        ],
      },
    ],
  };

  // Claims Trend Chart Data
  const claimsTrendData = {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    datasets: [
      {
        label: t("claimsDashboard.claimsSubmitted"),
        data: [165, 159, 180, 181, 156, 195, 240, 218, 245, 234, 256, 278],
        borderColor: "#0066CC",
        backgroundColor: "rgba(0, 102, 204, 0.1)",
        tension: 0.4,
      },
      {
        label: t("claimsDashboard.claimsApproved"),
        data: [128, 138, 145, 162, 140, 175, 198, 185, 210, 198, 220, 235],
        borderColor: "#00C851",
        backgroundColor: "rgba(0, 200, 81, 0.1)",
        tension: 0.4,
      },
      {
        label: t("claimsDashboard.claimsRejected"),
        data: [37, 21, 35, 19, 16, 20, 42, 33, 35, 36, 36, 43],
        borderColor: "#FF4444",
        backgroundColor: "rgba(255, 68, 68, 0.1)",
        tension: 0.4,
      },
    ],
  };

  // Loss Ratio by Product (using status data from API)
  const lossRatioData = {
    labels:
      dashboardData?.breakdown?.byStatus?.map((status) => status.status) || [],
    datasets: [
      {
        label: t("claimsDashboard.claimsCount"),
        data:
          dashboardData?.breakdown?.byStatus?.map((status) => status.count) ||
          [],
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#4CAF50",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
          "#FF9F40",
        ],
      },
    ],
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "Closed":
          return "success";
        case "Settled":
          return "success";
        case "Approved":
          return "info";
        case "In Progress":
          return "warning";
        case "Pending":
          return "warning";
        case "Under Investigation":
          return "warning";
        case "Under Assessment":
          return "warning";
        case "Pending Approval":
          return "warning";
        case "Documents Required":
          return "danger";
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
    const getPriorityIcon = (priority) => {
      switch (priority?.toLowerCase()) {
        case "high":
          return "🔴";
        case "medium":
          return "🟡";
        case "low":
          return "🟢";
        default:
          return "⚪";
      }
    };
    return <span>{getPriorityIcon(rowData.priority)}</span>;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-eye"
          rounded
          text
          severity="info"
          onClick={() => navigate(`/claims/view/${rowData.claimId}`)}
        />
        <Button
          icon="pi pi-pencil"
          rounded
          text
          onClick={() => navigate(`/claims/edit/${rowData.claimId}`)}
        />
      </div>
    );
  };

  return (
    <div className="claims-dashboard">
      <Toast ref={toast} />
      <div className="dashboard-header">
        <div className="header-content">
          <h2>{t("claimsDashboard.title")}</h2>
          <div className="header-actions">
            <Calendar
              value={dateRange}
              onChange={(e) => setDateRange(e.value)}
              selectionMode="range"
              placeholder={t("claimsDashboard.selectDateRange")}
            />
            <Button
              label={t("claimsDashboard.exportReport")}
              icon="pi pi-download"
              severity="info"
              onClick={handleExportReport}
            />
          </div>
        </div>
        <div className="mobile-header-actions">
          <Calendar
            value={dateRange}
            onChange={(e) => setDateRange(e.value)}
            selectionMode="range"
            placeholder={t("claimsDashboard.selectDateRange")}
          />
          <Button
            label={t("claimsDashboard.exportReport")}
            icon="pi pi-download"
            severity="info"
            onClick={handleExportReport}
          />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-row">
        <div className="kpi-scroll-container">
          <Card className="kpi-card">
            <div className="kpi-content">
              <i
                className="pi pi-folder-open kpi-icon"
                style={{ color: "#0066CC" }}
              ></i>
              <div className="kpi-details">
                <span className="kpi-label">{t("claimsDashboard.totalOpenClaims")}</span>
                <span className="kpi-value">{kpiData.totalOpenClaims}</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card">
            <div className="kpi-content">
              <i
                className="pi pi-exclamation-triangle kpi-icon"
                style={{ color: "#FF6B6B" }}
              ></i>
              <div className="kpi-details">
                <span className="kpi-label">{t("claimsDashboard.claimsOverdue")}</span>
                <span className="kpi-value">{kpiData.claimsOverdue}</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card">
            <div className="kpi-content">
              <i
                className="pi pi-calendar kpi-icon"
                style={{ color: "#4ECDC4" }}
              ></i>
              <div className="kpi-details">
                <span className="kpi-label">{t("claimsDashboard.todaysClaims")}</span>
                <span className="kpi-value">{kpiData.todaysClaims}</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card">
            <div className="kpi-content">
              <i
                className="pi pi-chart-line kpi-icon"
                style={{ color: "#95E77E" }}
              ></i>
              <div className="kpi-details">
                <span className="kpi-label">{t("claimsDashboard.highestClaims")}</span>
                <span className="kpi-value">
                  {kpiData.highestClaimsCategory}
                </span>
                <span className="kpi-percentage">
                  {kpiData.highestClaimsPercentage}%
                </span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card">
            <div className="kpi-content">
              <i
                className="pi pi-map-marker kpi-icon"
                style={{ color: "#FFD93D" }}
              ></i>
              <div className="kpi-details">
                <span className="kpi-label">{t("claimsDashboard.maxClaimsByState")}</span>
                <span className="kpi-value">{kpiData.maxClaimsByState}</span>
                <span className="kpi-percentage">
                  {kpiData.statePercentage}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content">
        <div className="content-left">
          {/* Recent Claims Table */}
          <Card title={t("claimsDashboard.recentClaims")} className="recent-claims-card">
            <div className="claims-table-container">
              <DataTable
                value={recentClaims}
                loading={loading}
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 25]}
                className="claims-table"
              >
                <Column field="claimId" header={t("claimsDashboard.claimId")} />
                <Column field="lob" header={t("claimsDashboard.lob")} />
                <Column field="customer" header={t("claimsDashboard.customer")} />
                <Column field="policy" header={t("claimsDashboard.policy")} />
                <Column field="lossDate" header={t("claimsDashboard.lossDate")} />
                <Column field="reportedDate" header={t("claimsDashboard.reported")} />
                <Column field="reporter" header={t("claimsDashboard.reporter")} />
                <Column body={priorityBodyTemplate} header={t("claimsDashboard.priority")} />
                <Column body={statusBodyTemplate} header={t("claimsDashboard.status")} />
                <Column field="amount" header={t("claimsDashboard.amount")} />
                <Column
                  body={actionBodyTemplate}
                  header=""
                  style={{ width: "100px" }}
                />
              </DataTable>
            </div>
          </Card>

          {/* Claims Trend Chart */}
          <Card title={t("claimsDashboard.claimsTrendAnalysis")} className="chart-card">
            <Chart
              type="line"
              data={claimsTrendData}
              options={{
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
          </Card>
        </div>

        <div className="content-right">
          {/* Claims by State */}
          <Card title={t("claimsDashboard.claimsByState")} className="state-card">
            {claimsByState.map((state) => (
              <div key={state.state} className="state-item">
                <div className="state-info">
                  <span className="state-name">{state.state}</span>
                  <span className="state-value">{state.value} {t("claimsDashboard.claims")}</span>
                </div>
                <ProgressBar value={state.percentage} showValue={false} />
              </div>
            ))}
          </Card>

          {/* Claims by Source */}
          <Card title={t("claimsDashboard.claimsBySource")} className="source-card">
            <Chart
              type="doughnut"
              data={claimsBySourceData}
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

          {/* Loss Ratio */}
          <Card title={t("claimsDashboard.lossRatioByProduct")} className="loss-ratio-card">
            <Chart
              type="bar"
              data={lossRatioData}
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
                    max: 100,
                  },
                },
              }}
              style={{ height: "200px" }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClaimsDashboard;
