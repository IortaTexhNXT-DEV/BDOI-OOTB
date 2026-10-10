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
import ConfigStatus from "../../components/ConfigStatus";
import DateField from "../../components/DateField";
import LoadingBar from "../../components/LoadingBar";
import useStableLoad from "../../hooks/useStableLoad";
import birTaxService from "../../services/birTaxService";
import { hasPermission } from "../../utils/canOpen";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { BirTag, PageHeader, date, money, showError, showSuccess } from "./common";
import InvoiceDetail from "./InvoiceDetail";
import "./tax.scss";

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
  const [linesError, setLinesError] = useState(null);
  const set = (p) => setV((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (!["debit_note", "override_commission"].includes(v.sourceType)) { setCandidates([]); return; }
    birTaxService.invoiceCandidates(v.sourceType).then(setCandidates).catch((e) => showError(toast, e));
  }, [v.sourceType, toast]);
  const setLine = (i, p) => set({ lines: v.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const manual = v.sourceType === "manual";
  const issue = async () => {
    // a described line needs its price: an amount of zero is refused by the invoice register
    const priced = !manual || v.lines.filter((l) => l.description).every((l) => Number(l.quantity || 0) > 0 && Number(l.unitPrice || 0) > 0);
    setLinesError(priced ? null : t("birTax.linePriceRequired"));
    if (!priced) return;
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
                <Column header={t("birTax.quantity")} style={{ width: "7rem" }} body={(l, o) => <InputNumber value={l.quantity} min={0} onValueChange={(e) => setLine(o.rowIndex, { quantity: e.value })} inputStyle={{ width: "5rem" }} />} />
                <Column header={t("birTax.unitPrice")} style={{ width: "10rem" }} body={(l, o) => <InputNumber value={l.unitPrice} min={0} onValueChange={(e) => setLine(o.rowIndex, { unitPrice: e.value })} minFractionDigits={2} inputStyle={{ width: "8rem" }} />} />
                <Column header={t("birTax.vatClass")} style={{ width: "10rem" }} body={(l, o) => <Dropdown value={l.vatClass} options={VAT_CLASSES.map((x) => ({ label: t(`birTax.vat.${x}`), value: x }))} onChange={(e) => setLine(o.rowIndex, { vatClass: e.value })} />} />
                <Column style={{ width: "3rem" }} body={(l, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("birTax.removeLine")} onClick={() => set({ lines: v.lines.filter((_, j) => j !== o.rowIndex) })} disabled={v.lines.length === 1} />} />
              </DataTable>
              {linesError ? <small className="p-error block mt-1" role="alert">{linesError}</small> : null}
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

/** Seller facts under the page header and the invoicing setup as a configuration chip. */
const SellerFacts = ({ seller }) => {
  const { t } = useTranslation();
  const setup = seller.setup || { state: "ready", missing: [] };
  const facts = [
    { key: "name", label: t("birTax.seller"), value: seller.registeredName || "-" },
    { key: "tin", label: t("birTax.tin"), value: seller.tinFormatted || "-" },
    { key: "vat", label: t("birTax.vatStatus"), value: seller.vatRegistered ? t("birTax.vatReg") : t("birTax.nonVatReg") },
    { key: "serial", label: t("birTax.serialRangeLabel"), value: t("birTax.serialFromTo", { from: seller.serialFrom, to: seller.serialTo }) },
  ];
  return (
    <div className="tax-facts">
      {facts.map((f) => <span key={f.key}><span className="tax-fact__label">{f.label}</span><span className="tax-fact__value">{f.value}</span></span>)}
      <ConfigStatus state={setup.state} feature={t("birTax.invoicingSetup")} missing={setup.missing.map((m) => t(`birTax.setupMissing.${m}`))} area="accounting" />
    </div>
  );
};

const STATUSES = ["issued", "cancelled"];
const EMPTY_FILTERS = { search: "", status: null, sourceType: null, from: "", to: "" };

/**
 * Accounts > Tax > Sales Invoices: the register of the broker's sales invoices (commission debit notes, overriding
 * commission, broker-billed commission, manual service invoices) with the seller facts and whether invoicing is set
 * up, filters, totals of the issued invoices, the invoice detail with its payment acknowledgements, and cancellation
 * with a coded reason.
 */
const SalesInvoices = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);
  const canWrite = hasPermission("write:period-end");
  const set = (p) => setFilters((f) => ({ ...f, ...p }));

  const list = useStableLoad(useCallback(() => birTaxService.invoices({ search: filters.search.trim(), status: filters.status, sourceType: filters.sourceType,
    from: filters.from, to: filters.to }), [filters]), { debounceMs: 300, initialData: [] });
  const sellerLoad = useStableLoad(useCallback(() => birTaxService.seller(), []));
  const seller = sellerLoad.data;
  const openDetail = async (id) => { try { setDetail(await birTaxService.invoice(id)); } catch (e) { showError(toast, e); } };

  const rows = list.data || [];
  const issued = rows.filter((r) => r.status === "issued");
  const total = (k) => money(issued.reduce((sum, r) => sum + Number(r[k] || 0), 0));
  return (
    <div className="pe-page tax-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.salesInvoices")} trail={[t("birTax.salesInvoices")]} subtitle={t("birTax.salesInvoicesHelp")}>
        {canWrite && <Button icon="pi pi-plus" label={t("birTax.newInvoice")} onClick={() => setCreating(true)} />}
      </PageHeader>
      {seller && <SellerFacts seller={seller} />}

      <div className="pe-card bv-loading-host">
        <LoadingBar active={list.refreshing} />
        <div className="tax-toolbar mb-3">
          <div className="tax-field tax-field--search">
            <label htmlFor="si-search">{t("birTax.search")}</label>
            <span className="p-input-icon-left w-full"><i className="pi pi-search" />
              <InputText id="si-search" value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder={t("birTax.searchInvoice")} className="w-full" /></span>
          </div>
          <div className="tax-field">
            <label htmlFor="si-source">{t("birTax.invoiceFor")}</label>
            <Dropdown inputId="si-source" value={filters.sourceType} options={SOURCES.map((x) => ({ label: t(`birTax.source.${x}`), value: x }))} onChange={(e) => set({ sourceType: e.value })}
              placeholder={t("birTax.all")} showClear />
          </div>
          <div className="tax-field">
            <label htmlFor="si-status">{t("birTax.statusLabel")}</label>
            <Dropdown inputId="si-status" value={filters.status} options={STATUSES.map((x) => ({ label: t(`birTax.status.${x}`), value: x }))} onChange={(e) => set({ status: e.value })}
              placeholder={t("birTax.all")} showClear />
          </div>
          <div className="tax-field tax-field--date">
            <label htmlFor="si-from">{t("birTax.from")}</label>
            <DateField id="si-from" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          </div>
          <div className="tax-field tax-field--date">
            <label htmlFor="si-to">{t("birTax.to")}</label>
            <DateField id="si-to" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </div>
        </div>
        <DataTable value={rows} loading={list.loading} dataKey="id" size="small" stripedRows paginator={rows.length > 20} rows={20} emptyMessage={t("birTax.noInvoices")}>
            <Column field="invoiceNumber" header={t("birTax.invoiceNumber")} sortable footer={t("birTax.totalIssued")}
              body={(r) => <button type="button" className="pe-link" onClick={() => openDetail(r.id)}>{r.invoiceNumber}</button>} />
            <Column header={t("birTax.invoiceDate")} body={(r) => date(r.invoiceDate)} sortable sortField="invoiceDate" />
            <Column field="buyerName" header={t("birTax.buyerName")} />
            <Column header={t("birTax.invoiceFor")} body={(r) => t(`birTax.source.${r.sourceType}`, { defaultValue: r.sourceType })} />
            <Column field="sourceReference" header={t("birTax.reference")} />
            <Column header={t("birTax.totalSales")} body={(r) => money(r.totalSales)} footer={total("totalSales")} className="bv-num" headerClassName="bv-num" footerClassName="bv-num" />
            <Column header={t("birTax.vatAmount")} body={(r) => money(r.vatAmount)} footer={total("vatAmount")} className="bv-num" headerClassName="bv-num" footerClassName="bv-num" />
            <Column header={t("birTax.totalAmount")} body={(r) => money(r.totalAmount)} footer={total("totalAmount")} className="bv-num" headerClassName="bv-num" footerClassName="bv-num" />
            <Column header={t("birTax.balance")} body={(r) => money(r.balance)} footer={total("balance")} className="bv-num" headerClassName="bv-num" footerClassName="bv-num" />
            <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
            <Column header={t("birTax.eisStatus")} body={(r) => (r.eisStatus ? <BirTag status={r.eisStatus} /> : "")} />
            <Column style={{ width: "4rem" }} body={(r) => <Button icon="pi pi-print" text size="small" aria-label={t("birTax.print")} tooltip={t("birTax.print")}
              onClick={() => birTaxService.invoicePdf(r.id).catch((e) => showError(toast, e))} />} />
          </DataTable>
        {list.error ? <div className="pe-error" role="alert">{list.error}</div> : null}
      </div>
      {creating && <NewInvoice seller={seller} toast={toast} onHide={() => setCreating(false)} onIssued={(inv) => { setCreating(false); list.reload(); openDetail(inv.id); }} />}
      {detail && <InvoiceDetail invoice={detail} toast={toast} canWrite={canWrite} onHide={() => setDetail(null)} onChanged={() => { list.reload(); openDetail(detail.id); }} />}
    </div>
  );
};

export default SalesInvoices;
