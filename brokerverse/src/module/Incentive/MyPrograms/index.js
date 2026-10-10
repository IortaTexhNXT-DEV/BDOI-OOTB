import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { ProgressBar } from "primereact/progressbar";
import { ChartCard, ThemedChart, tableOf } from "../../../components/Dashboard";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import FieldError from "../../../components/FieldError";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import { useStableLoad } from "../../../hooks/useStableLoad";
import incentiveService from "../../../services/incentiveService";
import { useChartTheme } from "../../../theme/chartTheme";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate, formatInstant } from "../../../utility/dateFormat";
import { formatPercent, progressValue } from "../../../utility/numberFormat";
import { hasPermission } from "../../../utils/canOpen";
import { IncentiveHeader, formatMeasure } from "../common";

/** How a tier pays, in words: "2% of premium achieved (maximum ₱20,000.00)", "₱500.00 per policy". */
export const tierPayout = (tier, t) => {
  const rate = formatPercent(tier.value, { decimals: 2 });
  const amount = formatCurrency(tier.value);
  const base = {
    percentOfAchieved: t("incentive.mine.payPercentAchieved", { rate }),
    percentOfTarget: t("incentive.mine.payPercentTarget", { rate }),
    perUnit: t("incentive.mine.payPerPolicy", { amount }),
    fixed: amount,
  }[tier.basis] || amount;
  return tier.maxPayout ? t("incentive.mine.payMaximum", { payout: base, max: formatCurrency(tier.maxPayout) }) : base;
};

/** Status of a program for the agent: running, or ended (with the shared status chip). */
const ProgramStatus = ({ program }) => {
  const { t } = useTranslation();
  return <StatusChip code={program.ended ? "completed" : "active"} label={t(program.ended ? "incentive.mine.statusEnded" : "incentive.mine.statusRunning")} />;
};
ProgramStatus.propTypes = { program: PropTypes.shape({ ended: PropTypes.bool }).isRequired };

/** Days left in the current calculation period (the period the row shows), or "-" once the program ended. */
const daysLeft = (p) => (p.ended ? "-" : Number(p.periodDaysRemaining ?? p.daysRemaining ?? 0).toLocaleString());

/** One program in one view: its facts, its tiers and the agent's performance in the current calculation period. */
const ProgramDialog = ({ program, onHide }) => {
  const { t } = useTranslation();
  if (!program) return null;
  const p = program;
  const top = !p.nextTier && (p.tiers || []).length;
  return (
    <DetailDialog visible onHide={onHide} header={t("incentive.mine.programTitle")} size="lg">
      <DetailHeader title={p.programName} status={p.programStatus} subtitle={p.programCode} />
      <DetailSection title={t("incentive.mine.program")}>
        <KeyValueGrid columns={3} items={[
          { label: t("incentive.mine.code"), value: p.programCode },
          { label: t("incentive.mine.name"), value: p.programName },
          { label: t("incentive.mine.measure"), value: p.targetMetric },
          { label: t("incentive.mine.programPeriod"), value: `${formatDate(p.startDate)} - ${formatDate(p.endDate)}` },
          { label: t("incentive.mine.currentPeriod"), value: `${formatDate(p.periodFrom)} - ${formatDate(p.periodTo)}` },
          { label: t("incentive.mine.daysLeft"), value: daysLeft(p) },
          { label: t("incentive.mine.frequency"), value: p.calculationFrequency },
          { label: t("incentive.mine.eligibility"), value: p.applicableTo },
          { label: t("incentive.mine.programType"), value: p.programType },
        ]} />
      </DetailSection>
      <DetailSection title={t("incentive.mine.tiers")} flush>
        <DataTable value={p.tiers || []} dataKey="level" size="small" className="inc-table" emptyMessage={t("incentive.mine.noTiers")}>
          <Column header={t("incentive.mine.tier")} body={(_, o) => o.rowIndex + 1} />
          <Column header={t("incentive.mine.band")} field="level" />
          <Column header={t("incentive.mine.payout")} body={(tier) => tierPayout(tier, t)} />
        </DataTable>
      </DetailSection>
      <DetailSection title={t("incentive.mine.performance")}>
        <KeyValueGrid columns={3} items={[
          { label: t("incentive.mine.target"), value: formatMeasure(p.target, p.metric) },
          { label: t("incentive.mine.achieved"), value: formatMeasure(p.achieved, p.metric) },
          { label: t("incentive.mine.achievement"), value: p.achievementPercent, type: "percent" },
          { label: t("incentive.mine.currentTier"), value: p.tier },
          { label: t("incentive.mine.estimatedPayout"), value: p.potentialEarning, type: "amount" },
          { label: t("incentive.mine.nextTier"), value: top ? t("incentive.mine.topTier") : p.nextTier?.level },
          { label: t("incentive.mine.stillNeeded"), value: p.nextTier ? formatMeasure(p.nextTier.needed, p.metric) : null, hidden: !p.nextTier },
        ]} />
      </DetailSection>
    </DetailDialog>
  );
};

ProgramDialog.propTypes = { program: PropTypes.object, onHide: PropTypes.func.isRequired };
ProgramDialog.defaultProps = { program: null };

