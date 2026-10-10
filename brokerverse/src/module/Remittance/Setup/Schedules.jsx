import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { OverlayPanel } from "primereact/overlaypanel";
import { Skeleton } from "primereact/skeleton";
import { TabMenu } from "primereact/tabmenu";
import PageHeader from "../../../components/PageHeader";
import TechnicalDetails from "../../../components/TechnicalDetails";
import LoadingBar from "../../../components/LoadingBar";
import RowActions from "../../../components/RowActions";
import StatusChip from "../../../components/StatusChip";
import { openConfirm } from "../../../components/ConfirmDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { hasPermission } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import adminService from "../../../services/adminService";
import { AutomationChip, RunHistoryPanel, RunNowDialog, automationFacts } from "../Runs";
import { REMITTANCE_ROUTES, loadInsurerOptions, statusChip } from "../shared";
import ScheduleForm from "./ScheduleForm";
import ScheduleView from "./ScheduleView";
import "../remittance.scss";

/** "6 created · 3 held · 1 exception", or "Failed: <message>". */
export const lastResultText = (run, t) => {
  if (!run) return "-";
  if (run.result === "failed") return t("remittance.schedules.lastFailed", { message: run.message || run.resultLabel });
  const c = run.counts || {};
  return t("remittance.schedules.lastCounts", { created: c.created ?? 0, held: c.held ?? 0, exceptions: c.exceptions ?? 0 });
};

