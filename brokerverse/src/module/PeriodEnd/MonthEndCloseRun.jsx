import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { openConfirm } from "../../components/ConfirmDialog";
import ApprovalActions, { isInitiator } from "../../components/ApprovalActions";
import { ActivityLog, RecordActivityLog, fromStatusHistory } from "../../components/ActivityLog";
import { JournalDialog, JournalLink, PageHeader, StatusTag, date, dateTime, money, showError, showSuccess } from "./common";
import { hasPermission } from "../../utils/canOpen";

const STEPS = ["accruals", "recurring", "deferral", "fx", "depreciation", "checks"];
const PERIOD_STATUSES = ["open", "soft_closed", "closed", "locked", "closing"];

// the decisions on a run: the call with the remarks typed, the tone of the confirmation and the message once done
const DECISIONS = {
  submit: { call: (run, remarks, target) => periodEndService.submitRun(run.id, target, remarks), done: "periodEnd.submitted" },
  approve: { call: (run, remarks) => periodEndService.approveRun(run.id, remarks), done: "periodEnd.approved" },
  reject: { call: (run, remarks) => periodEndService.rejectRun(run.id, remarks), done: "periodEnd.rejected", severity: "danger", required: true },
  cancel: { call: (run, remarks) => periodEndService.cancelRun(run.id, remarks), done: "periodEnd.cancelled", severity: "danger" },
};

/**
 * Month-end close run: the steps (accruals, recurring journals, commission deferral, FX revaluation, checklist), the
 * checklist results with manual sign-offs, the journals the run generated (with their auto-reversals), and the
 * maker-checker close (submit by the preparer, approve by a finance manager).
 */
