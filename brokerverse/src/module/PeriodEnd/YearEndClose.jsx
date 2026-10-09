import React, { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { useStableLoad } from "../../hooks/useStableLoad";
import LoadingBar from "../../components/LoadingBar";
import { FieldsSkeleton } from "../../components/Skeletons";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { JournalDialog, PageHeader, StatusTag, date, dateTime, showError, showSuccess } from "./common";
import LinesEditor, { emptyLines } from "./LinesEditor";
import ActionDialog from "./yearEnd/ActionDialog";
import ActivityCard from "./yearEnd/ActivityCard";
import CheckList from "./yearEnd/CheckList";
import Facts from "./yearEnd/Facts";
import Stepper from "./yearEnd/Stepper";
import { AdjustmentsStep, ApprovalStep, ClosingStep, OpeningStep, PrerequisitesStep, netFact } from "./yearEnd/StepCards";
import "./yearEnd/YearEnd.scss";

const REMARK_MAX = 1000;
const cents = (v) => Math.round(Number(v || 0) * 100);
const balanced = (lines) => {
  const used = lines.filter((l) => l.accountCode || Number(l.debit) || Number(l.credit));
  const debit = used.reduce((s, l) => s + cents(l.debit), 0);
  return used.length >= 2 && used.every((l) => l.accountCode) && debit > 0 && debit === used.reduce((s, l) => s + cents(l.credit), 0);
};

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
  const [remark, setRemark] = useState("");
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

  /** Run an action, then reload the year (kept on screen meanwhile) and say it is done. */
  const act = async (name, fn, message, { resetStep = false } = {}) => {
    setBusy(name);
    try {
      await fn();
      if (resetStep) setStepKey(null);
      if (requested) await Promise.all([reload(), years.reload()]);
      else {
        setRequested(shown);
        await years.reload();
      }
      setDialog(null);
      if (message) showSuccess(toast, message);
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  const open = (name) => {
    setRemark("");
    setReason(null);
    setTried(false);
    setDialog(name);
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

  const remarkField = (
    <div className="ye-field">
      <label htmlFor="ye-remark" className="bv-field-label">{t("yearEndClose.remark")}<span className="ye-optional">{t("reasonPicker.optional", "(optional)")}</span></label>
      <InputTextarea id="ye-remark" value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} autoResize maxLength={REMARK_MAX} className="w-full" />
    </div>
  );
  const runFacts = run ? [
    { label: t("periodEnd.fiscalYear"), value: fy.code },
    { label: t("yearEndClose.run"), value: run.runNumber },
  ] : [];

  const renderStep = (key) => {
    const checks = (data.checks || []).filter((c) => c.step === key);
    if (key === "prerequisites") return <PrerequisitesStep checks={checks} onOpenYear={selectYear} />;
    if (key === "adjustments") return <AdjustmentsStep data={data} checks={checks} onOpenYear={selectYear} onOpenJournal={setJournal} />;
    if (key === "closing") return <ClosingStep data={data} onOpenJournal={setJournal} />;
    if (key === "approval") {
      return <ApprovalStep data={data} busy={busy} onClose={() => open("close")} onRequestReversal={() => open("requestReversal")}
        onApproveReversal={() => open("approveReversal")} onWithdrawReversal={() => open("withdraw")} />;
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
          <Facts items={[
            { label: t("periodEnd.fiscalYear"), value: `${fy.code} · ${date(fy.startDate)} – ${date(fy.endDate)}` },
            { label: t("periodEnd.yearStatus"), value: <StatusTag status={fy.status} /> },
            { label: t("yearEndClose.run"), value: <span className="ye-inline">{run.runNumber} <StatusTag status={run.status} /></span> },
            { label: t("yearEndClose.approval.preparedBy"), value: run.preparedByName ? `${run.preparedByName}, ${date(run.preparedAt)}` : date(run.preparedAt) },
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
        <h2 className="ye-empty__text" id="ye-empty-title">{t("yearEndClose.empty", { fiscalYear: fy.code, from: date(fy.startDate), to: date(fy.endDate) })}</h2>
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
        {actions.cancel?.allowed && <Button type="button" text severity="secondary" icon="pi pi-ban" label={t("periodEnd.cancelRun")} onClick={() => open("cancel")} />}
      </PageHeader>

      <div className="ye-body bv-loading-host">
        <LoadingBar active={refreshing} />
        {error && <div className="pe-error" role="alert">{error}</div>}
        {loading && !data && <div className="pe-card"><FieldsSkeleton rows={2} columns={3} /></div>}
        {data && (run ? renderRun() : renderEmpty())}
        {data && <ActivityCard activity={data.activity} />}
      </div>

      <JournalDialog journal={journal} onHide={() => setJournal(null)} />

      {run && (
        <>
          <ActionDialog visible={dialog === "close"} title={t("yearEndClose.dialog.closeTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
            facts={[...runFacts, netFact(t, data.closing?.netIncome), { label: t("yearEndClose.closing.journalDate"), value: `${date(fy.endDate)} (${fy.adjustmentPeriod})` },
              { label: t("periodEnd.nextFiscalYear"), value: data.opening?.fiscalYear }, { label: t("yearEndClose.opening.accounts"), value: String(data.opening?.lines.length ?? 0) }]}
            consequence={t("yearEndClose.dialog.closeConsequence", { fiscalYear: fy.code })} cancelLabel={t("periodEnd.cancel")} confirmLabel={t("yearEndClose.approval.close")}
            confirmIcon="pi pi-lock" busy={busy === "close"} onConfirm={() => act("close", () => periodEndService.closeYearEnd(run.id, remark.trim()), t("periodEnd.yearClosed"))}>
            {remarkField}
          </ActionDialog>

          <ActionDialog visible={dialog === "requestReversal"} title={t("yearEndClose.dialog.requestTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
            facts={[...runFacts, { label: t("yearEndClose.approval.closedBy"), value: run.closedByName ? `${run.closedByName}, ${dateTime(run.closedAt)}` : dateTime(run.closedAt) }]}
            consequence={t("yearEndClose.dialog.requestConsequence")} cancelLabel={t("periodEnd.cancel")} confirmLabel={t("yearEndClose.reversal.request")}
            confirmIcon="pi pi-send" busy={busy === "request"} onConfirm={confirmReversalRequest}>
            <ReasonPicker context="year_end_reverse" value={reason} onChange={setReason} showErrors={tried} />
          </ActionDialog>

          <ActionDialog visible={dialog === "approveReversal"} title={t("yearEndClose.dialog.reverseTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
            facts={[...runFacts,
              { label: t("yearEndClose.reversal.requestedBy"), value: run.reverseRequest ? `${run.reverseRequest.byName || "-"}, ${dateTime(run.reverseRequest.at)}` : null },
              { label: t("yearEndClose.reversal.reason"), value: run.reverseRequest?.reason }]}
            consequence={t("yearEndClose.dialog.reverseConsequence", { fiscalYear: run.nextFiscalYear })} cancelLabel={t("periodEnd.cancel")} confirmLabel={t("yearEndClose.reversal.approve")}
            confirmIcon="pi pi-undo" severity="warning" busy={busy === "reverse"}
            onConfirm={() => act("reverse", () => periodEndService.reverseYearEnd(run.id, remark.trim()), t("periodEnd.yearReversed"), { resetStep: true })}>
            {remarkField}
          </ActionDialog>

          <ActionDialog visible={dialog === "withdraw"} title={t("yearEndClose.dialog.withdrawTitle")} onHide={() => setDialog(null)}
            facts={[...runFacts, { label: t("yearEndClose.reversal.reason"), value: run.reverseRequest?.reason }]}
            cancelLabel={t("yearEndClose.dialog.keepRequest")} confirmLabel={t("yearEndClose.reversal.withdraw")} busy={busy === "withdraw"}
            onConfirm={() => act("withdraw", () => periodEndService.withdrawYearEndReversal(run.id), t("yearEndClose.toast.reversalWithdrawn"))} />

          <ActionDialog visible={dialog === "cancel"} title={t("yearEndClose.dialog.cancelTitle", { runNumber: run.runNumber })} onHide={() => setDialog(null)}
            facts={[...runFacts, { label: t("yearEndClose.approval.preparedBy"), value: run.preparedByName }]}
            consequence={t("yearEndClose.dialog.cancelConsequence", { fiscalYear: fy.code })} cancelLabel={t("yearEndClose.dialog.keepRun")} confirmLabel={t("periodEnd.cancelRun")}
            severity="danger" busy={busy === "cancel"} onConfirm={() => act("cancel", () => periodEndService.cancelYearEnd(run.id), t("yearEndClose.toast.cancelled"), { resetStep: true })} />
        </>
      )}

      {fy && (
        <ActionDialog visible={dialog === "adjustment" && !!adjustment} width={980} title={t("yearEndClose.dialog.adjustmentTitle", { fiscalYear: fy.code })} onHide={() => setDialog(null)}
          facts={[{ label: t("periodEnd.fiscalYear"), value: fy.code }, { label: t("periodEnd.period"), value: fy.adjustmentPeriod },
            { label: t("yearEndClose.closing.journalDate"), value: date(fy.endDate) }]}
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
        </ActionDialog>
      )}
    </div>
  );
};

export default YearEndClose;
