import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputText } from "primereact/inputtext";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Knob } from "primereact/knob";
import { Tag } from "primereact/tag";
import { Timeline } from "primereact/timeline";
import { Badge } from "primereact/badge";
import { Dialog } from "primereact/dialog";
import { MultiSelect } from "primereact/multiselect";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const RemittanceAnalytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dateRange, setDateRange] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [selectedMetrics, setSelectedMetrics] = useState(["Volume", "Value", "Success Rate"]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);

  // Chart data
  const volumeChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      {
        label: 'Transactions',
        data: [45000, 52000, 48000, 61000, 55000, 67000, 72000, 69000, 74000],
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const revenueChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      {
        label: 'Revenue ($M)',
        data: [2.4, 2.8, 2.6, 3.2, 2.9, 3.5, 3.8, 3.6, 3.9],
        backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#e83e8c', '#6c757d'],
        borderWidth: 2
      }
    ]
  };

  const settlementStatusData = {
    labels: ['Completed', 'Processing', 'Pending', 'Failed'],
    datasets: [
      {
        data: [85, 10, 3, 2],
        backgroundColor: ['#28a745', '#007bff', '#ffc107', '#dc3545'],
        borderWidth: 0
      }
    ]
  };

  // KPI data
  const kpiData = [
    {
      id: 1,
      name: "Settlement Efficiency",
      value: 92,
      target: 95,
      trend: 2.1,
      status: "warning",
      unit: "%",
      description: "Average settlement completion rate"
    },
    {
      id: 2,
      name: "Payment Success Rate",
      value: 97,
      target: 95,
      trend: 1.5,
      status: "success",
      unit: "%",
      description: "Successful payment processing rate"
    },
    {
      id: 3,
      name: "Average Processing Time",
      value: 18,
      target: 24,
      trend: -12.3,
      status: "success",
      unit: "hours",
      description: "Time from initiation to completion"
    },
    {
      id: 4,
      name: "Exception Rate",
      value: 3.2,
      target: 5,
      trend: -0.8,
      status: "success",
      unit: "%",
      description: "Transactions requiring manual intervention"
    }
  ];

  // Top performers data
  const topClients = [
    {
      clientName: "ABC Insurance Co",
      transactionCount: 1250,
      totalValue: 15600000,
      avgProcessingTime: 16,
      successRate: 98.5
    },
    {
      clientName: "XYZ Corp",
      transactionCount: 890,
      totalValue: 12400000,
      avgProcessingTime: 14,
      successRate: 99.1
    },
    {
      clientName: "DEF Ltd",
      transactionCount: 670,
      totalValue: 8900000,
      avgProcessingTime: 18,
      successRate: 97.3
    },
    {
      clientName: "GHI Group",
      transactionCount: 445,
      totalValue: 6700000,
      avgProcessingTime: 20,
      successRate: 96.8
    }
  ];

  const topAgents = [
    {
      agentName: "John Smith",
      clientCount: 45,
      totalCommission: 125000,
      avgSettlementTime: 12,
      performanceScore: 94
    },
    {
      agentName: "Sarah Johnson",
      clientCount: 38,
      totalCommission: 110000,
      avgSettlementTime: 15,
      performanceScore: 91
    },
    {
      agentName: "Mike Wilson",
      clientCount: 32,
      totalCommission: 89000,
      avgSettlementTime: 14,
      performanceScore: 89
    }
  ];

  // Trends data
  const trendsData = [
    {
      id: 1,
      metric: "Transaction Volume",
      current: 74000,
      previous: 69000,
      change: 7.2,
      forecast: 78000
    },
    {
      id: 2,
      metric: "Average Transaction Value",
      current: 52750,
      previous: 49200,
      change: 7.2,
      forecast: 55200
    },
    {
      id: 3,
      metric: "Processing Time",
      current: 18,
      previous: 22,
      change: -18.2,
      forecast: 16
    },
    {
      id: 4,
      metric: "Customer Satisfaction",
      current: 4.6,
      previous: 4.3,
      change: 7.0,
      forecast: 4.7
    }
  ];

  // Recent alerts
  const recentAlerts = [
    {
      id: 1,
      type: "Performance",
      message: "Settlement efficiency dropped below target (92% vs 95%)",
      severity: "warning",
      timestamp: "2025-09-26 14:30",
      affected: "All regions"
    },
    {
      id: 2,
      type: "Volume",
      message: "Unusual spike in transaction volume detected (+25%)",
      severity: "info",
      timestamp: "2025-09-26 10:15",
      affected: "North region"
    },
    {
      id: 3,
      type: "Exception",
      message: "High exception rate detected for client ABC Corp (8.5%)",
      severity: "warning",
      timestamp: "2025-09-26 09:45",
      affected: "ABC Corp"
    }
  ];

  const periodOptions = [
    { label: "Last 7 Days", value: "Last 7 Days" },
    { label: "This Month", value: "This Month" },
    { label: "Last 3 Months", value: "Last 3 Months" },
    { label: "This Year", value: "This Year" },
    { label: "Custom Range", value: "Custom Range" }
  ];

  const metricsOptions = [
    { label: "Volume", value: "Volume" },
    { label: "Value", value: "Value" },
    { label: "Success Rate", value: "Success Rate" },
    { label: "Processing Time", value: "Processing Time" },
    { label: "Exception Rate", value: "Exception Rate" }
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f0f0f0'
        }
      },
      x: {
        grid: {
          color: '#f0f0f0'
        }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right'
      }
    }
  };

  const getKpiStatus = (value, target, isReverse = false) => {
    const percentage = (value / target) * 100;
    if (isReverse) {
      return percentage <= 80 ? 'success' : percentage <= 100 ? 'warning' : 'danger';
    }
    return percentage >= 100 ? 'success' : percentage >= 80 ? 'warning' : 'danger';
  };

  const getKpiColor = (status) => {
    switch (status) {
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      case 'danger': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const trendBodyTemplate = (rowData) => {
    const isPositive = rowData.change >= 0;
    return (
      <div className={`trend ${isPositive ? 'positive' : 'negative'}`}>
        <i className={`pi ${isPositive ? 'pi-arrow-up' : 'pi-arrow-down'}`} />
        <span>{formatPercent(rowData.change)}</span>
      </div>
    );
  };

  const severityBodyTemplate = (rowData) => {
    const getSeverity = (severity) => {
      switch (severity) {
        case 'info': return 'info';
        case 'warning': return 'warning';
        case 'danger': return 'danger';
        default: return null;
      }
    };
    return <Tag value={rowData.severity.toUpperCase()} severity={getSeverity(rowData.severity)} />;
  };

  const performanceBodyTemplate = (rowData) => {
    return <ProgressBar value={rowData.performanceScore} className="performance-bar" />;
  };

  const successRateBodyTemplate = (rowData) => {
    return (
      <div className="success-rate">
        <span>{rowData.successRate}%</span>
        <ProgressBar value={rowData.successRate} className="rate-bar" showValue={false} />
      </div>
    );
  };

  const handleBackToMaster = () => {
    navigate("/master/finance/remittance");
  };

  const handleExportData = () => {
    console.log("Exporting analytics data");
  };

  const handleRefreshData = () => {
    console.log("Refreshing analytics data");
  };

  const detailDialogFooter = (
    <div>
      <Button
        label="Export Chart"
        icon="pi pi-download"
        className="p-button-secondary mr-2"
      />
      <Button
        label="Close"
        icon="pi pi-times"
        onClick={() => setShowDetailDialog(false)}
        className="p-button-text"
      />
    </div>
  );

  return (
    <div className="remittance-analytics">
      <div className="header-section">
        <h2>{t("remittance.analyticsDashboard")}</h2>
        <div className="header-actions">
          <Button
            label="Back to Master"
            icon="pi pi-arrow-left"
            className="p-button-secondary mr-2"
            onClick={handleBackToMaster}
          />
          <Button
            label="Export"
            icon="pi pi-download"
            className="p-button-outlined mr-2"
            onClick={handleExportData}
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            className="p-button-outlined"
            onClick={handleRefreshData}
          />
        </div>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <label>Time Period:</label>
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => setSelectedPeriod(e.value)}
            className="period-dropdown"
          />
        </div>
        {selectedPeriod === "Custom Range" && (
          <div className="control-group">
            <label>Date Range:</label>
            <Calendar
              value={dateRange}
              onChange={(e) => setDateRange(e.value)}
              selectionMode="range"
              placeholder="Select date range"
            />
          </div>
        )}
        <div className="control-group">
          <label>Metrics:</label>
          <MultiSelect
            value={selectedMetrics}
            options={metricsOptions}
            onChange={(e) => setSelectedMetrics(e.value)}
            display="chip"
            className="metrics-selector"
          />
        </div>
      </div>

      <div className="kpi-section">
        <div className="kpi-grid">
          {kpiData.map(kpi => (
            <Card key={kpi.id} className="kpi-card">
              <div className="kpi-content">
                <div className="kpi-header">
                  <h4>{kpi.name}</h4>
                  <div className={`kpi-trend ${kpi.trend >= 0 ? 'positive' : 'negative'}`}>
                    <i className={`pi ${kpi.trend >= 0 ? 'pi-arrow-up' : 'pi-arrow-down'}`} />
                    <span>{formatPercent(kpi.trend)}</span>
                  </div>
                </div>
                <div className="kpi-gauge">
                  <Knob
                    value={kpi.value}
                    max={kpi.unit === '%' ? 100 : kpi.target * 1.5}
                    size={80}
                    valueColor={getKpiColor(kpi.status)}
                    rangeColor="#e9ecef"
                    textColor="#495057"
                    strokeWidth={8}
                    readOnly
                  />
                </div>
                <div className="kpi-details">
                  <div className="kpi-value">
                    {kpi.value} {kpi.unit}
                  </div>
                  <div className="kpi-target">
                    Target: {kpi.target} {kpi.unit}
                  </div>
                  <div className="kpi-description">
                    {kpi.description}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="Performance Overview">
            <div className="charts-grid">
              <Card className="chart-card">
                <h4>Transaction Volume Trend</h4>
                <div className="chart-container">
                  <Chart
                    type="line"
                    data={volumeChartData}
                    options={chartOptions}
                    onClick={() => {
                      setSelectedChart('volume');
                      setShowDetailDialog(true);
                    }}
                  />
                </div>
              </Card>

              <Card className="chart-card">
                <h4>Revenue Analysis</h4>
                <div className="chart-container">
                  <Chart
                    type="bar"
                    data={revenueChartData}
                    options={chartOptions}
                    onClick={() => {
                      setSelectedChart('revenue');
                      setShowDetailDialog(true);
                    }}
                  />
                </div>
              </Card>

              <Card className="chart-card">
                <h4>Settlement Status Distribution</h4>
                <div className="chart-container">
                  <Chart
                    type="pie"
                    data={settlementStatusData}
                    options={pieChartOptions}
                    onClick={() => {
                      setSelectedChart('settlement');
                      setShowDetailDialog(true);
                    }}
                  />
                </div>
              </Card>

              <Card className="chart-card summary-stats">
                <h4>Key Statistics</h4>
                <div className="stats-list">
                  <div className="stat-item">
                    <span className="stat-label">Total Transactions</span>
                    <span className="stat-value">74,000</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Value</span>
                    <span className="stat-value">$3.9M</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Processing Time</span>
                    <span className="stat-value">18 hours</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Success Rate</span>
                    <span className="stat-value">97%</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabPanel>

          <TabPanel header="Top Performers">
            <div className="performers-section">
              <div className="performers-grid">
                <Card className="performers-card">
                  <h4>Top Clients by Volume</h4>
                  <DataTable value={topClients} stripedRows>
                    <Column field="clientName" header="Client" />
                    <Column
                      field="transactionCount"
                      header="Transactions"
                      body={(data) => data.transactionCount.toLocaleString()}
                    />
                    <Column
                      field="totalValue"
                      header="Total Value"
                      body={(data) => formatCurrency(data.totalValue)}
                    />
                    <Column
                      field="avgProcessingTime"
                      header="Avg Time (hrs)"
                    />
                    <Column
                      field="successRate"
                      header="Success Rate"
                      body={successRateBodyTemplate}
                    />
                  </DataTable>
                </Card>

                <Card className="performers-card">
                  <h4>Top Agents by Performance</h4>
                  <DataTable value={topAgents} stripedRows>
                    <Column field="agentName" header="Agent" />
                    <Column field="clientCount" header="Clients" />
                    <Column
                      field="totalCommission"
                      header="Commission"
                      body={(data) => formatCurrency(data.totalCommission)}
                    />
                    <Column
                      field="avgSettlementTime"
                      header="Avg Time (hrs)"
                    />
                    <Column
                      field="performanceScore"
                      header="Performance"
                      body={performanceBodyTemplate}
                    />
                  </DataTable>
                </Card>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Trends & Forecasts">
            <div className="trends-section">
              <Card>
                <h4>Key Metrics Trends</h4>
                <DataTable value={trendsData} stripedRows>
                  <Column field="metric" header="Metric" />
                  <Column
                    field="current"
                    header="Current"
                    body={(data) => {
                      if (data.metric.includes('Value') || data.metric.includes('Commission')) {
                        return formatCurrency(data.current);
                      }
                      return data.current.toLocaleString();
                    }}
                  />
                  <Column
                    field="previous"
                    header="Previous"
                    body={(data) => {
                      if (data.metric.includes('Value') || data.metric.includes('Commission')) {
                        return formatCurrency(data.previous);
                      }
                      return data.previous.toLocaleString();
                    }}
                  />
                  <Column
                    field="change"
                    header="Change"
                    body={trendBodyTemplate}
                  />
                  <Column
                    field="forecast"
                    header="Forecast"
                    body={(data) => {
                      if (data.metric.includes('Value') || data.metric.includes('Commission')) {
                        return formatCurrency(data.forecast);
                      }
                      return data.forecast.toLocaleString();
                    }}
                  />
                </DataTable>
              </Card>
            </div>
          </TabPanel>

          <TabPanel header="Alerts & Insights">
            <div className="alerts-section">
              <div className="alerts-grid">
                <Card className="alerts-card">
                  <h4>Recent Alerts <Badge value={recentAlerts.length} severity="danger" className="ml-2" /></h4>
                  <DataTable value={recentAlerts} stripedRows>
                    <Column field="type" header="Type" />
                    <Column field="message" header="Message" />
                    <Column field="severity" header="Severity" body={severityBodyTemplate} />
                    <Column field="timestamp" header="Time" />
                    <Column field="affected" header="Affected" />
                  </DataTable>
                </Card>

                <Card className="insights-card">
                  <h4>AI Insights</h4>
                  <div className="insights-list">
                    <div className="insight-item">
                      <div className="insight-icon success">
                        <i className="pi pi-thumbs-up" />
                      </div>
                      <div className="insight-content">
                        <strong>Performance Improvement</strong>
                        <p>Settlement efficiency has improved by 5% this quarter compared to last quarter.</p>
                      </div>
                    </div>
                    <div className="insight-item">
                      <div className="insight-icon warning">
                        <i className="pi pi-exclamation-triangle" />
                      </div>
                      <div className="insight-content">
                        <strong>Potential Risk</strong>
                        <p>Predicted 15% increase in transaction volume next month. Consider capacity planning.</p>
                      </div>
                    </div>
                    <div className="insight-item">
                      <div className="insight-icon info">
                        <i className="pi pi-info-circle" />
                      </div>
                      <div className="insight-content">
                        <strong>Optimization Opportunity</strong>
                        <p>Automating exception handling could reduce processing time by 20%.</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header="Detailed Chart View"
        visible={showDetailDialog}
        style={{ width: '80vw', height: '70vh' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
        maximizable
      >
        <div className="chart-detail">
          {selectedChart === 'volume' && (
            <div>
              <h3>Transaction Volume Analysis</h3>
              <div className="detail-chart-container">
                <Chart
                  type="line"
                  data={volumeChartData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: 'Monthly Transaction Volume Trend'
                      }
                    }
                  }}
                />
              </div>
              <div className="chart-insights">
                <h4>Key Insights:</h4>
                <ul>
                  <li>Steady growth trend with 7.2% increase from August to September</li>
                  <li>Peak volume of 74,000 transactions in September</li>
                  <li>Consistent month-over-month growth since June</li>
                  <li>Projected to reach 78,000 transactions in October</li>
                </ul>
              </div>
            </div>
          )}
          {selectedChart === 'revenue' && (
            <div>
              <h3>Revenue Analysis</h3>
              <div className="detail-chart-container">
                <Chart
                  type="bar"
                  data={revenueChartData}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: 'Monthly Revenue Performance'
                      }
                    }
                  }}
                />
              </div>
              <div className="chart-insights">
                <h4>Key Insights:</h4>
                <ul>
                  <li>Revenue increased 8.3% from August to September ($3.6M to $3.9M)</li>
                  <li>Best performing month: September with $3.9M revenue</li>
                  <li>Average monthly revenue: $3.1M</li>
                  <li>Revenue per transaction has increased 1.1% month-over-month</li>
                </ul>
              </div>
            </div>
          )}
          {selectedChart === 'settlement' && (
            <div>
              <h3>Settlement Status Distribution</h3>
              <div className="detail-chart-container">
                <Chart
                  type="pie"
                  data={settlementStatusData}
                  options={{
                    ...pieChartOptions,
                    plugins: {
                      ...pieChartOptions.plugins,
                      title: {
                        display: true,
                        text: 'Current Settlement Status Breakdown'
                      }
                    }
                  }}
                />
              </div>
              <div className="chart-insights">
                <h4>Key Insights:</h4>
                <ul>
                  <li>85% of settlements are completed successfully</li>
                  <li>10% are currently in processing</li>
                  <li>Only 3% are pending action</li>
                  <li>Failure rate maintained at low 2%</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default RemittanceAnalytics;