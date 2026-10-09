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
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import { IntTag, PageHeader, date, dateTime, isoDay, money, showError, showSuccess } from "./common";

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
        <div className="col-6 md:col-2"><label>{t("integrations.valueDate")}</label><Calendar value={form.valueDate} onChange={(e) => setForm({ ...form, valueDate: e.value })} dateFormat="yy-mm-dd" className="w-full" /></div>
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

/** One batch: lines, workflow buttons, the file, the status file import and the manual result of a line. */
const BatchDialog = ({ batchId, onHide, onChanged, toast }) => {
  const { t } = useTranslation();
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reason, setReason] = useState(null);
  const [result, setResult] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const fileInput = useRef(null);
  const load = useCallback(() => service.batch(batchId).then(setB).catch((e) => showError(toast, e)), [batchId, toast]);
  useEffect(() => {
    if (!batchId) return;
    setB(null);
    setSkipped([]);
    load();
  }, [batchId, load]);
  const run = async (key, fn) => {
    setBusy(key);
    try {
      const r = await fn();
      showSuccess(toast, r.message);
      if (r.data?.outcome?.skipped) setSkipped(r.data.outcome.skipped);
      await load();
      onChanged();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(null);
    }
  };
  if (!batchId) return null;
  const s = b?.status;
  return (
    <Dialog className="pe-dialog" header={b ? `${b.batchNumber} · ${b.layoutName}` : ""} visible onHide={onHide} style={{ width: "min(1150px, 98vw)" }}>
      {b && (
        <>
          <div className="pe-filters mb-2">
            <IntTag status={b.status} />
            <span>{t(`integrations.channelTypes.${b.channel}`)} · {t("integrations.valueDate")} {date(b.valueDate)} · {b.bankAccountName || b.bankAccountCode}</span>
            <strong className="ml-auto">{b.lineCount} · {money(b.totalAmount)}</strong>
          </div>
          {b.rejectedReason && s === "draft" && <Message severity="warn" className="w-full mb-2" text={`${t("integrations.returned")}: ${b.rejectedReason}`} />}
          <div className="flex flex-wrap gap-2 mb-3">
            {s === "draft" && <Button label={t("integrations.submit")} icon="pi pi-send" loading={busy === "submit"} onClick={() => run("submit", () => service.submitBatch(b.id))} />}
            {s === "for-approval" && <Button label={t("integrations.approve")} icon="pi pi-check" loading={busy === "approve"} onClick={() => run("approve", () => service.approveBatch(b.id))} />}
            {s === "for-approval" && <Button label={t("integrations.reject")} icon="pi pi-undo" outlined severity="danger" onClick={() => setReason({ action: "reject", text: "" })} />}
            {["approved", "file-generated", "sent"].includes(s) && !b.paidCount && !b.rejectedCount && (
              <Button label={b.fileName ? t("integrations.rewriteFile") : t("integrations.writeFile")} icon="pi pi-file" loading={busy === "generate"} onClick={() => run("generate", () => service.generateBatchFile(b.id))} />
            )}
            {b.fileName && <Button label={t("integrations.downloadFile")} icon="pi pi-download" outlined onClick={() => service.downloadBatchFile(b.id, b.fileName).catch((e) => showError(toast, e))} />}
            {s === "file-generated" && <Button label={t("integrations.markUploaded")} icon="pi pi-cloud-upload" outlined loading={busy === "sent"} onClick={() => run("sent", () => service.markBatchSent(b.id))} />}
            {["file-generated", "sent"].includes(s) && (
              <>
                <input ref={fileInput} type="file" accept=".csv,.txt,text/plain" style={{ display: "none" }} aria-label={t("integrations.importStatus")}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run("status", () => service.importStatusFile(b.id, f)); }} />
                <Button label={t("integrations.importStatus")} icon="pi pi-upload" loading={busy === "status"} onClick={() => fileInput.current?.click()} />
              </>
            )}
            {!["completed", "cancelled"].includes(s) && !b.paidCount && (
              <Button label={t("integrations.cancelBatch")} icon="pi pi-times" text severity="danger" onClick={() => setReason({ action: "cancel", text: "" })} />
            )}
          </div>
          {skipped.length > 0 && <Message severity="warn" className="w-full mb-2" text={`${t("integrations.rowsSkipped")}: ${skipped.map((x) => `${x.reference} (${x.reason})`).join("; ")}`} />}
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
        </>
      )}
      <Dialog className="pe-dialog" header={reason?.action === "reject" ? t("integrations.reject") : t("integrations.cancelBatch")} visible={!!reason} style={{ width: "min(480px, 96vw)" }} onHide={() => setReason(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setReason(null)} /><Button label={t("integrations.confirm")} icon="pi pi-check" disabled={!reason?.text || reason.text.trim().length < 3}
          onClick={() => { const r = reason; setReason(null); run(r.action, () => (r.action === "reject" ? service.rejectBatch(b.id, r.text.trim()) : service.cancelBatch(b.id, r.text.trim()))); }} /></div>}>
        <label htmlFor="batch-reason">{t("integrations.reason")}</label>
        <InputText id="batch-reason" value={reason?.text || ""} onChange={(e) => setReason({ ...reason, text: e.target.value })} className="w-full" />
      </Dialog>
      <Dialog className="pe-dialog" header={result ? `${t("integrations.recordResult")}: ${result.voucher}` : ""} visible={!!result} style={{ width: "min(520px, 96vw)" }} onHide={() => setResult(null)}
        footer={<div><Button label={t("integrations.cancel")} text onClick={() => setResult(null)} /><Button label={t("integrations.save")} icon="pi pi-save" disabled={result?.status === "rejected" && !result?.reason}
          onClick={() => { const r = result; setResult(null); run("line", () => service.lineResult(b.id, r.lineId, { status: r.status, bankReference: r.bankReference || undefined, reason: r.reason || undefined })); }} /></div>}>
        {result && (
          <div className="grid">
            <div className="col-12"><label>{t("integrations.result")}</label>
              <Dropdown value={result.status} options={["paid", "rejected"].map((x) => ({ label: t(`integrations.status.${x}`), value: x }))} onChange={(e) => setResult({ ...result, status: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("integrations.bankReference")}</label><InputText value={result.bankReference} onChange={(e) => setResult({ ...result, bankReference: e.target.value })} className="w-full" /></div>
            {result.status === "rejected" && <div className="col-12"><label>{t("integrations.reason")} *</label><InputText value={result.reason} onChange={(e) => setResult({ ...result, reason: e.target.value })} className="w-full" /></div>}
          </div>
        )}
      </Dialog>
    </Dialog>
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
      {creating ? <NewBatch visible toast={toast} onHide={() => setCreating(false)} onCreated={(b) => { setCreating(false); list.reload(); setOpenId(b.id); }} /> : null}
      <BatchDialog batchId={openId} toast={toast} onHide={() => setOpenId(null)} onChanged={list.reload} />
    </div>
  );
};

export default BankPaymentFiles;