const MyPrograms = () => {
  const { t } = useTranslation();
  const chart = useChartTheme();
  const reader = hasPermission("read:incentive");
  const [agentId, setAgentId] = useState(null);
  const [selected, setSelected] = useState(null);

  const loader = useCallback(() => incentiveService.myPrograms(agentId || undefined), [agentId]);
  const { data, loading, refreshing, error } = useStableLoad(loader);
  const notAgent = data && data.eligible === false && !agentId;
  const agentsLoader = useCallback(() => incentiveService.agents(), []);
  const agents = useStableLoad(agentsLoader, { enabled: reader, initialData: [] });

  // a manager who is not an agent sees the first eligible agent, and may choose another
  useEffect(() => {
    if (notAgent && agents.data?.length) setAgentId(agents.data[0].id);
  }, [notAgent, agents.data]);

  const programs = useMemo(() => (notAgent ? [] : data?.assignedPrograms || []), [data, notAgent]);
  const events = notAgent ? [] : data?.activity || [];
  const running = programs.filter((p) => !p.ended).length;
  const payout = programs.reduce((s, p) => s + Number(p.potentialEarning || 0), 0);
  const average = programs.length ? programs.reduce((s, p) => s + Number(p.achievementPercent || 0), 0) / programs.length : 0;
  const ready = !!data;

  // achievement of each program against its target (100%): bars in the series colour, the target as a reference line
  const chartData = useMemo(() => ({
    labels: programs.map((p) => p.programName),
    datasets: [{ label: t("incentive.mine.achievement"), data: programs.map((p) => Number(p.achievementPercent || 0)), backgroundColor: chart.primary, borderWidth: 0, maxBarThickness: 24 }],
  }), [programs, chart.primary, t]);
  const chartOptions = useMemo(() => ({ indexAxis: "y", scales: { x: { suggestedMax: 100 } } }), []);
  const target = useMemo(() => [{ value: 100, label: t("incentive.mine.target") }], [t]);

  const agentPicker = reader && agents.data?.length && (agentId || notAgent) ? (
    <Dropdown value={agentId} options={agents.data.map((a) => ({ label: `${a.name} (${a.code})`, value: a.id }))} onChange={(e) => setAgentId(e.value)} filter
      aria-label={t("incentive.mine.agent")} className="inc-header-field" />
  ) : null;

  return (
    <div className="inc-page">
      <IncentiveHeader title={t("incentive.mine.title")} help={t("incentive.help.myPrograms")} actions={agentPicker} />
      {error ? <FieldError error={error} /> : null}

      <StatCards items={[
        { key: "programs", label: t("incentive.mine.programs"), value: ready ? programs.length : null },
        { key: "running", label: t("incentive.mine.running"), value: ready ? running : null },
        { key: "payout", label: t("incentive.mine.estimatedPayout"), value: ready ? formatCurrency(payout) : null },
        { key: "average", label: t("incentive.mine.averageAchievement"), value: ready ? formatPercent(average) : null },
      ]} />

      <div className="inc-stack">
        <DetailSection title={t("incentive.mine.programsTitle")} className="bv-loading-host" flush>
          <LoadingBar active={refreshing} />
          <DataTable value={programs} dataKey="programId" loading={loading} size="small" className="inc-table" emptyMessage={t("incentive.mine.noPrograms")}
            onRowClick={(e) => setSelected(e.data)} rowClassName={() => "inc-row-link"}>
            <Column header={t("incentive.mine.program")} style={{ minWidth: "12rem" }} body={(p) => <div>{p.programName}<div className="inc-muted">{p.programCode}</div></div>} />
            <Column header={t("incentive.mine.period")} bodyClassName="inc-nowrap" body={(p) => `${formatDate(p.periodFrom)} - ${formatDate(p.periodTo)}`} />
            <Column header={t("incentive.mine.target")} body={(p) => formatMeasure(p.target, p.metric)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.mine.achieved")} body={(p) => formatMeasure(p.achieved, p.metric)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.mine.achievement")} body={(p) => (
              <div className="bv-meter">
                <ProgressBar value={progressValue(p.achievementPercent)} showValue={false} />
                <span className="bv-meter__value">{formatPercent(p.achievementPercent)}</span>
              </div>
            )} />
            <Column header={t("incentive.mine.estimatedPayout")} body={(p) => formatCurrency(p.potentialEarning)} className="inc-num" headerClassName="inc-num" />
            <Column header={t("incentive.mine.status")} body={(p) => <ProgramStatus program={p} />} />
            <Column header={t("incentive.batch.actions")} body={(p) => (
              <Button type="button" icon="pi pi-eye" text rounded aria-label={t("incentive.viewDetails")} tooltip={t("incentive.viewDetails")}
                onClick={(e) => { e.stopPropagation(); setSelected(p); }} />
            )} />
          </DataTable>
        </DetailSection>

        <ChartCard title={t("incentive.mine.chartTitle")} table={tableOf(chartData, "percent")} exportName="incentive-achievement">
          <ThemedChart type="bar" data={chartData} options={chartOptions} format="percent" reference={target} height={Math.max(160, programs.length * 48)}
            emptyText={t("incentive.mine.noAchievement")} />
        </ChartCard>
      </div>

      <DetailSection title={t("incentive.mine.activityTitle")} flush>
        {events.length ? (
          <DataTable value={events} size="small" className="inc-table">
            <Column header={t("incentive.mine.date")} body={(e) => formatInstant(e.date)} />
            <Column header={t("incentive.mine.event")} body={(e) => t(`incentive.mine.events.${e.action}`)} />
            <Column header={t("incentive.mine.program")} field="programName" />
            <Column header={t("incentive.mine.period")} field="period" />
            <Column header={t("incentive.batch.batch")} field="batchId" />
            <Column header={t("incentive.mine.amount")} body={(e) => formatCurrency(e.amount)} className="inc-num" headerClassName="inc-num" />
          </DataTable>
        ) : <p className="inc-empty inc-empty--padded">{t("incentive.mine.noActivity")}</p>}
      </DetailSection>

      <ProgramDialog program={selected} onHide={() => setSelected(null)} />
    </div>
  );
};

export default MyPrograms;
