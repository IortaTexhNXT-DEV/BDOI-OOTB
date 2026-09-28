import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Tag } from "primereact/tag";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const ExecutiveDashboard = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const currencySymbol = currencyCode === "USD" ? "$" : "฿";
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [dateRange, setDateRange] = useState([
    new Date(2025, 0, 1),
    new Date(),
  ]);

  const periodOptions = [
    { label: t("executiveDashboard.thisWeek"), value: "week" },
    { label: t("executiveDashboard.thisMonth"), value: "month" },
    { label: t("executiveDashboard.thisQuarter"), value: "quarter" },
    { label: t("executiveDashboard.thisYear"), value: "year" },
  ];

  // KPI title translation keys
  const kpiTitleKeys = {
    totalRevenue: "executiveDashboard.totalRevenue",
    activePolicies: "executiveDashboard.activePolicies",
    customerSatisfaction: "executiveDashboard.customerSatisfaction",
    claimsRatio: "executiveDashboard.claimsRatio",
    newBusiness: "executiveDashboard.newBusiness",
    retentionRate: "executiveDashboard.retentionRate",
  };

  // Executive KPIs
  const executiveKPIs = {
    totalRevenue: {
      value: "₱45.8M",
      change: "+12.5%",
      trend: "up",
      target: "₱50M",
      achievement: 91.6,
    },
    activePolicies: {
      value: "8,247",
      change: "+8.3%",
      trend: "up",
      target: "10,000",
      achievement: 82.47,
    },
    customerSatisfaction: {
      value: "94.2%",
      change: "+2.1%",
      trend: "up",
      target: "95%",
      achievement: 99.16,
    },
    claimsRatio: {
      value: "68.5%",
      change: "-3.2%",
      trend: "down",
      target: "70%",
      achievement: 102.14,
    },
    newBusiness: {
      value: "₱12.3M",
      change: "+18.7%",
      trend: "up",
      target: "₱15M",
      achievement: 82.0,
    },
    retentionRate: {
      value: "87.4%",
      change: "+1.8%",
      trend: "up",
      target: "90%",
      achievement: 97.11,
    },
  };

  // Revenue by Product Line
  const revenueByProductData = {
    labels: [
      "Motor",
      "Fire and Allied Perils",
      "Employee Benefits",
      "Health",
      "Property",
      "Life",
      "Travel",
      "Marine",
      "Others",
    ],
    datasets: [
      {
        label: "Revenue (₱M)",
        data: [18.5, 10.2, 15.8, 12.3, 8.7, 6.2, 3.8, 2.9, 2.1],
        backgroundColor: [
          "#0066CC",
          "#E65100",
          "#4CAF50",
          "#00C851",
          "#FFA500",
          "#9C27B0",
          "#00BCD4",
          "#FF5252",
          "#607D8B",
        ],
      },
    ],
  };

  // Monthly Performance Trend
  const monthlyTrendData = {
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
        label: t("executiveDashboard.grossWrittenPremium"),
        data: [3.8, 4.2, 4.5, 4.1, 4.8, 5.2, 5.5, 5.1, 5.8, 6.2, 6.5, 7.1],
        borderColor: "#0066CC",
        backgroundColor: "rgba(0, 102, 204, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: t("executiveDashboard.netPremium"),
        data: [3.2, 3.5, 3.8, 3.4, 4.0, 4.3, 4.6, 4.2, 4.8, 5.1, 5.4, 5.9],
        borderColor: "#00C851",
        backgroundColor: "rgba(0, 200, 81, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: t("executiveDashboard.claimsPaid"),
        data: [2.1, 2.3, 2.5, 2.2, 2.6, 2.8, 3.0, 2.7, 3.1, 3.3, 3.5, 3.8],
        borderColor: "#FF5252",
        backgroundColor: "rgba(255, 82, 82, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Regional Performance
  const regionalPerformance = [
    {
      region: "Metro Manila",
      premium: "₱18.5M",
      policies: 3241,
      growth: "+15.2%",
      marketShare: 40.4,
    },
    {
      region: "Cebu",
      premium: "₱8.3M",
      policies: 1456,
      growth: "+12.8%",
      marketShare: 18.1,
    },
    {
      region: "Davao",
      premium: "₱6.7M",
      policies: 1175,
      growth: "+10.5%",
      marketShare: 14.6,
    },
    {
      region: "Laguna",
      premium: "₱4.2M",
      policies: 737,
      growth: "+8.3%",
      marketShare: 9.2,
    },
    {
      region: "Cavite",
      premium: "₱3.8M",
      policies: 667,
      growth: "+6.7%",
      marketShare: 8.3,
    },
    {
      region: "Batangas",
      premium: "₱2.1M",
      policies: 368,
      growth: "+5.2%",
      marketShare: 4.6,
    },
    {
      region: "Others",
      premium: "₱2.2M",
      policies: 603,
      growth: "+4.8%",
      marketShare: 4.8,
    },
  ];

  // Top Performing Products
  const topProducts = [
    {
      product: "Motor Comprehensive",
      premium: "₱12.8M",
      policies: 2845,
      claimRatio: "65%",
      profit: "₱4.48M",
    },
    {
      product: "Group Life Insurance",
      premium: "₱9.2M",
      policies: 342,
      claimRatio: "28%",
      profit: "₱6.62M",
    },
    {
      product: "Health Plus",
      premium: "₱8.5M",
      policies: 1892,
      claimRatio: "72%",
      profit: "₱2.38M",
    },
    {
      product: "Group Medical & HMO",
      premium: "₱6.6M",
      policies: 285,
      claimRatio: "68%",
      profit: "₱2.11M",
    },
    {
      product: "Property All Risk",
      premium: "₱6.3M",
      policies: 456,
      claimRatio: "45%",
      profit: "₱3.47M",
    },
    {
      product: "Group Personal Accident",
      premium: "₱4.8M",
      policies: 458,
      claimRatio: "35%",
      profit: "₱3.12M",
    },
  ];

  // Agent Performance
  const agentPerformance = [
    {
      name: "Juan Dela Cruz",
      branch: "Makati",
      premium: "₱3.2M",
      policies: 145,
      conversion: "78%",
      rating: 4.8,
    },
    {
      name: "Maria Santos",
      branch: "Quezon City",
      premium: "₱2.8M",
      policies: 132,
      conversion: "75%",
      rating: 4.7,
    },
    {
      name: "Pedro Garcia",
      branch: "Cebu",
      premium: "₱2.5M",
      policies: 118,
      conversion: "72%",
      rating: 4.6,
    },
    {
      name: "Rosa Fernandez",
      branch: "Davao",
      premium: "₱2.1M",
      policies: 98,
      conversion: "68%",
      rating: 4.5,
    },
    {
      name: "Carlos Mendoza",
      branch: "Laguna",
      premium: "₱1.8M",
      policies: 87,
      conversion: "65%",
      rating: 4.4,
    },
  ];

  // Claims Analytics
  const claimsAnalytics = {
    labels: ["Approved", "Pending", "Under Review", "Rejected"],
    datasets: [
      {
        data: [65, 20, 10, 5],
        backgroundColor: ["#00C851", "#FFA500", "#2196F3", "#FF5252"],
      },
    ],
  };

  // Customer Segmentation
  const customerSegmentData = {
    labels: ["Retail", "Corporate", "SME", "Government"],
    datasets: [
      {
        label: "Premium Contribution",
        data: [45, 30, 20, 5],
        backgroundColor: ["#0066CC", "#00C851", "#FFA500", "#9C27B0"],
      },
    ],
  };

  const growthTemplate = (rowData, field) => {
    const value = rowData[field];
    const isPositive = value.startsWith("+");
    return (
      <Tag
        value={value}
        severity={isPositive ? "success" : "danger"}
        icon={isPositive ? "pi pi-arrow-up" : "pi pi-arrow-down"}
      />
    );
  };

  const ratingTemplate = (rowData) => {
    return (
      <div className="rating-cell">
        <i className="pi pi-star-fill" style={{ color: "#FFD700" }}></i>
        <span>{rowData.rating}</span>
      </div>
    );
  };

  const marketShareTemplate = (rowData) => {
    return (
      <ProgressBar
        value={rowData.marketShare}
        showValue={true}
        style={{ height: "20px" }}
      />
    );
  };

  return (
    <div className="executive-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{t("executiveDashboard.title")}</h1>
            <p>{t("executiveDashboard.subtitle")}</p>
          </div>
          <div className="header-right">
            <Calendar
              value={dateRange}
              onChange={(e) => setDateRange(e.value)}
              selectionMode="range"
              placeholder={t("executiveDashboard.selectDateRange")}
            />
            <Dropdown
              value={selectedPeriod}
              options={periodOptions}
              onChange={(e) => setSelectedPeriod(e.value)}
            />
            <Button
              label={t("executiveDashboard.exportReport")}
              icon="pi pi-download"
              severity="info"
            />
            <Button label={t("executiveDashboard.settings")} icon="pi pi-cog" severity="secondary" />
          </div>
        </div>
        {/* Mobile/Tablet Actions - moved below title */}
        <div className="mobile-header-actions">
          <Calendar
            value={dateRange}
            onChange={(e) => setDateRange(e.value)}
            selectionMode="range"
            placeholder={t("executiveDashboard.selectDateRange")}
          />
          <Dropdown
            value={selectedPeriod}
            options={periodOptions}
            onChange={(e) => setSelectedPeriod(e.value)}
          />
          <Button label={t("executiveDashboard.exportReport")} icon="pi pi-download" severity="info" />
          <Button label={t("executiveDashboard.settings")} icon="pi pi-cog" severity="secondary" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-section">
        <div className="kpi-scroll-container">
          {Object.entries(executiveKPIs).map(([key, kpi]) => (
            <Card key={key} className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">
                  {t(kpiTitleKeys[key] || key)}
                </span>
                <Tag
                  value={kpi.change}
                  severity={kpi.trend === "up" ? "success" : "danger"}
                  icon={`pi pi-arrow-${kpi.trend}`}
                />
              </div>
              <div className="kpi-value">{String(kpi.value).replace("₱", currencySymbol)}</div>
              <div className="kpi-target">
                <span>{t("executiveDashboard.target")}: {String(kpi.target).replace("₱", currencySymbol)}</span>
                <ProgressBar
                  value={kpi.achievement}
                  showValue={false}
                  style={{ height: "6px" }}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Performance Trends */}
        <Card title={t("executiveDashboard.performanceTrends")} className="trend-card">
          <div className="chart-scroll-hint">
            <small className="scroll-hint-text">
              <i className="pi pi-arrows-h" style={{ marginRight: "4px" }} />
              {t("executiveDashboard.scrollHint")}
            </small>
          </div>
          <div className="chart-scroll-container">
            <Chart
              type="line"
              data={monthlyTrendData}
              options={{
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                  tooltip: {
                    mode: "index",
                    intersect: false,
                  },
                },
                scales: {
                  x: {
                    display: true,
                    ticks: {
                      maxRotation: 45,
                      minRotation: 0,
                    },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function (value) {
                        return currencySymbol + value + "M";
                      },
                    },
                  },
                },
                interaction: {
                  intersect: false,
                  mode: "index",
                },
                elements: {
                  point: {
                    radius: 4,
                    hoverRadius: 6,
                  },
                  line: {
                    tension: 0.4,
                  },
                },
              }}
              style={{ height: "350px", width: "1200px" }}
            />
          </div>
        </Card>

        {/* Revenue Distribution */}
        <Card title={t("executiveDashboard.revenueByProductLine")} className="revenue-card">
          <Chart
            type="doughnut"
            data={revenueByProductData}
            options={{
              maintainAspectRatio: false,
              responsive: true,
              plugins: {
                legend: {
                  position: "right",
                },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      return context.label + ": " + currencySymbol + context.parsed + "M";
                    },
                  },
                },
              },
            }}
            style={{ height: "350px" }}
          />
        </Card>

        {/* Regional Performance Table */}
        <Card title={t("executiveDashboard.regionalPerformance")} className="regional-card">
          <DataTable
            value={regionalPerformance}
            size="small"
            className="regional-table"
          >
            <Column field="region" header={t("executiveDashboard.region")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => String(row.premium || "").replace("₱", currencySymbol)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
            <Column
              field="growth"
              header={t("executiveDashboard.growth")}
              body={(rowData) => growthTemplate(rowData, "growth")}
            />
            <Column
              field="marketShare"
              header={t("executiveDashboard.marketShare")}
              body={marketShareTemplate}
            />
          </DataTable>
        </Card>

        {/* Top Products */}
        <Card title={t("executiveDashboard.topPerformingProducts")} className="products-card">
          <DataTable
            value={topProducts}
            size="small"
            className="products-table"
          >
            <Column field="product" header={t("executiveDashboard.product")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => String(row.premium || "").replace("₱", currencySymbol)} />
            <Column field="policies" header={t("executiveDashboard.policies")} />
            <Column field="claimRatio" header={t("executiveDashboard.claimRatio")} />
            <Column field="profit" header={t("executiveDashboard.profit")} body={(row) => String(row.profit || "").replace("₱", currencySymbol)} />
          </DataTable>
        </Card>

        {/* Agent Performance */}
        <Card title={t("executiveDashboard.topAgentsPerformance")} className="agents-card">
          <DataTable
            value={agentPerformance}
            size="small"
            className="agents-table"
          >
            <Column field="name" header={t("executiveDashboard.agent")} />
            <Column field="branch" header={t("executiveDashboard.branch")} />
            <Column field="premium" header={t("executiveDashboard.premium")} body={(row) => String(row.premium || "").replace("₱", currencySymbol)} />
            <Column field="conversion" header={t("executiveDashboard.conversion")} />
            <Column field="rating" header={t("executiveDashboard.rating")} body={ratingTemplate} />
          </DataTable>
        </Card>

        {/* Quick Stats */}
        <div className="quick-stats">
          {/* Claims Analytics */}
          <Card title={t("executiveDashboard.claimsStatusDistribution")} className="claims-card">
            <Chart
              type="pie"
              data={claimsAnalytics}
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

          {/* Customer Segmentation */}
          <Card title={t("executiveDashboard.customerSegmentation")} className="segment-card">
            <Chart
              type="bar"
              data={customerSegmentData}
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
                    ticks: {
                      callback: function (value) {
                        return value + "%";
                      },
                    },
                  },
                },
              }}
              style={{ height: "250px" }}
            />
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Card title={t("executiveDashboard.quickActions")} className="actions-card">
          <div className="actions-grid">
            <Button
              label={t("executiveDashboard.viewClaims")}
              icon="pi pi-file"
              onClick={() => navigate("/claims/dashboard")}
            />
            <Button
              label={t("executiveDashboard.underwriting")}
              icon="pi pi-check-square"
              onClick={() => navigate("/underwriting/dashboard")}
            />
            <Button
              label={t("executiveDashboard.newQuote")}
              icon="pi pi-plus"
              severity="success"
              onClick={() => navigate("/quotes/new")}
            />
            <Button
              label={t("executiveDashboard.reports")}
              icon="pi pi-chart-bar"
              severity="info"
              onClick={() => navigate("/reports")}
            />
            <Button
              label={t("executiveDashboard.policiesLabel")}
              icon="pi pi-briefcase"
              onClick={() => navigate("/policies")}
            />
            <Button
              label={t("executiveDashboard.analytics")}
              icon="pi pi-chart-line"
              severity="warning"
              onClick={() => navigate("/analytics")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
