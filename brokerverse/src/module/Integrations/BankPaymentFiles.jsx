import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Skeleton } from "primereact/skeleton";
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import EligibilityNote from "../../components/EligibilityNote";
import BankBatchDialog from "../../components/BankBatchDialog";
import { openConfirm } from "../../components/ConfirmDialog";
import { ActivityLog, fromLifecycle } from "../../components/ActivityLog";
import { codeAmount } from "../../utility/currencyConverter";
import { hasPermission } from "../../utils/canOpen";
import { IntTag, PageHeader, SEVERITY, date, dateTime, showError, showSuccess } from "./common";

const STATUSES = ["draft", "for-approval", "approved", "file-generated", "sent", "completed", "cancelled"];

/** "PHP 89,026.00", as the remittance and payment screens write amounts. */
const money = (value) => codeAmount(value, "PHP");

/** "BPI ···8801": the payee's bank and the last four digits of the account; the full number stays in Insurer payments. */
const maskedAccount = (bankCode, accountNumber) => {
  const digits = String(accountNumber || "").replace(/\D/g, "");
  return [bankCode, digits ? `···${digits.slice(-4)}` : null].filter(Boolean).join(" ");
};

const LIFECYCLE = [
  { action: "create", at: "createdAt", by: "createdBy" },
  { action: "submit", at: "submittedAt" },
  { action: "approve", at: "approvedAt", by: "approvedBy" },
  { action: "generate", at: "fileGeneratedAt" },
  { action: "send", at: "sentAt" },
];

/**
 * One batch: its number, status and totals, the workflow actions (each confirmed with the batch's figures), the batch
 * facts, its payments with the manual result of a line, and what happened to it so far.
 */
