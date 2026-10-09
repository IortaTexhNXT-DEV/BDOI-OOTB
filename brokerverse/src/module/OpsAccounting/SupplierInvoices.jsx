import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { Field, OpsTag, PageHeader, blank, date, isoOf, money, numericColumn, showError, showSuccess, useFieldErrors } from "./common";

const STATUSES = ["all", "draft", "for-approval", "open", "approved", "partially-paid", "paid", "rejected", "cancelled"];
const newLine = (account = "") => ({ description: "", accountCode: account, amount: null, vatable: true, assetClass: null });

/**
 * Accounts > Payables > Supplier Invoices: supplier invoices with input VAT and expanded withholding tax, sent for
 * approval (approve:payables, not the preparer) and posted on approval; an asset line is capitalised in the fixed asset
 * register. Print the AP voucher with its journal.
 */
const SupplierInvoices = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const { errors, check, fromApi, clear } = useFieldErrors();
  const openForm = (value) => { clear(); setForm(value); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.supplierInvoices({ status, search: search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    service.masterRecords("supplier", { status: "Active" }).then((r) => setSuppliers(r.rows)).catch(() => {});
    service.assetClasses().then(setClasses).catch(() => {});
  }, []);

  const supplier = suppliers.find((s) => s.code === form?.supplierId);
  const act = async (fn, message) => {
    try {
      const r = await fn();
      showSuccess(toast, typeof message === "function" ? message(r) : message);
      load();
      if (view) setView(await service.supplierInvoice(view.id));
      return true;
    } catch (e) {
      fromApi(e);
      showError(toast, e);
      return false;
    }
  };
  const save = (submit) => check({
    supplierId: form.supplierId ? null : t("opsAcc.required"),
    supplierInvoiceNo: blank(form.supplierInvoiceNo) ? t("opsAcc.required") : null,
    invoiceDate: form.invoiceDate ? null : t("opsAcc.required"),
    lines: form.lines.every((l) => l.amount > 0) ? null : t("opsAcc.ap.lineAmounts"),
  }) && act(() => service.createSupplierInvoice({
    supplierId: form.supplierId, supplierInvoiceNo: form.supplierInvoiceNo, invoiceDate: isoOf(form.invoiceDate), description: form.description || null,
    ...(form.ewtCode !== undefined ? { ewtCode: form.ewtCode || null } : {}), submit,
    lines: form.lines.map((l) => ({ description: l.description || form.description || "Supplier invoice", accountCode: l.accountCode || undefined, amount: l.amount, vatable: l.vatable, assetClass: l.assetClass || null })),
  }), (r) => t("opsAcc.ap.saved", { number: r.voucherNumber, status: t(`opsAcc.status.${r.status}`) })).then((ok) => ok && openForm(null));
  const reason = async (label) => promptText(t(label));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const net = (form?.lines || []).reduce((s, l) => s + Number(l.amount || 0), 0);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.ap.invoices")} section={t("opsAcc.ap.menu")} subtitle={t("opsAcc.ap.invoicesIntro")}>
        <Button icon="pi pi-plus" label={t("opsAcc.ap.newInvoice")} onClick={() => openForm({ supplierId: null, supplierInvoiceNo: "", invoiceDate: new Date(), description: "", lines: [newLine()] })} />
      </PageHeader>
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <Dropdown value={status} options={STATUSES.map((s) => ({ label: t(`opsAcc.status.${s}`), value: s }))} onChange={(e) => setStatus(e.value)} className="w-12rem" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.ap.searchHint")} className="w-20rem" />
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")} rowHover
          onRowClick={(e) => service.supplierInvoice(e.data.id).then(setView).catch((x) => showError(toast, x))}>
          <Column field="voucherNumber" header={t("opsAcc.ap.voucher")} />
          <Column field="supplierName" header={t("opsAcc.ap.supplier")} />
          <Column field="supplierInvoiceNo" header={t("opsAcc.ap.supplierInvoice")} />
          <Column header={t("opsAcc.ap.invoiceDate")} body={(r) => date(r.invoiceDate)} />
          <Column header={t("opsAcc.ap.dueDate")} body={(r) => date(r.dueDate)} />
          <Column header={t("opsAcc.ap.gross")} body={(r) => money(r.grossAmount)} {...numericColumn} />
          <Column header={t("opsAcc.ap.ewt")} body={(r) => money(r.ewtAmount)} {...numericColumn} />
          <Column header={t("opsAcc.ap.balance")} body={(r) => money(r.balance)} {...numericColumn} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={view ? `${view.voucherNumber} · ${view.supplierName}` : ""} visible={!!view} style={{ width: "min(960px, 96vw)" }} onHide={() => setView(null)}>
        {view && (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              <OpsTag status={view.status} />
              {["draft", "rejected"].includes(view.status) && <Button label={t("opsAcc.ap.submit")} size="small" onClick={() => act(() => service.invoiceAction(view.id, "submit"), t("opsAcc.ap.submitted"))} />}
              {view.status === "for-approval" && <Button label={t("opsAcc.approve")} size="small" icon="pi pi-check" onClick={() => act(() => service.invoiceAction(view.id, "approve"), t("opsAcc.ap.approved"))} />}
              {view.status === "for-approval" && <Button label={t("opsAcc.reject")} size="small" severity="danger" outlined
                onClick={async () => { const r = await reason("opsAcc.ap.rejectReason"); if (r) act(() => service.invoiceAction(view.id, "reject", { reason: r }), t("opsAcc.ap.rejected")); }} />}
              {["draft", "rejected", "for-approval", "approved"].includes(view.status) && <Button label={t("opsAcc.cancel")} size="small" text
                onClick={async () => { const r = await reason("opsAcc.ap.cancelReason"); if (r) act(() => service.invoiceAction(view.id, "cancel", { reason: r }), t("opsAcc.ap.cancelled")); }} />}
              <Button label={t("opsAcc.print")} size="small" icon="pi pi-print" outlined onClick={() => service.printSupplierInvoice(view.id).catch((e) => showError(toast, e))} />
            </div>
            <p className="mt-0">{view.supplierInvoiceNo} · {date(view.invoiceDate)} · {t("opsAcc.ap.dueDate")} {date(view.dueDate)} {view.journalNumber ? `· ${view.journalNumber}` : ""}</p>
            <DataTable value={view.lines} dataKey="id" size="small">
              <Column field="description" header={t("opsAcc.description")} />
              <Column header={t("opsAcc.ap.account")} body={(r) => `${r.accountCode} ${r.accountName || ""}`} />
              <Column field="assetClass" header={t("opsAcc.ap.assetClass")} />
              <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
              <Column header={t("opsAcc.ap.vat")} body={(r) => money(r.vatAmount)} {...numericColumn} />
            </DataTable>
            <div className="flex flex-wrap gap-4 mt-2">
              <span>{t("opsAcc.ap.net")}: <b>{money(view.netAmount)}</b></span>
              <span>{t("opsAcc.ap.vat")}: <b>{money(view.inputVat)}</b></span>
              <span>{t("opsAcc.ap.gross")}: <b>{money(view.grossAmount)}</b></span>
              <span>{t("opsAcc.ap.ewt")} {view.ewtCode ? `(${view.ewtCode} ${view.ewtRate}%)` : ""}: <b>{money(view.ewtAmount)}</b></span>
              <span>{t("opsAcc.ap.payable")}: <b>{money(view.payableAmount)}</b></span>
            </div>
          </>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("opsAcc.ap.newInvoice")} visible={!!form} style={{ width: "min(1000px, 98vw)" }} onHide={() => openForm(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => openForm(null)} /><Button label={t("opsAcc.ap.saveDraft")} outlined onClick={() => save(false)} />
          <Button label={t("opsAcc.ap.saveSubmit")} icon="pi pi-send" onClick={() => save(true)} /></div>}>
        {form && (
          <>
            <div className="grid">
              <Field label={t("opsAcc.ap.supplier")} col="col-12 md:col-5" required error={errors.supplierId}>
                <Dropdown value={form.supplierId} options={suppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.code }))} filter
                  onChange={(e) => { const s = suppliers.find((x) => x.code === e.value); setForm({ ...form, supplierId: e.value, lines: form.lines.map((l) => ({ ...l, accountCode: l.accountCode || s?.expenseAccount || "" })) }); }} className="w-full" />
              </Field>
              <Field label={t("opsAcc.ap.supplierInvoice")} col="col-12 md:col-3" required error={errors.supplierInvoiceNo}><InputText value={form.supplierInvoiceNo} maxLength={60} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.ap.invoiceDate")} col="col-12 md:col-4" required error={errors.invoiceDate}><Calendar value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.value })} showIcon className="w-full" /></Field>
              <Field label={t("opsAcc.description")} col="col-12 md:col-8"><InputText value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.ap.ewtCode")} col="col-12 md:col-4"><InputText value={form.ewtCode ?? supplier?.ewtCode ?? ""} maxLength={20} onChange={(e) => setForm({ ...form, ewtCode: e.target.value })} className="w-full" /></Field>
            </div>
            {supplier && <p className="pe-muted mt-0">{supplier.vatRegistered === false ? t("opsAcc.ap.notVat") : t("opsAcc.ap.vatRegistered")} · {t("opsAcc.ap.terms", { days: supplier.paymentTermsDays ?? "-" })}</p>}
            <DataTable value={form.lines.map((l, i) => ({ ...l, i }))} dataKey="i" size="small">
              <Column header={t("opsAcc.description")} body={(r) => <InputText value={r.description} maxLength={300} onChange={(e) => setLine(r.i, { description: e.target.value })} className="w-full" />} />
              <Column header={t("opsAcc.ap.account")} body={(r) => <InputText value={r.accountCode} maxLength={20} disabled={!!r.assetClass} onChange={(e) => setLine(r.i, { accountCode: e.target.value })} className="w-8rem" />} />
              <Column header={t("opsAcc.ap.assetClass")} body={(r) => <Dropdown value={r.assetClass} options={classes.map((c) => ({ label: c.name, value: c.code }))} showClear placeholder="-" onChange={(e) => setLine(r.i, { assetClass: e.value })} className="w-10rem" />} />
              <Column header={t("opsAcc.ap.vatable")} body={(r) => <Checkbox checked={r.vatable} onChange={(e) => setLine(r.i, { vatable: e.checked })} />} />
              <Column header={t("opsAcc.amount")} body={(r) => <InputNumber value={r.amount} mode="decimal" minFractionDigits={2} min={0} className={errors.lines && !(r.amount > 0) ? "p-invalid" : undefined} onValueChange={(e) => setLine(r.i, { amount: e.value })} />} />
              <Column body={(r) => <Button icon="pi pi-trash" text size="small" aria-label={t("opsAcc.remove")} disabled={form.lines.length < 2} onClick={() => setForm({ ...form, lines: form.lines.filter((_, k) => k !== r.i) })} />} />
            </DataTable>
            {errors.lines ? <small className="p-error block mt-1" role="alert">{errors.lines}</small> : null}
            <div className="flex justify-content-between mt-2">
              <Button icon="pi pi-plus" label={t("opsAcc.ap.addLine")} text onClick={() => setForm({ ...form, lines: [...form.lines, newLine(supplier?.expenseAccount || "")] })} />
              <span>{t("opsAcc.ap.net")}: <b>{money(net)}</b></span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};

export default SupplierInvoices;
