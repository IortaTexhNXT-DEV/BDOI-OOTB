import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CommissionService from "../../../services/commissionService";
import {
  getCommissionViewMode,
  setCommissionViewMode,
} from "../utils/commissionViewMode";
import "./style.scss";
import { currencySymbol } from "../../../utility/currencyConverter";
import { formatPercent } from "../../../utility/numberFormat";
import logger from "../../../utility/logger";
import { DetailPageSkeleton } from "../../../components/Skeletons";
import StatCards from "../../../components/StatCards";
import { ChartCard, DashboardToolbar, ShareChart, ThemedChart, formatValue } from "../../../components/Dashboard";
import { useChartTheme } from "../../../theme/chartTheme";

/** Lifecycle of a commission line, in the order it moves (the payable funnel follows this order). */
const STAGES = ["Accrued", "Eligible", "Approved", "Paid"];
const stageRank = (s) => { const i = STAGES.indexOf(s); return i < 0 ? STAGES.length : i; };
const money = (v) => formatValue("currency", v, { compact: true });

const shareTable = (items, header) => ({
  columns: [{ field: "label", header }, { field: "amount", header: "Amount", format: "currency" }, { field: "pct", header: "Share", format: "percent" }],
  rows: [...items].sort((a, b) => b.amount - a.amount),
});

/**
 * Commission Dashboard: brokerage income, commission sharing (comsub) payable to referrers and the margin left, by
 * referrer, product and insurer, by month, and the payable lines through their lifecycle. The whole book to date.
 */
