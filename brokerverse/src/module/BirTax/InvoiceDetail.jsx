import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import DateField from "../../components/DateField";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import birTaxService from "../../services/birTaxService";
import { toIsoDate } from "../../utility/dateFormat";
import { BirTag, date, money, showError, showSuccess } from "./common";
import { dateTime } from "../PeriodEnd/common";
import "./tax.scss";
import { useFeature } from "../../features/Feature";

export const PAYMENT_MODES = ["bank-transfer", "check", "cash", "online"];

/** Record a payment on a manual invoice: the payment acknowledgement (supplementary document). */
const PaymentDialog = ({ invoice, onHide, onSaved, toast }) => {
  const { t } = useTranslation();
  const [pay, setPay] = useState({ paymentDate: toIsoDate(new Date()), amount: invoice.balance - invoice.withholdingTax, ewtAmount: invoice.withholdingTax, paymentMode: "bank-transfer",
    form2307No: "", referenceNo: "" });
  const [busy, setBusy] = useState(false);
  const set = (p) => setPay((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await birTaxService.recordPayment(invoice.id, { paymentDate: pay.paymentDate || undefined, amount: Number(pay.amount || 0), ewtAmount: Number(pay.ewtAmount || 0),
        form2307No: pay.form2307No || undefined, paymentMode: pay.paymentMode || undefined, referenceNo: pay.referenceNo || undefined });
      showSuccess(toast, t("birTax.paymentSaved"));
      onSaved();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog className="pe-dialog bv-centered tax-dialog" visible header={`${t("birTax.recordPayment")} · ${invoice.invoiceNumber}`} style={{ width: "min(640px, 95vw)" }} onHide={() => !busy && onHide()}
      footer={(
        <div>
          <Button label={t("periodEnd.cancel")} text disabled={busy} onClick={onHide} />
          <Button label={t("birTax.recordPayment")} icon="pi pi-check" loading={busy} disabled={!pay.paymentDate || Number(pay.amount || 0) + Number(pay.ewtAmount || 0) <= 0} onClick={save} />
        </div>
      )}>
      <KeyValueGrid columns={3} items={[
        { label: t("birTax.buyerName"), value: invoice.buyerName },
        { label: t("birTax.totalAmount"), value: invoice.totalAmount, type: "amount" },
        { label: t("birTax.balance"), value: invoice.balance, type: "amount" },
      ]} />
      <div className="grid mt-2">
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-date">{t("birTax.paymentDate")}</label>
          <DateField id="pay-date" value={pay.paymentDate} onChange={(e) => set({ paymentDate: e.target.value })} /></div>
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-mode">{t("birTax.paymentMode")}</label>
          <Dropdown inputId="pay-mode" value={pay.paymentMode} options={PAYMENT_MODES.map((x) => ({ label: t(`birTax.paymentModes.${x}`), value: x }))} onChange={(e) => set({ paymentMode: e.value })} className="w-full" /></div>
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-amount">{t("birTax.amountReceived")}</label>
          <InputNumber inputId="pay-amount" value={pay.amount} onValueChange={(e) => set({ amount: e.value })} min={0} minFractionDigits={2} maxFractionDigits={2} className="w-full" /></div>
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-ewt">{t("birTax.ewt")}</label>
          <InputNumber inputId="pay-ewt" value={pay.ewtAmount} onValueChange={(e) => set({ ewtAmount: e.value })} min={0} minFractionDigits={2} maxFractionDigits={2} className="w-full" /></div>
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-2307">{t("birTax.form2307No")}</label>
          <InputText id="pay-2307" value={pay.form2307No} onChange={(e) => set({ form2307No: e.target.value })} className="w-full" /></div>
        <div className="col-12 md:col-6 tax-field"><label htmlFor="pay-ref">{t("birTax.reference")}</label>
          <InputText id="pay-ref" value={pay.referenceNo} onChange={(e) => set({ referenceNo: e.target.value })} className="w-full" /></div>
      </div>
    </Dialog>
  );
};

/** Cancel an invoice or one of its payment acknowledgements, with a reason of the Reason Codes master. */
const CancelDialog = ({ invoice, payment, onHide, onDone, toast }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = payment ? t("birTax.cancelPayment") : t("birTax.cancelInvoice");
  const confirm = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    setBusy(true);
    try {
      if (payment) await birTaxService.cancelPayment(payment.id, reasonPayload(reason));
      else await birTaxService.cancelInvoice(invoice.id, reasonPayload(reason));
      showSuccess(toast, t("birTax.cancelled"));
      onDone();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };
  const facts = payment
    ? [{ label: t("birTax.ackNumber"), value: payment.ackNumber }, { label: t("birTax.paymentDate"), value: payment.paymentDate, type: "date" },
      { label: t("birTax.amountReceived"), value: payment.amount, type: "amount" }]
    : [{ label: t("birTax.invoiceNumber"), value: invoice.invoiceNumber }, { label: t("birTax.buyerName"), value: invoice.buyerName },
      { label: t("birTax.totalAmount"), value: invoice.totalAmount, type: "amount" }];
  return (
    <Dialog className="pe-dialog bv-centered tax-dialog" visible header={label} style={{ width: "min(560px, 95vw)" }} onHide={() => !busy && onHide()}
      footer={(
        <div>
          <Button label={t("periodEnd.cancel")} text disabled={busy} onClick={onHide} />
          <Button label={label} severity="danger" loading={busy} onClick={confirm} />
        </div>
      )}>
      <KeyValueGrid columns={3} items={facts} />
      <p className="pe-muted">{payment ? t("birTax.cancelPaymentNote") : t("birTax.cancelInvoiceNote")}</p>
      <ReasonPicker context={payment ? "invoice_payment_cancel" : "sales_invoice_cancel"} value={reason} onChange={setReason} showErrors={tried} autoFocus />
    </Dialog>
  );
};

/**
 * A sales invoice: number, status and buyer at the top, the parties and references, the lines, the amounts, the
 * payment acknowledgements; Print, Record payment (manual invoice with a balance) and Cancel invoice.
 */
const InvoiceDetail = ({ invoice, onHide, onChanged, toast, canWrite }) => {
  const { t } = useTranslation();
  const eis = useFeature("bir-eis");
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const s = invoice.seller || {};
  const print = (fn) => fn().catch((e) => showError(toast, e));
  const issued = invoice.status === "issued";
  const changed = () => { setPaying(false); setCancelling(null); onChanged(); };

  return (
    <DetailDialog visible onHide={onHide} size="lg" className="tax-dialog" header={`${t("birTax.salesInvoice")} ${invoice.invoiceNumber}`}
      footer={(
        <>
          <Button label={t("detailView.close")} text onClick={onHide} />
          <Button icon="pi pi-print" outlined label={t("birTax.print")} onClick={() => print(() => birTaxService.invoicePdf(invoice.id))} />
          {canWrite && issued && invoice.sourceType === "manual" && invoice.balance > 0 && (
            <Button icon="pi pi-wallet" outlined label={t("birTax.recordPayment")} onClick={() => setPaying(true)} />
          )}
          {canWrite && issued && <Button icon="pi pi-ban" severity="danger" outlined label={t("birTax.cancelInvoice")} onClick={() => setCancelling({})} />}
        </>
      )}>
      <DetailHeader title={invoice.invoiceNumber} subtitle={invoice.buyerName}
        status={{ code: invoice.status, label: t(`birTax.status.${invoice.status}`), severity: issued ? "success" : "secondary" }}
        meta={[
          { label: t("birTax.invoiceDate"), value: invoice.invoiceDate, type: "date" },
          { label: t("birTax.totalAmount"), value: invoice.totalAmount, type: "amount" },
          { label: t("birTax.balance"), value: invoice.balance, type: "amount" },
          { label: t("birTax.eisStatus"), value: invoice.eisStatus ? <BirTag status={invoice.eisStatus} /> : null, hidden: !eis.visible },
        ]} />
      <DetailSection title={t("birTax.parties")}>
        <KeyValueGrid columns={3} items={[
          { label: t("birTax.seller"), value: s.registeredName },
          { label: t("birTax.sellerTin"), value: s.tinFormatted },
          { label: t("birTax.vatStatus"), value: s.vatRegistered ? t("birTax.vatReg") : t("birTax.nonVatReg") },
          { label: t("birTax.soldTo"), value: invoice.buyerName },
          { label: t("birTax.buyerTin"), value: invoice.buyerTin },
          { label: t("birTax.buyerAddress"), value: invoice.buyerAddress },
          { label: t("birTax.invoiceFor"), value: t(`birTax.source.${invoice.sourceType}`, { defaultValue: invoice.sourceType }) },
          { label: t("birTax.reference"), value: invoice.sourceReference },
          { label: t("birTax.printCount"), value: invoice.printCount, type: "number", decimals: 0 },
          { label: t("periodEnd.remarks"), value: invoice.remarks, span: "full", hidden: !invoice.remarks },
        ]} />
      </DetailSection>
      {invoice.status === "cancelled" && (
        <DetailSection title={t("birTax.cancellation")}>
          <KeyValueGrid columns={3} items={[
            { label: t("birTax.reason"), value: invoice.cancelReason, span: 2 },
            { label: t("birTax.cancelledAt"), value: dateTime(invoice.cancelledAt) },
          ]} />
        </DetailSection>
      )}
      <DetailSection title={t("birTax.lines")} flush>
        <DataTable value={invoice.lines} size="small" dataKey="lineNo">
          <Column field="description" header={t("birTax.description")} />
          <Column field="quantity" header={t("birTax.quantity")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.unitPrice")} body={(l) => money(l.unitPrice)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.vatClass")} body={(l) => t(`birTax.vat.${l.vatClass}`)} />
          <Column header={t("birTax.amount")} body={(l) => money(l.amount)} className="bv-num" headerClassName="bv-num" />
        </DataTable>
      </DetailSection>
      <DetailSection title={t("birTax.amounts")}>
        <KeyValueGrid columns={4} items={[
          { label: t("birTax.vat.vatable"), value: invoice.vatableSales, type: "amount" },
          { label: t("birTax.vat.exempt"), value: invoice.vatExemptSales, type: "amount" },
          { label: t("birTax.vat.zero_rated"), value: invoice.zeroRatedSales, type: "amount" },
          { label: t("birTax.vatAmount"), value: invoice.vatAmount, type: "amount" },
          { label: t("birTax.totalAmount"), value: invoice.totalAmount, type: "amount" },
          { label: t("birTax.expectedEwtAmount"), value: invoice.withholdingTax, type: "amount" },
          { label: t("birTax.amountPaid"), value: invoice.amountPaid, type: "amount" },
          { label: t("birTax.balance"), value: invoice.balance, type: "amount" },
        ]} />
      </DetailSection>
      <DetailSection title={t("birTax.payments")} flush>
        <DataTable value={invoice.payments} size="small" dataKey="id" emptyMessage={t("birTax.noPayments")}>
          <Column field="ackNumber" header={t("birTax.ackNumber")} />
          <Column header={t("birTax.paymentDate")} body={(p) => date(p.paymentDate)} />
          <Column header={t("birTax.amountReceived")} body={(p) => money(p.amount)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.ewt")} body={(p) => money(p.ewtAmount)} className="bv-num" headerClassName="bv-num" />
          <Column field="form2307No" header={t("birTax.form2307No")} />
          <Column header={t("birTax.statusLabel")} body={(p) => <BirTag status={p.status} />} />
          <Column style={{ width: "6rem" }} body={(p) => (
            <span className="flex gap-1 justify-content-end">
              <Button icon="pi pi-print" text size="small" aria-label={t("birTax.print")} tooltip={t("birTax.print")} onClick={() => print(() => birTaxService.paymentPdf(p.id))} />
              {canWrite && p.status === "posted" && (
                <Button icon="pi pi-ban" text size="small" severity="danger" aria-label={t("birTax.cancelPayment")} tooltip={t("birTax.cancelPayment")} onClick={() => setCancelling({ payment: p })} />
              )}
            </span>
          )} />
        </DataTable>
      </DetailSection>
      {paying && <PaymentDialog invoice={invoice} toast={toast} onHide={() => setPaying(false)} onSaved={changed} />}
      {cancelling && <CancelDialog invoice={invoice} payment={cancelling.payment} toast={toast} onHide={() => setCancelling(null)} onDone={changed} />}
    </DetailDialog>
  );
};

export default InvoiceDetail;
