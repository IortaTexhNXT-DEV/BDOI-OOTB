import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Chart } from "primereact/chart";
import { Dropdown } from "primereact/dropdown";
import { Badge } from "primereact/badge";
import { Divider } from "primereact/divider";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import { incentiveMockData } from "../../../services/mockData/incentiveMockData";
import "./index.scss";

const Statement = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const toast = useRef(null);

  // State management
  const [statementData, setStatementData] = useState(incentiveMockData.statementData);
  const [selectedPeriod, setSelectedPeriod] = useState("January 2025");
  const [loading, setLoading] = useState(false);

  // Chart data
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  // Period options
  const periodOptions = [
    { label: "January 2025", value: "January 2025" },
    { label: "December 2024", value: "December 2024" },
    { label: "November 2024", value: "November 2024" },
    { label: "October 2024", value: "October 2024" },
    { label: "September 2024", value: "September 2024" },
    { label: "August 2024", value: "August 2024" }
  ];

  // Breadcrumb items
  const items = [
    { label: "Incentive", url: "/incentive" },
    { label: "Statement", url: "/incentive/statement" }
  ];

  const home = { label: "Dashboard" };

  // Initialize data and charts
  useEffect(() => {
    loadStatement();
    initializeChart();
  }, [selectedPeriod]);

  const loadStatement = async () => {
    setLoading(true);
    try {
      // Simulate loading statement data for selected period
      // In real application, this would fetch from API based on selectedPeriod
      setTimeout(() => {
        toast.current.show({
          severity: 'success',
          summary: t('incentive.statementLoaded'),
          detail: t('incentive.statementLoadedSuccess', { period: selectedPeriod }),
          life: 3000
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t('common.error', 'Error'),
        detail: t('incentive.failedToLoadStatement'),
        life: 3000
      });
      setLoading(false);
    }
  };

  const initializeChart = () => {
    const documentStyle = getComputedStyle(document.documentElement);

    // Monthly trend chart
    const data = {
      labels: statementData.monthlyTrend.map(item => item.month),
      datasets: [
        {
          label: 'Monthly Earnings',
          data: statementData.monthlyTrend.map(item => item.earnings),
          fill: true,
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderColor: documentStyle.getPropertyValue('--primary-color') || '#0072d8',
          tension: 0.4
        }
      ]
    };

    const options = {
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            color: documentStyle.getPropertyValue('--text-color')
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: documentStyle.getPropertyValue('--text-color-secondary')
          },
          grid: {
            color: documentStyle.getPropertyValue('--surface-border')
          }
        },
        y: {
          ticks: {
            color: documentStyle.getPropertyValue('--text-color-secondary'),
            callback: function(value) {
              return formatCurrency(value);
            }
          },
          grid: {
            color: documentStyle.getPropertyValue('--surface-border')
          }
        }
      }
    };

    setChartData(data);
    setChartOptions(options);
  };

  // Handle period change
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
  };

  // Handle print statement
  const handlePrintStatement = () => {
    toast.current.show({
      severity: 'info',
      summary: 'Print Statement',
      detail: 'Statement is being prepared for printing...',
      life: 3000
    });
  };

  // Handle export statement
  const handleExportStatement = () => {
    toast.current.show({
      severity: 'info',
      summary: 'Export Statement',
      detail: 'Statement is being exported to PDF...',
      life: 3000
    });
  };

  // Template functions
  const achievementBodyTemplate = (rowData) => {
    if (typeof rowData.achievement === 'string') {
      return rowData.achievement;
    }
    return formatCurrency(rowData.achievement);
  };

  const targetBodyTemplate = (rowData) => {
    if (typeof rowData.target === 'string') {
      return rowData.target;
    }
    return formatCurrency(rowData.target);
  };

  const earnedAmountBodyTemplate = (rowData) => {
    return formatCurrency(rowData.earnedAmount);
  };

  return (
    <div className="container__statement">
      <Toast ref={toast} />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">{t("incentive.incentiveStatement")}</div>
        <div className="header-actions">
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => handlePeriodChange(e.value)}
            className="period-selector"
          />
          <Button
            icon="pi pi-print"
            className="p-button-outlined"
            onClick={handlePrintStatement}
            tooltip="Print Statement"
          />
          <Button
            icon="pi pi-download"
            className="p-button-outlined"
            onClick={handleExportStatement}
            tooltip="Export to PDF"
          />
        </div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      {/* Content */}
      <div className="content-container">
        {/* Statement Header */}
        <Card className="statement-header">
          <div className="header-grid">
            <div className="agent-info">
              <h2>{statementData.agentName}</h2>
              <p className="agent-code">Agent Code: {statementData.agentCode}</p>
            </div>
            <div className="period-info">
              <h3>{statementData.period}</h3>
              <p className="statement-date">Statement Date: {new Date(statementData.statementDate).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="summary-section">
          <div className="summary-cards">
            <Card className="summary-card total-earnings">
              <div className="card-content">
                <div className="card-icon">
                  <i className="pi pi-wallet"></i>
                </div>
                <div className="card-info">
                  <span className="card-label">Total Earnings</span>
                  <span className="card-value">
                    {formatCurrency(statementData.totalEarnings)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="summary-card ytd-earnings">
              <div className="card-content">
                <div className="card-icon">
                  <i className="pi pi-chart-line"></i>
                </div>
                <div className="card-info">
                  <span className="card-label">YTD Earnings</span>
                  <span className="card-value">
                    {formatCurrency(statementData.ytdEarnings)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="summary-card pending-payment">
              <div className="card-content">
                <div className="card-icon">
                  <i className="pi pi-clock"></i>
                </div>
                <div className="card-info">
                  <span className="card-label">Pending Payment</span>
                  <span className="card-value">
                    {formatCurrency(statementData.pendingPayment)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="summary-card last-payment">
              <div className="card-content">
                <div className="card-icon">
                  <i className="pi pi-check-circle"></i>
                </div>
                <div className="card-info">
                  <span className="card-label">Last Payment</span>
                  <span className="card-value">
                    {formatCurrency(statementData.lastPayment)}
                  </span>
                  <span className="card-date">{new Date(statementData.lastPaymentDate).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="main-content-grid">
          {/* Program Breakdown */}
          <div className="programs-section">
            <Card>
              <div className="section-header">
                <h3>Program Breakdown</h3>
                <Badge
                  value={statementData.programBreakdown.length}
                  severity="info"
                />
              </div>

              <DataTable
                value={statementData.programBreakdown}
                className="programs-table"
                stripedRows
                loading={loading}
                emptyMessage="No program data available"
              >
                <Column field="program" header="Program" style={{ width: "30%" }} />
                <Column
                  body={targetBodyTemplate}
                  header="Target"
                  style={{ width: "15%", textAlign: "right" }}
                />
                <Column
                  body={achievementBodyTemplate}
                  header="Achievement"
                  style={{ width: "15%", textAlign: "right" }}
                />
                <Column field="rate" header="Rate" style={{ width: "15%" }} />
                <Column
                  body={earnedAmountBodyTemplate}
                  header="Earned Amount"
                  style={{ width: "20%", textAlign: "right" }}
                />
              </DataTable>

              <Divider />

              <div className="total-row">
                <span className="total-label">Total Earnings:</span>
                <span className="total-amount">
                  {formatCurrency(statementData.totalEarnings)}
                </span>
              </div>
            </Card>
          </div>

          {/* Trend Chart */}
          <div className="chart-section">
            <Card>
              <div className="section-header">
                <h3>Earnings Trend (Last 13 Months)</h3>
              </div>
              <Chart
                type="line"
                data={chartData}
                options={chartOptions}
                height="300px"
              />
            </Card>
          </div>
        </div>

        {/* Payment History */}
        <div className="payment-history-section">
          <Card>
            <div className="section-header">
              <h3>Recent Payment History</h3>
            </div>

            <div className="payment-history">
              <div className="payment-item">
                <div className="payment-date">
                  <span className="date">{new Date(statementData.lastPaymentDate).toLocaleDateString()}</span>
                  <span className="status paid">Paid</span>
                </div>
                <div className="payment-details">
                  <div className="payment-description">December 2024 Incentive Payment</div>
                  <div className="payment-amount">
                    {formatCurrency(statementData.lastPayment)}
                  </div>
                </div>
              </div>

              <div className="payment-item">
                <div className="payment-date">
                  <span className="date">Expected: February 15, 2025</span>
                  <span className="status pending">Pending</span>
                </div>
                <div className="payment-details">
                  <div className="payment-description">January 2025 Incentive Payment</div>
                  <div className="payment-amount">
                    {formatCurrency(statementData.pendingPayment)}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Statement Footer */}
        <Card className="statement-footer">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Important Notes:</h4>
              <ul>
                <li>Incentive payments are processed monthly on the 15th of the following month</li>
                <li>Earnings are calculated based on achievement levels and program terms</li>
                <li>Contact your supervisor for any discrepancies in calculations</li>
                <li>This statement is generated automatically and serves as an official record</li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact Information:</h4>
              <p>
                <strong>Incentive Support:</strong><br />
                Email: incentives@company.com<br />
                Phone: (02) 123-4567<br />
                Office Hours: Monday - Friday, 8:00 AM - 5:00 PM
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Statement;