const CommissionDashboard = () => {
  const chart = useChartTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [brokerageView, setBrokerageView] = useState("insurer");
  const [viewMode, setViewMode] = useState(() => getCommissionViewMode());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getDashboard();
      setData(res?.data || res);
      setAsOf(new Date());
    } catch (err) {
      logger.error("Failed to load commission dashboard", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const handleViewModeChange = (mode) => {
    setViewMode(setCommissionViewMode(mode));
  };

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
  const brokerageItems = brokerageView === "insurer" ? data.brokerageByInsurer : data.brokerageByProduct;
  const toAccounts = () => navigate("/commission/referrer-accounts");

  const figures = [
    { key: "income", label: "Brokerage income", value: money(kpis.brokerageIncome) },
    { key: "comsub", label: "Comsub (gross)", value: money(kpis.comsubGross), onClick: toAccounts },
    { key: "margin", label: "Net margin", value: money(kpis.netMargin), note: `Margin ${formatPercent(kpis.marginPct)}` },
    { key: "payable", label: "Outstanding payable", value: money(kpis.outstandingPayable), note: "Eligible + approved, net of WHT", onClick: toAccounts },
    { key: "wht", label: "WHT withheld (paid)", value: money(kpis.whtWithheldPaid) },
    { key: "clawback", label: "Clawed back", value: money(data.clawback.amount), note: `${data.clawback.lines} line(s), excluded above` },
  ];

  const referrers = [...data.comsubByReferrer].sort((a, b) => b.amount - a.amount);
  const referrerData = { labels: referrers.map((r) => r.name), datasets: [{ label: "Comsub (gross)", data: referrers.map((r) => r.amount), backgroundColor: chart.primary }] };

  const [income, comsub, margin] = chart.series(3);
  const line = (label, field, color) => ({ label, data: data.monthlyTrend.map((m) => m[field]), borderColor: color, backgroundColor: color, pointBackgroundColor: color });
  const trendData = {
    labels: data.monthlyTrend.map((m) => m.month),
    datasets: [line("Brokerage income", "brokerageIncome", income), line("Comsub gross", "comsubGross", comsub), line("Net margin", "netMargin", margin)],
  };

  // the payable funnel: one ordinal ramp in lifecycle order, later stages darker
  const funnel = [...data.payableFunnel].sort((a, b) => stageRank(a.status) - stageRank(b.status));
  const funnelData = { labels: funnel.map((f) => f.status), datasets: [{ label: `Net payable (${currencySymbol()})`, data: funnel.map((f) => f.amount), backgroundColor: chart.sequential(funnel.length) }] };
  const lines = [...data.linesByStatus].sort((a, b) => stageRank(a.status) - stageRank(b.status));

  return (
    <div className="commission-dashboard-page bv-dash-page">
      <DashboardToolbar title="Commission Dashboard" asOf={asOf} onRefresh={loadData} loading={loading}
        actions={(
          <div className="view-mode-toggle" role="group" aria-label="View mode">
            <button type="button" className={viewMode === "accounting" ? "active" : ""} aria-pressed={viewMode === "accounting"} onClick={() => handleViewModeChange("accounting")}>
              Accounting
            </button>
            <button type="button" className={viewMode === "management" ? "active" : ""} aria-pressed={viewMode === "management"} onClick={() => handleViewModeChange("management")}>
              Management
            </button>
          </div>
        )}>
        <span className="commission-dashboard-page__scope">
          Whole book to date
          {viewMode === "management" ? <span className="readonly-note"> · read-only (management)</span> : null}
        </span>
      </DashboardToolbar>

      <StatCards items={figures} className="bv-stat-cards--wide commission-kpis" />

      <div className="bv-dash-grid">
        <ChartCard className="bv-dash-grid__wide" title="Monthly trend: income, payable and margin"
          table={{ columns: [{ field: "month", header: "Month" }, { field: "brokerageIncome", header: "Brokerage income", format: "currency" }, { field: "comsubGross", header: "Comsub gross", format: "currency" }, { field: "netMargin", header: "Net margin", format: "currency" }], rows: data.monthlyTrend }}
          exportName="commission-monthly-trend">
          <ThemedChart type="line" data={trendData} format="currency" height={260} />
        </ChartCard>

        <ChartCard title="ComSub (gross) by referrer" subtitle="Sorted by amount"
          table={{ columns: [{ field: "name", header: "Referrer" }, { field: "amount", header: "Comsub (gross)", format: "currency" }], rows: referrers }} exportName="comsub-by-referrer">
          <ThemedChart type="bar" data={referrerData} format="currency" options={{ indexAxis: "y" }} height={Math.max(160, referrers.length * 30 + 40)} />
        </ChartCard>

        <ChartCard title="Payable funnel: net payable by lifecycle stage" subtitle="Outstanding (eligible + approved) is what accounting still owes referrers, net of WHT"
          table={{ columns: [{ field: "status", header: "Stage" }, { field: "amount", header: "Net payable", format: "currency" }], rows: funnel }} exportName="payable-funnel">
          <ThemedChart type="bar" data={funnelData} format="currency" options={{ indexAxis: "y" }} height={Math.max(160, funnel.length * 34 + 40)} />
          <table className="bv-viz-table commission-lines">
            <thead><tr><th scope="col">Stage</th><th scope="col" className="bv-num">Lines</th></tr></thead>
            <tbody>{lines.map((s) => <tr key={s.status}><td>{s.status}</td><td className="bv-num">{s.count}</td></tr>)}</tbody>
          </table>
        </ChartCard>

        <ChartCard title="ComSub (gross) by product" table={shareTable(data.comsubByProduct, "Product")} exportName="comsub-by-product">
          <ShareChart items={data.comsubByProduct} dimension="lob" label="Comsub (gross)" />
        </ChartCard>

        <ChartCard title={`Brokerage income by ${brokerageView}`} table={shareTable(brokerageItems, brokerageView === "insurer" ? "Insurer" : "Product")} exportName={`brokerage-by-${brokerageView}`}
          actions={(
            <div className="bv-viz-switch" role="group" aria-label="Brokerage income by">
              <button type="button" className={brokerageView === "insurer" ? "active" : ""} aria-pressed={brokerageView === "insurer"} onClick={() => setBrokerageView("insurer")}>Insurer</button>
              <button type="button" className={brokerageView === "product" ? "active" : ""} aria-pressed={brokerageView === "product"} onClick={() => setBrokerageView("product")}>Product</button>
            </div>
          )}>
          <ShareChart items={brokerageItems} dimension={brokerageView === "insurer" ? "insurer" : "lob"} label="Brokerage income" />
        </ChartCard>
      </div>
    </div>
  );
};

export default CommissionDashboard;
