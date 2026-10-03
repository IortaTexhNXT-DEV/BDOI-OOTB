import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { TabView, TabPanel } from "primereact/tabview";
import { Chart } from "primereact/chart";
import { Knob } from "primereact/knob";
import { Badge } from "primereact/badge";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import incentiveService from "../../../services/incentiveService";
import { showError } from "../../Remittance/shared";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";
import { formatPercent, progressValue, roundTo } from "../../../utility/numberFormat";

const MyPrograms = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);

  // State management
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalPrograms: 0,
    activePrograms: 0,
    totalPotentialEarning: 0,
    avgAchievement: 0
  });

  // Chart data
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  // Breadcrumb items
  const items = [
    { label: t("incentive.incentive") },
    { label: t("incentive.myPrograms"), url: "/incentive/my-programs" }
  ];

  const home = { label: t("sidebar.Accounts") };

  // Initialize data
  useEffect(() => {
    loadMyPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed-in agent's programs; users who are not agents (managers) see the first eligible agent.
  const fetchAgentData = async () => {
    const mine = await incentiveService.myPrograms();
    if (mine.eligible !== false) return mine;
    const all = await incentiveService.agentPrograms();
    return all[0] || mine;
  };

  const loadMyPrograms = async () => {
    setLoading(true);
    try {
      const currentAgentData = await fetchAgentData();
      const programs = currentAgentData.assignedPrograms || [];
      setAgentData(currentAgentData);
      initializeCharts(programs);

      const totalPrograms = programs.length;
      const activePrograms = programs.filter(p => p.daysRemaining > 0).length;
      const totalPotentialEarning = programs.reduce((sum, p) => sum + Number(p.potentialEarning || 0), 0);
      const avgAchievement = totalPrograms ? programs.reduce((sum, p) => sum + Number(p.achievementPercent || 0), 0) / totalPrograms : 0;

      setDashboardData({
        totalPrograms,
        activePrograms,
        totalPotentialEarning,
        avgAchievement: Math.round(avgAchievement)
      });
    } catch (error) {
      showError(toast, error, t("incentive.failedToLoadProgramData"));
    } finally {
      setLoading(false);
    }
  };

  const initializeCharts = (programs) => {
    const documentStyle = getComputedStyle(document.documentElement);

    // Achievement chart data
    const data = {
      labels: programs.map((p) => p.programName),
      datasets: [
        {
          label: 'Achievement %',
          data: programs.map((p) => p.achievementPercent),
          backgroundColor: [
            documentStyle.getPropertyValue('--blue-500'),
            documentStyle.getPropertyValue('--green-500'),
            documentStyle.getPropertyValue('--yellow-500')
          ],
          borderColor: [
            documentStyle.getPropertyValue('--blue-600'),
            documentStyle.getPropertyValue('--green-600'),
            documentStyle.getPropertyValue('--yellow-600')
          ],
          borderWidth: 1
        }
      ]
    };

    const options = {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    };

    setChartData(data);
    setChartOptions(options);
  };

  const handleViewDetails = (program) => {
    setSelectedProgram(program);
    setDetailsVisible(true);
  };

  // Template functions
  const achievementBodyTemplate = (rowData) => {
    const percentage = rowData.achievementPercent;
    const getSeverity = () => {
      if (percentage >= 100) return "success";
      if (percentage >= 80) return "warning";
      return "danger";
    };

    return (
      <div className="achievement-progress">
        <ProgressBar
          value={progressValue(percentage)}
          showValue={false}
          className={`progress-${getSeverity()}`}
        />
        <span className="achievement-text">{formatPercent(percentage)}</span>
      </div>
    );
  };

  const earningBodyTemplate = (rowData) => {
    return formatCurrency(rowData.potentialEarning);
  };

  const daysRemainingBodyTemplate = (rowData) => {
    const days = rowData.daysRemaining;
    const getSeverity = () => {
      if (days > 30) return "success";
      if (days > 7) return "warning";
      return "danger";
    };

    return (
      <Tag
        value={`${days} days`}
        severity={getSeverity()}
        icon="pi pi-clock"
      />
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <Button
        icon={<SvgEyeIcon />}
        className="view-details-button"
        onClick={() => handleViewDetails(rowData)}
        tooltip="View Details" aria-label="View Details"
      />
    );
  };

  const targetBodyTemplate = (rowData) => {
    return formatCurrency(rowData.target);
  };

  const achievedBodyTemplate = (rowData) => {
    return formatCurrency(rowData.achieved, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="container__my__programs">
      <Toast ref={toast} />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">My Incentive Programs</div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      {/* Dashboard Cards */}
      <div className="dashboard-section">
        <div className="dashboard-cards">
          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-trophy card-icon gold"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.totalPrograms}</span>
                <span className="card-label">Total Programs</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-play card-icon green"></i>
              <div className="card-info">
                <span className="card-value">{dashboardData.activePrograms}</span>
                <span className="card-label">Active Programs</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <i className="pi pi-wallet card-icon blue"></i>
              <div className="card-info">
                <span className="card-value">
                  {formatCurrency(dashboardData.totalPotentialEarning)}
                </span>
                <span className="card-label">Potential Earnings</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card">
            <div className="card-content">
              <div className="knob-container">
                <Knob
                  value={roundTo(dashboardData.avgAchievement, 0) ?? 0}
                  size={60}
                  strokeWidth={8}
                  valueTemplate={"{value}%"}
                  valueColor="#0072d8"
                  rangeColor="#e9ecef"
                />
              </div>
              <div className="card-info">
                <span className="card-label">Avg Achievement</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="content-container">
        <div className="content-grid">
          {/* Programs List */}
          <div className="programs-section">
            <Card>
              <div className="section-header">
                <h3>My Active Programs</h3>
                <Badge
                  value={agentData?.assignedPrograms?.length || 0}
                  severity="info"
                />
              </div>

              <DataTable
                value={agentData?.assignedPrograms || []}
                className="programs-table"
                stripedRows
                loading={loading}
                emptyMessage="No programs assigned"
              >
                <Column field="programName" header="Program Name" style={{ width: "25%" }} />
                <Column
                  body={targetBodyTemplate}
                  header="Target"
                  style={{ width: "15%", textAlign: "right" }}
                />
                <Column
                  body={achievedBodyTemplate}
                  header="Achieved"
                  style={{ width: "15%", textAlign: "right" }}
                />
                <Column
                  body={achievementBodyTemplate}
                  header="Achievement"
                  style={{ width: "20%" }}
                />
                <Column
                  body={earningBodyTemplate}
                  header="Potential Earning"
                  style={{ width: "15%", textAlign: "right" }}
                />
                <Column
                  body={daysRemainingBodyTemplate}
                  header="Days Left"
                  style={{ width: "10%" }}
                />
                <Column
                  body={actionBodyTemplate}
                  header="Action"
                  style={{ width: "8%" }}
                />
              </DataTable>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <Card>
              <div className="section-header">
                <h3>Achievement Overview</h3>
              </div>
              <Chart
                type="bar"
                data={chartData}
                options={chartOptions}
                height="300px"
              />
            </Card>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="activities-section">
          <Card>
            <div className="section-header">
              <h3>Recent Activities</h3>
              <Badge
                value={agentData?.recentActivities?.length || 0}
                severity="success"
              />
            </div>

            <div className="activities-list">
              {agentData?.recentActivities?.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-date">
                    {formatAppDate(activity.date)}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{activity.activity}</div>
                    <div className="activity-details">
                      <span className="impact">+{formatCurrency(activity.impact)}</span>
                      <span className="points">+{activity.points} points</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Program Details Dialog */}
      <Dialog
        header="Program Details"
        visible={detailsVisible}
        onHide={() => setDetailsVisible(false)}
        style={{ width: '70vw', maxWidth: '800px' }}
      >
        {selectedProgram && (
          <TabView>
            <TabPanel header="Overview">
              <div className="program-details">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Program Name:</label>
                    <span>{selectedProgram.programName}</span>
                  </div>
                  <div className="detail-item">
                    <label>Target:</label>
                    <span>{formatCurrency(selectedProgram.target)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Achieved:</label>
                    <span>{formatCurrency(selectedProgram.achieved)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Achievement:</label>
                    <span className="achievement-badge">
                      {selectedProgram.achievementPercent}%
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Potential Earning:</label>
                    <span className="earning-amount">
                      {formatCurrency(selectedProgram.potentialEarning)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Days Remaining:</label>
                    <span>{selectedProgram.daysRemaining} days</span>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="Progress">
              <div className="progress-section">
                <div className="progress-chart">
                  <div className="progress-circle">
                    <Knob
                      value={roundTo(selectedProgram.achievementPercent, 0) ?? 0}
                      size={120}
                      strokeWidth={10}
                      valueTemplate={"{value}%"}
                      valueColor={selectedProgram.achievementPercent >= 100 ? "#28a745" : "#0072d8"}
                      rangeColor="#e9ecef"
                    />
                  </div>
                  <div className="progress-info">
                    <h4>Current Achievement</h4>
                    <p>
                      {formatCurrency(selectedProgram.achieved)} of{" "}
                      {formatCurrency(selectedProgram.target)}
                    </p>
                    <p className="remaining">
                      {formatCurrency(selectedProgram.target - selectedProgram.achieved)} remaining
                    </p>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="Earning Potential">
              <div className="earning-breakdown">
                <div className="earning-card">
                  <h4>Current Earning Potential</h4>
                  <div className="earning-amount-large">
                    {formatCurrency(selectedProgram.potentialEarning)}
                  </div>
                  <p>Based on current achievement level</p>
                </div>

                <div className="earning-tips">
                  <h5>Tips to Maximize Earnings:</h5>
                  <ul>
                    <li>Focus on achieving the base target first</li>
                    <li>Stretch targets offer higher earning potential</li>
                    <li>Monitor your progress regularly</li>
                    <li>Contact your supervisor for guidance</li>
                  </ul>
                </div>
              </div>
            </TabPanel>
          </TabView>
        )}
      </Dialog>
    </div>
  );
};

export default MyPrograms;