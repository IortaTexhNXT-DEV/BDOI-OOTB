import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import renewalsWorkspaceService, { periodRange, productLabel } from "../../../services/renewalsWorkspaceService";
import SvgDot from "../../../assets/icons/SvgDot";
import { calendarDateFormat, toIsoDate } from "../../../utility/dateFormat";
import { downloadCsv } from "../../../utility/csvExport";
import "./index.scss";
import { currencySymbol } from "../../../utility/currencyConverter";
import { formatPercent, formatWithUnit, progressValue } from "../../../utility/numberFormat";

const RetentionAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Last 12 Months');
  const [productFilter, setProductFilter] = useState('All Products');
  const [agentFilter, setAgentFilter] = useState('All Agents');
  const [dateRange, setDateRange] = useState([null, null]);
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [analyticsData, setAnalyticsData] = useState({});
  const [riskCounts, setRiskCounts] = useState({});
  const [queueItems, setQueueItems] = useState([]);
  const toast = useRef(null);

  const timeFilterOptions = [
    { label: t("renewal.last3Months"), value: 'Last 3 Months' },
    { label: t("renewal.last6Months"), value: 'Last 6 Months' },
    { label: t("renewal.last12Months"), value: 'Last 12 Months' },
    { label: t("renewal.yearToDate"), value: 'Year to Date' },
    { label: t("renewal.customRange"), value: 'Custom Range' }
  ];

  const productKeys = Object.keys(analyticsData.byProduct || {});
  const productFilterOptions = [
    { label: t("renewal.allProducts"), value: 'All Products' },
    ...productKeys.map(key => ({ label: productLabel(key), value: key }))
  ];
  const shownProducts = productFilter === 'All Products' ? productKeys : productKeys.filter(key => key === productFilter);

  const agentFilterOptions = [
    { label: t("renewal.allAgents"), value: 'All Agents' },
    ...(analyticsData.byAgent || []).map(agent => ({ label: agent.agentName, value: agent.agentName }))
  ];
  const shownAgents = (analyticsData.byAgent || []).filter(agent => agentFilter === 'All Agents' || agent.agentName === agentFilter);

  const items = [
    { label: t("renewal.renewals"), url: "#" },
    { label: t("renewal.retentionAnalytics"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  useEffect(() => {
    loadAnalyticsData();
  }, [timeFilter, dateRange]);

  useEffect(() => {
    setupCharts();
  }, [analyticsData, riskCounts, productFilter, agentFilter]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [performance, queue] = await Promise.all([
        renewalsWorkspaceService.getPerformance(periodRange(timeFilter, dateRange)),
        renewalsWorkspaceService.getQueue()
      ]);
      setAnalyticsData(performance);
      setQueueItems(queue.items || []);
      setRiskCounts(queue.items.reduce((counts, item) => ({ ...counts, [item.retentionRisk]: (counts[item.retentionRisk] || 0) + 1 }), {}));
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: error?.message || t("renewal.failedToLoadAnalyticsData"),
        life: 3000
      });
    } finally {
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
          fill: false,
          backgroundColor: `${primaryColor}20`,
          borderColor: primaryColor,
          borderWidth: 2,
          tension: 0
        }
      ]
    };

    // Product Performance Chart
    const productData = {
      labels: shownProducts.map(productLabel),
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: shownProducts.map(key => analyticsData.byProduct[key]?.renewalRate || 0),
          backgroundColor: [primaryColor, successColor, warningColor, dangerColor, '#8B5CF6'],
          borderWidth: 0
        }
      ]
    };

    // Agent Performance Chart
    const agentData = {
      labels: shownAgents.map(agent => agent.agentName.split(' ')[0]),
      datasets: [
        {
          label: 'Renewal Rate (%)',
          data: shownAgents.map(agent => agent.renewalRate),
          backgroundColor: primaryColor,
          borderWidth: 0
        },
        {
          label: 'Premium Retained (M)',
          data: shownAgents.map(agent => agent.premiumRetained / 1000000),
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
          data: ['Low', 'Medium', 'High', 'Critical'].map(level => riskCounts[level] || 0),
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
                return currencySymbol() + value + 'M';
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

  const formatPercentage = (value, decimals = 1) => formatPercent(value ?? 0, { decimals });

  // indicators of the open renewals (Renewal Queue), as counts and shares of the open renewals
  const openCount = queueItems.length;
  const share = (n) => (openCount ? Math.round((n / openCount) * 100) : 0);
  const indicator = (key, label, count) => ({ key, label, count, pct: share(count) });
  const riskIndicators = [
    indicator("risk", t("renewal.indicatorAtRisk"), queueItems.filter((i) => ["High", "Critical"].includes(i.retentionRisk)).length),
    indicator("claims", t("renewal.indicatorClaims"), queueItems.filter((i) => Number(i.claimsHistory?.totalClaims) > 0).length),
    indicator("unpaid", t("renewal.indicatorUnpaid"), queueItems.filter((i) => Number(i.outstandingPremium) > 0).length),
    indicator("contact", t("renewal.indicatorNoContact"), queueItems.filter((i) => !i.contactAttempts && !i.noticeStage).length),
  ];

  // actions drawn from the figures on this page: the weakest line and sales person, unpaid and uncontacted renewals
  const recommendedActions = (() => {
    const out = [];
    const overall = Number(analyticsData.overall?.renewalRate) || 0;
    const lines = productKeys.map((k) => ({ k, ...analyticsData.byProduct[k] })).filter((l) => (l.renewed || 0) + (l.lapsed || 0) > 0);
    const weakLine = lines.sort((x, y) => x.renewalRate - y.renewalRate)[0];
    if (weakLine && weakLine.renewalRate < overall) {
      out.push({ key: "line", title: t("renewal.actionLineTitle", { line: productLabel(weakLine.k) }), text: t("renewal.actionLineText", { rate: formatPercentage(weakLine.renewalRate), overall: formatPercentage(overall) }) });
    }
    const people = (analyticsData.byAgent || []).filter((a) => a.agentName && (a.policiesRenewed || 0) > 0);
    const weakPerson = [...people].sort((x, y) => x.renewalRate - y.renewalRate)[0];
    if (people.length > 1 && weakPerson && weakPerson.renewalRate < overall) {
      out.push({ key: "sales", title: t("renewal.actionSalesTitle", { name: weakPerson.agentName }), text: t("renewal.actionSalesText", { rate: formatPercentage(weakPerson.renewalRate), overall: formatPercentage(overall) }) });
    }
    const unpaid = riskIndicators.find((i) => i.key === "unpaid").count;
    if (unpaid) out.push({ key: "unpaid", title: t("renewal.actionUnpaidTitle"), text: t("renewal.actionUnpaidText", { count: unpaid }) });
    const noContact = riskIndicators.find((i) => i.key === "contact").count;
    if (noContact) out.push({ key: "contact", title: t("renewal.actionContactTitle"), text: t("renewal.actionContactText", { count: noContact }) });
    return out;
  })();



  const agentRankingTemplate = (rowData) => {
    return (
      <div className="rank-cell">
        <span className="rank-number">#{rowData.ranking}</span>
      </div>
    );
  };

  const renewalRateTemplate = (rowData) => {
    return (
      <div className="bv-meter">
        <ProgressBar value={progressValue(rowData.renewalRate)} showValue={false} />
        <span className="bv-meter__value">{formatPercentage(rowData.renewalRate)}</span>
      </div>
    );
  };

  const handleExport = () => {
    downloadCsv(`retention-analytics-${toIsoDate(new Date())}.csv`, shownAgents, [
      { header: t("renewal.rank"), field: "ranking" },
      { header: t("renewal.salesPerson"), field: "agentName" },
      { header: t("renewal.renewalRatePercent"), field: "renewalRate" },
      { header: t("renewal.policiesRenewed"), field: "policiesRenewed" },
      { header: t("renewal.premium"), field: "premiumRetained" },
      { header: t("renewal.cycleTime"), field: "avgCycleTime" },
    ]);
    toast.current.show({ severity: "success", summary: t("renewal.exportStarted"), detail: t("renewal.rowsExported", { count: shownAgents.length }), life: 3000 });
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
      <Tag value={formatWithUnit(rowData.avgCycleTime, "days")} severity={getTimeColor(rowData.avgCycleTime)} />
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
                    dateFormat={calendarDateFormat()}
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
                  onClick={handleExport}
                  disabled={!shownAgents.length}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="kpi-cards">
          <Card className="kpi-card primary">
            <div className="kpi-content">
              <div className="kpi-info">
                <span className="kpi-label">Overall Renewal Rate</span>
                <span className="kpi-value">{formatPercentage(analyticsData.overall?.renewalRate)}</span>
                <div className="bv-meter">
                  <ProgressBar value={progressValue(analyticsData.overall?.renewalRate)} showValue={false} />
                  <span className="bv-meter__value">{formatPercentage(analyticsData.overall?.renewalRate)}</span>
                </div>
                <span className="kpi-change">{`${analyticsData.overall?.renewed ?? 0} renewed, ${analyticsData.overall?.lapsed ?? 0} lapsed`}</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card success">
            <div className="kpi-content">
              <div className="kpi-info">
                <span className="kpi-label">Premium Retention</span>
                <span className="kpi-value">{formatPercentage(analyticsData.overall?.premiumRetention)}</span>
                <div className="bv-meter">
                  <ProgressBar value={progressValue(analyticsData.overall?.premiumRetention)} showValue={false} />
                  <span className="bv-meter__value">{formatPercentage(analyticsData.overall?.premiumRetention)}</span>
                </div>
                <span className="kpi-change">{`${analyticsData.overall?.open ?? 0} still open`}</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card warning">
            <div className="kpi-content">
              <div className="kpi-info">
                <span className="kpi-label">Avg Cycle Time</span>
                <span className="kpi-value">{formatWithUnit(analyticsData.overall?.avgCycleTime ?? 0, "days")}</span>
                <span className="kpi-change">From renewal opened to renewed</span>
              </div>
            </div>
          </Card>

          <Card className="kpi-card info">
            <div className="kpi-content">
              <div className="kpi-visual">
                <div className="satisfaction-visual">
                  <i className="pi pi-star-fill"></i>
                  <span className="rating">{analyticsData.overall?.customerSatisfaction ?? '-'}</span>
                </div>
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Customer Satisfaction</span>
                <span className="kpi-value">{analyticsData.overall?.customerSatisfaction == null ? t("renewal.notMeasured") : `${analyticsData.overall.customerSatisfaction} / 5`}</span>
                <span className="kpi-change">{analyticsData.overall?.customerSatisfaction == null ? "No survey data captured" : "Client survey average"}</span>
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
                    <span className="chart-caption">12 months</span>
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
                    <span className="chart-caption">Current period</span>
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
                    {shownProducts.map(key => [key, analyticsData.byProduct[key]]).map(([key, product]) => (
                      <div key={key} className="product-item">
                        <div className="product-info">
                          <span className="product-name">{productLabel(key)}</span>
                          <span className="product-rate">{formatPercentage(product.renewalRate)}</span>
                        </div>
                        <div className="product-premium">
                          <span>Avg Premium: {formatCurrency(product.avgPremium)}</span>
                        </div>
                        <div className="bv-meter">
                          <ProgressBar value={progressValue(product.renewalRate)} showValue={false} />
                          <span className="bv-meter__value">{formatPercentage(product.renewalRate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabPanel>

            <TabPanel header="Sales Performance">
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Sales Performance Comparison</h3>
                    <span className="chart-caption">Dual axis</span>
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
                    <h3>Sales Leaderboard</h3>
                  </div>
                  <DataTable
                    value={shownAgents}
                    className="leaderboard-table"
                  >
                    <Column
                      body={agentRankingTemplate}
                      header="Rank"
                      style={{ width: '80px' }}
                    />
                    <Column
                      field="agentName"
                      header="Sales person"
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
                    <span className="chart-caption">Current portfolio</span>
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
                    {riskIndicators.map((ind) => (
                      <div className="risk-indicator" key={ind.key}>
                        <div className="indicator-header">
                          <span>{ind.label}</span>
                          <strong>{ind.count}</strong>
                        </div>
                        <div className="bv-meter">
                          <ProgressBar value={progressValue(ind.pct)} showValue={false} />
                          <span className="bv-meter__value">{t("renewal.shareOfOpen", { pct: ind.pct })}</span>
                        </div>
                      </div>
                    ))}
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
              <h3>{t("renewal.recommendedActions")}</h3>
            </div>
            {recommendedActions.length === 0 ? (
              <p className="text-color-secondary m-0">{t("renewal.noRecommendedActions")}</p>
            ) : (
              <ul className="action-list">
                {recommendedActions.map((a) => (
                  <li key={a.key}>
                    <strong>{a.title}</strong>
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RetentionAnalytics;