const MonthEndCloseRun = () => {
  const { t } = useTranslation();
  // Approving, rejecting, reopening and year-end close / reverse need approve:period-end (the server refuses them otherwise)
  const canApprove = hasPermission("approve:period-end");
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(null);
  const [journal, setJournal] = useState(null);
  const [activityKey, setActivityKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setRun(await periodEndService.closeRun(id));
    } catch (e) {
      showError(toast, e);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (name, fn, message) => {
    setBusy(name);
    try {
      const r = await fn();
      setRun(r);
      setActivityKey((k) => k + 1);
      if (message) showSuccess(toast, message);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  if (!run) return <div className="pe-page"><Toast ref={toast} /></div>;
  const finished = ["closed", "cancelled"].includes(run.status);
  const canExecute = !["pending-approval", "closed", "cancelled"].includes(run.status);
  const canSubmit = ["in-progress", "blocked", "ready", "soft-closed"].includes(run.status) && run.executionCount > 0;
  const activeJournals = run.journals.filter((j) => j.status === "active");

  const runFacts = () => [
    { label: t("periodEnd.runNumber"), value: run.runNumber },
    { label: t("periodEnd.period"), value: run.period },
    { label: t("periodEnd.runStatus"), value: t(`periodEnd.status.${run.status}`) },
    { label: t("periodEnd.journals"), value: activeJournals.length, type: "number" },
    { label: t("periodEnd.blockingFailures"), value: run.checks.filter((c) => c.severity === "blocking" && c.status === "failed").length, type: "number" },
  ];

  // submit, approve, reject or cancel the close after a confirmation that shows the run and takes the remarks
  const decide = async (kind, target) => {
    const decision = DECISIONS[kind];
    let updated;
    const remarks = await openConfirm({
      title: t(`periodEnd.confirmations.${kind}${target === "soft_closed" ? "Soft" : ""}Title`, { period: run.period }),
      severity: decision.severity || "neutral",
      message: t(`periodEnd.confirmations.${kind}${target === "soft_closed" ? "Soft" : ""}Message`, { period: run.period }),
      facts: runFacts(),
      note: kind === "submit" ? t("periodEnd.submitHelp") : null,
      input: { type: "textarea", label: decision.required ? t("periodEnd.reason") : t("periodEnd.remarks"), required: !!decision.required, maxLength: 1000 },
      confirmLabel: t(`periodEnd.confirmations.${kind}${target === "soft_closed" ? "Soft" : ""}`),
      cancelLabel: kind === "cancel" ? t("periodEnd.confirmations.keepRun") : undefined,
      onConfirm: async (value) => { updated = await decision.call(run, value, target); },
    });
    if (remarks === null) return;
    setRun(updated);
    setActivityKey((k) => k + 1);
    showSuccess(toast, t(decision.done));
  };

  const execute = async () => {
    const ok = await openConfirm({
      title: t(run.executionCount ? "periodEnd.confirmations.rerunTitle" : "periodEnd.confirmations.runTitle", { period: run.period }),
      message: t("periodEnd.confirmations.runMessage"),
      facts: [
        { label: t("periodEnd.runNumber"), value: run.runNumber },
        { label: t("periodEnd.period"), value: run.period },
        { label: t("periodEnd.steps"), value: STEPS.filter((s) => s !== "checks").map((s) => t(`periodEnd.step.${s}`)).join(", ") },
        { label: t("periodEnd.executions"), value: run.executionCount, type: "number" },
      ],
      note: run.executionCount ? t("periodEnd.confirmations.rerunNote") : null,
      confirmLabel: t(run.executionCount ? "periodEnd.rerunSteps" : "periodEnd.runSteps"),
    });
    if (ok) act("execute", () => periodEndService.executeRun(run.id), t("periodEnd.stepsDone"));
  };

  const sign = async (check, withdraw) => {
    let updated;
    const remarks = await openConfirm({
      title: t(withdraw ? "periodEnd.confirmations.withdrawTitle" : "periodEnd.confirmations.signTitle"),
      severity: withdraw ? "warning" : "neutral",
      facts: [
        { label: t("periodEnd.item"), value: check.label },
        { label: t("periodEnd.severity"), value: t(`periodEnd.severityValue.${check.severity}`) },
        { label: t("periodEnd.runNumber"), value: run.runNumber },
      ],
      input: { type: "textarea", label: t("periodEnd.remarks"), maxLength: 1000 },
      confirmLabel: t(withdraw ? "periodEnd.confirmations.withdraw" : "periodEnd.confirmations.sign"),
      onConfirm: async (value) => { updated = await periodEndService.signCheck(run.id, check.code, value, !withdraw); },
    });
    if (remarks === null) return;
    setRun(updated);
    setActivityKey((k) => k + 1);
    showSuccess(toast, t("periodEnd.signedOff"));
  };

  // the close is approved by a user who neither prepared nor submitted it
  const initiator = isInitiator({ id: run.preparedBy }) ? { id: run.preparedBy } : { id: run.submittedBy };
  const periodStatusLabels = Object.fromEntries(PERIOD_STATUSES.map((k) => [k, t(`periodEnd.status.${k}`)]));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("periodEnd.monthEndClose")} ${run.period}`} trail={[t("periodEnd.monthEndClose"), run.runNumber]}
        subtitle={`${run.runNumber} · ${t("periodEnd.fiscalYear")} ${run.fiscalYear || "-"} · ${date(run.periodInfo?.startDate)} – ${date(run.periodInfo?.endDate)}`}>
        <Button icon="pi pi-arrow-left" text label={t("periodEnd.back")} onClick={() => navigate("/accounts/period-end/close")} />
        {canExecute && (
          <Button icon="pi pi-play" label={run.executionCount ? t("periodEnd.rerunSteps") : t("periodEnd.runSteps")} loading={busy === "execute"} onClick={execute} />
        )}
        {canExecute && run.executionCount > 0 && (
          <Button icon="pi pi-refresh" outlined label={t("periodEnd.recheck")} loading={busy === "recheck"} onClick={() => act("recheck", () => periodEndService.recheckRun(run.id))} />
        )}
        {canSubmit && run.status !== "soft-closed" && (
          <Button icon="pi pi-send" outlined label={t("periodEnd.confirmations.submitSoft")} onClick={() => decide("submit", "soft_closed")} />
        )}
        {canSubmit && <Button icon="pi pi-send" label={t("periodEnd.submitClose")} onClick={() => decide("submit", "closed")} />}
        {canApprove && run.status === "pending-approval" && (
          <ApprovalActions initiator={initiator} approveLabel={t("periodEnd.approveClose")} rejectLabel={t("periodEnd.confirmations.reject")}
            onApprove={() => decide("approve")} onReject={() => decide("reject")} />
        )}
        {!finished && run.status !== "soft-closed" && <Button icon="pi pi-ban" text severity="secondary" label={t("periodEnd.cancelRun")} onClick={() => decide("cancel")} />}
      </PageHeader>

      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.runStatus")}</div><div className="pe-kpi-value"><StatusTag status={run.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.periodStatus")}</div><div className="pe-kpi-value"><StatusTag status={run.periodInfo?.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.preparedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{run.preparedByName || "-"}</div><div className="pe-muted">{dateTime(run.preparedAt || run.openedAt)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.submittedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{run.submittedByName || "-"}</div><div className="pe-muted">{run.targetStatus ? t(`periodEnd.status.${run.targetStatus}`) : ""}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.approvedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{run.approvedByName || "-"}</div><div className="pe-muted">{dateTime(run.approvedAt)}</div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.executions")}</div><div className="pe-kpi-value">{run.executionCount}</div></div>
      </div>
      {run.rejectionReason && run.status !== "closed" && <div className="pe-card pe-error"><strong>{t("periodEnd.rejectedReason")}:</strong> {run.rejectionReason}</div>}

      <div className="pe-card">
        <div className="pe-card-title">{t("periodEnd.steps")}</div>
        <div className="pe-steps">
          {STEPS.map((s) => {
            const st = run.steps?.[s] || {};
            return (
              <div className="pe-step" key={s}>
                <div className="pe-step-head"><span>{t(`periodEnd.step.${s}`)}</span><StatusTag status={st.status || "pending"} /></div>
                <div className="pe-step-msg">{st.message || t(`periodEnd.stepHelp.${s}`)}</div>
                {st.reversalWarning && <div className="pe-step-msg pe-error">{st.reversalWarning}</div>}
                {st.at && <div className="pe-muted mt-1">{dateTime(st.at)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("periodEnd.checklist")}</div>
        <DataTable value={run.checks} dataKey="code" size="small" stripedRows>
          <Column header={t("periodEnd.item")} body={(r) => <div><div>{r.label}</div>{r.remarks && <div className="pe-muted">{r.remarks}</div>}</div>} />
          <Column header={t("periodEnd.type")} body={(r) => t(`periodEnd.itemType.${r.itemType}`)} style={{ width: "7rem" }} />
          <Column header={t("periodEnd.severity")} body={(r) => t(`periodEnd.severityValue.${r.severity}`)} style={{ width: "7rem" }} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} style={{ width: "9rem" }} />
          <Column header={t("periodEnd.result")} body={(r) => (r.itemType === "manual"
            ? (r.signedByName ? `${t("periodEnd.signedBy")} ${r.signedByName}, ${dateTime(r.signedAt)}` : "")
            : <span>{r.message}{r.amount ? ` (${money(r.amount)})` : ""}</span>)} />
          <Column header="" style={{ width: "9rem" }} body={(r) => (r.itemType === "manual" && !finished && run.status !== "pending-approval" ? (
            r.status === "signed-off"
              ? <Button size="small" text label={t("periodEnd.withdraw")} onClick={() => sign(r, true)} />
              : <Button size="small" outlined icon="pi pi-pencil" label={t("periodEnd.signOff")} onClick={() => sign(r, false)} />
          ) : null)} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("periodEnd.journalsCreated")}</div>
        <DataTable value={run.journals} dataKey="entryId" size="small" stripedRows emptyMessage={t("periodEnd.noJournals")}>
          <Column header={t("periodEnd.stepLabel")} body={(r) => t(`periodEnd.entryStep.${r.step}`)} />
          <Column header={t("periodEnd.journal")} body={(r) => <JournalLink journal={r} onOpen={setJournal} />} />
          <Column header={t("periodEnd.date")} body={(r) => date(r.date)} />
          <Column field="description" header={t("periodEnd.description")} />
          <Column header={t("periodEnd.amount")} body={(r) => money(r.amount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("periodEnd.autoReversal")} body={(r) => (r.reversalNumber
            ? <span><JournalLink journal={{ journalNumber: r.reversalNumber, date: r.reversalDate }} onOpen={setJournal} /> {date(r.reversalDate)}</span>
            : r.autoReverseOn ? `${t("periodEnd.due")} ${date(r.autoReverseOn)}` : "")} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => (
            <span className="flex gap-1 align-items-center flex-wrap">
              <StatusTag status={r.status === "undone" ? "undone" : r.journalStatus} />
              {(r.undoJournals || []).map((u) => <JournalLink key={u.journalId} journal={u} onOpen={setJournal} />)}
            </span>
          )} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("periodEnd.runActivity")}</div>
        <RecordActivityLog key={activityKey} entity="period_close_run" recordId={run.id} />
      </div>

      <div className="pe-card">
        <div className="pe-card-title">{t("periodEnd.periodHistory")}</div>
        <ActivityLog entries={fromStatusHistory(run.history, { statusLabels: periodStatusLabels })} />
      </div>

      <JournalDialog journal={journal} onHide={() => setJournal(null)} />
    </div>
  );
};

export default MonthEndCloseRun;
