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
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import ApprovalActions from "../../components/ApprovalActions";
import { RecordActivityLog } from "../../components/ActivityLog";
import { printPdf } from "../../components/Print";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess } from "./common";

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
      showError(toast, e);
      return false;
    }
  };
  const save = (submit) => act(() => service.createSupplierInvoice({
    supplierId: form.supplierId, supplierInvoiceNo: form.supplierInvoiceNo, invoiceDate: isoOf(form.invoiceDate), description: form.description || null,
    ...(form.ewtCode !== undefined ? { ewtCode: form.ewtCode || null } : {}), submit,
    lines: form.lines.map((l) => ({ description: l.description || form.description || "Supplier invoice", accountCode: l.accountCode || undefined, amount: l.amount, vatable: l.vatable, assetClass: l.assetClass || null })),
  }), (r) => t("opsAcc.ap.saved", { number: r.voucherNumber, status: t(`opsAcc.status.${r.status}`) })).then((ok) => ok && setForm(null));
  const invoiceFacts = (inv) => [
    { label: t("opsAcc.ap.voucher"), value: inv.voucherNumber },
    { label: t("opsAcc.ap.supplier"), value: inv.supplierName },
    { label: t("opsAcc.ap.supplierInvoice"), value: inv.supplierInvoiceNo },
    { label: t("opsAcc.ap.invoiceDate"), value: inv.invoiceDate, type: "date" },
    { label: t("opsAcc.ap.gross"), value: inv.grossAmount, type: "amount" },
    { label: t("opsAcc.ap.payable"), value: inv.payableAmount, type: "amount", emphasis: true },
  ];
  // submit, approve, reject and cancel of the invoice in view, each confirmed with the invoice's figures
  const decide = async (action) => {
    const withReason = ["reject", "cancel"].includes(action);
    const answer = await openConfirm({
      title: t(`opsAcc.confirmations.invoice.${action}Title`, { number: view.voucherNumber }),
      severity: withReason ? "danger" : "neutral",
      message: t(`opsAcc.confirmations.invoice.${action}Message`),
      facts: invoiceFacts(view),
      input: withReason ? { type: "textarea", label: t(`opsAcc.ap.${action}Reason`), required: true, minLength: 3, maxLength: 500 } : undefined,
      confirmLabel: t(`opsAcc.confirmations.invoice.${action}`),
      cancelLabel: action === "cancel" ? t("opsAcc.confirmations.invoice.keep") : undefined,
    });
    if (answer === null || answer === false) return;
    const done = { submit: "opsAcc.ap.submitted", approve: "opsAcc.ap.approved", reject: "opsAcc.ap.rejected", cancel: "opsAcc.ap.cancelled" }[action];
    act(() => service.invoiceAction(view.id, action, withReason ? { reason: answer } : undefined), t(done));
  };
  const print = (inv) => printPdf(`/payables/invoices/${encodeURIComponent(inv.id)}/pdf`, { fileName: `${inv.voucherNumber}.pdf` }).catch((e) => showError(toast, e));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const net = (form?.lines || []).reduce((s, l) => s + Number(l.amount || 0), 0);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.ap.invoices")} section={t("opsAcc.ap.menu")} subtitle={t("opsAcc.ap.invoicesIntro")}>
        <Button icon="pi pi-plus" label={t("opsAcc.ap.newInvoice")} onClick={() => setForm({ supplierId: null, supplierInvoiceNo: "", invoiceDate: new Date(), description: "", lines: [newLine()] })} />
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

      <DetailDialog header={t("opsAcc.confirmations.invoice.header")} visible={!!view} onHide={() => setView(null)} size="lg"
        footer={view && (
          <>
            {["draft", "rejected", "for-approval", "approved"].includes(view.status) && (
              <Button label={t("opsAcc.confirmations.invoice.cancel")} text severity="danger" onClick={() => decide("cancel")} />
            )}
            <Button label={t("opsAcc.print")} icon="pi pi-print" outlined onClick={() => print(view)} />
            {["draft", "rejected"].includes(view.status) && <Button label={t("opsAcc.confirmations.invoice.submit")} icon="pi pi-send" onClick={() => decide("submit")} />}
            {view.status === "for-approval" && (
              <ApprovalActions initiator={{ id: view.createdById }} approveLabel={t("opsAcc.confirmations.invoice.approve")} rejectLabel={t("opsAcc.confirmations.invoice.reject")}
                onApprove={() => decide("approve")} onReject={() => decide("reject")} />
            )}
            <Button label={t("detailView.close")} outlined onClick={() => setView(null)} />
          </>
        )}>
        {view && (
          <>
            {/* the header names the invoice; the decision sits with the other actions in the footer, the figures in Amounts */}
            <DetailHeader title={view.voucherNumber} subtitle={view.supplierName} status={{ code: view.status, label: t(`opsAcc.status.${view.status}`, { defaultValue: view.status }) }}
              meta={[
                { label: t("opsAcc.ap.supplierInvoice"), value: view.supplierInvoiceNo },
                { label: t("opsAcc.ap.invoiceDate"), value: view.invoiceDate, type: "date" },
                { label: t("opsAcc.ap.dueDate"), value: view.dueDate, type: "date" },
              ]} />
            {view.status === "rejected" && view.rejectReason && <p className="pe-error">{t("opsAcc.confirmations.rejectedBecause", { reason: view.rejectReason })}</p>}
            {view.status === "cancelled" && view.cancelReason && <p className="pe-error">{t("opsAcc.confirmations.cancelledBecause", { reason: view.cancelReason })}</p>}
            <DetailSection title={t("opsAcc.confirmations.amounts")}>
              <KeyValueGrid columns={3} items={[
                { label: t("opsAcc.ap.net"), value: view.netAmount, type: "amount" },
                { label: t("opsAcc.ap.vat"), value: view.inputVat, type: "amount" },
                { label: t("opsAcc.ap.gross"), value: view.grossAmount, type: "amount" },
                { label: view.ewtCode ? `${t("opsAcc.ap.ewt")} (${view.ewtCode} ${view.ewtRate}%)` : t("opsAcc.ap.ewt"), value: view.ewtAmount, type: "amount" },
                { label: t("opsAcc.ap.payable"), value: view.payableAmount, type: "amount" },
                { label: t("opsAcc.ap.balance"), value: view.balance, type: "amount" },
                { label: t("opsAcc.confirmations.journal"), value: view.journalNumber },
                { label: t("opsAcc.confirmations.preparedBy"), value: view.createdBy },
                { label: t("opsAcc.confirmations.approvedBy"), value: view.approvedBy },
                { label: t("opsAcc.confirmations.approvedAt"), value: view.approvedAt, type: "datetime" },
                { label: t("opsAcc.description"), value: view.description, span: "full", hidden: !view.description },
              ]} />
            </DetailSection>
            <DetailSection title={t("opsAcc.confirmations.lines")} flush>
              <DataTable value={view.lines} dataKey="id" size="small">
                <Column field="description" header={t("opsAcc.description")} />
                <Column header={t("opsAcc.ap.account")} body={(r) => `${r.accountCode} ${r.accountName || ""}`} />
                <Column field="assetClass" header={t("opsAcc.ap.assetClass")} />
                <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
                <Column header={t("opsAcc.ap.vat")} body={(r) => money(r.vatAmount)} {...numericColumn} />
              </DataTable>
            </DetailSection>
            <DetailSection title={t("opsAcc.confirmations.activity")}>
              <RecordActivityLog key={view.status} entity="supplier_invoice" recordId={view.id} />
            </DetailSection>
          </>
        )}
      </DetailDialog>

      <Dialog className="pe-dialog" header={t("opsAcc.ap.newInvoice")} visible={!!form} style={{ width: "min(1000px, 98vw)" }} onHide={() => setForm(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setForm(null)} /><Button label={t("opsAcc.ap.saveDraft")} outlined onClick={() => save(false)} />
          <Button label={t("opsAcc.ap.saveSubmit")} icon="pi pi-send" onClick={() => save(true)} /></div>}>
        {form && (
          <>
            <div className="grid">
              <Field label={t("opsAcc.ap.supplier")} col="col-12 md:col-5" required>
                <Dropdown value={form.supplierId} options={suppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.code }))} filter
                  onChange={(e) => { const s = suppliers.find((x) => x.code === e.value); setForm({ ...form, supplierId: e.value, lines: form.lines.map((l) => ({ ...l, accountCode: l.accountCode || s?.expenseAccount || "" })) }); }} className="w-full" />
              </Field>
              <Field label={t("opsAcc.ap.supplierInvoice")} col="col-12 md:col-3" required><InputText value={form.supplierInvoiceNo} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.ap.invoiceDate")} col="col-12 md:col-4" required><Calendar value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.value })} showIcon className="w-full" /></Field>
              <Field label={t("opsAcc.description")} col="col-12 md:col-8"><InputText value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.ap.ewtCode")} col="col-12 md:col-4"><InputText value={form.ewtCode ?? supplier?.ewtCode ?? ""} onChange={(e) => setForm({ ...form, ewtCode: e.target.value })} className="w-full" /></Field>
            </div>
            {supplier && <p className="pe-muted mt-0">{supplier.vatRegistered === false ? t("opsAcc.ap.notVat") : t("opsAcc.ap.vatRegistered")} · {t("opsAcc.ap.terms", { days: supplier.paymentTermsDays ?? "-" })}</p>}
            <DataTable value={form.lines.map((l, i) => ({ ...l, i }))} dataKey="i" size="small">
              <Column header={t("opsAcc.description")} body={(r) => <InputText value={r.description} onChange={(e) => setLine(r.i, { description: e.target.value })} className="w-full" />} />
              <Column header={t("opsAcc.ap.account")} body={(r) => <InputText value={r.accountCode} disabled={!!r.assetClass} onChange={(e) => setLine(r.i, { accountCode: e.target.value })} className="w-8rem" />} />
              <Column header={t("opsAcc.ap.assetClass")} body={(r) => <Dropdown value={r.assetClass} options={classes.map((c) => ({ label: c.name, value: c.code }))} showClear placeholder="-" onChange={(e) => setLine(r.i, { assetClass: e.value })} className="w-10rem" />} />
              <Column header={t("opsAcc.ap.vatable")} body={(r) => <Checkbox checked={r.vatable} onChange={(e) => setLine(r.i, { vatable: e.checked })} />} />
              <Column header={t("opsAcc.amount")} body={(r) => <InputNumber value={r.amount} mode="decimal" minFractionDigits={2} onValueChange={(e) => setLine(r.i, { amount: e.value })} />} />
              <Column body={(r) => <Button icon="pi pi-trash" text size="small" aria-label={t("opsAcc.remove")} disabled={form.lines.length < 2} onClick={() => setForm({ ...form, lines: form.lines.filter((_, k) => k !== r.i) })} />} />
            </DataTable>
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
