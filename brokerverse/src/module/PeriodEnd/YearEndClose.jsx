import React, { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { useStableLoad } from "../../hooks/useStableLoad";
import LoadingBar from "../../components/LoadingBar";
import { FieldsSkeleton } from "../../components/Skeletons";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import { ActivityLog, toEntry } from "../../components/ActivityLog";
import { JournalDialog, PageHeader, StatusTag, date, showError, showSuccess } from "./common";
import LinesEditor, { emptyLines } from "./LinesEditor";
import CheckList from "./yearEnd/CheckList";
import FormDialog from "./yearEnd/FormDialog";
import Stepper from "./yearEnd/Stepper";
import { AdjustmentsStep, ApprovalStep, ClosingStep, OpeningStep, PrerequisitesStep, byAt, netFact } from "./yearEnd/StepCards";
import "./yearEnd/YearEnd.scss";

const REMARK_MAX = 1000;
const cents = (v) => Math.round(Number(v || 0) * 100);
const balanced = (lines) => {
  const used = lines.filter((l) => l.accountCode || Number(l.debit) || Number(l.credit));
  const debit = used.reduce((s, l) => s + cents(l.debit), 0);
  return used.length >= 2 && used.every((l) => l.accountCode) && debit > 0 && debit === used.reduce((s, l) => s + cents(l.credit), 0);
};
// the actions of the year-end close in the vocabulary of the shared activity log (it colours each entry by it)
const ACTIVITY_TONE = { start: "create", check: "update", close: "close", "reverse-request": "submit", "reverse-withdraw": "withdraw", reverse: "reverse", cancel: "cancel" };

/**
 * Accounts > Period End > Year-End Close: a guided process in five steps (prerequisites, year-end adjustments,
 * closing entries, close of the year by an Accounting Manager other than the preparer, opening balances of the next
 * fiscal year), each a card with its checks and where to resolve them, and the reversal of a close (requested with a
 * reason, approved by another Accounting Manager). One overview request per fiscal year feeds the screen; it is
 * reloaded after every action and the content stays on screen while it reloads.
 */
const YearEndClose = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params, setParams] = useSearchParams();
  // the year asked for (from the link or the drop-down); without one the server picks the year being closed
  const [requested, setRequested] = useState(params.get("fiscalYear") || null);
  const [stepKey, setStepKey] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [adjustment, setAdjustment] = useState(null);
  const [journal, setJournal] = useState(null);

  const years = useStableLoad(useCallback(() => periodEndService.yearEnd(), []), { initialData: [] });
  const { data, loading, refreshing, error, reload } = useStableLoad(useCallback(() => periodEndService.yearEndOverview(requested), [requested]));
  const fy = data?.fiscalYear;
  const run = data?.run;
  const actions = data?.actions || {};
  const shown = requested || fy?.code || null;

  const selectYear = (code) => {
    setRequested(code);
    setStepKey(null);
    setParams({ fiscalYear: code }, { replace: true });
  };

  /** Reload the year (kept on screen meanwhile), pinned to the year shown, and say what was done. */
  const refresh = async (message, { resetStep = false } = {}) => {
    if (resetStep) setStepKey(null);
    if (requested) await Promise.all([reload(), years.reload()]);
    else {
      setRequested(shown);
      await years.reload();
    }
    if (message) showSuccess(toast, message);
  };
  /** An action of a form or a button: its error goes to a toast. */
  const act = async (name, fn, message, options) => {
    setBusy(name);
    try {
      await fn();
      setDialog(null);
      await refresh(message, options);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };
  /** The action of a confirmation: the dialog shows its error, and closes once it succeeded. */
  const confirmed = (fn, message, options) => async (remark) => {
    await fn(remark);
    await refresh(message, options);
  };

  const confirmReversalRequest = () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    act("request", () => periodEndService.requestYearEndReversal(run.id, reasonPayload(reason)), t("yearEndClose.toast.reversalRequested"));
  };
  const saveAdjustment = () => act("adjust", () => periodEndService.createAdjustment({
    fiscalYear: fy.code,
    description: adjustment.description.trim(),
    lines: adjustment.lines.filter((l) => l.accountCode).map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit || 0), credit: Number(l.credit || 0), memo: l.memo || undefined })),
  }), t("periodEnd.adjustmentCreated"));

  const yearOptions = (years.data || []).map((y) => ({ label: `${y.code} · ${t(`periodEnd.status.${y.status}`)}`, value: y.code }));
  if (fy && !yearOptions.some((o) => o.value === fy.code)) yearOptions.push({ label: `${fy.code} · ${t(`periodEnd.status.${fy.status}`)}`, value: fy.code });

  const remarkInput = { type: "textarea", label: t("yearEndClose.remark"), maxLength: REMARK_MAX, rows: 2 };
  const runFacts = run ? [
    { label: t("periodEnd.fiscalYear"), value: fy.code },
    { label: t("yearEndClose.run"), value: run.runNumber },
  ] : [];
  const statusWord = (s) => (s ? t(`periodEnd.status.${s}`, { defaultValue: s }) : null);
  const severalRuns = new Set((data?.activity || []).map((a) => a.runNumber)).size > 1;
  const activity = (data?.activity || []).map((a, i) => toEntry({
    id: a.id, at: a.at, actionCode: ACTIVITY_TONE[a.action] || a.action, actionLabel: t(`yearEndClose.action.${a.action}`, { defaultValue: a.action }),
    user: { displayName: a.byName, role: (a.roles || []).join(", ") || null }, fromStatus: statusWord(a.fromStatus), toStatus: statusWord(a.toStatus),
    remarks: [severalRuns ? a.runNumber : null, a.remarks].filter(Boolean).join(" · ") || null,
  }, i));

  const renderStep = (key) => {
    const checks = (data.checks || []).filter((c) => c.step === key);
    if (key === "prerequisites") return <PrerequisitesStep checks={checks} onOpenYear={selectYear} />;
    if (key === "adjustments") return <AdjustmentsStep data={data} checks={checks} onOpenYear={selectYear} onOpenJournal={setJournal} />;
    if (key === "closing") return <ClosingStep data={data} onOpenJournal={setJournal} />;
    if (key === "approval") {
      return <ApprovalStep data={data} onClose={() => setDialog("close")} onRequestReversal={() => { setReason(null); setTried(false); setDialog("requestReversal"); }}
        onApproveReversal={() => setDialog("approveReversal")} onWithdrawReversal={() => setDialog("withdraw")} />;
    }
    return <OpeningStep data={data} />;
  };
  const stepActions = (key) => {
    if (key === "prerequisites" && actions.check?.allowed) {
      return <Button type="button" icon="pi pi-refresh" outlined label={t("yearEndClose.runChecks")} loading={busy === "check"}
        onClick={() => act("check", () => periodEndService.checkYearEnd(run.id), t("yearEndClose.toast.checked"))} />;
    }
    if (key === "adjustments" && actions.adjust?.allowed) {
      return <Button type="button" icon="pi pi-plus" outlined label={t("yearEndClose.adjustments.add")} onClick={() => { setAdjustment({ description: "", lines: emptyLines() }); setDialog("adjustment"); }} />;
    }
    return null;
  };

  const renderRun = () => {
    const active = data.steps.some((s) => s.key === stepKey) ? stepKey : data.currentStep;
    const index = data.steps.findIndex((s) => s.key === active);
    const step = data.steps[index];
    return (
      <>
        <section className="pe-card ye-summary" aria-label={t("yearEndClose.summary")}>
          <KeyValueGrid columns="auto" items={[
            { label: t("periodEnd.fiscalYear"), value: <>{fy.code}<span className="ye-fact-note">{`${date(fy.startDate)} – ${date(fy.endDate)}`}</span></> },
            { label: t("periodEnd.yearStatus"), value: <StatusTag status={fy.status} /> },
            { label: t("yearEndClose.run"), value: <span className="ye-inline">{run.runNumber} <StatusTag status={run.status} /></span> },
            { label: t("yearEndClose.approval.preparedBy"), value: byAt(run.preparedByName, run.preparedAt) },
            netFact(t, run.status === "closed" ? run.netIncome : data.closing?.netIncome),
            { label: t("periodEnd.nextFiscalYear"), value: data.opening?.fiscalYear },
          ]} />
        </section>
        <Stepper steps={data.steps} active={active} onSelect={setStepKey} />
        <section className="pe-card ye-step" aria-labelledby="ye-step-title">
          <header className="ye-step__head">
            <h2 className="ye-step__title" id="ye-step-title">{`${index + 1}. ${t(`yearEndClose.step.${active}`)}`}</h2>
            <StatusTag status={step.status} />
            <div className="ye-step__actions">{stepActions(active)}</div>
          </header>
          {renderStep(active)}
          <footer className="ye-step__nav">
            <Button type="button" text icon="pi pi-arrow-left" label={t("yearEndClose.previous")} disabled={index === 0} onClick={() => setStepKey(data.steps[index - 1].key)} />
            <Button type="button" text icon="pi pi-arrow-right" iconPos="right" label={t("yearEndClose.next")} disabled={index === data.steps.length - 1}
              onClick={() => setStepKey(data.steps[index + 1].key)} />
          </footer>
        </section>
      </>
    );
  };

  const renderEmpty = () => (
    <section className="pe-card ye-empty" aria-labelledby="ye-empty-title">
      <div className="ye-empty__line">
        <p className="ye-empty__text" id="ye-empty-title">{t("yearEndClose.empty", { fiscalYear: fy.code, from: date(fy.startDate), to: date(fy.endDate) })}</p>
        {actions.start?.allowed && (
          <Button type="button" icon="pi pi-play" label={t("yearEndClose.start")} loading={busy === "start"}
            onClick={() => act("start", () => periodEndService.createYearEnd(fy.code), t("periodEnd.yearEndStarted"), { resetStep: true })} />
        )}
      </div>
      <h3 className="ye-subtitle">{t("yearEndClose.step.prerequisites")}</h3>
      <CheckList checks={(data.checks || []).filter((c) => c.step === "prerequisites")} onOpenYear={selectYear} />
    </section>
  );

  return (
    <div className="pe-page ye-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.yearEndClose")} trail={[t("periodEnd.yearEndClose")]} help={t("yearEndClose.help")}>
        <Dropdown value={shown} options={yearOptions} onChange={(e) => selectYear(e.value)} aria-label={t("periodEnd.fiscalYear")} className="ye-year" />
        {actions.cancel?.allowed && <Button type="button" text severity="secondary" icon="pi pi-ban" label={t("periodEnd.cancelRun")} onClick={() => setDialog("cancel")} />}
      </PageHeader>

      <div className="ye-body bv-loading-host">
        <LoadingBar active={refreshing} />
        {error && <div className="pe-error" role="alert">{error}</div>}
        {loading && !data && <div className="pe-card"><FieldsSkeleton rows={2} columns={3} /></div>}
        {data && (run ? renderRun() : renderEmpty())}
        {activity.length > 0 && (
          <section className="pe-card" aria-labelledby="ye-activity-title">
            <h2 className="pe-card-title" id="ye-activity-title">{t("yearEndClose.activity.title")}</h2>
            <ActivityLog entries={activity} />
          </section>
        )}
      </div>

      <JournalDialog journal={journal} onHide={() => setJournal(null)} />

      {run && (
        <>
          <ConfirmDialog visible={dialog === "close"} onHide={() => setDialog(null)} severity="warning" icon="pi pi-lock"
            title={t("yearEndClose.dialog.closeTitle", { fiscalYear: fy.code })}
            message={t("yearEndClose.dialog.closeMessage", { period: fy.adjustmentPeriod, date: date(fy.endDate), fiscalYear: data.opening?.fiscalYear })}
            facts={[...runFacts, netFact(t, data.closing?.netIncome), { label: t("yearEndClose.opening.accounts"), value: data.opening?.lines.length ?? 0, type: "number" }]}
            input={remarkInput} note={t("yearEndClose.dialog.closeConsequence", { fiscalYear: fy.code })} confirmLabel={t("yearEndClose.approval.close")} confirmIcon="pi pi-lock"
            onConfirm={confirmed((remark) => periodEndService.closeYearEnd(run.id, remark), t("periodEnd.yearClosed"))} />

          <ConfirmDialog visible={dialog === "approveReversal"} onHide={() => setDialog(null)} severity="warning" icon="pi pi-undo"
            title={t("yearEndClose.dialog.reverseTitle", { fiscalYear: fy.code })} message={t("yearEndClose.dialog.reverseMessage", { fiscalYear: fy.code })}
            facts={[...runFacts,
              { label: t("yearEndClose.reversal.requestedBy"), value: run.reverseRequest ? byAt(run.reverseRequest.byName, run.reverseRequest.at) : null },
              { label: t("yearEndClose.reversal.reason"), value: run.reverseRequest?.reason }]}
            input={remarkInput} note={t("yearEndClose.dialog.reverseConsequence", { fiscalYear: run.nextFiscalYear })} confirmLabel={t("yearEndClose.reversal.approve")} confirmIcon="pi pi-undo"
            onConfirm={confirmed((remark) => periodEndService.reverseYearEnd(run.id, remark), t("periodEnd.yearReversed"), { resetStep: true })} />

          <ConfirmDialog visible={dialog === "withdraw"} onHide={() => setDialog(null)} title={t("yearEndClose.dialog.withdrawTitle")}
            message={t("yearEndClose.dialog.withdrawMessage", { fiscalYear: fy.code })}
            facts={[...runFacts, { label: t("yearEndClose.reversal.reason"), value: run.reverseRequest?.reason }]}
            cancelLabel={t("yearEndClose.dialog.keepRequest")} confirmLabel={t("yearEndClose.reversal.withdraw")}
            onConfirm={confirmed(() => periodEndService.withdrawYearEndReversal(run.id), t("yearEndClose.toast.reversalWithdrawn"))} />

          <ConfirmDialog visible={dialog === "cancel"} onHide={() => setDialog(null)} severity="danger" title={t("yearEndClose.dialog.cancelTitle", { runNumber: run.runNumber })}
            message={t("yearEndClose.dialog.cancelMessage", { runNumber: run.runNumber })} facts={[...runFacts, { label: t("yearEndClose.approval.preparedBy"), value: run.preparedByName }]}
            note={t("yearEndClose.dialog.cancelConsequence", { fiscalYear: fy.code })} cancelLabel={t("yearEndClose.dialog.keepRun")} confirmLabel={t("periodEnd.cancelRun")}
            onConfirm={confirmed(() => periodEndService.cancelYearEnd(run.id), t("yearEndClose.toast.cancelled"), { resetStep: true })} />

          <FormDialog visible={dialog === "requestReversal"} title={t("yearEndClose.dialog.requestTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
            facts={[...runFacts, { label: t("yearEndClose.approval.closedBy"), value: byAt(run.closedByName, run.closedAt) }]}
            consequence={t("yearEndClose.dialog.requestConsequence")} cancelLabel={t("periodEnd.cancel")} confirmLabel={t("yearEndClose.reversal.request")}
            confirmIcon="pi pi-send" busy={busy === "request"} onConfirm={confirmReversalRequest}>
            <ReasonPicker context="year_end_reverse" value={reason} onChange={setReason} showErrors={tried} />
          </FormDialog>
        </>
      )}

      {fy && (
        <FormDialog visible={dialog === "adjustment" && !!adjustment} width={980} title={t("yearEndClose.dialog.adjustmentTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
          facts={[{ label: t("periodEnd.fiscalYear"), value: fy.code }, { label: t("periodEnd.period"), value: fy.adjustmentPeriod },
            { label: t("yearEndClose.closing.journalDate"), value: fy.endDate, type: "date" }]}
          consequence={t("yearEndClose.dialog.adjustmentConsequence")} cancelLabel={t("periodEnd.cancel")} confirmLabel={t("yearEndClose.dialog.submitAdjustment")}
          confirmIcon="pi pi-send" busy={busy === "adjust"} disabled={!adjustment || adjustment.description.trim().length < 2 || !balanced(adjustment.lines)} onConfirm={saveAdjustment}>
          {adjustment && (
            <>
              <div className="ye-field">
                <label htmlFor="ye-adj-desc" className="bv-field-label">{t("periodEnd.description")}<span className="required-marker">*</span></label>
                <InputText id="ye-adj-desc" value={adjustment.description} maxLength={500} onChange={(e) => setAdjustment({ ...adjustment, description: e.target.value })} className="w-full" />
              </div>
              <LinesEditor lines={adjustment.lines} onChange={(lines) => setAdjustment({ ...adjustment, lines })} />
            </>
          )}
        </FormDialog>
      )}
    </div>
  );
};

export default YearEndClose;
