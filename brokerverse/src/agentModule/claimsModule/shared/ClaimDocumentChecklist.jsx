import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { ProgressBar } from "primereact/progressbar";
import service from "../../../services/opsAccountingService";
import { EmptyState, RowActions, StatusChip } from "../../../components/RecordPage";
import { formatDate } from "../../../utility/dateFormat";

/** The claim's document checklist (GET /claim-documents/claims/:id) with a reload; `error` is the load error text. */
export const useClaimChecklist = (claimId) => {
  const [state, setState] = useState({ list: null, error: "" });
  const reload = useCallback(async () => {
    if (!claimId) return null;
    try {
      const list = await service.claimChecklist(claimId);
      setState({ list, error: "" });
      return list;
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
      return null;
    }
  }, [claimId]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
};

const STATUS = {
  received: { key: "received", severity: "success" },
  waived: { key: "waived", severity: "info" },
};
const statusOf = (item) => STATUS[item.status] || (item.required ? { key: "missing", severity: "warning" } : { key: "notReceived", severity: "secondary" });

/** "x of y required documents in" with a bar, and what is still open. */
export const ChecklistProgress = ({ summary }) => {
  const { t } = useTranslation();
  const required = summary.required || 0;
  const received = summary.receivedRequired ?? required - (summary.missingRequired || 0);
  const pct = required ? Math.round((received / required) * 100) : 100;
  return (
    <div className="claim-docs__progress">
      <div className="claim-docs__progress-head">
        <span className="claim-docs__progress-figure">{t("claimDocs.progress", { received, required })}</span>
        {summary.missingRequired ? <StatusChip label={t("claimDocs.missingCount", { count: summary.missingRequired })} severity="warning" />
          : <StatusChip label={t("claimDocs.allIn")} severity="success" />}
        {summary.missingOptional ? <StatusChip label={t("claimDocs.optionalOpen", { count: summary.missingOptional })} severity="secondary" /> : null}
      </div>
      <ProgressBar value={pct} showValue={false} className="claim-docs__bar" aria-label={t("claimDocs.progress", { received, required })} />
    </div>
  );
};
ChecklistProgress.propTypes = { summary: PropTypes.object.isRequired };

/**
 * The documents of one claim, one compact row each: the document (optional ones marked), its status, the date it came
 * in or was waived (with the reason), the file and one action menu (upload a copy, mark received, waive with a reason,
 * mark as missing again). `list` is the checklist; `onChanged` reloads it; `notify(severity, text)` reports the result.
 */
const ClaimDocumentChecklist = ({ claimId, list, onChanged, notify, readOnly }) => {
  const { t } = useTranslation();
  const fileInput = useRef(null);
  const [uploadFor, setUploadFor] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind: "waive", item, reason } | { kind: "add", name, required }
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const run = async (fn, message) => {
    setBusy(true);
    try {
      const r = await fn();
      notify("success", typeof message === "function" ? message(r) : message);
      await onChanged();
      return true;
    } catch (e) {
      notify("error", e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (item, status) => run(() => service.updateChecklistItem(claimId, item.id, { status }), t("claimDocs.updated", { name: item.documentName }));
  const pickFile = (item) => {
    setUploadFor(item);
    fileInput.current?.click();
  };
  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && uploadFor) run(() => service.uploadChecklistItem(claimId, uploadFor.id, file), t("claimDocs.uploaded", { name: uploadFor.documentName }));
  };
  const saveDialog = async () => {
    setDialogError("");
    if (dialog.kind === "waive" && dialog.reason.trim().length < 3) {
      setDialogError(t("claimDocs.waiveReasonRequired"));
      return;
    }
    if (dialog.kind === "add" && !dialog.name.trim()) {
      setDialogError(t("claimDocs.nameRequired"));
      return;
    }
    const ok = dialog.kind === "waive"
      ? await run(() => service.updateChecklistItem(claimId, dialog.item.id, { status: "waived", waiveReason: dialog.reason.trim() }), t("claimDocs.updated", { name: dialog.item.documentName }))
      : await run(() => service.addChecklistItem(claimId, { documentName: dialog.name.trim(), required: dialog.required }), t("claimDocs.added", { name: dialog.name.trim() }));
    if (ok) setDialog(null);
  };

  const dateCell = (item) => {
    if (item.status === "received") return item.receivedOn ? formatDate(item.receivedOn) : "—";
    if (item.status === "waived") {
      return (
        <span className="bv-cell-stack">
          <span>{item.updatedAt ? formatDate(item.updatedAt) : "—"}</span>
          {item.waiveReason ? <small className="claim-docs__reason" title={item.waiveReason}>{item.waiveReason}</small> : null}
        </span>
      );
    }
    return "—";
  };
  const actions = (item) => (
    <RowActions menu={[
      { label: t("claimDocs.upload"), icon: "pi pi-upload", command: () => pickFile(item) },
      { label: t("claimDocs.markReceived"), icon: "pi pi-check", hidden: item.status === "received", command: () => setStatus(item, "received") },
      { label: t("claimDocs.waive"), icon: "pi pi-ban", hidden: item.status !== "pending", command: () => setDialog({ kind: "waive", item, reason: "" }) },
      { label: t("claimDocs.reopen"), icon: "pi pi-undo", hidden: item.status === "pending", command: () => setStatus(item, "pending") },
    ]} />
  );

  return (
    <div className="claim-docs">
      <ChecklistProgress summary={list.summary} />
      <DataTable value={list.items} dataKey="id" size="small" className="claim-docs__table" loading={busy}
        emptyMessage={<EmptyState icon="pi-file" title={t("claimDocs.emptyTitle")} text={readOnly ? null : t("claimDocs.emptyText")} />}>
        <Column header={t("claimDocs.col.document")} body={(i) => (
          <span className="bv-cell-stack">
            <span>{i.documentName}</span>
            {!i.required ? <small>{t("claimDocs.optional")}</small> : null}
          </span>
        )} />
        <Column header={t("claimDocs.col.status")} body={(i) => <StatusChip label={t(`claimDocs.status.${statusOf(i).key}`)} severity={statusOf(i).severity} />} className="bv-nowrap" />
        <Column header={t("claimDocs.col.date")} body={dateCell} />
        <Column header={t("claimDocs.col.file")} body={(i) => (i.fileName ? <span className="claim-docs__file" title={i.fileName}><i className="pi pi-paperclip" aria-hidden="true" />{i.fileName}</span> : "—")} />
        {readOnly ? null : <Column header={t("claimFlow.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" />}
      </DataTable>
      {readOnly ? null : (
        <div className="claim-docs__foot">
          <Button type="button" text icon="pi pi-plus" label={t("claimDocs.add")} onClick={() => setDialog({ kind: "add", name: "", required: true })} disabled={busy} />
        </div>
      )}
      <input ref={fileInput} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={upload} aria-hidden="true" tabIndex={-1} />
      <Dialog visible={!!dialog} onHide={() => setDialog(null)} style={{ width: "min(460px, 95vw)" }}
        header={dialog?.kind === "waive" ? t("claimDocs.waiveTitle", { name: dialog.item.documentName }) : t("claimDocs.addTitle")}
        footer={(
          <>
            <Button type="button" text label={t("claimDocs.cancel")} onClick={() => setDialog(null)} disabled={busy} />
            <Button type="button" label={dialog?.kind === "waive" ? t("claimDocs.waiveConfirm") : t("claimDocs.add")} onClick={saveDialog} loading={busy} />
          </>
        )}>
        {dialog?.kind === "waive" ? (
          <div className="field">
            <label htmlFor="cd-reason" className="claim-journey__label">{t("claimDocs.waiveReason")} *</label>
            <InputTextarea id="cd-reason" rows={3} autoResize className="w-full" value={dialog.reason} onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} />
          </div>
        ) : null}
        {dialog?.kind === "add" ? (
          <>
            <div className="field">
              <label htmlFor="cd-name" className="claim-journey__label">{t("claimDocs.col.document")} *</label>
              <InputText id="cd-name" className="w-full" value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            </div>
            <div className="flex align-items-center gap-2">
              <Checkbox inputId="cd-required" checked={dialog.required} onChange={(e) => setDialog({ ...dialog, required: e.checked })} />
              <label htmlFor="cd-required">{t("claimDocs.requiredLabel")}</label>
            </div>
          </>
        ) : null}
        {dialogError ? <small className="p-error block mt-2">{dialogError}</small> : null}
      </Dialog>
    </div>
  );
};

ClaimDocumentChecklist.propTypes = {
  claimId: PropTypes.string.isRequired,
  list: PropTypes.shape({ items: PropTypes.array, summary: PropTypes.object }).isRequired,
  onChanged: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
};
ClaimDocumentChecklist.defaultProps = { readOnly: false };

/** Reminders sent to the claimant for the missing documents (by hand or by the daily job). */
export const ChecklistReminders = ({ reminders }) => {
  const { t } = useTranslation();
  if (!reminders?.length) return null;
  return (
    <DataTable value={reminders} dataKey="id" size="small" className="claim-docs__reminders">
      <Column header={t("claimDocs.col.sent")} body={(r) => formatDate(r.at, { withTime: true })} className="bv-nowrap" />
      <Column field="to" header={t("claimDocs.col.to")} />
      <Column header={t("claimDocs.col.missing")} body={(r) => <span className="claim-docs__reason" title={(r.missing || []).join("; ")}>{(r.missing || []).join("; ")}</span>} />
      <Column header={t("claimDocs.col.by")} body={(r) => (r.automatic ? t("claimDocs.automatic") : r.by || "—")} />
    </DataTable>
  );
};
ChecklistReminders.propTypes = { reminders: PropTypes.array };
ChecklistReminders.defaultProps = { reminders: [] };

export default ClaimDocumentChecklist;
