import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { TabView, TabPanel } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import { Knob } from "primereact/knob";
import { Badge } from "primereact/badge";
import { renewalMockData, renewalCrudOperations } from "../../../services/mockData/renewalMockData";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";

const RetentionAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Last 12 Months');
  const [productFilter, setProductFilter] = useState('All Products');
  const [agentFilter, setAgentFilter] = useState('All Agents');
  const [dateRange, setDateRange] = useState([null, null]);
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [analyticsData, setAnalyticsData] = useState(renewalMockData.performanceMetrics);
  const toast = useRef(null);

  const timeFilterOptions = [
    { label: t("renewal.last3Months"), value: 'Last 3 Months' },
    { label: t("renewal.last6Months"), value: 'Last 6 Months' },
    { label: t("renewal.last12Months"), value: 'Last 12 Months' },
    { label: t("renewal.yearToDate"), value: 'Year to Date' },
    { label: t("renewal.customRange"), value: 'Custom Range' }
  ];

  const productFilterOptions = [
    { label: t("renewal.allProducts"), value: 'All Products' },
    { label: t("renewal.motorInsurance"), value: 'motor' },
    { label: t("renewal.fireInsurance"), value: 'fire' },
    { label: t("renewal.marineInsurance"), value: 'marine' },
    { label: t("renewal.healthInsurance"), value: 'health' },
    { label: t("renewal.personalAccident"), value: 'personalAccident' }
  ];

  const agentFilterOptions = [
    { label: t("renewal.allAgents"), value: 'All Agents' },
    { label: 'Juan Dela Cruz', value: 'Juan Dela Cruz' },
    { label: 'Ana Reyes', value: 'Ana Reyes' },
    { label: 'Carlos Mendoza', value: 'Carlos Mendoza' }
  ];

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.retentionAnalytics"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadAnalyticsData();
    setupCharts();
  }, [timeFilter, productFilter, agentFilter]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Simulate loading analytics data
      setTimeout(() => {
        // In real app, would fetch based on filters
        setAnalyticsData(renewalMockData.performanceMetrics);
        setLoading(false);

        toast.current.show({
          severity: 'success',
          summary: t("renewal.dataLoaded"),
          detail: t("renewal.analyticsDataUpdatedSuccess"),
          life: 3000
        });
      }, 1000);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: t("renewal.failedToLoadAnalyticsData"),
        life: 3000
      });
      setLoading(false);
    }
  };

  const setupCharts = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const primaryColor = documentStyle.getPropertyValue('--primary-color') || '#3B82F6';
    const successColor = documentStyle.getPropertyValue('--green-500') || '#10B981';
    const warningColor = documentStyle.getPropertyValue('--yellow-500') || '#F59E0B';
    const dangerColor = documentStyle.getPropertyValue('--red-500') || '#EF4444';

    // Renewal Rate Trend Chart
    const renewalTrendData = {
      labels: analyticsData.trends?.monthly?.map(item => item.month) || [],
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: analyticsData.trends?.monthly?.map(item => item.rate) || [],
          fill: true,
          backgroundColor: `${primaryColor}20`,
          borderColor: primaryColor,
          borderWidth: 2,
          tension: 0.4
        }
      ]
    };

    // Product Performance Chart
    const productData = {
      labels: ['Motor', 'Fire', 'Marine', 'Health', 'Personal Accident'],
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: [
            analyticsData.byProduct?.motor?.renewalRate || 0,
            analyticsData.byProduct?.fire?.renewalRate || 0,
            analyticsData.byProduct?.marine?.renewalRate || 0,
            analyticsData.byProduct?.health?.renewalRate || 0,
            analyticsData.byProduct?.personalAccident?.renewalRate || 0
          ],
          backgroundColor: [primaryColor, successColor, warningColor, dangerColor, '#8B5CF6'],
          borderWidth: 0
        }
      ]
    };

    // Agent Performance Chart
    const agentData = {
      labels: analyticsData.byAgent?.map(agent => agent.agentName.split(' ')[0]) || [],
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: analyticsData.byAgent?.map(agent => agent.renewalRate) || [],
          backgroundColor: primaryColor,
          borderWidth: 0
        },
        {
          label: 'Premium Retained (M)',
          data: analyticsData.byAgent?.map(agent => agent.premiumRetained / 1000000) || [],
          backgroundColor: successColor,
          borderWidth: 0,
          yAxisID: 'y1'
        }
      ]
    };

    // Risk Distribution Chart
    const riskData = {
      labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
      datasets: [
        {
          data: [45, 30, 20, 5], // Sample distribution
          backgroundColor: [successColor, warningColor, dangerColor, '#DC2626'],
          borderWidth: 0
        }
      ]
    };

    setChartData({
      renewalTrend: renewalTrendData,
      productPerformance: productData,
      agentPerformance: agentData,
      riskDistribution: riskData
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
      renewalTrend: {
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
      productPerformance: {
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
      agentPerformance: {
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
                return '₱' + value + 'M';
              }
            }
          }
        }
      },
      riskDistribution: {
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

  const getRiskSeverity = (risk) => {
    if (risk >= 90) return 'danger';
    if (risk >= 70) return 'warning';
    if (risk >= 50) return 'info';
    return 'success';
  };

  const agentRankingTemplate = (rowData) => {
    const getRankIcon = (rank) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return rank;
      }
    };

    return (
      <div className="rank-cell">
        <span className="rank-icon">{getRankIcon(rowData.ranking)}</span>
        <span className="rank-number">#{rowData.ranking}</span>
      </div>
    );
  };

  const renewalRateTemplate = (rowData) => {
    return (
      <div className="rate-cell">
        <ProgressBar value={rowData.renewalRate} style={{ width: '80px', height: '8px' }} />
        <span>{formatPercentage(rowData.renewalRate)}</span>
      </div>
    );
  };

  const premiumTemplate = (rowData) => {
    return formatCurrency(rowData.premiumRetained);
  };

  const cycleTimeTemplate = (rowData) => {
    const getTimeColor = (days) => {
      if (days <= 14) return 'success';
      if (days <= 21) return 'warning';
      return 'danger';
    };

    return (
      <Tag value={`${rowData.avgCycleTime} days`} severity={getTimeColor(rowData.avgCycleTime)} />
    );
  };

  return (
    <div className="container__retention__analytics__master">
      <Toast ref={toast} />

      <div className="top__container">
        <h1 className="page__title">{t("renewal.retentionAnalytics")}</h1>
        <BreadCrumb model={items} home={home} />
      </div>

      <div className="content-container">
        {/* Filters Section */}
        <div className="filters-section">
          <Card>
            <div className="filters-grid">
              <div className="filter-field">
                <label>{t("renewal.timePeriod")}</label>
                <Dropdown
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.value)}
                  options={timeFilterOptions}
                />
              </div>

              <div className="filter-field">
                <label>{t("renewal.productLine")}</label>
                <Dropdown
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.value)}
                  options={productFilterOptions}
                />
              </div>

              <div className="filter-field">
                <label>{t("renewal.agent")}</label>
                <Dropdown
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.value)}
                  options={agentFilterOptions}
                />
              </div>

              {timeFilter === 'Custom Range' && (
                <div className="filter-field">
                  <label>Date Range</label>
                  <Calendar
                    value={dateRange}
                    onChange={(e) => setDateRange(e.value)}
                    selectionMode="range"
                    dateFormat="mm/dd/yy"
                  />
                </div>
              )}

              <div className="filter-actions">
                <Button
                  label="Apply Filters"
                  icon="pi pi-filter"
                  onClick={loadAnalyticsData}
                  loading={loading}
                />
                <Button
                  label="Export Report"
                  icon="pi pi-file-excel"
                  className="p-button-secondary"
                  onClick={() => {
                    toast.current.show({
                      severity: 'success',
                      summary: 'Export Started',
                      detail: 'Analytics report exported to Excel',
                      life: 3000
                    });
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="kpi-cards">
          <Card className="kpi-card primary">
            <div className="kpi-content">
              <div className="kpi-visual">
                <Knob
                  value={analyticsData.overall?.renewalRate}
                  size={80}
                  readOnly
                  valueColor="#3B82F6"
                  rangeColor="#E5E7EB"
                />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Overall Renewal Rate</span>
                <span className="kpi-value">{formatPercentage(analyticsData.overall?.renewalRate)}</span>
                <span className="kpi-change positive">+2.3% vs last period</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card success">
            <div className="kpi-content">
              <div className="kpi-visual">
                <Knob
                  value={analyticsData.overall?.premiumRetention}
                  size={80}
                  readOnly
                  valueColor="#10B981"
                  rangeColor="#E5E7EB"
                />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Premium Retention</span>
                <span className="kpi-value">{formatPercentage(analyticsData.overall?.premiumRetention)}</span>
                <span className="kpi-change positive">+1.8% vs last period</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card warning">
            <div className="kpi-content">
              <div className="kpi-visual">
                <div className="cycle-time-visual">
                  <i className="pi pi-clock"></i>
                  <span className="cycle-days">{analyticsData.overall?.avgCycleTime}</span>
                </div>
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Avg Cycle Time</span>
                <span className="kpi-value">{analyticsData.overall?.avgCycleTime} days</span>
                <span className="kpi-change negative">+1.2 days vs last period</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card info">
            <div className="kpi-content">
              <div className="kpi-visual">
                <div className="satisfaction-visual">
                  <i className="pi pi-star-fill"></i>
                  <span className="rating">{analyticsData.overall?.customerSatisfaction}</span>
                </div>
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Customer Satisfaction</span>
                <span className="kpi-value">{analyticsData.overall?.customerSatisfaction}/5.0</span>
                <span className="kpi-change positive">+0.3 vs last period</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <TabView>
            <TabPanel header="Trend Analysis">
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Renewal Rate Trend</h3>
                    <Badge value="12 months" severity="info" />
                  </div>
                  <div className="chart-container">
                    <Chart
                      type="line"
                      data={chartData.renewalTrend}
                      options={chartOptions.renewalTrend}
                      height="300px"
                    />
                  </div>
                </Card>
              </div>
            </TabPanel>

            <TabPanel header="Product Performance">
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Renewal Rate by Product</h3>
                    <Badge value="Current period" severity="info" />
                  </div>
                  <div className="chart-container">
                    <Chart
                      type="bar"
                      data={chartData.productPerformance}
                      options={chartOptions.productPerformance}
                      height="300px"
                    />
                  </div>
                </Card>

                <Card className="product-metrics">
                  <div className="chart-header">
                    <h3>Product Metrics</h3>
                  </div>
                  <div className="product-list">
                    {Object.entries(analyticsData.byProduct || {}).map(([key, product]) => (
                      <div key={key} className="product-item">
                        <div className="product-info">
                          <span className="product-name">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                          <span className="product-rate">{formatPercentage(product.renewalRate)}</span>
                        </div>
                        <div className="product-premium">
                          <span>Avg Premium: {formatCurrency(product.avgPremium)}</span>
                        </div>
                        <ProgressBar value={product.renewalRate} style={{ height: '6px' }} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabPanel>

            <TabPanel header="Agent Performance">
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Agent Performance Comparison</h3>
                    <Badge value="Dual axis" severity="info" />
                  </div>
                  <div className="chart-container">
                    <Chart
                      type="bar"
                      data={chartData.agentPerformance}
                      options={chartOptions.agentPerformance}
                      height="300px"
                    />
                  </div>
                </Card>

                <Card className="agent-leaderboard">
                  <div className="chart-header">
                    <h3>Agent Leaderboard</h3>
                  </div>
                  <DataTable
                    value={analyticsData.byAgent || []}
                    className="leaderboard-table"
                  >
                    <Column
                      body={agentRankingTemplate}
                      header="Rank"
                      style={{ width: '80px' }}
                    />
                    <Column
                      field="agentName"
                      header="Agent"
                      style={{ width: '140px' }}
                    />
                    <Column
                      body={renewalRateTemplate}
                      header="Renewal Rate"
                      style={{ width: '120px' }}
                    />
                    <Column
                      field="policiesRenewed"
                      header="Policies"
                      style={{ width: '80px', textAlign: 'center' }}
                    />
                    <Column
                      body={premiumTemplate}
                      header="Premium"
                      style={{ width: '120px' }}
                    />
                    <Column
                      body={cycleTimeTemplate}
                      header="Cycle Time"
                      style={{ width: '100px' }}
                    />
                  </DataTable>
                </Card>
              </div>
            </TabPanel>

            <TabPanel header="Risk Analysis">
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Risk Distribution</h3>
                    <Badge value="Current portfolio" severity="info" />
                  </div>
                  <div className="chart-container">
                    <Chart
                      type="doughnut"
                      data={chartData.riskDistribution}
                      options={chartOptions.riskDistribution}
                      height="300px"
                    />
                  </div>
                </Card>

                <Card className="risk-metrics">
                  <div className="chart-header">
                    <h3>Risk Indicators</h3>
                  </div>
                  <div className="risk-indicators">
                    <div className="risk-indicator">
                      <div className="indicator-header">
                        <span>Policies at Risk</span>
                        <Badge value="24" severity="danger" />
                      </div>
                      <ProgressBar value={15} className="risk-bar danger" />
                      <span className="indicator-text">15% of total portfolio</span>
                    </div>

                    <div className="risk-indicator">
                      <div className="indicator-header">
                        <span>High Claims Ratio</span>
                        <Badge value="8" severity="warning" />
                      </div>
                      <ProgressBar value={5} className="risk-bar warning" />
                      <span className="indicator-text">5% of total portfolio</span>
                    </div>

                    <div className="risk-indicator">
                      <div className="indicator-header">
                        <span>Payment Issues</span>
                        <Badge value="12" severity="info" />
                      </div>
                      <ProgressBar value={8} className="risk-bar info" />
                      <span className="indicator-text">8% of total portfolio</span>
                    </div>

                    <div className="risk-indicator">
                      <div className="indicator-header">
                        <span>Competitor Activity</span>
                        <Badge value="6" severity="secondary" />
                      </div>
                      <ProgressBar value={4} className="risk-bar secondary" />
                      <span className="indicator-text">4% of total portfolio</span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabPanel>
          </TabView>
        </div>

        {/* Action Items */}
        <div className="action-section">
          <Card>
            <div className="action-header">
              <h3>Recommended Actions</h3>
              <Badge value="Priority" severity="danger" />
            </div>
            <div className="action-items">
              <div className="action-item high">
                <div className="action-content">
                  <i className="pi pi-exclamation-triangle"></i>
                  <div className="action-text">
                    <h4>Focus on Marine Insurance Renewals</h4>
                    <p>Marine insurance has the lowest renewal rate at 75%. Consider targeted retention campaigns.</p>
                  </div>
                </div>
                <Button label="Take Action" className="p-button-danger p-button-sm" />
              </div>

              <div className="action-item medium">
                <div className="action-content">
                  <i className="pi pi-clock"></i>
                  <div className="action-text">
                    <h4>Reduce Cycle Time</h4>
                    <p>Average cycle time increased by 1.2 days. Review and optimize renewal processes.</p>
                  </div>
                </div>
                <Button label="Take Action" className="p-button-warning p-button-sm" />
              </div>

              <div className="action-item low">
                <div className="action-content">
                  <i className="pi pi-users"></i>
                  <div className="action-text">
                    <h4>Agent Training Opportunity</h4>
                    <p>Carlos Mendoza's performance is below average. Consider additional training or support.</p>
                  </div>
                </div>
                <Button label="Take Action" className="p-button-info p-button-sm" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RetentionAnalytics;