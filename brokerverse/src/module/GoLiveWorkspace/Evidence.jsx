import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import ImportDialog, { fileSize } from "../../components/ImportDialog";
import RowActions, { actionsColumn } from "../../components/RowActions";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { dateTimeOf, myId, useAccess, useDownload, useWorkspace } from "./shared";

export const EVIDENCE_TYPES = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.txt,.docx";

/** Attach an evidence file to a run, checklist step, reconciliation, decision or defect, with a note. */
export const AttachEvidence = ({ visible, onHide, ownerType, ownerId, title, onAttached }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const targets = useMemo(() => [{ label: t("goLive.evidence.file"), uploadPath: "/data-load/evidence" }], [t]);
  return (
    <ImportDialog visible={visible} onHide={onHide} title={title || t("goLive.evidence.attach")} targets={targets} accept={EVIDENCE_TYPES} fileTypes={t("goLive.evidence.fileTypes")}
      fields={{ ownerType, ownerId, note: note.trim() || undefined }} loadLabel={t("goLive.evidence.attach")}
      steps={[{ key: "evidence-note", label: t("goLive.evidence.note"), node: (
        <InputText id="evidence-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-full" />
      ) }]}
      onUploaded={() => { setNote(""); onHide(); onAttached(); }} />
  );
};

/** Evidence files of a record (or of everything of a run): download, attach, and remove by their uploader while the run is open. */
const Evidence = ({ ownerType, ownerId, runId, open }) => {
  const { t } = useTranslation();
  const { notify } = useWorkspace();
  const { canWrite } = useAccess();
  const download = useDownload();
  const [attaching, setAttaching] = useState(false);
  const loader = useCallback(() => goLiveService.evidence(runId ? { runId } : { ownerType, ownerId }), [ownerType, ownerId, runId]);
  const { data, loading, reload } = useStableLoad(loader, { initialData: [] });

  const remove = (e) => openConfirm({
    title: t("goLive.evidence.removeTitle"), severity: "danger", message: t("goLive.evidence.removeMessage"),
    facts: [{ label: t("goLive.evidence.file"), value: e.fileName }, { label: t("goLive.evidence.uploadedAt"), value: e.uploadedAt, type: "datetime" }],
    confirmLabel: t("goLive.evidence.remove"),
    onConfirm: async () => {
      await goLiveService.deleteEvidence(e.id);
      notify("success", t("goLive.evidence.removed"));
      reload();
    },
  });

  return (
    <div className="go-live__stack">
      {canWrite && open ? (
        <div className="go-live__actions go-live__actions--end">
          <Button type="button" icon="pi pi-paperclip" label={t("goLive.evidence.attach")} outlined onClick={() => setAttaching(true)} />
        </div>
      ) : null}
      <DataTable value={data || []} dataKey="id" size="small" loading={loading} emptyMessage={t("goLive.evidence.none")}>
        <Column field="fileName" header={t("goLive.evidence.file")} />
        {runId ? <Column header={t("goLive.evidence.attachedTo")} body={(e) => t(`goLive.evidence.owners.${e.ownerType}`)} /> : null}
        <Column field="note" header={t("goLive.evidence.note")} body={(e) => e.note || "—"} />
        <Column header={t("goLive.evidence.size")} body={(e) => fileSize(e.sizeBytes)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("goLive.evidence.uploaded")} body={(e) => `${e.uploadedBy || "—"} · ${dateTimeOf(e.uploadedAt)}`} />
        <Column body={(e) => (
          <RowActions>
            <Button type="button" icon="pi pi-download" text rounded aria-label={t("goLive.common.download")} tooltip={t("goLive.common.download")} tooltipOptions={{ position: "top" }}
              onClick={() => download(() => goLiveService.evidenceFile(e.id))} />
            {canWrite && open && e.uploadedById === myId() ? (
              <Button type="button" icon="pi pi-trash" text rounded severity="danger" aria-label={t("goLive.evidence.remove")} tooltip={t("goLive.evidence.remove")}
                tooltipOptions={{ position: "top" }} onClick={() => remove(e)} />
            ) : null}
          </RowActions>
        )} {...actionsColumn} />
      </DataTable>
      <AttachEvidence visible={attaching} onHide={() => setAttaching(false)} ownerType={ownerType} ownerId={ownerId} onAttached={reload} />
    </div>
  );
};

export default Evidence;
