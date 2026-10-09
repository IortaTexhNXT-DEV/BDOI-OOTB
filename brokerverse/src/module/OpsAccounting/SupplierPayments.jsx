import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { promptText } from "../../utility/dialogs";
import { Field, OpsTag, PageHeader, date, isoOf, money, numericColumn, showError, showSuccess, useFieldErrors } from "./common";

/** Accounts > Payables > Supplier Payments: pay approved invoices of a supplier from a bank account (posting rule ap.payment). */
export const SupplierPayments = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(null); // { supplierId, invoices, selected, paymentMode, payFromAccount, chequeNumber, paymentDate, reference }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await service.supplierPayments({ search: search || undefined }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    service.masterRecords("supplier", { status: "Active" }).then((r) => setSuppliers(r.rows)).catch(() => {});
    service.bankAccounts().then(setAccounts).catch(() => {});
  }, []);

  const pickSupplier = async (code) => {
    try {
      const invoices = await service.supplierInvoices({ status: "open", supplierId: code });
      setForm((f) => ({ ...f, supplierId: code, invoices, selected: invoices }));
    } catch (e) {
      showError(toast, e);
    }
  };
  const { errors, check, fromApi, clear } = useFieldErrors();
  const openForm = (value) => { clear(); setForm(value); };
  const pay = async () => {
    if (!check({
      supplierId: form.supplierId ? null : t("opsAcc.required"),
      payFromAccount: form.payFromAccount ? null : t("opsAcc.ap.chooseAccount"),
    })) return;
    try {
      const r = await service.createSupplierPayment({ supplierId: form.supplierId, paymentMode: form.paymentMode, payFromAccount: form.payFromAccount, chequeNumber: form.chequeNumber || null,
        paymentDate: isoOf(form.paymentDate), reference: form.reference || null, allocations: form.selected.map((i) => ({ invoiceId: i.id })) });
      showSuccess(toast, t("opsAcc.ap.paid", { number: r.paymentNumber }));
      openForm(null);
      load();
    } catch (e) {
      fromApi(e);
      showError(toast, e);
    }
  };
  const cancel = async (p) => {
    const reason = await promptText(t("opsAcc.ap.cancelPaymentReason"));
    if (!reason) return;
    try {
      await service.cancelSupplierPayment(p.id, reason);
      showSuccess(toast, t("opsAcc.ap.paymentCancelled"));
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const total = (form?.selected || []).reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.ap.payments")} section={t("opsAcc.ap.menu")} subtitle={t("opsAcc.ap.paymentsIntro")}>
        <Button icon="pi pi-plus" label={t("opsAcc.ap.newPayment")} onClick={() => openForm({ supplierId: null, invoices: [], selected: [], paymentMode: "check", payFromAccount: accounts.length === 1 ? accounts[0].value : null, chequeNumber: "", paymentDate: new Date(), reference: "" })} />
      </PageHeader>
      <div className="pe-card">
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.ap.searchHint")} className="w-20rem mb-2" />
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} emptyMessage={t("opsAcc.none")}>
          <Column field="paymentNumber" header={t("opsAcc.ap.paymentNumber")} />
          <Column field="supplierName" header={t("opsAcc.ap.supplier")} />
          <Column header={t("opsAcc.date")} body={(r) => date(r.paymentDate)} />
          <Column header={t("opsAcc.paymentMode")} body={(r) => t(`opsAcc.modes.${r.paymentMode}`)} />
          <Column field="chequeNumber" header={t("opsAcc.ap.cheque")} />
          <Column field="journalNumber" header={t("opsAcc.journal")} />
          <Column header={t("opsAcc.amount")} body={(r) => money(r.amount)} {...numericColumn} />
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.status} />} />
          <Column body={(r) => (
            <span className="flex gap-1">
              <Button icon="pi pi-print" text size="small" aria-label={t("opsAcc.print")} tooltip={t("opsAcc.print")} onClick={() => service.printSupplierPayment(r.id).catch((e) => showError(toast, e))} />
              {r.status === "posted" && <Button icon="pi pi-times" text size="small" severity="danger" aria-label={t("opsAcc.cancel")} tooltip={t("opsAcc.cancel")} onClick={() => cancel(r)} />}
            </span>
          )} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={t("opsAcc.ap.newPayment")} visible={!!form} style={{ width: "min(900px, 96vw)" }} onHide={() => openForm(null)}
        footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => openForm(null)} /><Button label={t("opsAcc.ap.pay", { amount: money(total) })} icon="pi pi-check" disabled={!form?.selected.length} onClick={pay} /></div>}>
        {form && (
          <>
            <div className="grid">
              <Field label={t("opsAcc.ap.supplier")} col="col-12 md:col-6" required error={errors.supplierId}>
                <Dropdown value={form.supplierId} options={suppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.code }))} filter onChange={(e) => pickSupplier(e.value)} className="w-full" />
              </Field>
              <Field label={t("opsAcc.date")} col="col-12 md:col-3"><Calendar value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.value })} showIcon className="w-full" /></Field>
              <Field label={t("opsAcc.paymentMode")} col="col-12 md:col-3">
                <Dropdown value={form.paymentMode} options={["check", "bank-transfer", "cash"].map((m) => ({ label: t(`opsAcc.modes.${m}`), value: m }))} onChange={(e) => setForm({ ...form, paymentMode: e.value })} className="w-full" />
              </Field>
              <Field label={t("opsAcc.bankAccount")} col="col-12 md:col-6" required error={errors.payFromAccount}><Dropdown value={form.payFromAccount} options={accounts} optionLabel="label" optionValue="value" onChange={(e) => setForm({ ...form, payFromAccount: e.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.ap.cheque")} col="col-12 md:col-3"><InputText value={form.chequeNumber} maxLength={40} onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })} className="w-full" /></Field>
              <Field label={t("opsAcc.reference")} col="col-12 md:col-3"><InputText value={form.reference} maxLength={100} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="w-full" /></Field>
            </div>
            <DataTable value={form.invoices} dataKey="id" size="small" selectionMode="checkbox" selection={form.selected} onSelectionChange={(e) => setForm({ ...form, selected: e.value })} emptyMessage={t("opsAcc.ap.noOpen")}>
              <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
              <Column field="voucherNumber" header={t("opsAcc.ap.voucher")} />
              <Column field="supplierInvoiceNo" header={t("opsAcc.ap.supplierInvoice")} />
              <Column header={t("opsAcc.ap.dueDate")} body={(r) => date(r.dueDate)} />
              <Column header={t("opsAcc.ap.balance")} body={(r) => money(r.balance)} {...numericColumn} />
            </DataTable>
          </>
        )}
      </Dialog>
    </div>
  );
};

