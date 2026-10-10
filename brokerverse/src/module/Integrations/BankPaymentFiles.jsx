import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
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
import { openConfirm } from "../../components/ConfirmDialog";
import { ActivityLog, fromLifecycle } from "../../components/ActivityLog";
import { currentUser } from "../../utility/userIdentity";
import { IntTag, PageHeader, SEVERITY, date, dateTime, isoDay, money, showError, showSuccess } from "./common";
import { calendarDateFormat } from "../../utility/dateFormat";

const STATUSES = ["draft", "for-approval", "approved", "file-generated", "sent", "completed", "cancelled"];
const CHANNELS = ["bulk_credit", "instapay", "pesonet"];

/** New batch: layout, bank account, channel, value date and the vouchers to pay. */
const NewBatch = ({ visible, onHide, onCreated, toast }) => {
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ layoutCode: null, bankAccountCode: null, channel: "pesonet", valueDate: new Date(), remarks: "" });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setLoading(true);
    Promise.all([service.layouts(), service.bankAccounts(), service.eligibleVouchers()])
      .then(([l, a, v]) => { setLayouts(l.data || []); setAccounts(a); setVouchers(v); })
      .catch((e) => showError(toast, e))
      .finally(() => setLoading(false));
  }, [visible, toast]);
  const layout = layouts.find((l) => l.code === form.layoutCode);
  const total = selected.reduce((s, v) => s + Number(v.amount), 0);
  const create = async () => {
    try {
      const r = await service.createBatch({ layoutCode: form.layoutCode, bankAccountCode: form.bankAccountCode, channel: form.channel, valueDate: isoDay(form.valueDate),
        disbursementIds: selected.map((v) => v.disbursementId), remarks: form.remarks || undefined });
      showSuccess(toast, r.message);
      onCreated(r.data);
    } catch (e) {
      showError(toast, e);
    }
  };
  return (
    <Dialog className="pe-dialog" header={t("integrations.newBatch")} visible={visible} style={{ width: "min(1100px, 98vw)" }} onHide={onHide}
      footer={<div><Button label={t("integrations.cancel")} text onClick={onHide} />
        <Button label={t("integrations.createBatch")} icon="pi pi-check" onClick={create} disabled={!form.layoutCode || !form.bankAccountCode || !selected.length} /></div>}>
      <div className="grid">
        <div className="col-12 md:col-4"><label>{t("integrations.layout")} *</label>
          <Dropdown value={form.layoutCode} options={layouts.map((l) => ({ label: l.name, value: l.code }))} onChange={(e) => {
            const l = layouts.find((x) => x.code === e.value);
            setForm({ ...form, layoutCode: e.value, channel: l?.channels.includes(form.channel) ? form.channel : l?.channels[0] });
          }} className="w-full" /></div>
        <div className="col-12 md:col-4"><label>{t("integrations.payFrom")} *</label>
          <Dropdown value={form.bankAccountCode} options={accounts.map((a) => ({ label: `${a.name} (${a.bankCode} ${a.accountNumber})`, value: a.code }))} onChange={(e) => setForm({ ...form, bankAccountCode: e.value })} className="w-full" /></div>
        <div className="col-6 md:col-2"><label>{t("integrations.channel")}</label>
          <Dropdown value={form.channel} options={(layout?.channels || CHANNELS).map((c) => ({ label: t(`integrations.channelTypes.${c}`), value: c }))} onChange={(e) => setForm({ ...form, channel: e.value })} className="w-full" /></div>
        <div className="col-6 md:col-2"><label>{t("integrations.valueDate")}</label><Calendar value={form.valueDate} onChange={(e) => setForm({ ...form, valueDate: e.value })} dateFormat={calendarDateFormat()} className="w-full" /></div>
        {layout?.isExample && <div className="col-12"><Message severity="warn" className="w-full" text={t("integrations.exampleLayout")} /></div>}
        <div className="col-12">
          <DataTable value={vouchers} loading={loading} dataKey="disbursementId" size="small" stripedRows selectionMode="checkbox" selection={selected}
            onSelectionChange={(e) => setSelected(e.value.filter((v) => v.ready))} isDataSelectable={(e) => e.data.ready} emptyMessage={t("integrations.noVouchers")} scrollable scrollHeight="22rem">
            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
            <Column field="voucherNumber" header={t("integrations.voucher")} />
            <Column header={t("integrations.payee")} body={(v) => <div><div>{v.payeeName}</div><div className="pe-muted">{t(`integrations.payeeTypes.${v.payeeType}`, { defaultValue: v.payeeType })}</div></div>} />
            <Column header={t("integrations.amount")} body={(v) => money(v.amount)} className="bv-num" headerClassName="bv-num" />
            <Column header={t("integrations.payeeAccount")} body={(v) => (v.ready ? `${v.bankCode} ${v.accountNumber}` : <span className="text-orange-600">{t("integrations.noPayeeAccount")}</span>)} />
            <Column header={t("integrations.voucherDate")} body={(v) => date(v.voucherDate)} />
          </DataTable>
          <div className="mt-2 text-right"><strong>{t("integrations.selected", { count: selected.length })}: {money(total)}</strong></div>
        </div>
        <div className="col-12"><label>{t("integrations.remarks")}</label><InputText value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full" /></div>
      </div>
    </Dialog>
  );
};