const BatchDialog = ({ batchId, onHide, onChanged, toast }) => {
  const { t, i18n } = useTranslation();
  const [b, setB] = useState(null);
  const [result, setResult] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [busy, setBusy] = useState(null);
  const fileInput = useRef(null);
  const load = useCallback(() => service.batch(batchId).then(setB).catch((e) => showError(toast, e)), [batchId, toast]);
  useEffect(() => {
    if (!batchId) return;
    setB(null);
    setSkipped([]);
    load();
  }, [batchId, load]);

  const done = async (r) => {
    showSuccess(toast, r?.message);
    if (r?.data?.outcome?.skipped) setSkipped(r.data.outcome.skipped);
    await load();
    onChanged();
  };

  // a step without a question (status file, line result): runs at once
  const run = async (key, fn) => {
    setBusy(key);
    try {
      await done(await fn());
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };

  const facts = () => [
    { label: t("integrations.batch"), value: b.batchNumber },
    { label: t("integrations.channel"), value: t(`integrations.channelTypes.${b.channel}`) },
    { label: t("integrations.valueDate"), value: b.valueDate, type: "date" },
    { label: t("integrations.payments"), value: b.lineCount, type: "number" },
    { label: t("integrations.totalAmount"), value: money(b.totalAmount), emphasis: true },
  ];

  // a workflow step: confirmed with the batch's figures, run inside the dialog (errors stay there)
  const step = async (action, fn, { severity = "neutral", reason = false } = {}) => {
    let r;
    const answer = await openConfirm({
      title: t(`integrations.batchSteps.${action}.title`),
      severity,
      message: t(`integrations.batchSteps.${action}.message`),
      facts: facts(),
      note: i18n.exists(`integrations.batchSteps.${action}.note`) ? t(`integrations.batchSteps.${action}.note`) : null,
      input: reason ? { type: "textarea", label: t("integrations.reason"), required: true, minLength: 3, maxLength: 500 } : null,
      confirmLabel: t(`integrations.batchSteps.${action}.action`),
      onConfirm: async (value) => {
        r = await fn(value);
      },
    });
    if (answer === null || answer === false) return;
    await done(r);
  };

  if (!batchId) return null;
  const s = b?.status;
  const decision = b?.decision || null;
  // the workflow steps need write:disbursements on the server: a reader sees the batch only
  const canWrite = hasPermission("write:disbursements");

  const actions = b ? (
    <>
      {canWrite && s === "draft" && <Button label={t("integrations.submit")} icon="pi pi-send" onClick={() => step("submit", () => service.submitBatch(b.id))} />}
      {s === "for-approval" && decision?.canDecide ? (
        <span className="bv-int-approval">
          <Button label={t("integrations.reject")} icon="pi pi-undo" outlined severity="danger"
            onClick={() => step("reject", (text) => service.rejectBatch(b.id, text), { severity: "danger", reason: true })} />
          <Button label={t("integrations.approve")} icon="pi pi-check" onClick={() => step("approve", () => service.approveBatch(b.id))} />
        </span>
      ) : null}
      {canWrite && ["approved", "file-generated", "sent"].includes(s) && !b.paidCount && !b.rejectedCount && (
        <Button label={b.fileName ? t("integrations.rewriteFile") : t("integrations.writeFile")} icon="pi pi-file"
          onClick={() => step(b.fileName ? "rewrite" : "generate", () => service.generateBatchFile(b.id), { severity: b.fileName ? "warning" : "neutral" })} />
      )}
      {b.fileName && <Button label={t("integrations.downloadFile")} icon="pi pi-download" outlined onClick={() => service.downloadBatchFile(b.id, b.fileName).catch((e) => showError(toast, e))} />}
      {canWrite && s === "file-generated" && <Button label={t("integrations.markUploaded")} icon="pi pi-cloud-upload" outlined onClick={() => step("sent", () => service.markBatchSent(b.id))} />}
      {canWrite && ["file-generated", "sent"].includes(s) && (
        <>
          <input ref={fileInput} type="file" accept=".csv,.txt,text/plain" style={{ display: "none" }} aria-label={t("integrations.importStatus")}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run("status", () => service.importStatusFile(b.id, f)); }} />
          <Button label={t("integrations.importStatus")} icon="pi pi-upload" outlined loading={busy === "status"} onClick={() => fileInput.current?.click()} />
        </>
      )}
      {canWrite && !["completed", "cancelled"].includes(s) && !b.paidCount && (
        <Button label={t("integrations.cancelBatch")} outlined severity="danger"
          onClick={() => step("cancel", (text) => service.cancelBatch(b.id, text), { severity: "danger", reason: true })} />
      )}
    </>
  ) : null;

  return (
    <DetailDialog visible onHide={onHide} header={t("integrations.batchDetail")} size="xl">
      {b ? (
        <>
          <DetailHeader
            title={b.batchNumber}
            subtitle={b.layoutName}
            status={{ code: b.status, label: t(`integrations.status.${b.status}`, { defaultValue: b.status }), severity: SEVERITY[b.status] }}
            meta={[
              { label: t("integrations.channel"), value: t(`integrations.channelTypes.${b.channel}`) },
              { label: t("integrations.valueDate"), value: b.valueDate, type: "date" },
              { label: t("integrations.payments"), value: b.lineCount, type: "number" },
              { label: t("integrations.totalAmount"), value: money(b.totalAmount) },
            ]}
          />
          <div className="bv-int-actions">{actions}</div>
          {s === "for-approval" && decision && !decision.canDecide && decision.blockedReason ? <EligibilityNote reason={decision.blockedReason} className="mb-2" /> : null}
          {skipped.length > 0 && <Message severity="warn" className="w-full mb-2" text={`${t("integrations.rowsSkipped")}: ${skipped.map((x) => `${x.reference} (${x.reason})`).join("; ")}`} />}
          <DetailSection title={t("integrations.batchFacts")}>
            <KeyValueGrid columns={4} items={[
              { label: t("integrations.payFrom"), value: b.bankAccountName || b.bankAccountCode, span: 2 },
              { label: t("integrations.status.paid"), value: b.paidCount, type: "number" },
              { label: t("integrations.status.rejected"), value: b.rejectedCount, type: "number" },
              { label: t("integrations.createdBy"), value: b.createdBy },
              { label: t("integrations.createdAt"), value: b.createdAt, type: "datetime" },
              { label: t("integrations.approvedBy"), value: b.approvedBy },
              { label: t("integrations.approvedAt"), value: b.approvedAt, type: "datetime" },
              { label: t("integrations.fileName"), value: b.fileName, span: 2 },
              { label: t("integrations.fileWrittenAt"), value: b.fileGeneratedAt, type: "datetime" },
              { label: t("integrations.uploadedAt"), value: b.sentAt, type: "datetime" },
              { label: t("integrations.returnedReason"), value: b.rejectedReason, span: "full", hidden: !b.rejectedReason },
              { label: t("integrations.remarks"), value: b.remarks, span: "full", hidden: !b.remarks },
            ]} />
          </DetailSection>
          <DetailSection title={t("integrations.payments")} flush>
            <DataTable value={b.lines} dataKey="id" size="small" stripedRows>
              <Column field="seq" header="#" />
              <Column field="voucherNumber" header={t("integrations.voucher")} />
              <Column header={t("integrations.payee")} body={(l) => <div><div>{l.payeeName}</div><div className="pe-muted">{l.accountName}</div></div>} />
              <Column header={t("integrations.payeeAccount")} body={(l) => maskedAccount(l.bankCode, l.accountNumber)} />
              <Column header={t("integrations.amount")} body={(l) => money(l.amount)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("integrations.status.label")} body={(l) => <IntTag status={l.status} />} />
              <Column header={t("integrations.bankReference")} body={(l) => l.bankReference || l.reason || "-"} />
              <Column header={t("integrations.journal")} body={(l) => l.journalNumber || "-"} />
              <Column header={t("integrations.resultAt")} body={(l) => (l.resultAt ? `${dateTime(l.resultAt)} (${t(`integrations.sourceType.${l.resultSource}`)})` : "-")} />
              <Column header="" body={(l) => (canWrite && l.status === "pending" && ["file-generated", "sent"].includes(s) ? (
                <Button icon="pi pi-check-square" text rounded size="small" aria-label={t("integrations.recordResult")} tooltip={t("integrations.recordResult")} tooltipOptions={{ position: "top" }}
                  onClick={() => setResult({ lineId: l.id, voucher: l.voucherNumber, status: "paid", bankReference: "", reason: "" })} />
              ) : null)} />
            </DataTable>
          </DetailSection>
          <DetailSection title={t("integrations.activity")}>
            <ActivityLog entries={fromLifecycle(b, LIFECYCLE)} />
          </DetailSection>
        </>
      ) : (
        <div className="bv-int-loading" aria-busy="true">
          <Skeleton height="2rem" width="40%" />
          <Skeleton height="6rem" />
          <Skeleton height="10rem" />
        </div>
      )}
      <Dialog className="pe-dialog bv-centered" header={result ? `${t("integrations.recordResult")}: ${result.voucher}` : ""} visible={!!result} style={{ width: "min(520px, 96vw)" }} onHide={() => setResult(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setResult(null)} /><Button label={t("integrations.saveResult")} icon="pi pi-save" disabled={result?.status === "rejected" && !result?.reason}
          onClick={() => { const r = result; setResult(null); run("line", () => service.lineResult(b.id, r.lineId, { status: r.status, bankReference: r.bankReference || undefined, reason: r.reason || undefined })); }} /></div>}>
        {result && (
          <div className="grid">
            <div className="col-12"><label htmlFor="line-result">{t("integrations.result")}</label>
              <Dropdown inputId="line-result" value={result.status} options={["paid", "rejected"].map((x) => ({ label: t(`integrations.status.${x}`), value: x }))} onChange={(e) => setResult({ ...result, status: e.value })} className="w-full" /></div>
            <div className="col-12"><label htmlFor="line-ref">{t("integrations.bankReference")}</label><InputText id="line-ref" value={result.bankReference} onChange={(e) => setResult({ ...result, bankReference: e.target.value })} className="w-full" /></div>
            {result.status === "rejected" && <div className="col-12"><label htmlFor="line-reason">{t("integrations.reason")} *</label><InputText id="line-reason" value={result.reason} onChange={(e) => setResult({ ...result, reason: e.target.value })} className="w-full" /></div>}
          </div>
        )}
      </Dialog>
    </DetailDialog>
  );
};

