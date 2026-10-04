import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import service from "../../services/creditControlService";
import { promptText } from "../../utility/dialogs";
import { CcTag, PageHeader, date, dateTime, isoOf, money, showError, showSuccess } from "./common";

const FILTERS = ["attention", "breached", "at-risk", "all"];

/**
 * Accounts > Credit Control > Premium Warranty Monitor: broker-billed policies past (or near) the premium payment
 * warranty with premium still due. Actions: remind the client, request an extension (approved by an Accounting
 * Manager), request the cancellation for non-payment (a draft cancellation endorsement for Operations).
 */
const WarrantyMonitor = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [filter, setFilter] = useState("attention");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extension, setExtension] = useState(null); // { row, requestedDeadline, reason }
  const [actions, setActions] = useState(null); // { row, list }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([service.warranty({ status: filter, search: search || undefined }), service.pendingExtensions()]);
      setData(d);
      setPending(p);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, message) => {
    try {
      const out = await fn();
      showSuccess(toast, typeof message === "function" ? message(out) : message);
      await load();
      return out;
    } catch (e) {
      showError(toast, e);
      return undefined;
    }
  };
  const remind = async (row) => {
    const notes = await promptText(t("creditControl.reminderNotes"));
    if (notes === null) return;
    await run(() => service.remind(row.policyId, notes), (r) => t("creditControl.reminderSent", { to: r.to }));
  };
  const cancellation = async (row) => {
    const notes = await promptText(t("creditControl.cancellationNotes", { policy: row.policyNumber }));
    if (notes === null) return;
    await run(() => service.requestCancellation(row.policyId, notes), (r) => t("creditControl.cancellationRaised", { number: r.endorsementNumber || "" }));
  };
  const saveExtension = async () => {
    const out = await run(() => service.requestExtension(extension.row.policyId, { requestedDeadline: isoOf(extension.requestedDeadline), reason: extension.reason }), t("creditControl.extensionRequested"));
    if (out) setExtension(null);
  };
  const decide = async (x, action) => {
    const remarks = await promptText(action === "approve" ? t("creditControl.approveRemarks") : t("creditControl.rejectReason"));
    if (remarks === null) return;
    await run(() => service.decideExtension(x.id, action, remarks), t(action === "approve" ? "creditControl.extensionApproved" : "creditControl.extensionRejected"));
  };
  const showActions = async (row) => {
    try {
      setActions({ row, list: await service.warrantyActions(row.policyId) });
    } catch (e) {
      showError(toast, e);
    }
  };

  const s = data?.summary;
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("creditControl.warrantyMonitor")} trail={[t("creditControl.warrantyMonitor")]} />
      {(
        <div className="grid mb-2">
          {[["breached", s ? `${s.breached} · ${money(s.breachedAmount)}` : "-"], ["atRisk", s ? `${s.atRisk} · ${money(s.atRiskAmount)}` : "-"], ["pendingExtensions", s ? pending.length : "-"]].map(([k, v]) => (
            <div className="col-12 md:col-4" key={k}><div className="pe-card p-3"><div className="pe-muted text-sm">{t(`creditControl.summary.${k}`)}</div><div className="text-xl font-semibold">{v}</div></div></div>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="pe-card mb-3">
          <h3 className="mt-0">{t("creditControl.extensionsToApprove")}</h3>
          <DataTable value={pending} dataKey="id" size="small" stripedRows>
            <Column field="policyNumber" header={t("creditControl.policyNumber")} />
            <Column field="clientName" header={t("creditControl.client")} />
            <Column header={t("creditControl.currentDeadline")} body={(r) => date(r.currentDeadline)} />
            <Column header={t("creditControl.requestedDeadline")} body={(r) => date(r.requestedDeadline)} />
            <Column field="reason" header={t("creditControl.reason")} />
            <Column field="requestedBy" header={t("creditControl.requestedBy")} />
            <Column body={(r) => (
              <div className="flex gap-1">
                <Button icon="pi pi-check" text size="small" severity="success" tooltip={t("creditControl.approve")} onClick={() => decide(r, "approve")} aria-label={t("creditControl.approve")} />
                <Button icon="pi pi-times" text size="small" severity="danger" tooltip={t("creditControl.reject")} onClick={() => decide(r, "reject")} aria-label={t("creditControl.reject")} />
              </div>
            )} />
          </DataTable>
        </div>
      )}
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={filter} options={FILTERS.map((f) => ({ label: t(`creditControl.filter.${f}`), value: f }))} onChange={(e) => setFilter(e.value)} className="w-15rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("creditControl.searchPolicyClient")} className="w-20rem" />
        </div>
        <DataTable value={data?.rows || []} dataKey="policyId" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("creditControl.none")}>
          <Column field="policyNumber" header={t("creditControl.policyNumber")} />
          <Column field="clientName" header={t("creditControl.client")} />
          <Column field="insurerName" header={t("creditControl.insurer")} />
          <Column header={t("creditControl.inception")} body={(r) => date(r.inceptionDate)} />
          <Column header={t("creditControl.deadline")} body={(r) => <span>{date(r.deadline)}{r.extendedTo ? ` (${t("creditControl.extended")})` : ""}</span>} />
          <Column header={t("creditControl.daysPast")} body={(r) => (r.daysPastDeadline ? r.daysPastDeadline : `-${r.daysToDeadline}`)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("creditControl.premiumDue")} body={(r) => money(r.premiumDue)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("creditControl.statusLabel")} style={{ minWidth: "11rem" }} body={(r) => (
            <div className="cc-status-cell">
              <span className="flex align-items-center gap-1 flex-wrap"><CcTag status={r.status} />{r.pendingExtension && <CcTag status="pending" />}</span>
              {r.onInstalmentPlan && <span className="bv-cell-sub nowrap">{t("creditControl.onPlan")}</span>}
              {r.cancellationRequest && <span className="bv-cell-sub">{r.cancellationRequest}</span>}
            </div>
          )} />
          <Column body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-envelope" text size="small" tooltip={t("creditControl.remind")} onClick={() => remind(r)} aria-label={t("creditControl.remind")} />
              <Button icon="pi pi-calendar-plus" text size="small" tooltip={t("creditControl.requestExtension")} disabled={!!r.pendingExtension}
                onClick={() => setExtension({ row: r, requestedDeadline: null, reason: "" })} aria-label={t("creditControl.requestExtension")}
                />
              <Button icon="pi pi-ban" text size="small" severity="danger" tooltip={t("creditControl.requestCancellation")} disabled={r.status !== "breached" || !!r.cancellationRequest} onClick={() => cancellation(r)} aria-label={t("creditControl.requestCancellation")} />
              <Button icon="pi pi-history" text size="small" tooltip={t("creditControl.history")} onClick={() => showActions(r)} aria-label={t("creditControl.history")} />
            </div>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={extension ? `${t("creditControl.requestExtension")} · ${extension.row.policyNumber}` : ""} visible={!!extension} style={{ width: "min(520px, 96vw)" }} onHide={() => setExtension(null)}
        footer={<div><Button label={t("creditControl.cancel")} text onClick={() => setExtension(null)} /><Button label={t("creditControl.send")} icon="pi pi-send" onClick={saveExtension} disabled={!extension?.requestedDeadline || !extension?.reason?.trim()} /></div>}>
        {extension && (
          <div className="grid">
            <div className="col-12">{t("creditControl.currentDeadline")}: <b>{date(extension.row.deadline)}</b></div>
            <div className="col-12"><label>{t("creditControl.requestedDeadline")} *</label>
              <Calendar value={extension.requestedDeadline} minDate={new Date(`${extension.row.deadline}T00:00:00`)} onChange={(e) => setExtension({ ...extension, requestedDeadline: e.value })} showIcon className="w-full" /></div>
            <div className="col-12"><label>{t("creditControl.reason")} *</label>
              <InputTextarea value={extension.reason} rows={3} onChange={(e) => setExtension({ ...extension, reason: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={actions ? `${t("creditControl.history")} · ${actions.row.policyNumber}` : ""} visible={!!actions} style={{ width: "min(760px, 96vw)" }} onHide={() => setActions(null)}>
        {actions && (
          <DataTable value={actions.list} dataKey="id" size="small" stripedRows emptyMessage={t("creditControl.none")}>
            <Column header={t("creditControl.when")} body={(r) => dateTime(r.createdAt)} />
            <Column header={t("creditControl.action")} body={(r) => t(`creditControl.actionType.${r.action}`, { defaultValue: r.action })} />
            <Column field="notes" header={t("creditControl.notes")} />
            <Column field="endorsementNumber" header={t("creditControl.endorsement")} />
            <Column field="createdBy" header={t("creditControl.by")} />
          </DataTable>
        )}
      </Dialog>
    </div>
  );
};

export default WarrantyMonitor;
