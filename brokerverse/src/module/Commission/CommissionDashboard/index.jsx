import React, { useEffect, useMemo, useState } from "react";
import { Chart } from "primereact/chart";
import CommissionService from "../../../services/commissionService";
import { formatAmount } from "../utils/formatAmount";
import {
  getCommissionViewMode,
  setCommissionViewMode,
} from "../utils/commissionViewMode";
import "./style.scss";
import { currencySymbol } from "../../../utility/currencyConverter";
import { formatPercent } from "../../../utility/numberFormat";
import logger from "../../../utility/logger";
import { DetailPageSkeleton } from "../../../components/Skeletons";
import { useChartTheme } from "../../../theme/chartTheme";

const CommissionDashboard = () => {
  const chart = useChartTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [brokerageView, setBrokerageView] = useState("insurer");
  const [viewMode, setViewMode] = useState(() => getCommissionViewMode());

  useEffect(() => {
    loadData();
  }, []);

  const handleViewModeChange = (mode) => {
    setViewMode(setCommissionViewMode(mode));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getDashboard();
      setData(res?.data || res);
    } catch (err) {
      logger.error("Failed to load commission dashboard", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const maxReferrer = useMemo(() => {
    if (!data?.comsubByReferrer?.length) return 1;
    return Math.max(...data.comsubByReferrer.map((r) => r.amount), 1);
  }, [data]);

  const maxFunnel = useMemo(() => {
    if (!data?.payableFunnel?.length) return 1;
    return Math.max(...data.payableFunnel.map((r) => r.amount), 1);
  }, [data]);

  const trendChart = useMemo(() => {
    if (!data?.monthlyTrend) return null;
    const [income, comsub, margin] = chart.series(3);
    return {
      labels: data.monthlyTrend.map((m) => m.month),
      datasets: [
        {
          label: "Brokerage income",
          data: data.monthlyTrend.map((m) => m.brokerageIncome),
          borderColor: income,
          backgroundColor: income,
          tension: 0,
          fill: false,
        },
        {
          label: "Comsub gross",
          data: data.monthlyTrend.map((m) => m.comsubGross),
          borderColor: comsub,
          backgroundColor: comsub,
          tension: 0,
          fill: false,
        },
        {
          label: "Net margin",
          data: data.monthlyTrend.map((m) => m.netMargin),
          borderColor: margin,
          backgroundColor: margin,
          tension: 0,
          fill: false,
        },
      ],
    };
  }, [data, chart]);

  const trendOptions = chart.options({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, right: 8, bottom: 0, left: 0 },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 12,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v) => currencySymbol() + Math.round(v / 1000) + "k",
        },
      },
      x: {
        grid: { display: false },
      },
    },
  });

  const makeDonut = (items) => ({
    labels: items.map((i) => i.label),
    datasets: [
      {
        data: items.map((i) => i.amount),
        backgroundColor: chart.series(items.length),
        borderWidth: 0,
      },
    ],
  });

  if (loading && !data) {
    return (
      <div className="commission-dashboard-page">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="commission-dashboard-page">
        <p className="loading-msg">Failed to load dashboard.</p>
      </div>
    );
  }

  const { kpis } = data;
  const brokerageItems =
    brokerageView === "insurer"
      ? data.brokerageByInsurer
      : data.brokerageByProduct;

  return (
    <div className="commission-dashboard-page">
      <div className="page-header">
        <div className="page-header-row">
          <div className="page-header-text">
            <h1>Commission Dashboard</h1>
            {viewMode === "management" && <p><span className="readonly-note">read-only (management)</span></p>}
          </div>
          <div className="view-mode-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === "accounting" ? "active" : ""}
              onClick={() => handleViewModeChange("accounting")}
            >
              Accounting
            </button>
            <button
              type="button"
              className={viewMode === "management" ? "active" : ""}
              onClick={() => handleViewModeChange("management")}
            >
              Management
            </button>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="label">Brokerage income</span>
          <span className="value">{formatAmount(kpis.brokerageIncome)}</span>
        </div>
        <div className="kpi-card">
          <span className="label">Comsub (gross)</span>
          <span className="value">{formatAmount(kpis.comsubGross)}</span>
        </div>
        <div className="kpi-card">
          <span className="label">Net margin</span>
          <span className="value">{formatAmount(kpis.netMargin)}</span>
        </div>
        <div className="kpi-card">
          <span className="label">Margin %</span>
          <span className="value">{formatPercent(kpis.marginPct)}</span>
        </div>
        <div className="kpi-card">
          <span className="label">Outstanding payable</span>
          <span className="value">
            {formatAmount(kpis.outstandingPayable)}
          </span>
        </div>
        <div className="kpi-card">
          <span className="label">WHT withheld (paid)</span>
          <span className="value">
            {formatAmount(kpis.whtWithheldPaid)}
          </span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>ComSub (gross) by referrer</h3>
          <div className="hbar-list">
            {data.comsubByReferrer.map((r) => (
              <div className="hbar-row" key={r.name}>
                <span className="hbar-label" title={r.name}>
                  {r.name}
                </span>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{ width: `${(r.amount / maxReferrer) * 100}%` }}
                  />
                </div>
                <span className="hbar-value">{formatAmount(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Lines by status</h3>
          <div className="status-list">
            {data.linesByStatus.map((s) => (
              <div className="status-row" key={s.status}>
                {s.status === "Accrued" || s.status === "Paid" ? (
                  <span
                    className={`status-pill ${
                      s.status === "Paid" ? "paid" : "accrued"
                    }`}
                  >
                    {s.status}
                  </span>
                ) : (
                  <span className="status-label">{s.status}</span>
                )}
                <div className="status-count-wrap">
                  <span className="mini-bar" />
                  <span className="status-count">{s.count}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="clawback-note">
            Reversed / clawback:{" "}
            <strong className="claw-lines">
              {data.clawback.lines} line(s)
            </strong>{" "}
            · {formatAmount(data.clawback.amount)} comsub clawed back (excluded
            from the figures above).
          </p>
        </div>
      </div>

      <div className="panel trend-panel">
        <h3>Monthly trend: income, payable and margin</h3>
        <div className="chart-wrap">
          {trendChart && (
            <Chart
              type="line"
              data={trendChart}
              options={trendOptions}
              style={{ width: "100%", height: "100%" }}
            />
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="panel donut-panel">
          <h3>ComSub (gross) by product</h3>
          <div className="donut-body">
            <div className="donut-chart-wrap">
              <Chart
                type="doughnut"
                data={makeDonut(data.comsubByProduct)}
                options={{
                  cutout: "68%",
                  plugins: { legend: { display: false } },
                }}
              />
              <div className="donut-center">Comsub</div>
            </div>
            <ul className="legend-list">
              {data.comsubByProduct.map((item, idx) => (
                <li key={item.label}>
                  <span
                    className="dot"
                    style={{ background: chart.series(idx + 1)[idx] }}
                  />
                  <span className="name">{item.label}</span>
                  <span className="amt">
                    {formatAmount(item.amount)} ({formatPercent(item.pct)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel donut-panel">
          <div className="panel-head-row">
            <h3>Brokerage income by {brokerageView}</h3>
            <div className="toggle">
              <button
                type="button"
                className={brokerageView === "insurer" ? "active" : ""}
                onClick={() => setBrokerageView("insurer")}
              >
                Insurer
              </button>
              <button
                type="button"
                className={brokerageView === "product" ? "active" : ""}
                onClick={() => setBrokerageView("product")}
              >
                Product
              </button>
            </div>
          </div>
          <div className="donut-body">
            <div className="donut-chart-wrap">
              <Chart
                type="doughnut"
                data={makeDonut(brokerageItems)}
                options={{
                  cutout: "68%",
                  plugins: { legend: { display: false } },
                }}
              />
              <div className="donut-center">Brokerage</div>
            </div>
            <ul className="legend-list">
              {brokerageItems.map((item, idx) => (
                <li key={item.label}>
                  <span
                    className="dot"
                    style={{ background: chart.series(idx + 1)[idx] }}
                  />
                  <span className="name">{item.label}</span>
                  <span className="amt">
                    {formatAmount(item.amount)} ({formatPercent(item.pct)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="panel funnel-panel">
        <h3>Payable funnel: net payable ({currencySymbol()}) by lifecycle stage</h3>
        <div className="hbar-list funnel">
          {data.payableFunnel.map((f) => (
            <div className="hbar-row" key={f.status}>
              {f.status === "Accrued" || f.status === "Paid" ? (
                <span
                  className={`status-pill funnel-label ${
                    f.status === "Paid" ? "paid" : "accrued"
                  }`}
                >
                  {f.status}
                </span>
              ) : (
                <span className="hbar-label bold">{f.status}</span>
              )}
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${(f.amount / maxFunnel) * 100}%` }}
                />
              </div>
              <span className="hbar-value">{formatAmount(f.amount)}</span>
            </div>
          ))}
        </div>
        <p className="funnel-note">
          Outstanding (Eligible + Approved) is what accounting still owes
          referrers, net of WHT.
        </p>
      </div>
    </div>
  );
};

export default CommissionDashboard;