/**
 * Accounts > Bank Payment Files: insurer remittances, referrer payouts and other payment vouchers paid by a bank's
 * bulk credit, InstaPay or PESONet upload file. Maker-checker approval, the file from the bank's layout, and the bank's
 * status file (or the result entered by hand) that posts each payment and marks its voucher paid.
 */
const BankPaymentFiles = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [filters, setFilters] = useState({ status: null, search: "" });
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const openId = params.get("batch");
  const setOpenId = (batchId) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (batchId) next.set("batch", batchId);
    else next.delete("batch");
    return next;
  }, { replace: true });
  const fetchPage = useCallback(({ page, pageSize }) => service.batches({ status: filters.status, search: filters.search.trim(), page, pageSize }), [filters]);
  const list = useServerList(fetchPage, { key: "bank-payment-batches" });
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Accounts")} section={t("sidebar.Disbursement")} title={t("integrations.batchesTitle")}>
        {hasPermission("write:disbursements") ? <Button icon="pi pi-plus" label={t("integrations.newBatch")} onClick={() => setCreating(true)} /> : null}
      </PageHeader>
      <div className="pe-card">
        <div className="pe-filters mb-2">
          <span className="p-input-icon-left"><i className="pi pi-search" />
            <InputText value={filters.search} placeholder={t("integrations.searchBatches")} aria-label={t("integrations.searchBatches")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></span>
          <Dropdown value={filters.status} showClear placeholder={t("integrations.allStatuses")} aria-label={t("integrations.status.label")} options={STATUSES.map((s) => ({ label: t(`integrations.status.${s}`), value: s }))}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.value }))} />
        </div>
        <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("integrations.noBatches")} onRowClick={(e) => setOpenId(e.data.id)} rowClassName={() => "cursor-pointer"}>
          <Column field="batchNumber" header={t("integrations.batch")} />
          <Column header={t("integrations.layout")} body={(b) => <div><div>{b.layoutName}</div><div className="pe-muted">{t(`integrations.channelTypes.${b.channel}`)}</div></div>} />
          <Column header={t("integrations.valueDate")} body={(b) => date(b.valueDate)} />
          <Column header={t("integrations.payments")} body={(b) => `${b.lineCount} (${t("integrations.status.paid")} ${b.paidCount}, ${t("integrations.status.rejected")} ${b.rejectedCount})`} />
          <Column header={t("integrations.amount")} body={(b) => money(b.totalAmount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("integrations.status.label")} body={(b) => <IntTag status={b.status} />} />
          <Column header={t("integrations.created")} body={(b) => <div><div>{dateTime(b.createdAt)}</div><div className="pe-muted">{b.createdBy}</div></div>} />
        </DataTable>
      </div>
      <BankBatchDialog visible={creating} onHide={() => setCreating(false)} onCreated={(b, message) => { setCreating(false); showSuccess(toast, message); list.reload(); setOpenId(b.id); }} />
      <BatchDialog batchId={openId} toast={toast} onHide={() => setOpenId(null)} onChanged={list.reload} />
    </div>
  );
};

export default BankPaymentFiles;
