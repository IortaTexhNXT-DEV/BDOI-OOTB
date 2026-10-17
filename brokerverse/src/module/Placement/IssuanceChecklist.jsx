import React, { useCallback, useEffect, useState } from "react";
import FileField from "../../components/FileField";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { InputTextarea } from "primereact/inputtextarea";
import placementService from "../../services/placementService";
import s3Service from "../../services/s3Service";
import { hasPermission } from "../../utils/canOpen";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";

const SEVERITY = { pending: "warning", received: "success", "waiver-requested": "info", waived: "secondary" };

/**
 * Motor issuance checklist of a placement slip (placement.issuance_checklist_mode, Motor Issuance Checklist master):
 * each document received with a file or a remark, reopened, or waived by a second user (approve:policies, never the
 * requester). The booking is refused (block) or warned (warn) while a mandatory document is missing.
 */
const IssuanceChecklist = ({ placement, userId, notify, onChange }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = !["issued", "cancelled"].includes(placement.status);
  const write = hasPermission("write:quotations") && open;
  const approver = hasPermission("approve:policies") && open;

  const load = useCallback(async () => {
    try {
      setData(await placementService.issuanceChecklist(placement.id));
    } catch (e) {
      notify("error", e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement.id, placement.updatedAt]);
  useEffect(() => { load(); }, [load]);
  if (!data?.applies) return null;

  const run = async (itemId, action, body, message) => {
    const out = await placementService.checklistAction(placement.id, itemId, action, body);
    setData(out);
    notify("success", message);
    onChange?.();
  };
  const ask = (item, { title, action, label, severity, required = true, extra = {}, message }) => openConfirm({
    title: t(title, { document: item.document }),
    severity,
    facts: [{ label: t("placement.checklist.document"), value: item.document }, ...(item.waiverReason ? [{ label: t("placement.checklist.waiverReason"), value: item.waiverReason }] : [])],
    input: { type: "textarea", label: t("placement.checklist.reason"), required },
    confirmLabel: t(label),
    cancelLabel: t("placement.actions.back"),
    onConfirm: async (text) => run(item.id, action, { ...extra, [action === "reopen" ? "remark" : action === "waiver" ? "reason" : "note"]: text || undefined }, t(message)),
  });
  const receive = async () => {
    setBusy(true);
    try {
      let body = { remark: receiving.remark || undefined };
      if (receiving.file) {
        const up = await s3Service.uploadFile(receiving.file, "placement-documents");
        if (!up?.key) throw new Error(up?.error || t("placement.epolicy.errors.upload"));
        body = { ...body, documentKey: up.key, documentName: receiving.file.name };
      }
      await run(receiving.item.id, "receive", body, t("placement.checklist.received"));
      setReceiving(null);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const status = (i) => (
    <>
      <Tag value={i.onFile ? t("placement.checklist.onFile") : t(`placement.checklist.status.${i.status}`)} severity={i.onFile ? "success" : SEVERITY[i.status]} />
      {i.fileName && <div className="muted">{i.fileName}</div>}
      {i.remark && <div className="muted">{i.remark}</div>}
      {i.waiverReason && ["waiver-requested", "waived"].includes(i.status) && <div className="muted">{`${i.waiverRequestedBy || ""}: ${i.waiverReason}`}</div>}
    </>
  );
  const actions = (i) => {
    const mine = String(i.waiverRequestedById || "") === userId;
    return (
      <div className="flex gap-1 justify-content-end">
        {write && i.status === "pending" && <Button icon="pi pi-upload" size="small" text rounded tooltip={t("placement.checklist.receive")} tooltipOptions={{ position: "top" }} aria-label={t("placement.checklist.receive")}
          onClick={() => setReceiving({ item: i, file: null, remark: "" })} />}
        {write && i.status === "pending" && i.canWaive && <Button icon="pi pi-flag" size="small" text rounded tooltip={t("placement.checklist.requestWaiver")} tooltipOptions={{ position: "top" }}
          aria-label={t("placement.checklist.requestWaiver")} onClick={() => ask(i, { title: "placement.checklist.requestWaiverTitle", action: "waiver", label: "placement.checklist.requestWaiver", message: "placement.checklist.waiverRequested" })} />}
        {approver && i.status === "waiver-requested" && !mine && <Button icon="pi pi-check" size="small" text rounded severity="success" tooltip={t("placement.checklist.approveWaiver")} tooltipOptions={{ position: "top" }}
          aria-label={t("placement.checklist.approveWaiver")} onClick={() => ask(i, { title: "placement.checklist.approveWaiverTitle", action: "waiver-decision", label: "placement.checklist.approveWaiver", required: false, extra: { decision: "approve" }, message: "placement.checklist.waiverApproved" })} />}
        {approver && i.status === "waiver-requested" && !mine && <Button icon="pi pi-times" size="small" text rounded severity="danger" tooltip={t("placement.checklist.rejectWaiver")} tooltipOptions={{ position: "top" }}
          aria-label={t("placement.checklist.rejectWaiver")} onClick={() => ask(i, { title: "placement.checklist.rejectWaiverTitle", action: "waiver-decision", label: "placement.checklist.rejectWaiver", severity: "danger", extra: { decision: "reject" }, message: "placement.checklist.waiverRejected" })} />}
        {write && ["received", "waived"].includes(i.status) && <Button icon="pi pi-undo" size="small" text rounded tooltip={t("placement.checklist.reopen")} tooltipOptions={{ position: "top" }} aria-label={t("placement.checklist.reopen")}
          onClick={() => ask(i, { title: "placement.checklist.reopenTitle", action: "reopen", label: "placement.checklist.reopen", message: "placement.checklist.reopened" })} />}
      </div>
    );
  };

  return (
    <div className="placement-card">
      <h3 className="section-title">
        {t("placement.checklist.title")}
        <Tag className="ml-2" value={data.gate.missing ? t("placement.checklist.missing", { count: data.gate.missing }) : t("placement.checklist.complete")} severity={data.gate.missing ? (data.mode === "block" ? "danger" : "warning") : "success"} />
        {data.mode !== "block" && <Tag className="ml-2" value={t(`placement.checklist.mode.${data.mode}`)} severity="secondary" />}
      </h3>
      <div className="table-scroll">
        <DataTable value={data.items} dataKey="id" size="small" emptyMessage={t("placement.checklist.none")}>
          <Column field="document" header={t("placement.checklist.document")} />
          <Column header={t("placement.checklist.mandatory")} body={(i) => (i.required ? t("common.yes") : t("common.no"))} style={{ width: "8rem" }} />
          <Column header={t("placement.checklist.statusLabel")} body={status} />
          <Column body={actions} style={{ width: "10rem" }} />
        </DataTable>
      </div>
      <DetailDialog header={t("placement.checklist.receiveTitle", { document: receiving?.item?.document || "" })} visible={Boolean(receiving)} onHide={() => setReceiving(null)} size="sm"
        footer={<><Button label={t("placement.actions.cancel")} text onClick={() => setReceiving(null)} /><Button label={t("placement.checklist.receive")} icon="pi pi-check" loading={busy}
          disabled={!receiving || (!receiving.file && !String(receiving.remark || "").trim())} onClick={receive} /></>}>
        {receiving && (
          <div className="p-fluid">
            <div className="field">
              <label htmlFor="chk-file">{t("placement.checklist.file")}</label>
              <FileField id="chk-file" accept="image/*,application/pdf" value={receiving.file || null} onChange={(f) => setReceiving({ ...receiving, file: f })} />
            </div>
            <div className="field mb-0">
              <label htmlFor="chk-remark">{t("placement.checklist.remark")}</label>
              <InputTextarea id="chk-remark" rows={2} autoResize value={receiving.remark} maxLength={1000} onChange={(e) => setReceiving({ ...receiving, remark: e.target.value })} />
            </div>
          </div>
        )}
      </DetailDialog>
    </div>
  );
};

export default IssuanceChecklist;
