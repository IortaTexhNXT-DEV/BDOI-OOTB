import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { TabView, TabPanel } from "primereact/tabview";
import { ProgressBar } from "primereact/progressbar";
import { Badge } from "primereact/badge";
import { Knob } from "primereact/knob";
import { Avatar } from "primereact/avatar";
import { Calendar } from "primereact/calendar";
import renewalsWorkspaceService, { periodRange, productLabel } from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import { calendarDateFormat } from "../../../utility/dateFormat";
import "./index.scss";
import { currencySymbol } from "../../../utility/currencyConverter";

const PerformanceTracking = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Current Month');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [productFilter, setProductFilter] = useState('All Products');
  const [dateRange, setDateRange] = useState([null, null]);
  const [performanceData, setPerformanceData] = useState({});
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const toast = useRef(null);

  const timeFilterOptions = [
    { label: t("renewal.currentMonth"), value: 'Current Month' },
    { label: t("renewal.last3Months"), value: 'Last 3 Months' },
    { label: t("renewal.last6Months"), value: 'Last 6 Months' },
    { label: t("renewal.yearToDate"), value: 'Year to Date' },
    { label: t("renewal.customRange"), value: 'Custom Range' }
  ];

  const teamFilterOptions = [
    { label: t("renewal.allTeams"), value: 'All Teams' },
    { label: t("renewal.renewalTeamA"), value: 'Team A' },
    { label: t("renewal.renewalTeamB"), value: 'Team B' },
    { label: t("renewal.seniorAgents"), value: 'Senior' },
    { label: t("renewal.juniorAgents"), value: 'Junior' }
  ];

  const productKeys = Object.keys(performanceData.byProduct || {});
  const productFilterOptions = [
    { label: t("renewal.allProducts"), value: 'All Products' },
    ...productKeys.map(key => ({ label: productLabel(key), value: key }))
  ];
  const shownProducts = productFilter === 'All Products' ? productKeys : productKeys.filter(key => key === productFilter);

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.performanceTracking"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadPerformanceData();
  }, [timeFilter, dateRange]);

  useEffect(() => {
    setupCharts();
  }, [performanceData, productFilter]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      setPerformanceData(await renewalsWorkspaceService.getPerformance(periodRange(timeFilter, dateRange)));
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToLoadPerformanceData"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const setupCharts = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const primaryColor = '#3B82F6';
    const successColor = '#10B981';
    const warningColor = '#F59E0B';
    const dangerColor = '#EF4444';

    // Performance Trend Chart
    const trendData = {
      labels: performanceData.trends?.monthly?.map(item => item.month) || [],
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: performanceData.trends?.monthly?.map(item => item.rate) || [],
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}20`,
          tension: 0.4,
          fill: true
        }
      ]
    };

    // Agent Performance Comparison
    const agentComparisonData = {
      labels: performanceData.byAgent?.map(agent => agent.agentName.split(' ')[0]) || [],
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: performanceData.byAgent?.map(agent => agent.renewalRate) || [],
          backgroundColor: primaryColor,
          borderRadius: 4
        },
        {
          label: 'Premium Retained (M)',
          data: performanceData.byAgent?.map(agent => agent.premiumRetained / 1000000) || [],
          backgroundColor: successColor,
          borderRadius: 4,
          yAxisID: 'y1'
        }
      ]
    };

    // Product Performance Pie Chart
    const productPerformanceData = {
      labels: shownProducts.map(productLabel),
      datasets: [
        {
          data: shownProducts.map(key => performanceData.byProduct[key]?.renewalRate || 0),
          backgroundColor: [primaryColor, successColor, warningColor, dangerColor, '#8B5CF6'],
          borderWidth: 0
        }
      ]
    };

    setChartData({
      trend: trendData,
      agentComparison: agentComparisonData,
      productPerformance: productPerformanceData
    });

    const baseOptions = {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        }
      }
    };

    setChartOptions({
      trend: {
        ...baseOptions,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      },
      agentComparison: {
        ...baseOptions,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              callback: function(value) {
                return currencySymbol() + value + 'M';
              }
            }
          }
        }
      },
      productPerformance: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            position: 'right'
          }
        }
      }
    });
  };

  const formatPercentage = (value, decimals = 1) => {
    return `${value?.toFixed(decimals) || 0}%`;
  };

  const agentRankingTemplate = (rowData) => {
    const getRankIcon = (rank) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return `#${rank}`;
      }
    };

    const getRankColor = (rank) => {
      switch (rank) {
        case 1: return 'gold';
        case 2: return 'silver';
        case 3: return 'bronze';
        default: return 'default';
      }
    };

    return (
      <div className={`rank-cell ${getRankColor(rowData.ranking)}`}>
        <span className="rank-icon">{getRankIcon(rowData.ranking)}</span>
      </div>
    );
  };

  const agentNameTemplate = (rowData) => {
    return (
      <div className="agent-cell">
        <Avatar
          label={rowData.agentName.split(' ').map(n => n[0]).join('')}
          size="normal"
          shape="circle"
          className="agent-avatar"
        />
        <div className="agent-info">
          <span className="agent-name">{rowData.agentName}</span>
          <small className="agent-team">Renewal Team</small>
        </div>
      </div>
    );
  };

  const renewalRateTemplate = (rowData) => {
    const rate = rowData.renewalRate || 0;
    const getColor = (rate) => {
      if (rate >= 90) return 'success';
      if (rate >= 80) return 'info';
      if (rate >= 70) return 'warning';
      return 'danger';
    };

    return (
      <div className="rate-cell">
        <ProgressBar value={rate} className={`rate-progress ${getColor(rate)}`} />
        <span className={`rate-value ${getColor(rate)}`}>{formatPercentage(rate)}</span>
      </div>
    );
  };

  const premiumRetainedTemplate = (rowData) => {
    return (
      <div className="premium-cell">
        <span className="premium-amount">{formatCurrency(rowData.premiumRetained)}</span>
        <small className="premium-policies">{rowData.policiesRenewed} policies</small>
      </div>
    );
  };

  const cycleTimeTemplate = (rowData) => {
    const days = rowData.avgCycleTime;
    const getSeverity = (days) => {
      if (days <= 14) return 'success';
      if (days <= 21) return 'warning';
      return 'danger';
    };

    return <Tag value={`${days} days`} severity={getSeverity(days)} />;
  };

  const productRateTemplate = (rowData, field) => {
    const product = performanceData.byProduct?.[field];
    if (!product) return '-';

    return (
      <div className="product-rate-cell">
        <span className="rate">{formatPercentage(product.renewalRate)}</span>
        <small className="avg-premium">{formatCurrency(product.avgPremium)}</small>
      </div>
    );
  };

  // KPI targets and achievements for the selected period
  const kpiData = [
    {
      category: 'Renewal Rate',
      target: 85,
      achieved: performanceData.overall?.renewalRate ?? 0,
      unit: '%'
    },
    {
      category: 'Premium Retention',
      target: 90,
      achieved: performanceData.overall?.premiumRetention ?? 0,
      unit: '%'
    },
    {
      category: 'Cycle Time',
      target: 15,
      achieved: performanceData.overall?.avgCycleTime ?? 0,
      unit: 'days',
      inverse: true // Lower is better
    },
    {
      category: 'Customer Satisfaction',
      target: 4.5,
      achieved: performanceData.overall?.customerSatisfaction,
      unit: '/5'
    }
  ].filter(kpi => kpi.achieved !== undefined && kpi.achieved !== null);

  const kpiAchievementTemplate = (rowData) => {
    const percentage = rowData.inverse
      ? Math.max(0, 100 - ((rowData.achieved - rowData.target) / rowData.target) * 100)
      : (rowData.achieved / rowData.target) * 100;

    const getSeverity = (percentage) => {
      if (percentage >= 100) return 'success';
      if (percentage >= 90) return 'info';
      if (percentage >= 80) return 'warning';
      return 'danger';
    };

    return (
      <div className="kpi-achievement">
        <ProgressBar value={Math.min(percentage, 100)} className={getSeverity(percentage)} />
        <span className="achievement-text">
          {percentage >= 100 ? '✓ Achieved' : `${Math.round(percentage)}% of target`}
        </span>
      </div>
    );
  };

  return (
    <div className="container__performance__tracking__master">
      <Toast ref={toast} />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.performanceTracking")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        {/* Filters Section */}
        <div className="filters-section">
          <Card>
            <div className="filters-grid">
              <div className="filter-field">
                <label>Time Period</label>
                <Dropdown
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.value)}
                  options={timeFilterOptions}
                />
              </div>

              <div className="filter-field">
                <label>Team</label>
                <Dropdown
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.value)}
                  options={teamFilterOptions}
                />
              </div>

              <div className="filter-field">
                <label>Product Line</label>
                <Dropdown
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.value)}
                  options={productFilterOptions}
                />
              </div>

              {timeFilter === 'Custom Range' && (
                <div className="filter-field">
                  <label>Date Range</label>
                  <Calendar
                    value={dateRange}
                    onChange={(e) => setDateRange(e.value)}
                    selectionMode="range"
                    dateFormat={calendarDateFormat()}
                  />
                </div>
              )}

              <div className="filter-actions">
                <Button
                  label="Apply Filters"
                  icon="pi pi-filter"
                  onClick={loadPerformanceData}
                  loading={loading}
                />
                <Button
                  label="Export Report"
                  icon="pi pi-file-excel"
                  className="p-button-secondary"
                  onClick={() => {
                    toast.current.show({
                      severity: 'success',
                      summary: t("renewal.exportStarted"),
                      detail: t("renewal.performanceReportExportedToExcel"),
                      life: 3000
                    });
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* KPI Overview */}
        <div className="kpi-overview">
          <Card>
            <div className="kpi-header">
              <h3>Key Performance Indicators</h3>
              <Badge value="Current Period" severity="info" />
            </div>
            <div className="kpi-grid">
              {kpiData.map((kpi, index) => (
                <div key={index} className="kpi-item">
                  <div className="kpi-visual">
                    <Knob
                      value={kpi.inverse
                        ? Math.max(0, 100 - ((kpi.achieved - kpi.target) / kpi.target) * 100)
                        : Math.min((kpi.achieved / kpi.target) * 100, 100)}
                      size={80}
                      readOnly
                      valueColor={
                        (kpi.inverse
                          ? kpi.achieved <= kpi.target
                          : kpi.achieved >= kpi.target)
                        ? "#10B981" : "#EF4444"
                      }
                      rangeColor="#E5E7EB"
                    />
                  </div>
                  <div className="kpi-details">
                    <span className="kpi-category">{kpi.category}</span>
                    <div className="kpi-values">
                      <span className="achieved">{kpi.achieved}{kpi.unit}</span>
                      <span className="target">Target: {kpi.target}{kpi.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Performance Charts */}
        <div className="performance-charts">
          <TabView>
            <TabPanel header={t("renewal.trendAnalysis")}>
              <div className="charts-container">
                <Card className="trend-chart">
                  <div className="chart-header">
                    <h3>Renewal Rate Trend</h3>
                    <Badge value="12 months" severity="info" />
                  </div>
                  <Chart
                    type="line"
                    data={chartData.trend}
                    options={chartOptions.trend}
                    height="300px"
                  />
                </Card>
              </div>
            </TabPanel>

            <TabPanel header={t("renewal.agentPerformance")}>
              <div className="charts-container">
                <div className="charts-grid">
                  <Card className="comparison-chart">
                    <div className="chart-header">
                      <h3>Agent Performance Comparison</h3>
                      <Badge value="Dual metrics" severity="info" />
                    </div>
                    <Chart
                      type="bar"
                      data={chartData.agentComparison}
                      options={chartOptions.agentComparison}
                      height="300px"
                    />
                  </Card>

                  <Card className="leaderboard-card">
                    <div className="chart-header">
                      <h3>Agent Leaderboard</h3>
                    </div>
                    <DataTable
                      value={performanceData.byAgent || []}
                      className="leaderboard-table"
                      showGridlines={false}
                    >
                      <Column
                        body={agentRankingTemplate}
                        header={t("renewal.rank")}
                        style={{ width: '60px', textAlign: 'center' }}
                      />
                      <Column
                        body={agentNameTemplate}
                        header="Agent"
                        style={{ width: '180px' }}
                      />
                      <Column
                        body={renewalRateTemplate}
                        header={t("renewal.renewalRatePercent")}
                        style={{ width: '120px' }}
                      />
                      <Column
                        body={premiumRetainedTemplate}
                        header={t("renewal.premium")}
                        style={{ width: '140px' }}
                      />
                      <Column
                        body={cycleTimeTemplate}
                        header={t("renewal.cycleTime")}
                        style={{ width: '100px' }}
                      />
                    </DataTable>
                  </Card>
                </div>
              </div>
            </TabPanel>

            <TabPanel header={t("renewal.productPerformance")}>
              <div className="charts-container">
                <div className="charts-grid">
                  <Card className="product-chart">
                    <div className="chart-header">
                      <h3>Product Performance Distribution</h3>
                      <Badge value="Renewal rates" severity="info" />
                    </div>
                    <Chart
                      type="doughnut"
                      data={chartData.productPerformance}
                      options={chartOptions.productPerformance}
                      height="300px"
                    />
                  </Card>

                  <Card className="product-metrics">
                    <div className="chart-header">
                      <h3>Product Metrics Summary</h3>
                    </div>
                    <DataTable
                      value={[{ id: 1 }]} // Single row for product metrics
                      className="product-table"
                      showGridlines={false}
                      header={null}
                    >
                      <Column field="product" header={t("renewal.product")} body={() => t("renewal.renewalRate", "Renewal Rate")} />
                      {shownProducts.map(key => (
                        <Column key={key} body={(data) => productRateTemplate(data, key)} header={productLabel(key)} />
                      ))}
                    </DataTable>
                  </Card>
                </div>
              </div>
            </TabPanel>

            <TabPanel header={t("renewal.kpiScorecard")}>
              <div className="scorecard-container">
                <Card>
                  <div className="chart-header">
                    <h3>Performance Scorecard</h3>
                    <Badge value="vs Targets" severity="info" />
                  </div>
                  <DataTable
                    value={kpiData}
                    className="scorecard-table"
                    showGridlines={false}
                  >
                    <Column
                      field="category"
                      header={t("renewal.kpiCategory")}
                      style={{ width: '25%' }}
                    />
                    <Column
                      field="target"
                      header={t("renewal.target")}
                      style={{ width: '15%' }}
                      body={(data) => `${data.target}${data.unit}`}
                    />
                    <Column
                      field="achieved"
                      header={t("renewal.achieved")}
                      style={{ width: '15%' }}
                      body={(data) => `${data.achieved}${data.unit}`}
                    />
                    <Column
                      body={kpiAchievementTemplate}
                      header={t("renewal.achievement")}
                      style={{ width: '45%' }}
                    />
                  </DataTable>
                </Card>

                <div className="scorecard-summary">
                  <Card>
                    <div className="summary-header">
                      <h3>Performance Summary</h3>
                    </div>
                    <div className="summary-metrics">
                      <div className="summary-item">
                        <span className="metric-label">KPIs Achieved</span>
                        <span className="metric-value success">
                          {kpiData.filter(kpi =>
                            kpi.inverse
                              ? kpi.achieved <= kpi.target
                              : kpi.achieved >= kpi.target
                          ).length}/{kpiData.length}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="metric-label">Overall Score</span>
                        <span className="metric-value info">
                          {Math.round(
                            kpiData.reduce((total, kpi) => {
                              const achievement = kpi.inverse
                                ? Math.max(0, 100 - ((kpi.achieved - kpi.target) / kpi.target) * 100)
                                : (kpi.achieved / kpi.target) * 100;
                              return total + Math.min(achievement, 100);
                            }, 0) / kpiData.length
                          )}%
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="metric-label">Top Performer</span>
                        <span className="metric-value primary">
                          {performanceData.byAgent?.[0]?.agentName || '-'}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="metric-label">Improvement Area</span>
                        <span className="metric-value warning">Cycle Time</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabPanel>
          </TabView>
        </div>

        {/* Performance Insights */}
        <div className="performance-insights">
          <Card>
            <div className="insights-header">
              <h3>Performance Insights & Recommendations</h3>
              <Badge value="AI Generated" severity="success" />
            </div>
            <div className="insights-grid">
              <div className="insight-item positive">
                <div className="insight-icon">
                  <i className="pi pi-thumbs-up"></i>
                </div>
                <div className="insight-content">
                  <h4>Strong Overall Performance</h4>
                  <p>Renewal rate of 82.5% is above industry average. Ana Reyes leads with 88.2% success rate.</p>
                </div>
              </div>

              <div className="insight-item warning">
                <div className="insight-icon">
                  <i className="pi pi-clock"></i>
                </div>
                <div className="insight-content">
                  <h4>Cycle Time Optimization</h4>
                  <p>Average cycle time of 18 days exceeds target. Consider process automation for faster renewals.</p>
                </div>
              </div>

              <div className="insight-item info">
                <div className="insight-icon">
                  <i className="pi pi-chart-line"></i>
                </div>
                <div className="insight-content">
                  <h4>Marine Insurance Opportunity</h4>
                  <p>Marine insurance has lowest renewal rate at 75%. Focus on retention strategies for this segment.</p>
                </div>
              </div>

              <div className="insight-item success">
                <div className="insight-icon">
                  <i className="pi pi-star"></i>
                </div>
                <div className="insight-content">
                  <h4>Customer Satisfaction Growth</h4>
                  <p>Satisfaction improved to 4.2/5. Continue focus on customer experience excellence.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTracking;