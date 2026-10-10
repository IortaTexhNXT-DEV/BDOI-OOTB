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
import { openConfirm } from "../../components/ConfirmDialog";
import ApprovalActions from "../../components/ApprovalActions";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { ActivityLog, fromWarrantyActions, humanize } from "../../components/ActivityLog";
import { CcTag, PageHeader, date, isoOf, money, showError, showSuccess } from "./common";
import "./warrantyMonitor.scss";

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
  // the action runs inside the confirmation (an error stays there); the toast and the reload follow once it succeeded
  const confirmRun = async (options, fn, message) => {
    let out;
    const answer = await openConfirm({ ...options, onConfirm: async (value) => { out = await fn(value); } });
    if (answer === false || answer === null) return;
    showSuccess(toast, typeof message === "function" ? message(out) : message);
    await load();
  };
  const policyFacts = (r) => [
    { label: t("creditControl.policyNumber"), value: r.policyNumber },
    { label: t("creditControl.client"), value: r.clientName },
    { label: t("creditControl.insurer"), value: r.insurerName },
    { label: t("creditControl.deadline"), value: r.deadline, type: "date" },
    { label: t("creditControl.daysPast"), value: r.daysPastDeadline, type: "number", hidden: !r.daysPastDeadline },
    { label: t("creditControl.premiumDue"), value: r.premiumDue, type: "amount", emphasis: true },
  ];
  const remind = (row) => confirmRun({
    title: t("creditControl.confirmations.remindTitle"),
    message: t("creditControl.confirmations.remindMessage"),
    facts: policyFacts(row),
    input: { type: "textarea", label: t("creditControl.confirmations.reminderMessage"), maxLength: 1000, placeholder: t("creditControl.confirmations.reminderPlaceholder") },
    confirmLabel: t("creditControl.remind"),
  }, (notes) => service.remind(row.policyId, notes), (r) => t("creditControl.reminderSent", { to: r.to }));
  const cancellation = (row) => confirmRun({
    title: t("creditControl.confirmations.cancellationTitle"),
    severity: "danger",
    message: t("creditControl.confirmations.cancellationMessage"),
    facts: policyFacts(row),
    input: { type: "textarea", label: t("creditControl.confirmations.notesForOperations"), maxLength: 1000 },
    confirmLabel: t("creditControl.confirmations.requestCancellation"),
  }, (notes) => service.requestCancellation(row.policyId, notes), (r) => t("creditControl.cancellationRaised", { number: r.endorsementNumber || "" }));
  const saveExtension = async () => {
    const out = await run(() => service.requestExtension(extension.row.policyId, { requestedDeadline: isoOf(extension.requestedDeadline), reason: extension.reason }), t("creditControl.extensionRequested"));
    if (out) setExtension(null);
  };
  const decide = (x, action) => {
    const approve = action === "approve";
    return confirmRun({
      title: t(approve ? "creditControl.confirmations.approveExtensionTitle" : "creditControl.confirmations.rejectExtensionTitle"),
      severity: approve ? "neutral" : "danger",
      facts: [
        { label: t("creditControl.policyNumber"), value: x.policyNumber },
        { label: t("creditControl.client"), value: x.clientName },
        { label: t("creditControl.currentDeadline"), value: x.currentDeadline, type: "date" },
        { label: t("creditControl.requestedDeadline"), value: x.requestedDeadline, type: "date" },
        { label: t("creditControl.reason"), value: x.reason },
        { label: t("creditControl.requestedBy"), value: x.requestedBy },
      ],
      input: approve
        ? { type: "textarea", label: t("creditControl.approveRemarks"), maxLength: 1000 }
        : { type: "textarea", label: t("creditControl.rejectReason"), required: true, maxLength: 1000 },
      confirmLabel: t(approve ? "creditControl.confirmations.approveExtension" : "creditControl.confirmations.rejectExtension"),
    }, (remarks) => service.decideExtension(x.id, action, remarks), t(approve ? "creditControl.extensionApproved" : "creditControl.extensionRejected"));
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
            <Column style={{ minWidth: "14rem" }} body={(r) => (
              <ApprovalActions size="small" initiator={{ id: r.requestedById }} approveLabel={t("creditControl.approve")} rejectLabel={t("creditControl.reject")}
                onApprove={() => decide(r, "approve")} onReject={() => decide(r, "reject")} />
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
          <Column header={t("creditControl.statusLabel")} style={{ minWidth: "12rem" }} bodyClassName="cc-status-col" body={(r) => (
            <div className="cc-status-cell">
              <span className="flex align-items-center gap-1 flex-wrap"><CcTag status={r.status} />{r.pendingExtension && <CcTag status="pending" />}</span>
              {r.onInstalmentPlan && <span className="bv-cell-sub nowrap">{t("creditControl.onPlan")}</span>}
              {r.cancellationRequest && <span className="bv-cell-sub">{r.cancellationRequest}</span>}
            </div>
          )} />
          <Column style={{ width: "11rem", minWidth: "11rem" }} body={(r) => (
            <div className="flex gap-1 flex-nowrap">
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
            <div className="col-12">
              <KeyValueGrid columns={2} items={[
                { label: t("creditControl.client"), value: extension.row.clientName },
                { label: t("creditControl.currentDeadline"), value: extension.row.deadline, type: "date" },
                { label: t("creditControl.premiumDue"), value: extension.row.premiumDue, type: "amount" },
                { label: t("creditControl.daysPast"), value: extension.row.daysPastDeadline, type: "number" },
              ]} />
            </div>
            <div className="col-12"><label htmlFor="cc-ext-deadline">{t("creditControl.requestedDeadline")} *</label>
              <Calendar inputId="cc-ext-deadline" value={extension.requestedDeadline} minDate={new Date(`${extension.row.deadline}T00:00:00`)} onChange={(e) => setExtension({ ...extension, requestedDeadline: e.value })} showIcon className="w-full" /></div>
            <div className="col-12"><label htmlFor="cc-ext-reason">{t("creditControl.reason")} *</label>
              <InputTextarea id="cc-ext-reason" value={extension.reason} rows={3} onChange={(e) => setExtension({ ...extension, reason: e.target.value })} className="w-full" /></div>
          </div>
        )}
      </Dialog>

      <DetailDialog visible={!!actions} onHide={() => setActions(null)} size="md" header={t("creditControl.confirmations.historyTitle")}>
        {actions && (
          <>
            <DetailHeader title={actions.row.policyNumber} subtitle={actions.row.clientName}
              status={{ code: actions.row.status, label: t(`creditControl.status.${actions.row.status}`, { defaultValue: humanize(actions.row.status) }) }}
              meta={[
                { label: t("creditControl.insurer"), value: actions.row.insurerName },
                { label: t("creditControl.deadline"), value: actions.row.deadline, type: "date" },
                { label: t("creditControl.premiumDue"), value: actions.row.premiumDue, type: "amount" },
              ]} />
            <DetailSection title={t("creditControl.confirmations.activity")}>
              <ActivityLog entries={fromWarrantyActions(actions.list, {
                actionLabels: Object.fromEntries(actions.list.map((a) => [a.action, t(`creditControl.actionType.${a.action}`, { defaultValue: humanize(a.action) })])),
              })} />
            </DetailSection>
          </>
        )}
      </DetailDialog>
    </div>
  );
};

export default WarrantyMonitor;
