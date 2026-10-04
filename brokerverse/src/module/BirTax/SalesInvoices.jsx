import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { BirTag, Kpis, PageHeader, date, money, showError, showSuccess } from "./common";

const SOURCES = ["manual", "debit_note", "override_commission", "policy_commission"];
const VAT_CLASSES = ["vatable", "exempt", "zero_rated"];
const EMPTY_LINE = { description: "", quantity: 1, unitPrice: 0, vatClass: "vatable" };
const EMPTY = { sourceType: "manual", sourceId: null, policyNumber: "", invoiceDate: new Date(), buyerType: "client", buyerName: "", buyerTin: "", buyerAddress: "", buyerBusinessStyle: "",
  lines: [{ ...EMPTY_LINE }], ewtRate: 0, remarks: "" };

/** New invoice: for a debit note / overriding commission computation / broker-billed policy, or manual lines. */
const NewInvoice = ({ seller, onHide, onIssued, toast }) => {
  const { t } = useTranslation();
  const [v, setV] = useState({ ...EMPTY, lines: [{ ...EMPTY_LINE }] });
  const [candidates, setCandidates] = useState([]);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (!["debit_note", "override_commission"].includes(v.sourceType)) { setCandidates([]); return; }
    birTaxService.invoiceCandidates(v.sourceType).then(setCandidates).catch((e) => showError(toast, e));
  }, [v.sourceType, toast]);
  const setLine = (i, p) => set({ lines: v.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const manual = v.sourceType === "manual";
  const issue = async () => {
    const body = { sourceType: v.sourceType, invoiceDate: toIsoDate(v.invoiceDate), remarks: v.remarks || undefined };
    if (v.sourceType === "policy_commission") body.sourceId = v.policyNumber.trim();
    else if (!manual) body.sourceId = v.sourceId;
    if (manual) {
      body.buyer = { buyerType: v.buyerType, buyerName: v.buyerName, buyerTin: v.buyerTin || undefined, buyerAddress: v.buyerAddress || undefined, buyerBusinessStyle: v.buyerBusinessStyle || undefined };
      body.lines = v.lines.filter((l) => l.description).map((l) => ({ description: l.description, quantity: Number(l.quantity || 1), unitPrice: Number(l.unitPrice || 0), vatClass: l.vatClass }));
      body.ewtRate = Number(v.ewtRate || 0);
    }
    try {
      const inv = await birTaxService.issueInvoice(body);
      showSuccess(toast, `${inv.invoiceNumber} ${t("birTax.issuedMsg")}`);
      onIssued(inv);
    } catch (e) {
      showError(toast, e);
    }
  };
  const total = v.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  return (
    <Dialog className="pe-dialog" visible header={t("birTax.newInvoice")} style={{ width: "min(980px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("periodEnd.cancel")} text onClick={onHide} /><Button label={t("birTax.issueInvoice")} icon="pi pi-verified" onClick={issue}
        disabled={manual ? !v.buyerName || !v.lines.some((l) => l.description) : v.sourceType === "policy_commission" ? !v.policyNumber : !v.sourceId} /></div>}>
      {seller && !seller.tin && <Message severity="warn" className="w-full mb-2" text={t("birTax.sellerTinMissing")} />}
      {seller && !seller.atpNumber && !seller.casPermitNumber && <Message severity="warn" className="w-full mb-2" text={t("birTax.permitMissing")} />}
      <div className="grid">
        <div className="col-12 md:col-6"><label>{t("birTax.invoiceFor")}</label>
          <Dropdown value={v.sourceType} options={SOURCES.map((x) => ({ label: t(`birTax.source.${x}`), value: x }))} onChange={(e) => set({ sourceType: e.value, sourceId: null })} className="w-full" /></div>
        <div className="col-12 md:col-6"><label>{t("birTax.invoiceDate")}</label><Calendar value={v.invoiceDate} onChange={(e) => set({ invoiceDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
        {["debit_note", "override_commission"].includes(v.sourceType) && (
          <div className="col-12"><label>{t("birTax.document")} *</label>
            <Dropdown value={v.sourceId} options={candidates.map((c) => ({ label: `${c.reference} · ${c.buyer} · ${money(c.total)}`, value: c.id }))} onChange={(e) => set({ sourceId: e.value })}
              filter className="w-full" emptyMessage={t("birTax.noCandidates")} /></div>
        )}
        {v.sourceType === "policy_commission" && (
          <div className="col-12 md:col-6"><label>{t("birTax.policyNumber")} *</label><InputText value={v.policyNumber} onChange={(e) => set({ policyNumber: e.target.value })} className="w-full" /></div>
        )}
        {manual && (
          <>
            <div className="col-12 md:col-4"><label>{t("birTax.buyerType")}</label>
              <Dropdown value={v.buyerType} options={["client", "insurer", "other"].map((x) => ({ label: t(`birTax.buyer.${x}`), value: x }))} onChange={(e) => set({ buyerType: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("birTax.buyerName")} *</label><InputText value={v.buyerName} onChange={(e) => set({ buyerName: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-4"><label>{t("birTax.buyerTin")}</label><InputText value={v.buyerTin} placeholder="000-000-000-00000" onChange={(e) => set({ buyerTin: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-8"><label>{t("birTax.buyerBusinessStyle")}</label><InputText value={v.buyerBusinessStyle} onChange={(e) => set({ buyerBusinessStyle: e.target.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("birTax.buyerAddress")}</label><InputText value={v.buyerAddress} onChange={(e) => set({ buyerAddress: e.target.value })} className="w-full" /></div>
            <div className="col-12">
              <DataTable value={v.lines} size="small">
                <Column header={t("birTax.description")} body={(l, o) => <InputText value={l.description} onChange={(e) => setLine(o.rowIndex, { description: e.target.value })} className="w-full" />} />
                <Column header={t("birTax.quantity")} style={{ width: "7rem" }} body={(l, o) => <InputNumber value={l.quantity} onValueChange={(e) => setLine(o.rowIndex, { quantity: e.value })} inputStyle={{ width: "5rem" }} />} />
                <Column header={t("birTax.unitPrice")} style={{ width: "10rem" }} body={(l, o) => <InputNumber value={l.unitPrice} onValueChange={(e) => setLine(o.rowIndex, { unitPrice: e.value })} minFractionDigits={2} inputStyle={{ width: "8rem" }} />} />
                <Column header={t("birTax.vatClass")} style={{ width: "10rem" }} body={(l, o) => <Dropdown value={l.vatClass} options={VAT_CLASSES.map((x) => ({ label: t(`birTax.vat.${x}`), value: x }))} onChange={(e) => setLine(o.rowIndex, { vatClass: e.value })} />} />
                <Column style={{ width: "3rem" }} body={(l, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("birTax.removeLine")} onClick={() => set({ lines: v.lines.filter((_, j) => j !== o.rowIndex) })} disabled={v.lines.length === 1} />} />
              </DataTable>
              <div className="flex justify-content-between mt-2">
                <Button icon="pi pi-plus" text label={t("birTax.addLine")} onClick={() => set({ lines: [...v.lines, { ...EMPTY_LINE }] })} />
                <span>{t("birTax.salesNetOfVat")}: <strong>{money(total)}</strong></span>
              </div>
            </div>
            <div className="col-12 md:col-4"><label>{t("birTax.expectedEwt")}</label><InputNumber value={v.ewtRate} onValueChange={(e) => set({ ewtRate: e.value })} suffix="%" maxFractionDigits={2} className="w-full" /></div>
          </>
        )}
        <div className="col-12"><label>{t("periodEnd.remarks")}</label><InputTextarea value={v.remarks} rows={2} onChange={(e) => set({ remarks: e.target.value })} className="w-full" /></div>
      </div>
    </Dialog>
  );
};

/** Invoice detail: amounts, payments (payment acknowledgements), cancel. */
const InvoiceDetail = ({ invoice, onHide, onChanged, toast }) => {
  const { t } = useTranslation();
  const [pay, setPay] = useState(null);
  const [reason, setReason] = useState(null);
  const run = async (fn, msg) => { try { await fn(); if (msg) showSuccess(toast, msg); onChanged(); } catch (e) { showError(toast, e); } };
  const savePayment = () => run(async () => {
    await birTaxService.recordPayment(invoice.id, { paymentDate: toIsoDate(pay.paymentDate), amount: Number(pay.amount || 0), ewtAmount: Number(pay.ewtAmount || 0), form2307No: pay.form2307No || undefined,
      paymentMode: pay.paymentMode || undefined, referenceNo: pay.referenceNo || undefined });
    setPay(null);
  }, t("birTax.paymentSaved"));
  const doCancel = () => run(async () => {
    if (reason.paymentId) await birTaxService.cancelPayment(reason.paymentId, reason.text);
    else await birTaxService.cancelInvoice(invoice.id, reason.text);
    setReason(null);
  }, t("birTax.cancelled"));
  const s = invoice.seller || {};
  return (
    <Dialog className="pe-dialog" visible header={`${t("birTax.salesInvoice")} ${invoice.invoiceNumber}`} style={{ width: "min(1000px, 96vw)" }} onHide={onHide}
      footer={(
        <div>
          <Button icon="pi pi-print" outlined label={t("birTax.print")} onClick={() => run(() => birTaxService.invoicePdf(invoice.id))} />
          {invoice.status === "issued" && invoice.sourceType === "manual" && invoice.balance > 0 && (
            <Button icon="pi pi-wallet" label={t("birTax.recordPayment")} onClick={() => setPay({ paymentDate: new Date(), amount: invoice.balance - invoice.withholdingTax, ewtAmount: invoice.withholdingTax, paymentMode: "bank-transfer" })} />
          )}
          {invoice.status === "issued" && <Button icon="pi pi-ban" severity="danger" outlined label={t("birTax.cancelInvoice")} onClick={() => setReason({ text: "" })} />}
        </div>
      )}>
      <div className="grid">
        <div className="col-12 md:col-6"><span className="pe-muted">{t("birTax.seller")}: </span><strong>{s.registeredName}</strong><br />{s.tinFormatted} · {s.address}<br />
          {s.vatRegistered ? t("birTax.vatReg") : t("birTax.nonVatReg")}</div>
        <div className="col-12 md:col-6"><span className="pe-muted">{t("birTax.soldTo")}: </span><strong>{invoice.buyerName}</strong><br />{invoice.buyerTin || "-"} · {invoice.buyerAddress || "-"}</div>
        <div className="col-12 md:col-3"><span className="pe-muted">{t("birTax.invoiceDate")}: </span>{date(invoice.invoiceDate)}</div>
        <div className="col-12 md:col-3"><span className="pe-muted">{t("birTax.reference")}: </span>{invoice.sourceReference || "-"}</div>
        <div className="col-12 md:col-3"><span className="pe-muted">{t("birTax.statusLabel")}: </span><BirTag status={invoice.status} /></div>
        <div className="col-12 md:col-3"><span className="pe-muted">EIS: </span>{invoice.eisStatus ? <BirTag status={invoice.eisStatus} /> : "-"}</div>
      </div>
      {invoice.cancelReason && <Message severity="warn" className="w-full mb-2" text={`${t("birTax.cancelled")}: ${invoice.cancelReason}`} />}
      <DataTable value={invoice.lines} size="small" dataKey="lineNo">
        <Column field="description" header={t("birTax.description")} />
        <Column field="quantity" header={t("birTax.quantity")} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.unitPrice")} body={(l) => money(l.unitPrice)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.vatClass")} body={(l) => t(`birTax.vat.${l.vatClass}`)} />
        <Column header={t("birTax.amount")} body={(l) => money(l.amount)} className="bv-num" headerClassName="bv-num" />
      </DataTable>
      <Kpis items={[{ label: t("birTax.vat.vatable"), value: money(invoice.vatableSales) }, { label: t("birTax.vat.exempt"), value: money(invoice.vatExemptSales) },
        { label: t("birTax.vat.zero_rated"), value: money(invoice.zeroRatedSales) }, { label: "VAT", value: money(invoice.vatAmount) }, { label: t("birTax.totalAmount"), value: money(invoice.totalAmount) },
        { label: t("birTax.balance"), value: money(invoice.balance) }]} />
      <h4>{t("birTax.payments")}</h4>
      <DataTable value={invoice.payments} size="small" dataKey="id" emptyMessage={t("birTax.noPayments")}>
        <Column field="ackNumber" header={t("birTax.ackNumber")} />
        <Column header={t("birTax.paymentDate")} body={(p) => date(p.paymentDate)} />
        <Column header={t("birTax.amountReceived")} body={(p) => money(p.amount)} className="bv-num" headerClassName="bv-num" />
        <Column header={t("birTax.ewt")} body={(p) => money(p.ewtAmount)} className="bv-num" headerClassName="bv-num" />
        <Column field="form2307No" header={t("birTax.form2307No")} />
        <Column header={t("birTax.statusLabel")} body={(p) => <BirTag status={p.status} />} />
        <Column body={(p) => (
          <span className="flex gap-1">
            <Button icon="pi pi-print" text size="small" aria-label={t("birTax.print")} onClick={() => run(() => birTaxService.paymentPdf(p.id))} />
            {p.status === "posted" && <Button icon="pi pi-ban" text size="small" severity="danger" aria-label={t("birTax.cancelPayment")} onClick={() => setReason({ text: "", paymentId: p.id })} />}
          </span>
        )} />
      </DataTable>
      {pay && (
        <Dialog className="pe-dialog" visible header={t("birTax.recordPayment")} style={{ width: "min(640px, 95vw)" }} onHide={() => setPay(null)}
          footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setPay(null)} /><Button label={t("periodEnd.save")} icon="pi pi-save" onClick={savePayment} /></div>}>
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("birTax.paymentDate")}</label><Calendar value={pay.paymentDate} onChange={(e) => setPay({ ...pay, paymentDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.paymentMode")}</label><InputText value={pay.paymentMode} onChange={(e) => setPay({ ...pay, paymentMode: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.amountReceived")}</label><InputNumber value={pay.amount} onValueChange={(e) => setPay({ ...pay, amount: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.ewt")}</label><InputNumber value={pay.ewtAmount} onValueChange={(e) => setPay({ ...pay, ewtAmount: e.value })} minFractionDigits={2} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.form2307No")}</label><InputText value={pay.form2307No || ""} onChange={(e) => setPay({ ...pay, form2307No: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-6"><label>{t("birTax.reference")}</label><InputText value={pay.referenceNo || ""} onChange={(e) => setPay({ ...pay, referenceNo: e.target.value })} className="w-full" /></div>
          </div>
        </Dialog>
      )}
      {reason && (
        <Dialog className="pe-dialog" visible header={reason.paymentId ? t("birTax.cancelPayment") : t("birTax.cancelInvoice")} style={{ width: "min(520px, 95vw)" }} onHide={() => setReason(null)}
          footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setReason(null)} /><Button label={t("birTax.confirm")} severity="danger" onClick={doCancel} disabled={reason.text.trim().length < 3} /></div>}>
          <label>{t("birTax.reason")} *</label>
          <InputTextarea value={reason.text} rows={3} onChange={(e) => setReason({ ...reason, text: e.target.value })} className="w-full" />
          <p className="pe-muted">{t("birTax.cancelInvoiceNote")}</p>
        </Dialog>
      )}
    </Dialog>
  );
};

/**
 * Accounts > Tax > Sales Invoices: the broker's sales invoices under the EOPT Act (commission debit notes, overriding
 * commission, broker-billed commission, manual service invoices), with the BIR-required fields, sequential numbers,
 * cancellation with a reason and payment acknowledgements.
 */
const SalesInvoices = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: null, sourceType: null });
  const [seller, setSeller] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await birTaxService.invoices({ search: filters.search.trim(), status: filters.status, sourceType: filters.sourceType }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);
  useEffect(() => { birTaxService.seller().then(setSeller).catch(() => {}); }, []);
  const openDetail = async (id) => { try { setDetail(await birTaxService.invoice(id)); } catch (e) { showError(toast, e); } };

  const issued = rows.filter((r) => r.status === "issued");
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.salesInvoices")} trail={[t("birTax.salesInvoices")]} subtitle={t("birTax.salesInvoicesHelp")}>
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder={t("birTax.searchInvoice")} /></span>
        <Dropdown value={filters.sourceType} options={SOURCES.map((x) => ({ label: t(`birTax.source.${x}`), value: x }))} onChange={(e) => setFilters({ ...filters, sourceType: e.value })} placeholder={t("birTax.allSources")} showClear />
        <Dropdown value={filters.status} options={["issued", "cancelled"].map((x) => ({ label: t(`birTax.status.${x}`), value: x }))} onChange={(e) => setFilters({ ...filters, status: e.value })} placeholder={t("birTax.allStatuses")} showClear />
        <Button icon="pi pi-plus" label={t("birTax.newInvoice")} onClick={() => setCreating(true)} />
      </PageHeader>
      {seller && (
        <Message severity="info" className="w-full mb-2" text={`${seller.registeredName} · TIN ${seller.tinFormatted || "-"} · ${seller.vatRegistered ? t("birTax.vatReg") : t("birTax.nonVatReg")} · ATP / CAS ${seller.atpNumber || seller.casPermitNumber || t("birTax.notSet")} · ${t("birTax.serialRange")} ${seller.serialFrom} to ${seller.serialTo}`} />
      )}
      <Kpis items={[{ label: t("birTax.invoicesIssued"), value: issued.length }, { label: t("birTax.totalAmount"), value: money(issued.reduce((s, r) => s + r.totalAmount, 0)) },
        { label: "VAT", value: money(issued.reduce((s, r) => s + r.vatAmount, 0)) }, { label: t("birTax.balance"), value: money(issued.reduce((s, r) => s + r.balance, 0)) }]} />
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("birTax.noRows")}>
          <Column field="invoiceNumber" header={t("birTax.invoiceNumber")} sortable body={(r) => <button type="button" className="pe-link" onClick={() => openDetail(r.id)}>{r.invoiceNumber}</button>} />
          <Column header={t("birTax.invoiceDate")} body={(r) => date(r.invoiceDate)} sortable sortField="invoiceDate" />
          <Column field="buyerName" header={t("birTax.buyerName")} />
          <Column header={t("birTax.invoiceFor")} body={(r) => t(`birTax.source.${r.sourceType}`)} />
          <Column field="sourceReference" header={t("birTax.reference")} />
          <Column header={t("birTax.totalSales")} body={(r) => money(r.totalSales)} className="bv-num" headerClassName="bv-num" />
          <Column header="VAT" body={(r) => money(r.vatAmount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.totalAmount")} body={(r) => money(r.totalAmount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column header="EIS" body={(r) => (r.eisStatus ? <BirTag status={r.eisStatus} /> : "")} />
          <Column body={(r) => <Button icon="pi pi-print" text size="small" aria-label={t("birTax.print")} onClick={() => birTaxService.invoicePdf(r.id).catch((e) => showError(toast, e))} />} />
        </DataTable>
      </div>
      {creating && <NewInvoice seller={seller} toast={toast} onHide={() => setCreating(false)} onIssued={(inv) => { setCreating(false); load(); openDetail(inv.id); }} />}
      {detail && <InvoiceDetail invoice={detail} toast={toast} onHide={() => setDetail(null)} onChanged={() => { load(); openDetail(detail.id); }} />}
    </div>
  );
};

export default SalesInvoices;
