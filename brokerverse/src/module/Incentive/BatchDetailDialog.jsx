import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Skeleton } from "primereact/skeleton";
import ActivityLog, { toEntry } from "../../components/ActivityLog";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { useStableLoad } from "../../hooks/useStableLoad";
import incentiveService from "../../services/incentiveService";
import { readableError } from "../../utility/apiError";
import { formatCurrency } from "../../utility/currencyConverter";
import { formatDate } from "../../utility/dateFormat";
import { formatPercent } from "../../utility/numberFormat";
import { hasPermission } from "../../utils/canOpen";
import { WRITE, batchFacts, decisionBlock, formatMeasure, programNames } from "./common";
import TelesalesPolicies from "./TelesalesPolicies";

/**
 * The decision on a batch, approve or reject, in one layout: the facts of the batch, then optional remarks (approve) or
 * a reason of the Reason Codes master (incentive_batch_reject) with its note (reject).
 */
export const BatchDecisionDialog = ({ action, batch, visible, onHide, onDone }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const approving = action === "approve";

  const reset = () => {
    setReason(null);
    setRemarks("");
    setTried(false);
    setError(null);
  };
  const close = () => {
    reset();
    onHide();
  };
  const decide = async () => {
    setTried(true);
    if (!approving && reasonProblem(reason)) return;
    setBusy(true);
    setError(null);
    try {
      const after = approving
        ? await incentiveService.approveCalculation(batch.batchId, remarks.trim())
        : await incentiveService.rejectCalculation(batch.batchId, reasonPayload(reason));
      reset();
      onDone(after);
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} outlined onClick={close} disabled={busy} />
      <Button type="button" label={t(approving ? "incentive.batch.approveBatch" : "incentive.batch.rejectBatch")} severity={approving ? undefined : "danger"}
        onClick={decide} loading={busy} />
    </>
  );
  return (
    <Dialog visible={visible} onHide={close} header={t(approving ? "incentive.batch.approveTitle" : "incentive.batch.rejectTitle")} footer={footer} modal draggable={false}
      resizable={false} className="bv-centered inc-decision-dialog" style={{ width: "36rem" }} breakpoints={{ "640px": "100vw" }}>
      {batch ? <KeyValueGrid columns={2} items={batchFacts(batch, t)} /> : null}
      {approving ? (
        <div className="inc-form inc-decision-dialog__input">
          <label htmlFor="inc-approve-remarks" className="inc-form__label">{t("incentive.batch.remarks")}</label>
          <InputTextarea id="inc-approve-remarks" value={remarks} rows={3} maxLength={1000} autoResize onChange={(e) => setRemarks(e.target.value)} autoFocus />
        </div>
      ) : (
        <ReasonPicker context="incentive_batch_reject" value={reason} onChange={setReason} showErrors={tried} autoFocus className="inc-decision-dialog__input" />
      )}
      {error ? <FieldError error={error} /> : null}
    </Dialog>
  );
};

BatchDecisionDialog.propTypes = {
  action: PropTypes.oneOf(["approve", "reject"]).isRequired,
  batch: PropTypes.shape({ batchId: PropTypes.string }),
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
};
BatchDecisionDialog.defaultProps = { batch: null };

