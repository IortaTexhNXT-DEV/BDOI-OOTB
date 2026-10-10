import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { ActivityLog, fromRemittanceActivity } from "../../../components/ActivityLog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { remittanceService } from "../../../services/remittanceService";
import { RunHistoryTable } from "../Runs";
import { statusChip } from "../shared";

/** The facts of a schedule (View panel). */
export const scheduleFacts = (s, t) => [
  { label: t("remittance.schedules.columns.kind"), value: t(`remittance.schedules.kinds.${s.kind}`, { defaultValue: s.kind }) },
  { label: t("remittance.schedules.columns.covers"), value: s.covers?.allActive ? t("remittance.schedules.allActive", { count: s.covers.count }) : (s.covers?.insurers || []).map((i) => i.name) },
  { label: t("remittance.schedules.columns.frequency"), value: t(`remittance.schedules.frequencies.${s.frequency}`, { defaultValue: s.frequency }) },
  { label: t("remittance.schedules.columns.window"), value: s.paymentWindow === "Cut-off days"
    ? t("remittance.schedules.cutOff", { count: s.cutOffDays ?? 0 }) : t(`remittance.schedules.windows.${s.paymentWindow}`, { defaultValue: s.paymentWindow }) },
  { label: t("remittance.schedules.columns.groupBy"), value: t(`remittance.schedules.groupByOptions.${s.groupBy}`, { defaultValue: s.groupBy }) },
  { label: t("remittance.schedules.columns.eligibility"), value: t(`remittance.schedules.eligibilities.${s.eligibility}`, { defaultValue: s.eligibility }) },
  { label: t("remittance.schedules.columns.proofRequired"), value: s.eligibility === "Fully paid in the window" ? s.proofRequired : null, type: "boolean" },
  { label: t("remittance.schedules.columns.runs"), value: s.runs },
  { label: t("remittance.schedules.columns.nextRun"), value: s.nextRunText || null },
  { label: t("remittance.schedules.columns.lastRun"), value: s.lastRun?.text || null },
  { label: t("remittance.schedules.columns.timeZone"), value: s.timeZone },
];

/** View (side panel, 640px): the schedule's facts, its latest runs and its activity log. */
const ScheduleView = ({ visible, onHide, schedule, onRunHistory }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => remittanceService.scheduleActivity(schedule.id), [schedule]);
  const { data, loading, error, reload } = useStableLoad(loader, { enabled: !!(visible && schedule) });
  if (!schedule) return null;
  return (
    <Dialog visible={visible} onHide={onHide} header={t("remittance.schedules.viewTitle", { code: schedule.code })} modal draggable={false} resizable={false}
      style={{ width: "640px" }} breakpoints={{ "700px": "100vw" }} className="rm-panel"
      footer={<Button type="button" label={t("remittance.common.close")} outlined onClick={onHide} />}>
      <DetailHeader title={schedule.code} subtitle={schedule.name}
        status={statusChip(String(schedule.status).toLowerCase(), t(`remittance.schedules.statuses.${schedule.status}`, { defaultValue: schedule.status }))} />
      <DetailSection title={t("remittance.schedules.details")}>
        <KeyValueGrid columns={2} items={scheduleFacts(schedule, t)} />
      </DetailSection>
      <DetailSection title={t("remittance.schedules.latestRuns")}
        actions={<Button type="button" label={t("remittance.schedules.runHistory")} text size="small" onClick={() => onRunHistory(schedule)} />}>
        <RunHistoryTable scheduleId={schedule.id} perPage={5} paginate={false} compact />
      </DetailSection>
      <DetailSection title={t("remittance.schedules.activity")}>
        <ActivityLog entries={fromRemittanceActivity(data || [])} loading={loading} error={error} onRetry={reload} />
      </DetailSection>
    </Dialog>
  );
};

ScheduleView.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  schedule: PropTypes.object,
  onRunHistory: PropTypes.func.isRequired,
};

ScheduleView.defaultProps = { visible: false, schedule: null };

export default ScheduleView;