/** Accounts > Payables > AP Ageing: open supplier invoices aged on their due dates, by supplier and invoice. */
export const ApAgeing = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [asOf, setAsOf] = useState(new Date());
  const [data, setData] = useState(null);
  useEffect(() => { service.apAgeing({ asOf: isoOf(asOf) }).then(setData).catch((e) => showError(toast, e)); }, [asOf]);
  const days = data?.bucketDays || [30, 60, 90];
  const labels = { current: t("opsAcc.ap.notDue"), b1: `1-${days[0]}`, b2: `${days[0] + 1}-${days[1]}`, b3: `${days[1] + 1}-${days[2]}`, b4: t("opsAcc.ap.over", { days: days[2] }) };
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("opsAcc.ap.ageing")} section={t("opsAcc.ap.menu")} subtitle={t("opsAcc.ap.ageingIntro")}>
        <Calendar value={asOf} onChange={(e) => e.value && setAsOf(e.value)} showIcon />
        <Button icon="pi pi-download" label={t("opsAcc.export")} outlined onClick={() => service.downloadApAgeing({ asOf: isoOf(asOf) }).catch((e) => showError(toast, e))} />
      </PageHeader>
      <div className="pe-card mb-3">
        <DataTable value={data?.suppliers || []} dataKey="supplierId" size="small" stripedRows emptyMessage={t("opsAcc.none")}
          footer={data ? `${t("opsAcc.total")}: ${money(data.summary.total)}` : null}>
          <Column field="supplierName" header={t("opsAcc.ap.supplier")} />
          {["current", "b1", "b2", "b3", "b4"].map((k) => <Column key={k} header={labels[k]} body={(r) => money(r[k])} {...numericColumn} />)}
          <Column header={t("opsAcc.total")} body={(r) => money(r.total)} {...numericColumn} />
        </DataTable>
      </div>
      <div className="pe-card">
        <DataTable value={data?.rows || []} dataKey="invoiceId" size="small" stripedRows paginator rows={25} emptyMessage={t("opsAcc.none")}>
          <Column field="supplierName" header={t("opsAcc.ap.supplier")} />
          <Column field="voucherNumber" header={t("opsAcc.ap.voucher")} />
          <Column field="supplierInvoiceNo" header={t("opsAcc.ap.supplierInvoice")} />
          <Column header={t("opsAcc.ap.dueDate")} body={(r) => date(r.dueDate)} />
          <Column field="daysPastDue" header={t("opsAcc.ap.daysPastDue")} {...numericColumn} />
          <Column header={t("opsAcc.ap.balance")} body={(r) => money(r.balance)} {...numericColumn} />
          <Column header={t("opsAcc.ap.bucket")} body={(r) => labels[r.bucket]} />
        </DataTable>
      </div>
    </div>
  );
};
