import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import { Badge } from "primereact/badge";
import { Dialog } from "primereact/dialog";
import { MultiSelect } from "primereact/multiselect";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { calendarDateFormat, dateBody, downloadCsv, isoDate, showError } from "../shared";
import { useChartTheme } from "../../../theme/chartTheme";
import "./index.scss";

import { numberLocale } from "../../../utility/currencyConverter";
import { progressValue, roundTo } from "../../../utility/numberFormat";
const DAY_MS = 86400000;

/** Date range for a period option. */
const periodRange = (period, custom) => {
  const now = new Date();
  const to = isoDate(now);
  if (period === "Custom Range") return { from: isoDate(custom?.[0]), to: isoDate(custom?.[1]) || to };
  if (period === "Last 7 Days") return { from: isoDate(new Date(now - 7 * DAY_MS)), to };
  if (period === "This Month") return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  if (period === "Last 3 Months") return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to };
  return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to };
};

const pctChange = (current, previous) => (previous ? ((current - previous) / previous) * 100 : 0);

const RemittanceAnalytics = () => {
  const chart = useChartTheme();
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dateRange, setDateRange] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [selectedMetrics, setSelectedMetrics] = useState(["Volume", "Value", "Success Rate"]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);
  const [analytics, setAnalytics] = useState({ kpiData: [], topClients: [], monthlyTrend: [], statusDistribution: {} });
  const [topAgents, setTopAgents] = useState([]);

  const loadAnalytics = async () => {
    const range = periodRange(selectedPeriod, dateRange);
    try {
      const [data, agents] = await Promise.all([
        remittanceService.analytics(range),
        remittanceService.agencies()
      ]);
      setAnalytics(data);
      const maxCommission = Math.max(1, ...agents.map((a) => Number(a.commission || 0)));
      setTopAgents(agents.filter((a) => a.policyCount > 0).sort((a, b) => b.commission - a.commission).slice(0, 10).map((a) => ({
        agentName: a.agencyName,
        clientCount: a.policyCount,
        totalCommission: a.commission,
        avgSettlementTime: "-",
        performanceScore: Math.round((Number(a.commission || 0) / maxCommission) * 100)
      })));
    } catch (e) {
      showError(toast, e);
    }
  };

  useEffect(() => {
    if (selectedPeriod !== "Custom Range" || (dateRange?.[0] && dateRange?.[1])) loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, dateRange]);

  const { kpiData, topClients, monthlyTrend, statusDistribution } = analytics;
  const kpi = (name) => kpiData.find((k) => k.name === name) || {};
  const months = monthlyTrend.map((m) => m.month);
  const last = monthlyTrend[monthlyTrend.length - 1] || { count: 0, value: 0 };
  const prev = monthlyTrend[monthlyTrend.length - 2] || { count: 0, value: 0 };
  const totalCount = monthlyTrend.reduce((s, m) => s + m.count, 0);
  const totalValue = monthlyTrend.reduce((s, m) => s + Number(m.value || 0), 0);
  const peak = monthlyTrend.reduce((best, m) => (m.count > (best?.count ?? -1) ? m : best), null);
  const bestValue = monthlyTrend.reduce((best, m) => (m.value > (best?.value ?? -1) ? m : best), null);
  const statusTotal = Object.values(statusDistribution).reduce((s, n) => s + n, 0);

  // Chart data
  const volumeChartData = {
    labels: months,
    datasets: [
      {
        label: 'Transactions',
        data: monthlyTrend.map((m) => m.count),
        borderColor: chart.primary,
        backgroundColor: chart.alpha(chart.primary, 0.1),
        tension: 0,
        fill: false
      }
    ]
  };

  const revenueChartData = {
    labels: months,
    datasets: [
      {
        label: 'Value',
        data: monthlyTrend.map((m) => m.value),
        backgroundColor: chart.primary,
        borderWidth: 2
      }
    ]
  };

  const settlementStatusData = {
    labels: Object.keys(statusDistribution),
    datasets: [
      {
        data: Object.values(statusDistribution),
        backgroundColor: chart.statuses(Object.keys(statusDistribution)),
        borderWidth: 0
      }
    ]
  };

  const avgValue = (m) => (m.count ? Number(m.value) / m.count : 0);
  const trendRow = (id, metric, current, previous, isValue) => ({
    id, metric, current, previous, change: pctChange(current, previous), forecast: Math.max(0, current + (current - previous)), isValue
  });
  const processing = kpi("Average Processing Time");
  const trendsData = [
    trendRow(1, "Transaction Volume", last.count, prev.count, false),
    trendRow(2, "Average Transaction Value", avgValue(last), avgValue(prev), true),
    trendRow(3, "Total Value", Number(last.value || 0), Number(prev.value || 0), true),
    { id: 4, metric: "Processing Time (hours)", current: processing.value || 0, previous: processing.trend ? processing.value / (1 + processing.trend / 100) : processing.value || 0, change: processing.trend || 0, forecast: processing.value || 0 }
  ];

  const recentAlerts = kpiData.filter((k) => k.status !== "success").map((k) => ({
    id: k.id,
    type: "Performance",
    message: `${k.name} is off target (${k.value} ${k.unit} vs ${k.target} ${k.unit})`,
    severity: "warning",
    timestamp: `${analytics.from || ""} - ${analytics.to || ""}`,
    affected: "All insurers"
  }));

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

  const chartOptions = chart.options({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      },
      x: {}
    }
  });

  const pieChartOptions = chart.options({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right'
      }
    }
  });

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Number(value || 0).toFixed(1)}%`;
  };

  const formatMetric = (data, field) => (data.isValue ? formatCurrency(data[field]) : Number(data[field] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 }));

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
    return <Tag value={rowData.severity.charAt(0).toUpperCase() + rowData.severity.slice(1)} severity={rowData.severity} />;
  };
  const performanceBodyTemplate = (rowData) => {
    const value = progressValue(rowData.performanceScore);
    return (
      <div className="bv-meter">
        <ProgressBar value={value} showValue={false} />
        <span className="bv-meter__value">{`${roundTo(value, 1) ?? 0}%`}</span>
      </div>
    );
  };

  const successRateBodyTemplate = (rowData) => {
    const value = progressValue(rowData.successRate);
    return (
      <div className="bv-meter">
        <ProgressBar value={value} showValue={false} />
        <span className="bv-meter__value">{`${roundTo(value, 1) ?? 0}%`}</span>
      </div>
    );
  };

  const handleExportData = () => {
    downloadCsv(`remittance_analytics_${isoDate(new Date())}.csv`, [
      ...kpiData.map((k) => ({ section: "KPI", name: k.name, value: k.value, target: k.target, trend: k.trend })),
      ...monthlyTrend.map((m) => ({ section: "Monthly", name: m.period, value: m.value, target: m.count, trend: m.settled }))
    ], [
      { field: "section", header: "Section" },
      { field: "name", header: "Name / Period" },
      { field: "value", header: "Value" },
      { field: "target", header: "Target / Count" },
      { field: "trend", header: "Trend / Settled" }
    ]);
  };

  const handleRefreshData = () => {
    loadAnalytics();
  };

  const chartInsights = {
    volume: [
      `Latest month (${last.month || "-"}): ${last.count} remittances, ${formatPercent(pctChange(last.count, prev.count))} vs previous month`,
      `Peak volume: ${peak?.count ?? 0} remittances in ${peak?.month || "-"}`,
      `Total remittances in the last ${monthlyTrend.length} months: ${totalCount}`
    ],
    revenue: [
      `Latest month value: ${formatCurrency(last.value)} (${formatPercent(pctChange(last.value, prev.value))} vs previous month)`,
      `Best month: ${bestValue?.month || "-"} with ${formatCurrency(bestValue?.value || 0)}`,
      `Average monthly value: ${formatCurrency(monthlyTrend.length ? totalValue / monthlyTrend.length : 0)}`
    ],
    settlement: Object.entries(statusDistribution).map(([status, n]) => `${status}: ${n} (${statusTotal ? Math.round((n / statusTotal) * 100) : 0}%)`)
  };

  const insightList = (key) => (
    <div className="chart-insights">
      <h4>Key Insights:</h4>
      <ul>
        {chartInsights[key].map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );

  const detailDialogFooter = (
    <div>
      <Button
        label="Export Chart"
        icon="pi pi-download"
        className="p-button-secondary mr-2"
        onClick={handleExportData}
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
      <Toast ref={toast} />
      <div className="header-section">
        <h2>{t("remittance.analyticsDashboard")}</h2>
        <div className="header-actions">
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
            <Calendar dateFormat={calendarDateFormat()}
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
          {/* four cards hold their places until the figures arrive, so the charts below do not move */}
          {!kpiData.length && [0, 1, 2, 3].map((i) => <Card key={`placeholder-${i}`} className="kpi-card" aria-hidden="true" />)}
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
                <div className="kpi-details">
                  <div className="kpi-value">
                    {kpi.value} {kpi.unit}
                  </div>
                  <div className="kpi-target">
                    Target: {kpi.target} {kpi.unit}
                  </div>
                  {kpi.target > 0 && (
                    <div className="bv-meter">
                      <ProgressBar value={progressValue((Number(kpi.value || 0) / kpi.target) * 100)} showValue={false} />
                      <span className="bv-meter__value">{`${roundTo((Number(kpi.value || 0) / kpi.target) * 100, 1) ?? 0}% of target`}</span>
                    </div>
                  )}
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
                    <span className="stat-value">{totalCount.toLocaleString(numberLocale())}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Value</span>
                    <span className="stat-value">{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Processing Time</span>
                    <span className="stat-value">{processing.value ?? 0} hours</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Success Rate</span>
                    <span className="stat-value">{formatPercent(kpi("Payment Success Rate").value ?? 0)}</span>
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
                      body={(data) => data.transactionCount.toLocaleString(numberLocale())}
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
                  <h4>Top sales by Performance</h4>
                  <DataTable value={topAgents} stripedRows>
                    <Column field="agentName" header="Sales person" />
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
                    body={(data) => formatMetric(data, 'current')}
                  />
                  <Column
                    field="previous"
                    header="Previous"
                    body={(data) => formatMetric(data, 'previous')}
                  />
                  <Column
                    field="change"
                    header="Change"
                    body={trendBodyTemplate}
                  />
                  <Column
                    field="forecast"
                    header="Forecast"
                    body={(data) => formatMetric(data, 'forecast')}
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
                    <Column field="timestamp" header="Time" body={dateBody("timestamp")} />
                    <Column field="affected" header="Affected" />
                  </DataTable>
                </Card>

                <Card className="insights-card">
                  <h4>KPI Insights</h4>
                  <div className="insights-list">
                    {kpiData.map((k) => (
                      <div className="insight-item" key={k.id}>
                        <div className={`insight-icon ${k.status}`}>
                          <i className={`pi ${k.status === 'success' ? 'pi-thumbs-up' : 'pi-exclamation-triangle'}`} />
                        </div>
                        <div className="insight-content">
                          <strong>{k.name}</strong>
                          <p>{k.value} {k.unit} against a target of {k.target} {k.unit} ({formatPercent(k.trend)} vs previous period).</p>
                        </div>
                      </div>
                    ))}
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
              {insightList('volume')}
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
              {insightList('revenue')}
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
              {insightList('settlement')}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default RemittanceAnalytics;