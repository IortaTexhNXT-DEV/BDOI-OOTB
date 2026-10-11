import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputTextarea } from "primereact/inputtextarea";
import ApprovalActions from "../../components/ApprovalActions";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import goLiveService from "../../services/goLiveService";
import { count, makerOf, myId, num, useAccess, useDownload } from "./shared";

export const UNDO_REASON_MIN = 5;

/** The records that stop the undo of a load, with the download of the list. */
const Dependents = ({ batch, rows }) => {
  const { t } = useTranslation();
  const download = useDownload();
  return (
    <SectionCard title={t("goLive.undo.dependents")} flush
      actions={rows.length ? <Button type="button" icon="pi pi-download" label={t("goLive.common.download")} outlined size="small"
        onClick={() => download(() => goLiveService.dependentsWorkbook(batch.id))} /> : null}>
      <DataTable value={rows} dataKey={(d) => `${d.object}-${d.key}-${d.dependent}`} size="small" emptyMessage={t("goLive.undo.noDependents")}>
        <Column field="object" header={t("goLive.undo.object")} body={(d) => t(`goLive.undo.objects.${d.object}`, { defaultValue: d.object })} />
        <Column field="key" header={t("goLive.rows.key")} />
        <Column field="dependent" header={t("goLive.undo.dependent")} />
        <Column header={t("goLive.undo.count")} body={(d) => count(d.count)} {...num} />
      </DataTable>
    </SectionCard>
  );
};

/** Request of the undo: the dependents check first, then the reason. */
const RequestDialog = ({ batch, onHide, onDone }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dependents, setDependents] = useState(null);
  const problem = tried && reason.trim().length < UNDO_REASON_MIN ? t("goLive.undo.reasonRequired", { count: UNDO_REASON_MIN }) : null;
  const check = async () => {
    setError(null);
    try {
      setDependents(await goLiveService.dependents(batch.id));
    } catch (e) {
      setError(e.message);
    }
  };
  const request = async () => {
    setTried(true);
    if (reason.trim().length < UNDO_REASON_MIN) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.requestUndo(batch.id, reason.trim());
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="lg" header={t("goLive.undo.requestTitle", { number: batch.loadNumber })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.undo.requestUndo")} severity="danger" onClick={request} loading={busy} disabled={!dependents || dependents.length > 0} />
      </>
    )}>
      <div className="go-live__form">
        <div>
          <Button type="button" icon="pi pi-search" label={t("goLive.undo.check")} outlined size="small" onClick={check} />
        </div>
        {dependents ? <Dependents batch={batch} rows={dependents} /> : null}
        <label htmlFor="undo-reason" className="bv-field-label">{t("goLive.undo.reason")}<span className="required-marker">*</span></label>
        <InputTextarea id="undo-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoResize maxLength={1000} className={`w-full${problem ? " p-invalid" : ""}`} />
        <FieldError error={problem} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Undo of a migration load: dependents check, request with a reason, decision by another user, withdrawal. */
const UndoTab = ({ batch, makers, locked, onChanged }) => {
  const { t } = useTranslation();
  const { canWrite, canApprove } = useAccess();
  const [requesting, setRequesting] = useState(false);
  const [dependents, setDependents] = useState(null);
  const pending = batch.status === "undo-pending";

  const approve = () => openConfirm({
    title: t("goLive.undo.approveTitle"), severity: "danger",
    message: t("goLive.undo.approveMessage", { number: batch.loadNumber, records: count(batch.rowsNew) }),
    facts: [{ label: t("goLive.undo.requestedBy"), value: batch.undoRequestedBy }, { label: t("goLive.undo.reason"), value: batch.undoReason }],
    confirmLabel: t("goLive.undo.approveUndo"),
    onConfirm: async () => {
      await goLiveService.approveUndo(batch.id);
      onChanged(t("goLive.undo.approved", { number: batch.loadNumber }));
    },
  });
  const reject = () => openConfirm({
    title: t("goLive.undo.rejectTitle"), severity: "warning", message: t("goLive.undo.rejectMessage", { number: batch.loadNumber }),
    input: { type: "textarea", label: t("goLive.undo.remarks"), required: true, minLength: UNDO_REASON_MIN },
    confirmLabel: t("goLive.undo.rejectUndo"),
    onConfirm: async (remarks) => {
      await goLiveService.rejectUndo(batch.id, remarks);
      onChanged(t("goLive.undo.rejected", { number: batch.loadNumber }));
    },
  });
  const withdraw = () => openConfirm({
    title: t("goLive.undo.withdrawTitle"), severity: "warning", message: t("goLive.undo.withdrawMessage", { number: batch.loadNumber }),
    confirmLabel: t("goLive.undo.withdrawUndo"),
    onConfirm: async () => {
      await goLiveService.withdrawUndo(batch.id);
      onChanged(t("goLive.undo.withdrawn", { number: batch.loadNumber }));
    },
  });

  return (
    <div className="go-live__stack">
      <div className="go-live__actions">
        <Button type="button" icon="pi pi-search" label={t("goLive.undo.check")} outlined onClick={async () => setDependents(await goLiveService.dependents(batch.id).catch(() => []))}
          disabled={!["loaded", "undo-pending"].includes(batch.status)} />
        {canWrite && batch.status === "loaded" && !locked ? (
          <Button type="button" icon="pi pi-replay" label={t("goLive.undo.requestUndo")} severity="danger" outlined onClick={() => setRequesting(true)} />
        ) : null}
        {canWrite && pending && batch.undoRequestedById === myId() ? (
          <Button type="button" icon="pi pi-undo" label={t("goLive.undo.withdrawUndo")} outlined onClick={withdraw} />
        ) : null}
        {canApprove && pending ? (
          <ApprovalActions initiator={makerOf(makers)} approveLabel={t("goLive.undo.approveUndo")} rejectLabel={t("goLive.undo.rejectUndo")} onApprove={approve} onReject={reject} />
        ) : null}
      </div>
      <KeyValueGrid columns={3} items={[
        { label: t("goLive.undo.requestedBy"), value: batch.undoRequestedBy },
        { label: t("goLive.undo.requestedAt"), value: batch.undoRequestedAt, type: "datetime" },
        { label: t("goLive.undo.reason"), value: batch.undoReason },
        { label: t("goLive.undo.undoneBy"), value: batch.undoneBy },
        { label: t("goLive.undo.undoneAt"), value: batch.undoneAt, type: "datetime" },
      ]} />
      {dependents ? <Dependents batch={batch} rows={dependents} /> : null}
      {requesting ? <RequestDialog batch={batch} onHide={() => setRequesting(false)}
        onDone={() => { setRequesting(false); onChanged(t("goLive.undo.requested", { number: batch.loadNumber })); }} /> : null}
    </div>
  );
};

export default UndoTab;
