import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import DetailSection from "../../../components/DetailSection";
import FieldError from "../../../components/FieldError";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import { PrintableDocument, printView } from "../../../components/Print";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { useChartTheme } from "../../../theme/chartTheme";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import { formatPercent } from "../../../utility/numberFormat";
import { hasPermission } from "../../../utils/canOpen";
import { downloadCsv, showError } from "../../Remittance/shared";
import { IncentiveHeader, formatMeasure, monthOptions } from "../common";

/** Facts at the head of a statement. */
const statementFacts = (s, t) => [
  { label: t("incentive.stmt.agent"), value: s.agentName },
  { label: t("incentive.stmt.agentCode"), value: s.agentCode },
  { label: t("incentive.stmt.branch"), value: s.branch },
  { label: t("incentive.stmt.period"), value: s.period },
  { label: t("incentive.stmt.statementDate"), value: s.statementDate, type: "date" },
];

/** The statement as a printed document: facts, totals, programme breakdown and payment history. */
export const PrintedStatement = ({ statement: s }) => {
  const { t } = useTranslation();
  return (
    <PrintableDocument title={t("incentive.stmt.printTitle")} number={s.period}>
      <KeyValueGrid columns={3} items={statementFacts(s, t)} />
      <KeyValueGrid columns={4} items={[
        { label: t("incentive.stmt.earned"), value: s.totalEarnings, type: "amount" },
        { label: t("incentive.stmt.ytd"), value: s.ytdEarnings, type: "amount" },
        { label: t("incentive.stmt.pending"), value: s.pendingPayment, type: "amount" },
        { label: t("incentive.stmt.lastPayment"), value: s.lastPayment, type: "amount" },
      ]} />
      <h2>{t("incentive.stmt.breakdown")}</h2>
      <table>
        <thead>
          <tr>
            <th>{t("incentive.stmt.program")}</th>
            <th className="inc-num">{t("incentive.stmt.target")}</th>
            <th className="inc-num">{t("incentive.stmt.achieved")}</th>
            <th className="inc-num">{t("incentive.stmt.achievementPct")}</th>
            <th>{t("incentive.stmt.tier")}</th>
            <th className="inc-num">{t("incentive.stmt.earnedAmount")}</th>
            <th>{t("incentive.stmt.status")}</th>
          </tr>
        </thead>
        <tbody>
          {s.programBreakdown.map((r) => (
            <tr key={`${r.program}-${r.status}`}>
              <td>{r.program}</td>
              <td className="inc-num">{formatMeasure(r.target, r.metric)}</td>
              <td className="inc-num">{formatMeasure(r.achievement, r.metric)}</td>
              <td className="inc-num">{formatPercent(r.achievementPercent, { decimals: 2 })}</td>
              <td>{r.rate}</td>
              <td className="inc-num">{formatCurrency(r.earnedAmount)}</td>
              <td>{r.status}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={5}>{t("incentive.stmt.total")}</th>
            <th className="inc-num">{formatCurrency(s.totalEarnings)}</th>
            <th />
          </tr>
        </tbody>
      </table>
      <h2>{t("incentive.stmt.payments")}</h2>
      <table>
        <thead>
          <tr>
            <th>{t("incentive.stmt.period")}</th>
            <th>{t("incentive.stmt.programs")}</th>
            <th className="inc-num">{t("incentive.stmt.amount")}</th>
            <th>{t("incentive.stmt.status")}</th>
            <th>{t("incentive.stmt.paidOn")}</th>
            <th>{t("incentive.stmt.paymentReference")}</th>
          </tr>
        </thead>
        <tbody>
          {(s.paymentHistory || []).length ? s.paymentHistory.map((h) => (
            <tr key={`${h.batchId}-${h.periodKey}`}>
              <td>{h.period}</td>
              <td>{(h.programs || []).join(", ")}</td>
              <td className="inc-num">{formatCurrency(h.amount)}</td>
              <td>{h.status}</td>
              <td>{formatDate(h.paymentDate)}</td>
              <td>{h.paymentReference || "-"}</td>
            </tr>
          )) : (
            <tr><td colSpan={6}>{t("incentive.stmt.noPayments")}</td></tr>
          )}
        </tbody>
      </table>
    </PrintableDocument>
  );
};

PrintedStatement.propTypes = { statement: PropTypes.object.isRequired };

const Statement = () => {
  const { t } = useTranslation();
  const chart = useChartTheme();
  const toast = useRef(null);
  const months = useMemo(() => monthOptions(12), []);
  const reader = hasPermission("read:incentive");
  const [period, setPeriod] = useState(months[0].value);
  const [agentId, setAgentId] = useState(null);

  const loader = useCallback(() => incentiveService.statement({ agentId: agentId || undefined, period }), [agentId, period]);
  const { data, loading, refreshing, error } = useStableLoad(loader);
  const notAgent = data && data.eligible === false && !agentId;
  const agentsLoader = useCallback(() => incentiveService.agents(), []);
  const agents = useStableLoad(agentsLoader, { enabled: reader, initialData: [] });

  // a manager who is not an agent sees the first eligible agent's statement, and may choose another
  useEffect(() => {
    if (notAgent && agents.data?.length) setAgentId(agents.data[0].id);
  }, [notAgent, agents.data]);

  const s = data && !notAgent ? data : null;
  const breakdown = s?.programBreakdown || [];
  const trend = useMemo(() => s?.monthlyTrend || [], [s]);
  const anyEarnings = trend.some((m) => Number(m.earnings) > 0);

  const chartData = useMemo(() => ({
    labels: trend.map((m) => m.month),
    datasets: [{ label: t("incentive.stmt.earnings"), data: trend.map((m) => m.earnings), backgroundColor: chart.primary, borderWidth: 0, maxBarThickness: 28 }],
  }), [trend, chart.primary, t]);
  const chartOptions = useMemo(() => chart.options({
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } } },
  }), [chart]);

  const print = () => printView(<PrintedStatement statement={s} />, { title: `${t("incentive.stmt.printTitle")} ${s.agentCode} ${s.period}` })
    .catch((e) => showError(toast, e));
  const exportCsv = () => downloadCsv(`incentive_statement_${s.agentCode}_${period}.csv`, breakdown, [
    { field: () => s.agentName, header: t("incentive.stmt.agent") },
    { field: () => s.period, header: t("incentive.stmt.period") },
    { field: "program", header: t("incentive.stmt.program") },
    { field: "target", header: t("incentive.stmt.target") },
    { field: "achievement", header: t("incentive.stmt.achieved") },
    { field: "achievementPercent", header: t("incentive.stmt.achievementPct") },
    { field: "rate", header: t("incentive.stmt.tier") },
    { field: "earnedAmount", header: t("incentive.stmt.earnedAmount") },
    { field: "status", header: t("incentive.stmt.status") },
  ]);

  const actions = (
    <>
      {reader && agents.data?.length && (agentId || notAgent) ? (
        <Dropdown value={agentId} options={agents.data.map((a) => ({ label: `${a.name} (${a.code})`, value: a.id }))} onChange={(e) => setAgentId(e.value)} filter
          aria-label={t("incentive.stmt.agent")} className="inc-header-field" />
      ) : null}
      <Dropdown value={period} options={months} onChange={(e) => setPeriod(e.value)} aria-label={t("incentive.stmt.period")} className="inc-header-field" />
      <Button type="button" label={t("incentive.stmt.print")} icon="pi pi-print" outlined onClick={print} disabled={!s} />
      <Button type="button" label={t("incentive.stmt.export")} icon="pi pi-download" outlined onClick={exportCsv} disabled={!s} />
    </>
  );

  return (
    <div className="inc-page">
      <Toast ref={toast} />
      <IncentiveHeader title={t("incentive.incentiveStatement")} help={t("incentive.help.statement")} actions={actions} />
      {error ? <FieldError error={error} /> : null}

      <DetailSection className="bv-loading-host">
        <LoadingBar active={refreshing} />
        <KeyValueGrid columns={4} items={s ? statementFacts(s, t) : statementFacts({}, t)} />
      </DetailSection>

      <StatCards items={[
        { key: "earned", label: t("incentive.stmt.earned"), value: s ? formatCurrency(s.totalEarnings) : null },
        { key: "ytd", label: t("incentive.stmt.ytd"), value: s ? formatCurrency(s.ytdEarnings) : null },
        { key: "pending", label: t("incentive.stmt.pending"), value: s ? formatCurrency(s.pendingPayment) : null },
        { key: "last", label: t("incentive.stmt.lastPayment"), value: s ? formatCurrency(s.lastPayment) : null,
          note: s?.lastPaymentDate ? t("incentive.stmt.paidOnDate", { date: formatDate(s.lastPaymentDate) }) : null },
      ]} />

      <div className="inc-grid">
        <DetailSection title={t("incentive.stmt.breakdown")} flush>
          <DataTable value={breakdown} loading={loading} size="small" className="inc-table" emptyMessage={t("incentive.stmt.noPrograms")}
            footer={breakdown.length ? (
              <div className="inc-total"><span>{t("incentive.stmt.total")}</span><span>{formatCurrency(s.totalEarnings)}</span></div>
            ) : null}>
            <Column header={t("incentive.stmt.program")} field="program" />
            <Column header={t("incentive.stmt.target")} body={(r) => formatMeasure(r.target, r.metric)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.stmt.achieved")} body={(r) => formatMeasure(r.achievement, r.metric)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.stmt.achievementPct")} body={(r) => formatPercent(r.achievementPercent, { decimals: 2 })} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.stmt.tier")} field="rate" />
            <Column header={t("incentive.stmt.earnedAmount")} body={(r) => formatCurrency(r.earnedAmount)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.stmt.status")} body={(r) => <StatusChip label={r.status} />} />
          </DataTable>
        </DetailSection>
        <DetailSection title={t("incentive.stmt.trend")}>
          {anyEarnings
            ? <Chart type="bar" data={chartData} options={chartOptions} height="260px" />
            : <p className="inc-empty">{t("incentive.stmt.noEarnings")}</p>}
        </DetailSection>
      </div>

      <DetailSection title={t("incentive.stmt.payments")} flush>
        <DataTable value={s?.paymentHistory || []} size="small" className="inc-table" emptyMessage={t("incentive.stmt.noPayments")}>
          <Column header={t("incentive.stmt.period")} field="period" />
          <Column header={t("incentive.stmt.programs")} body={(h) => (h.programs || []).join(", ")} />
          <Column header={t("incentive.stmt.amount")} body={(h) => formatCurrency(h.amount)} className="inc-num" headerClassName="inc-num" />
          <Column header={t("incentive.stmt.status")} body={(h) => <StatusChip label={h.status} />} />
          <Column header={t("incentive.stmt.paidOn")} body={(h) => formatDate(h.paymentDate)} />
          <Column header={t("incentive.stmt.paymentReference")} body={(h) => h.paymentReference || "-"} />
          <Column header={t("incentive.batch.batch")} field="batchId" />
        </DataTable>
      </DetailSection>
    </div>
  );
};

export default Statement;