const LIFECYCLE = [
  { action: "create", at: "createdAt", by: "createdBy" },
  { action: "submit", at: "submittedAt" },
  { action: "approve", at: "approvedAt", by: "approvedBy" },
  { action: "generate", at: "fileGeneratedAt" },
  { action: "send", at: "sentAt" },
];

/** The signed-in user created the batch (the API names the maker by display name). */
const ownBatch = (b) => {
  const me = currentUser();
  return [me.displayName, me.username].filter(Boolean).some((n) => String(n).toLowerCase() === String(b?.createdBy || "").toLowerCase());
};

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
    { label: t("integrations.totalAmount"), value: b.totalAmount, type: "amount", emphasis: true },
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
  const own = b ? ownBatch(b) : false;
  const ownReason = own ? t("makerChecker.ownRecord") : null;

  const actions = b ? (
    <>
      {s === "draft" && <Button label={t("integrations.submit")} icon="pi pi-send" onClick={() => step("submit", () => service.submitBatch(b.id))} />}
      {s === "for-approval" && (
        <span className="bv-int-approval">
          {own ? <span id={`batch-${b.id}-own`} className="bv-int-approval__reason"><i className="pi pi-lock" aria-hidden="true" />{ownReason}</span> : null}
          <Button label={t("integrations.reject")} icon="pi pi-undo" outlined severity="danger" disabled={own} aria-describedby={own ? `batch-${b.id}-own` : undefined}
            onClick={() => step("reject", (text) => service.rejectBatch(b.id, text), { severity: "danger", reason: true })} />
          <Button label={t("integrations.approve")} icon="pi pi-check" disabled={own} aria-describedby={own ? `batch-${b.id}-own` : undefined}
            onClick={() => step("approve", () => service.approveBatch(b.id))} />
        </span>
      )}
      {["approved", "file-generated", "sent"].includes(s) && !b.paidCount && !b.rejectedCount && (
        <Button label={b.fileName ? t("integrations.rewriteFile") : t("integrations.writeFile")} icon="pi pi-file"
          onClick={() => step(b.fileName ? "rewrite" : "generate", () => service.generateBatchFile(b.id), { severity: b.fileName ? "warning" : "neutral" })} />
      )}
      {b.fileName && <Button label={t("integrations.downloadFile")} icon="pi pi-download" outlined onClick={() => service.downloadBatchFile(b.id, b.fileName).catch((e) => showError(toast, e))} />}
      {s === "file-generated" && <Button label={t("integrations.markUploaded")} icon="pi pi-cloud-upload" outlined onClick={() => step("sent", () => service.markBatchSent(b.id))} />}
      {["file-generated", "sent"].includes(s) && (
        <>
          <input ref={fileInput} type="file" accept=".csv,.txt,text/plain" style={{ display: "none" }} aria-label={t("integrations.importStatus")}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run("status", () => service.importStatusFile(b.id, f)); }} />
          <Button label={t("integrations.importStatus")} icon="pi pi-upload" outlined loading={busy === "status"} onClick={() => fileInput.current?.click()} />
        </>
      )}
      {!["completed", "cancelled"].includes(s) && !b.paidCount && (
        <Button label={t("integrations.cancelBatch")} icon="pi pi-times" text severity="danger"
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
              { label: t("integrations.totalAmount"), value: b.totalAmount, type: "amount" },
            ]}
          />
          <div className="bv-int-actions">{actions}</div>
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
              <Column header={t("integrations.payeeAccount")} body={(l) => `${l.bankCode} ${l.accountNumber}`} />
              <Column header={t("integrations.amount")} body={(l) => money(l.amount)} className="bv-num" headerClassName="bv-num" />
              <Column header={t("integrations.status.label")} body={(l) => <IntTag status={l.status} />} />
              <Column header={t("integrations.bankReference")} body={(l) => l.bankReference || l.reason || "-"} />
              <Column header={t("integrations.journal")} body={(l) => l.journalNumber || "-"} />
              <Column header={t("integrations.resultAt")} body={(l) => (l.resultAt ? `${dateTime(l.resultAt)} (${t(`integrations.sourceType.${l.resultSource}`)})` : "-")} />
              <Column header="" body={(l) => (l.status === "pending" && ["file-generated", "sent"].includes(s) ? (
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
  const [openId, setOpenId] = useState(null);
  const fetchPage = useCallback(({ page, pageSize }) => service.batches({ status: filters.status, search: filters.search.trim(), page, pageSize }), [filters]);
  const list = useServerList(fetchPage, { key: "bank-payment-batches" });
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Accounts")} section={t("sidebar.Disbursement")} title={t("integrations.batchesTitle")} subtitle={t("integrations.batchesIntro")}>
        <Button icon="pi pi-plus" label={t("integrations.newBatch")} onClick={() => setCreating(true)} />
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
      <NewBatch visible={creating} toast={toast} onHide={() => setCreating(false)} onCreated={(b) => { setCreating(false); list.reload(); setOpenId(b.id); }} />
      <BatchDialog batchId={openId} toast={toast} onHide={() => setOpenId(null)} onChanged={list.reload} />
    </div>
  );
};

export default BankPaymentFiles;
