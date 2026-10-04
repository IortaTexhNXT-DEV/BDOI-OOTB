import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import { Chart } from "primereact/chart";
import { Dropdown } from "primereact/dropdown";
import { Badge } from "primereact/badge";
import { Divider } from "primereact/divider";
import SvgDot from "../../../assets/icons/SvgDot";
import incentiveService from "../../../services/incentiveService";
import { downloadCsv, showError } from "../../Remittance/shared";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const emptyStatement = { agentName: "", agentCode: "", period: "", statementDate: null, totalEarnings: 0, ytdEarnings: 0, pendingPayment: 0, lastPayment: 0, lastPaymentDate: null, lastPaymentPeriods: [], pendingPeriods: [], programBreakdown: [], monthlyTrend: [], contact: null };

/** Last 12 calendar months as { label: "September 2026", value: "2026-09" }. */
const recentMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
  });
};

const Statement = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const periodOptions = recentMonths();

  // State management
  const [statementData, setStatementData] = useState(emptyStatement);
  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0].value);
  const [agentId, setAgentId] = useState(null);
  const [agentOptions, setAgentOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Chart data
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  // Breadcrumb items
  const items = [
    { label: t("incentive.incentive") },
    { label: t("incentive.statement", { defaultValue: "Statement" }), url: "/incentive/statement" }
  ];

  const home = { label: t("sidebar.Accounts") };

  // Users who are not agents (managers) pick an agent; agents see their own statement.
  const loadAgentChoices = async () => {
    const agents = await incentiveService.agents();
    setAgentOptions(agents.map((a) => ({ label: `${a.name} (${a.code})`, value: a.id })));
    return agents[0]?.id || null;
  };

  const loadStatement = async () => {
    setLoading(true);
    try {
      const data = await incentiveService.statement({ agentId: agentId || undefined, period: selectedPeriod });
      // A manager who is not an agent gets eligible: false; offer the agents and show the first one's statement.
      if (!agentId && data?.eligible === false) {
        const firstAgent = data.selectAgent ? await loadAgentChoices() : null;
        if (firstAgent) {
          setAgentId(firstAgent);
          return;
        }
      }
      setStatementData({ ...emptyStatement, ...data });
      initializeChart(data);
    } catch (error) {
      showError(toast, error, t('incentive.failedToLoadStatement'));
    } finally {
      setLoading(false);
    }
  };

  // Initialize data and charts
  useEffect(() => {
    loadStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, agentId]);

  const initializeChart = (statement) => {
    const documentStyle = getComputedStyle(document.documentElement);

    // Monthly trend chart
    const data = {
      labels: statement.monthlyTrend.map(item => item.month),
      datasets: [
        {
          label: 'Monthly Earnings',
          data: statement.monthlyTrend.map(item => item.earnings),
          fill: false,
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderColor: documentStyle.getPropertyValue('--primary-color') || '#0072d8',
          tension: 0
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
    window.print();
  };

  // Handle export statement
  const handleExportStatement = () => {
    downloadCsv(`incentive_statement_${statementData.agentCode}_${selectedPeriod}.csv`, statementData.programBreakdown, [
      { field: () => statementData.agentName, header: "Sales person" },
      { field: () => statementData.period, header: "Period" },
      { field: "program", header: "Program" },
      { field: "target", header: "Target" },
      { field: "achievement", header: "Achievement" },
      { field: "achievementPercent", header: "Achievement %" },
      { field: "rate", header: "Tier" },
      { field: "earnedAmount", header: "Earned Amount" },
      { field: "status", header: "Status" }
    ]);
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
          {agentOptions.length > 0 && (
            <Dropdown
              value={agentId}
              options={agentOptions}
              onChange={(e) => setAgentId(e.value)}
              filter
              className="period-selector"
            />
          )}
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
            tooltip="Print Statement" aria-label="Print Statement"
          />
          <Button
            icon="pi pi-download"
            className="p-button-outlined"
            onClick={handleExportStatement}
            tooltip="Export to PDF" aria-label="Export to PDF"
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
              <p className="statement-date">Statement Date: {formatAppDate(statementData.statementDate)}</p>
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
                  <span className="card-date">{formatAppDate(statementData.lastPaymentDate)}</span>
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

            {/* From the statement data: the last payment and the approved results not paid yet (no sample dates) */}
            <div className="payment-history">
              {!statementData.lastPaymentDate && !(statementData.pendingPayment > 0) && (
                <div className="payment-item">
                  <div className="payment-details">
                    <div className="payment-description">{t("followUps.noIncentivePayments", "No incentive payments yet")}</div>
                  </div>
                </div>
              )}
              {statementData.lastPaymentDate && (
                <div className="payment-item">
                  <div className="payment-date">
                    <span className="date">{formatAppDate(statementData.lastPaymentDate)}</span>
                    <span className="status paid">Paid</span>
                  </div>
                  <div className="payment-details">
                    <div className="payment-description">
                      {t("followUps.incentivePaymentFor", "Incentive payment: {{periods}}", { periods: (statementData.lastPaymentPeriods || []).join(", ") || "-" })}
                    </div>
                    <div className="payment-amount">
                      {formatCurrency(statementData.lastPayment)}
                    </div>
                  </div>
                </div>
              )}
              {statementData.pendingPayment > 0 && (
                <div className="payment-item">
                  <div className="payment-date">
                    <span className="date">{t("followUps.approvedNotPaid", "Approved, not yet paid")}</span>
                    <span className="status pending">Pending</span>
                  </div>
                  <div className="payment-details">
                    <div className="payment-description">
                      {t("followUps.incentivePaymentFor", "Incentive payment: {{periods}}", { periods: (statementData.pendingPeriods || []).join(", ") || "-" })}
                    </div>
                    <div className="payment-amount">
                      {formatCurrency(statementData.pendingPayment)}
                    </div>
                  </div>
                </div>
              )}
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
              {/* The letterhead company (Company master); lines without a value are left out */}
              <p>
                {statementData.contact?.companyName && (<><strong>{statementData.contact.companyName}</strong><br /></>)}
                {statementData.contact?.email && (<>Email: {statementData.contact.email}<br /></>)}
                {statementData.contact?.phone && (<>Phone: {statementData.contact.phone}<br /></>)}
                {!statementData.contact?.email && !statementData.contact?.phone && t("followUps.contactSupervisor", "Contact your supervisor or the finance team.")}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Statement;