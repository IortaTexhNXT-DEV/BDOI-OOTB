import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { JournalDialog, JournalLink, PageHeader, StatusTag, date, dateTime, money, showError, showSuccess } from "./common";
import { hasPermission } from "../../utils/canOpen";

const STEPS = ["accruals", "recurring", "deferral", "fx", "depreciation", "checks"];

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
  const [dialog, setDialog] = useState(null); // { kind: submit|approve|reject|cancel|sign, code?, target? }
  const [text, setText] = useState("");
  const [target, setTarget] = useState("closed");
  const [journal, setJournal] = useState(null);

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
      setDialog(null);
      setText("");
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

  const confirm = () => {
    const d = dialog;
    if (d.kind === "submit") return act("submit", () => periodEndService.submitRun(run.id, target, text), t("periodEnd.submitted"));
    if (d.kind === "approve") return act("approve", () => periodEndService.approveRun(run.id, text), t("periodEnd.approved"));
    if (d.kind === "reject") return act("reject", () => periodEndService.rejectRun(run.id, text), t("periodEnd.rejected"));
    if (d.kind === "cancel") return act("cancel", () => periodEndService.cancelRun(run.id, text), t("periodEnd.cancelled"));
    if (d.kind === "sign") return act("sign", () => periodEndService.signCheck(run.id, d.code, text, !d.withdraw), t("periodEnd.signedOff"));
    return null;
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={`${t("periodEnd.monthEndClose")} ${run.period}`} trail={[t("periodEnd.monthEndClose"), run.runNumber]}
        subtitle={`${run.runNumber} · ${t("periodEnd.fiscalYear")} ${run.fiscalYear || "-"} · ${date(run.periodInfo?.startDate)} – ${date(run.periodInfo?.endDate)}`}>
        <Button icon="pi pi-arrow-left" text label={t("periodEnd.back")} onClick={() => navigate("/accounts/period-end/close")} />
        {canExecute && (
          <Button icon="pi pi-play" label={run.executionCount ? t("periodEnd.rerunSteps") : t("periodEnd.runSteps")} loading={busy === "execute"}
            onClick={() => act("execute", () => periodEndService.executeRun(run.id), t("periodEnd.stepsDone"))} />
        )}
        {canExecute && run.executionCount > 0 && (
          <Button icon="pi pi-refresh" outlined label={t("periodEnd.recheck")} loading={busy === "recheck"} onClick={() => act("recheck", () => periodEndService.recheckRun(run.id))} />
        )}
        {canSubmit && <Button icon="pi pi-send" label={t("periodEnd.submitClose")} onClick={() => { setTarget(run.status === "soft-closed" ? "closed" : "closed"); setDialog({ kind: "submit" }); }} />}
        {canApprove && run.status === "pending-approval" && (
          <>
            <Button icon="pi pi-check" label={t("periodEnd.approveClose")} onClick={() => setDialog({ kind: "approve" })} />
            <Button icon="pi pi-times" severity="danger" outlined label={t("periodEnd.reject")} onClick={() => setDialog({ kind: "reject" })} />
          </>
        )}
        {!finished && run.status !== "soft-closed" && <Button icon="pi pi-ban" text severity="secondary" label={t("periodEnd.cancelRun")} onClick={() => setDialog({ kind: "cancel" })} />}
      </PageHeader>

      <div className="pe-kpis">
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.runStatus")}</div><div className="pe-kpi-value"><StatusTag status={run.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.periodStatus")}</div><div className="pe-kpi-value"><StatusTag status={run.periodInfo?.status} /></div></div>
        <div className="pe-kpi"><div className="pe-kpi-label">{t("periodEnd.preparedBy")}</div><div className="pe-kpi-value" style={{ fontSize: "1rem" }}>{run.preparedByName || "-"}</div><div className="pe-muted">{dateTime(run.preparedAt)}</div></div>
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
              ? <Button size="small" text label={t("periodEnd.withdraw")} onClick={() => { setText(""); setDialog({ kind: "sign", code: r.code, label: r.label, withdraw: true }); }} />
              : <Button size="small" outlined icon="pi pi-pencil" label={t("periodEnd.signOff")} onClick={() => { setText(""); setDialog({ kind: "sign", code: r.code, label: r.label }); }} />
          ) : null)} />
        </DataTable>
      </div>

      <div className="pe-card">
        <div className="pe-card-title">
          <span>{t("periodEnd.journalsCreated")} ({activeJournals.length})</span>
        </div>
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
        <div className="pe-card-title">{t("periodEnd.periodHistory")}</div>
        <DataTable value={run.history} size="small" emptyMessage={t("periodEnd.noRows")}>
          <Column header={t("periodEnd.when")} body={(r) => dateTime(r.changedAt)} />
          <Column header={t("periodEnd.from")} body={(r) => <StatusTag status={r.from} />} />
          <Column header={t("periodEnd.to")} body={(r) => <StatusTag status={r.to} />} />
          <Column field="changedBy" header={t("periodEnd.by")} />
          <Column field="remarks" header={t("periodEnd.remarks")} />
        </DataTable>
      </div>

      <JournalDialog journal={journal} onHide={() => setJournal(null)} />

      <Dialog className="pe-dialog" visible={!!dialog} style={{ width: "min(520px, 95vw)" }} onHide={() => setDialog(null)}
        header={dialog ? (dialog.kind === "sign" ? dialog.label : t(`periodEnd.dialog.${dialog.kind}`)) : ""}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setDialog(null)} />
            <Button label={t("periodEnd.confirm")} icon="pi pi-check" loading={!!busy} onClick={confirm}
              disabled={dialog?.kind === "reject" && !text.trim()} />
          </div>
        )}>
        {dialog && (
          <div>
            {dialog.kind === "submit" && (
              <div className="mb-3">
                <label>{t("periodEnd.closeAs")}</label>
                <SelectButton value={target} onChange={(e) => e.value && setTarget(e.value)}
                  options={[{ label: t("periodEnd.status.soft_closed"), value: "soft_closed", disabled: run.status === "soft-closed" }, { label: t("periodEnd.status.closed"), value: "closed" }]} />
                <p className="pe-muted">{t("periodEnd.submitHelp")}</p>
              </div>
            )}
            <label htmlFor="pe-dialog-text">{dialog.kind === "reject" ? `${t("periodEnd.reason")} *` : t("periodEnd.remarks")}</label>
            <InputTextarea id="pe-dialog-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full" autoResize />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default MonthEndCloseRun;
