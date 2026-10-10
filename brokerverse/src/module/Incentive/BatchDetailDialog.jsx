import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
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
import { WRITE, batchFacts, decisionBlock, formatMeasure } from "./common";

/** Rejection of a batch: its facts and a reason of the Reason Codes master (incentive_batch_reject) with a note. */
export const RejectBatchDialog = ({ batch, visible, onHide, onRejected }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    setReason(null);
    setTried(false);
    setError(null);
    onHide();
  };
  const reject = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    setBusy(true);
    setError(null);
    try {
      const after = await incentiveService.rejectCalculation(batch.batchId, reasonPayload(reason));
      setReason(null);
      setTried(false);
      onRejected(after);
    } catch (e) {
      setError(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} outlined onClick={close} disabled={busy} />
      <Button type="button" label={t("incentive.batch.rejectBatch")} severity="danger" onClick={reject} loading={busy} />
    </>
  );
  return (
    <Dialog visible={visible} onHide={close} header={t("incentive.batch.rejectTitle")} footer={footer} modal draggable={false} resizable={false}
      className="bv-centered inc-reject-dialog" style={{ width: "36rem" }} breakpoints={{ "640px": "100vw" }}>
      {batch ? <KeyValueGrid columns={2} items={batchFacts(batch, t)} /> : null}
      <ReasonPicker context="incentive_batch_reject" value={reason} onChange={setReason} showErrors={tried} autoFocus className="inc-reject-dialog__reason" />
      {error ? <FieldError error={error} /> : null}
    </Dialog>
  );
};

RejectBatchDialog.propTypes = {
  batch: PropTypes.shape({ batchId: PropTypes.string }),
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onRejected: PropTypes.func.isRequired,
};
RejectBatchDialog.defaultProps = { batch: null };

/** Adjustment of one agent line: the amount added (or taken off, negative) and the reason for it. */
const AdjustLineDialog = ({ batchId, line, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(line ? Number(line.adjustments || 0) : 0);
  const [reason, setReason] = useState(line?.adjustmentReason || "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setTried(true);
    if (!reason.trim() || amount === null) return;
    setBusy(true);
    setError(null);
    try {
      await incentiveService.adjustCalculation(batchId, [{ id: line.id, adjustments: amount, reason: reason.trim() }]);
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
          ]} />
          <label htmlFor="inc-adjust-amount" className="inc-form__label">{t("incentive.batch.adjustment")}</label>
          <InputNumber inputId="inc-adjust-amount" value={amount} onValueChange={(e) => setAmount(e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} />
          <label htmlFor="inc-adjust-reason" className="inc-form__label">{t("incentive.batch.adjustmentReason")} *</label>
          <InputText id="inc-adjust-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={tried && !reason.trim() ? "p-invalid" : ""} />
          {tried && !reason.trim() ? <FieldError error={t("incentive.batch.adjustmentReasonRequired")} /> : null}
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
const BatchDetailDialog = ({ batchId, onHide, onChanged }) => {
  const { t } = useTranslation();
  const [rejecting, setRejecting] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const open = !!batchId;

  const batchLoader = useCallback(() => incentiveService.getCalculation(batchId), [batchId]);
  const activityLoader = useCallback(() => incentiveService.calculationActivity(batchId), [batchId]);
  const { data: batch, loading, refreshing, error, reload } = useStableLoad(batchLoader, { enabled: open });
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

  const submit = () => openConfirm({
    title: t("incentive.batch.submitTitle"),
    message: t("incentive.batch.submitMessage"),
    facts: batchFacts(shown, t),
    confirmLabel: t("incentive.batch.submitForApproval"),
    onConfirm: () => incentiveService.submitCalculation(shown.batchId),
  }).then((done) => done && refresh(t("incentive.batch.submitted", { batchId: shown.batchId })));

  const approve = () => openConfirm({
    title: t("incentive.batch.approveTitle"),
    message: t("incentive.batch.approveMessage"),
    facts: batchFacts(shown, t),
    note: t("incentive.batch.approveNote"),
    input: { type: "textarea", label: t("incentive.batch.remarks"), required: false, maxLength: 1000 },
    confirmLabel: t("incentive.batch.approveBatch"),
    onConfirm: (remarks) => incentiveService.approveCalculation(shown.batchId, remarks),
  }).then((value) => value !== null && refresh(t("incentive.batch.approved", { batchId: shown.batchId })));

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
      <Button type="button" label={t("incentive.close")} outlined onClick={onHide} />
      {editable && canWrite ? <Button type="button" label={t("incentive.batch.submitForApproval")} onClick={submit} /> : null}
      {pending ? (
        <>
          <Button type="button" label={t("incentive.batch.reject")} severity="danger" outlined disabled={!!block} onClick={() => setRejecting(true)} />
          <Button type="button" label={t("incentive.batch.approveBatch")} disabled={!!block} onClick={approve} />
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
          {!shown && loading ? <Skeleton height="10rem" /> : null}
          {!shown && error ? <FieldError error={error} /> : null}
          {shown ? (
            <>
              <DetailHeader title={shown.batchId} status={shown.status} subtitle={shown.description || null}
                meta={[
                  { label: t("incentive.batch.period"), value: shown.period },
                  { label: t("incentive.batch.programs"), value: (shown.programsIncluded || []).join(", ") },
                  { label: t("incentive.batch.agents"), value: shown.agentCount, type: "number" },
                  { label: t("incentive.batch.totalPayout"), value: shown.totalAmount, type: "amount" },
                ]} />
              <DetailSection title={t("incentive.batch.summary")}>
                <KeyValueGrid columns={3} items={[
                  { label: t("incentive.batch.periodDates"), value: `${formatDate(shown.periodFrom)} - ${formatDate(shown.periodTo)}` },
                  { label: t("incentive.batch.calculatedOn"), value: shown.createdAt || shown.calculationDate, type: shown.createdAt ? "datetime" : "date" },
                  { label: t("incentive.batch.createdBy"), value: shown.createdBy },
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
                  <Column header={t("incentive.batch.achieved")} body={(r) => formatMeasure(r.achieved, r.metric)} className="inc-num" headerClassName="inc-num" />
                  <Column header={t("incentive.batch.achievementPct")} body={(r) => formatPercent(r.achievementPercent, { decimals: 2 })} className="inc-num" headerClassName="inc-num" />
                  <Column header={t("incentive.batch.tier")} body={(r) => r.tier || "-"} />
                  <Column header={t("incentive.batch.adjustment")} body={(r) => (Number(r.adjustments) ? formatCurrency(r.adjustments) : "-")} className="inc-num" headerClassName="inc-num" />
                  <Column header={t("incentive.batch.payout")} body={(r) => formatCurrency(r.finalAmount)} className="inc-num" headerClassName="inc-num" />
                  {editable && canWrite ? (
                    <Column header={t("incentive.batch.actions")} body={(r) => (
                      <Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label={t("incentive.batch.adjust")} tooltip={t("incentive.batch.adjust")} onClick={() => setAdjusting(r)} />
                    )} />
                  ) : null}
                </DataTable>
              </DetailSection>
              <DetailSection title={t("incentive.batch.activity")}>
                <ActivityLog entries={(activity.data || []).map(toEntry)} loading={activity.loading} error={activity.error} onRetry={activity.reload} />
              </DetailSection>
            </>
          ) : null}
        </div>
      </DetailDialog>
      <RejectBatchDialog batch={shown} visible={rejecting} onHide={() => setRejecting(false)}
        onRejected={() => {
          setRejecting(false);
          refresh(t("incentive.batch.rejected", { batchId: shown.batchId }));
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