const Covers = ({ schedule }) => {
  const { t } = useTranslation();
  const panel = useRef(null);
  const covers = schedule.covers || {};
  const label = covers.allActive ? t("remittance.schedules.allActive", { count: covers.count }) : covers.label;
  if (!(covers.insurers || []).length) return <span>{label}</span>;
  return (
    <>
      <Button type="button" label={label} link size="small" className="rm-covers" aria-haspopup="dialog" onClick={(e) => panel.current?.toggle(e)} />
      <OverlayPanel ref={panel} aria-label={t("remittance.schedules.columns.covers")}>
        <ul className="rm-covers__list">{covers.insurers.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
      </OverlayPanel>
    </>
  );
};

/**
 * Accounts > Remittance > Setup > Schedules: the Automation chip (Turn on for administrators), the cron for
 * administrators only, and one table of the schedules with a row menu built from the server's actions: View, Edit,
 * Preview run, Run now and Pause / Resume. New schedule is in the overflow menu; read-only users see "View only".
 */
const Schedules = () => {
  const { t } = useTranslation();
  const canWrite = hasPermission("write:remittance");
  const [view, setView] = useState(null);
  const [editing, setEditing] = useState(null);
  const [runNow, setRunNow] = useState(null);
  const [history, setHistory] = useState(null);
  const [insurers, setInsurers] = useState([]);
  const loader = useCallback(() => remittanceService.listSchedules(), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const schedules = data?.schedules || [];
  const automation = data?.automation || null;

  useEffect(() => {
    if (!canWrite) return;
    loadInsurerOptions().then(setInsurers).catch(() => setInsurers([]));
  }, [canWrite]);

  const statusText = (s) => t(`remittance.schedules.statuses.${s.status}`, { defaultValue: s.status });

  const confirmStatus = (s, pause) => openConfirm({
    title: pause ? t("remittance.schedules.pauseTitle", { code: s.code }) : t("remittance.schedules.resumeTitle", { code: s.code }),
    message: pause ? t("remittance.schedules.pauseMessage") : t("remittance.schedules.resumeMessage"),
    severity: pause ? "warning" : "neutral",
    confirmLabel: pause ? t("remittance.schedules.pauseVerb") : t("remittance.schedules.resumeVerb"),
    onConfirm: () => remittanceService.setScheduleStatus(s.id, pause ? "Paused" : "Active"),
  }).then((done) => { if (done) reload(); });

  const turnOn = () => openConfirm({
    title: t("remittance.automation.turnOnTitle"),
    confirmLabel: t("remittance.automation.turnOn"),
    onConfirm: () => adminService.updateSchedule(automation.jobCode, { enabled: true }),
  }).then((done) => { if (done) reload(); });

  const act = (s) => (action) => {
    switch (action.code) {
      case "view": setView(s); break;
      case "edit": setEditing({ schedule: s }); break;
      case "preview": setRunNow({ schedule: s, mode: "preview" }); break;
      case "run-now": setRunNow({ schedule: s, mode: "run" }); break;
      case "pause": confirmStatus(s, true); break;
      case "resume": confirmStatus(s, false); break;
      default:
    }
  };
  const actionLabel = (a) => t(`remittance.schedules.actions.${a.code}`, { defaultValue: a.label });

  const actions = canWrite ? (
    <RowActions label={t("remittance.common.moreActions")} actions={[{ code: "new-schedule", label: t("remittance.schedules.new"), allowed: true }]}
      onAction={() => setEditing({ schedule: null })} />
  ) : <StatusChip label={t("remittance.common.viewOnly")} severity="secondary" />;

  const empty = (
    <div className="rm-empty">
      <span>{t("remittance.schedules.empty")}</span>
      {canWrite ? <Button type="button" label={t("remittance.schedules.new")} outlined size="small" onClick={() => setEditing({ schedule: null })} /> : null}
    </div>
  );

  const facts = automationFacts(automation, t);

  return (
    <div className="rm-page">
      <PageHeader title={t("remittance.setup.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.setup.title")]} help={t("remittance.setup.help")} actions={actions} />
      <TabMenu model={[{ label: t("remittance.setup.tabs.schedules") }]} activeIndex={0} className="rm-tabs" />

      <div className="rm-strip">
        {automation ? <AutomationChip automation={automation} /> : null}
        {facts ? <span className="rm-strip__facts">{facts}</span> : null}
        {automation?.jobCode && !automation.jobEnabled ? (
          <Button type="button" label={t("remittance.automation.turnOn")} outlined size="small" onClick={turnOn} />
        ) : null}
      </div>
      {automation?.cron ? (
        <TechnicalDetails blocks={[{ label: t("remittance.automation.cron"), text: automation.cron }, { label: t("remittance.automation.job"), text: automation.jobCode }]} />
      ) : null}

      {error && !data ? (
        <div className="rm-inline-error" role="alert">
          <span>{t("remittance.schedules.loadError")}</span>
          <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={reload} />
        </div>
      ) : (
        <div className="rm-card bv-loading-host">
          <LoadingBar active={refreshing} />
          {loading && !data ? <Skeleton height="10rem" /> : (
            <DataTable value={schedules} dataKey="id" size="small" scrollable className="rm-table" emptyMessage={empty}>
              <Column header={t("remittance.schedules.columns.code")} body={(s) => <span className="rm-ref">{s.code}</span>} frozen style={{ minWidth: "8rem" }} />
              <Column header={t("remittance.schedules.columns.name")} field="name" />
              <Column header={t("remittance.schedules.columns.kind")} body={(s) => t(`remittance.schedules.kinds.${s.kind}`, { defaultValue: s.kind })} />
              <Column header={t("remittance.schedules.columns.covers")} body={(s) => <Covers schedule={s} />} />
              <Column header={t("remittance.schedules.columns.groupBy")} body={(s) => t(`remittance.schedules.groupByOptions.${s.groupBy}`, { defaultValue: s.groupBy })} />
              <Column header={t("remittance.schedules.columns.window")} body={(s) => (s.paymentWindow === "Cut-off days"
                ? t("remittance.schedules.cutOff", { count: s.cutOffDays ?? 0 }) : t(`remittance.schedules.windows.${s.paymentWindow}`, { defaultValue: s.paymentWindow }))} />
              <Column header={t("remittance.schedules.columns.runs")} field="runs" />
              <Column header={t("remittance.schedules.columns.nextRun")} body={(s) => <span className="rm-nowrap">{s.nextRunText || "-"}</span>} />
              <Column header={t("remittance.schedules.columns.lastRun")} body={(s) => <span className="rm-nowrap">{s.lastRun?.text || "-"}</span>} />
              <Column header={t("remittance.schedules.columns.lastResult")} body={(s) => lastResultText(s.lastRun, t)} />
              <Column header={t("remittance.schedules.columns.status")} body={(s) => <StatusChip {...statusChip(String(s.status).toLowerCase(), statusText(s))} />}
                style={{ minWidth: "7rem" }} />
              <Column header={<span className="p-sr-only">{t("remittance.schedules.columns.actions")}</span>} align="center" style={{ width: "3.5rem" }}
                body={(s) => <RowActions label={t("remittance.schedules.actionsFor", { code: s.code })} actions={s.actions} labelOf={actionLabel} onAction={act(s)} />} />
            </DataTable>
          )}
        </div>
      )}

      <ScheduleView visible={!!view} schedule={view} onHide={() => setView(null)} onRunHistory={(s) => setHistory(s)} />
      <ScheduleForm visible={!!editing} schedule={editing?.schedule || null} insurers={insurers} onHide={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }} />
      <RunNowDialog visible={!!runNow} mode={runNow?.mode} scheduleId={runNow?.schedule?.id} schedules={schedules.filter((s) => s.isActive)}
        onHide={() => setRunNow(null)} onDone={() => reload()} />
      <RunHistoryPanel visible={!!history} schedule={history} onHide={() => setHistory(null)} />
    </div>
  );
};

export default Schedules;