/** Adjustment of one agent line: the amount added (or taken off, negative) and a reason of the Reason Codes master (incentive_adjustment). */
const AdjustLineDialog = ({ batchId, line, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(line ? Number(line.adjustments || 0) : 0);
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setTried(true);
    if (reasonProblem(reason) || amount === null) return;
    setBusy(true);
    setError(null);
    try {
      await incentiveService.adjustCalculation(batchId, [{ id: line.id, adjustments: amount }], reasonPayload(reason));
      onSaved();
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} outlined onClick={onHide} disabled={busy} />
      <Button type="button" label={t("incentive.batch.saveAdjustment")} onClick={save} loading={busy} />
    </>
  );
  return (
    <Dialog visible={!!line} onHide={onHide} header={t("incentive.batch.adjustTitle")} footer={footer} modal draggable={false} resizable={false}
      className="bv-centered" style={{ width: "34rem" }} breakpoints={{ "640px": "100vw" }}>
      {line ? (
        <div className="inc-form">
          <KeyValueGrid columns={2} items={[
            { label: t("incentive.batch.agent"), value: line.agentName },
            { label: t("incentive.batch.program"), value: line.program },
            { label: t("incentive.batch.baseIncentive"), value: line.baseIncentive, type: "amount" },
            { label: t("incentive.batch.payout"), value: line.finalAmount, type: "amount" },
            { label: t("incentive.batch.adjustmentReason"), value: line.adjustmentReason, span: "full", hidden: !line.adjustmentReason },
          ]} />
          <label htmlFor="inc-adjust-amount" className="inc-form__label">{t("incentive.batch.adjustment")}</label>
          <InputNumber inputId="inc-adjust-amount" value={amount} onValueChange={(e) => setAmount(e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} />
          <ReasonPicker context="incentive_adjustment" value={reason} onChange={setReason} showErrors={tried} />
          {error ? <FieldError error={error} /> : null}
        </div>
      ) : null}
    </Dialog>
  );
};

AdjustLineDialog.propTypes = {
  batchId: PropTypes.string,
  line: PropTypes.object,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
AdjustLineDialog.defaultProps = { batchId: null, line: null };

/**
 * A calculation batch in one view (Calculations and Approvals): the header with its status and totals, the summary,
 * the agent results and the activity log; the actions of its status in the footer. Approve and Reject are disabled,
 * with the reason shown, for a user without the approval permission or who created or submitted the batch.
 */
/** The withholding tax % of a telesales batch (the version of its lines). */
const r0 = (lines) => Number(lines.find((l) => l.whtPct !== null && l.whtPct !== undefined)?.whtPct ?? 0).toFixed(2);

const BatchDetailDialog = ({ batchId, onHide, onChanged }) => {
  const { t } = useTranslation();
  const [deciding, setDeciding] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const open = !!batchId;

  const batchLoader = useCallback(() => incentiveService.getCalculation(batchId), [batchId]);
  const activityLoader = useCallback(() => incentiveService.calculationActivity(batchId), [batchId]);
  const { data: batch, refreshing, error, reload } = useStableLoad(batchLoader, { enabled: open });
  const activity = useStableLoad(activityLoader, { enabled: open });

  const shown = batch && batch.batchId === batchId ? batch : null;
  const canWrite = hasPermission(WRITE);
  const block = shown ? decisionBlock(shown, t) : null;
  const pending = shown?.status === "Pending Approval";
  const editable = shown && ["Calculated", "Rejected"].includes(shown.status);

  const refresh = async (message) => {
    const after = await reload();
    activity.reload();
    onChanged(after || shown, message);
  };

  // a batch without agent lines has nothing to approve
  const empty = shown && !Number(shown.agentCount);
  const submit = () => openConfirm({
    title: t("incentive.batch.submitTitle"),
    facts: batchFacts(shown, t),
    confirmLabel: t("incentive.batch.submitForApproval"),
    onConfirm: () => incentiveService.submitCalculation(shown.batchId),
  }).then((done) => done && refresh(t("incentive.batch.submitted", { batchId: shown.batchId })));

  const telesales = !!shown?.isTelesales;
  const [working, setWorking] = useState(false);
  const recalculate = async () => {
    setWorking(true);
    try {
      await incentiveService.recalculate(shown.batchId);
      await refresh(t("incentive.telesales.recalculated", { batchId: shown.batchId }));
    } catch (e) {
      onChanged(shown, readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setWorking(false);
    }
  };
  const exportBatch = () => incentiveService.exportBatch(shown.batchId).catch((e) => onChanged(shown, readableError(e?.message) || t("confirmDialog.failed")));

  const markPaid = () => openConfirm({
    title: t("incentive.batch.payTitle"),
    message: t("incentive.batch.payMessage"),
    facts: batchFacts(shown, t),
    input: { type: "text", label: t("incentive.batch.paymentReference"), required: true, maxLength: 60 },
    confirmLabel: t("incentive.batch.markPaid"),
    onConfirm: (paymentReference) => incentiveService.payCalculation(shown.batchId, { paymentReference }),
  }).then((value) => value !== null && refresh(t("incentive.batch.paid", { batchId: shown.batchId })));

  const footer = (
    <div className="inc-dialog-footer">
      {pending && block ? (
        <span className="inc-dialog-footer__reason">
          <i className="pi pi-lock" aria-hidden="true" />
          {block}
        </span>
      ) : null}
      {editable && canWrite && empty ? (
        <span className="inc-dialog-footer__reason">
          <i className="pi pi-lock" aria-hidden="true" />
          {t("incentive.batch.emptyBatch")}
        </span>
      ) : null}
      <Button type="button" label={t("incentive.close")} outlined onClick={onHide} />
      {telesales ? <Button type="button" label={t("incentive.telesales.export")} icon="pi pi-file-excel" outlined onClick={exportBatch} /> : null}
      {telesales && editable && canWrite ? <Button type="button" label={t("incentive.telesales.recalculate")} icon="pi pi-refresh" outlined loading={working} onClick={recalculate} /> : null}
      {editable && canWrite ? <Button type="button" label={t("incentive.batch.submitForApproval")} disabled={empty} onClick={submit} /> : null}
      {pending ? (
        <>
          <Button type="button" label={t("incentive.batch.reject")} severity="danger" outlined disabled={!!block} onClick={() => setDeciding("reject")} />
          <Button type="button" label={t("incentive.batch.approveBatch")} disabled={!!block} onClick={() => setDeciding("approve")} />
        </>
      ) : null}
      {shown?.status === "Approved" && canWrite ? <Button type="button" label={t("incentive.batch.markPaid")} onClick={markPaid} /> : null}
    </div>
  );

  const lines = shown?.details || [];
  return (
    <>
      <DetailDialog visible={open} onHide={onHide} header={t("incentive.batch.title")} size="xl" footer={footer}>
        <div className="bv-loading-host">
          <LoadingBar active={refreshing} />
          {!shown && !error ? <Skeleton height="10rem" /> : null}
          {!shown && error ? <FieldError error={error} /> : null}
          {shown ? (
            <>
              <DetailHeader title={shown.batchId} status={shown.status} subtitle={shown.description || null}
                meta={[
                  { label: t("incentive.batch.period"), value: shown.period },
                  { label: t("incentive.batch.programs"), value: programNames(shown) },
                  { label: t("incentive.batch.agents"), value: shown.agentCount, type: "number" },
                  { label: t("incentive.batch.totalPayout"), value: shown.totalAmount, type: "amount" },
                ]} />
              <DetailSection title={t("incentive.batch.summary")}>
                <KeyValueGrid columns={3} items={[
                  { label: t("incentive.batch.periodDates"), value: `${formatDate(shown.periodFrom)} - ${formatDate(shown.periodTo)}` },
                  { label: t("incentive.batch.calculatedOn"), value: shown.createdAt || shown.calculationDate, type: shown.createdAt ? "datetime" : "date" },
                  { label: t("incentive.batch.createdBy"), value: shown.createdBy },
                  { label: t("incentive.telesales.grossTotal"), value: shown.grossTotal, type: "amount", hidden: !telesales },
                  { label: t("incentive.telesales.taxTotal"), value: shown.taxTotal, type: "amount", hidden: !telesales },
                  { label: t("incentive.batch.adjustedBy"), value: (shown.adjustedBy || []).join(", "), hidden: !(shown.adjustedBy || []).length },
                  { label: t("incentive.batch.submittedBy"), value: shown.submittedBy, hidden: !shown.submittedBy },
                  { label: t("incentive.batch.submittedOn"), value: shown.submittedAt, type: "datetime", hidden: !shown.submittedAt },
                  { label: t("incentive.batch.approvedBy"), value: shown.approvedBy, hidden: !shown.approvedBy },
                  { label: t("incentive.batch.approvedOn"), value: shown.approvedAt, type: "datetime", hidden: !shown.approvedAt },
                  { label: t("incentive.batch.approvalRemarks"), value: shown.approvalRemarks, span: "full", hidden: !shown.approvalRemarks },
                  { label: t("incentive.batch.rejectedBy"), value: shown.rejectedBy, hidden: !shown.rejectedBy || shown.status !== "Rejected" },
                  { label: t("incentive.batch.rejectedOn"), value: shown.rejectedAt, type: "datetime", hidden: !shown.rejectedAt || shown.status !== "Rejected" },
                  { label: t("incentive.batch.rejectionReason"), value: shown.rejectionReason, span: "full", hidden: !shown.rejectionReason },
                  { label: t("incentive.batch.paidOn"), value: shown.paymentDate, type: "date", hidden: !shown.paymentDate },
                  { label: t("incentive.batch.paymentReference"), value: shown.paymentReference, hidden: !shown.paymentReference },
                ]} />
              </DetailSection>
              <DetailSection title={t("incentive.batch.agentResults")} flush>
                <DataTable value={lines} dataKey="id" size="small" emptyMessage={t("incentive.batch.noResults")} scrollable className="inc-table">
                  <Column header={t("incentive.batch.agent")} body={(r) => <span>{r.agentName}<span className="inc-muted"> {r.agentCode}</span></span>} />
                  <Column header={t("incentive.batch.program")} field="program" />
                  {telesales ? [
                    <Column key="c" header={t("incentive.telesales.counted")} body={(r) => `${r.counted} (${r.nbCount ?? 0} / ${r.renewalCount ?? 0})`} className="inc-num" headerClassName="inc-num" />,
                    <Column key="anc" header={t("incentive.telesales.anc")} body={(r) => formatCurrency(r.anc)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="lvl" header={t("incentive.telesales.level")} body={(r) => r.level || "-"} />,
                    <Column key="b" header={t("incentive.telesales.base")} body={(r) => formatCurrency(r.baseAmount)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="a" header={t("incentive.telesales.additional")} body={(r) => formatCurrency(r.additionalAmount)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="r" header={t("incentive.telesales.recovery")} body={(r) => formatCurrency(r.recoveryAmount)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="tx" header={t("incentive.telesales.tax", { pct: r0(lines) })} body={(r) => formatCurrency(r.taxAmount)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="res" header={t("incentive.telesales.result")} field="result" />,
                  ] : [
                    <Column key="ach" header={t("incentive.batch.achieved")} body={(r) => formatMeasure(r.achieved, r.metric)} className="inc-num" headerClassName="inc-num" />,
                    <Column key="pct" header={t("incentive.batch.achievementPct")} body={(r) => formatPercent(r.achievementPercent, { decimals: 2 })} className="inc-num" headerClassName="inc-num" />,
                    <Column key="tier" header={t("incentive.batch.tier")} body={(r) => r.tier || "-"} />,
                  ]}
                  <Column header={t("incentive.batch.adjustment")} body={(r) => (Number(r.adjustments) ? formatCurrency(r.adjustments) : "-")} className="inc-num" headerClassName="inc-num" />
                  <Column header={t("incentive.batch.payout")} body={(r) => formatCurrency(r.finalAmount)} className="inc-num" headerClassName="inc-num" />
                  {editable && canWrite ? (
                    <Column header={t("incentive.batch.actions")} body={(r) => (
                      <Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label={t("incentive.batch.adjust")} tooltip={t("incentive.batch.adjust")} onClick={() => setAdjusting(r)} />
                    )} />
                  ) : null}
                </DataTable>
              </DetailSection>
              {telesales ? (
                <DetailSection title={t("incentive.telesales.policies")} flush>
                  <TelesalesPolicies batch={shown} editable={!!editable && canWrite} onChanged={(message) => refresh(message)} />
                </DetailSection>
              ) : null}
              {telesales && (shown.executionLog || []).length ? (
                <DetailSection title={t("incentive.telesales.executionLog")}>
                  <ul className="inc-log">{shown.executionLog.map((l, i) => <li key={i}>{formatDate(l.at)} {l.step}{l.detail ? `: ${l.detail}` : ""}</li>)}</ul>
                </DetailSection>
              ) : null}
              <DetailSection title={t("incentive.batch.activity")}>
                <ActivityLog entries={(activity.data || []).map(toEntry)} loading={activity.loading} error={activity.error} onRetry={activity.reload} />
              </DetailSection>
            </>
          ) : null}
        </div>
      </DetailDialog>
      <BatchDecisionDialog action={deciding || "approve"} batch={shown} visible={!!deciding} onHide={() => setDeciding(null)}
        onDone={() => {
          const done = deciding;
          setDeciding(null);
          refresh(t(done === "approve" ? "incentive.batch.approved" : "incentive.batch.rejected", { batchId: shown.batchId }));
        }} />
      {adjusting ? (
        <AdjustLineDialog batchId={shown?.batchId} line={adjusting} onHide={() => setAdjusting(null)}
          onSaved={() => {
            const who = adjusting.agentName;
            setAdjusting(null);
            refresh(t("incentive.batch.adjusted", { name: who }));
          }} />
      ) : null}
    </>
  );
};

BatchDetailDialog.propTypes = {
  /** the batch shown; null closes the dialog */
  batchId: PropTypes.string,
  onHide: PropTypes.func.isRequired,
  /** after an action: the batch as it is now and the message to show */
  onChanged: PropTypes.func.isRequired,
};
BatchDetailDialog.defaultProps = { batchId: null };

export default BatchDetailDialog;
