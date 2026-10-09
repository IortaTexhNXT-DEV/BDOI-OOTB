import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabView, TabPanel } from "primereact/tabview";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import { RadioButton } from "primereact/radiobutton";
import remittanceService, { masterService } from "../../../services/remittanceService";
import reportsService from "../../../services/reportsService";
import { calendarDateFormat, dateBody, isoDate, loadInsurerOptions, loadSettings, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";
import { promptText } from "../../../utility/dialogs";
import ClientPaymentDialog, { PAYMENT_SEVERITY } from "./ClientPaymentDialog";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const STATUS_FILTERS = ["All", "Draft", "Pending Approval", "Open", "Partially Collected", "Collected", "Rejected", "Cancelled"];
const MODE_LABELS = { "bank-transfer": "Bank transfer", check: "Cheque", cash: "Cash", card: "Card", gcash: "GCash", online: "Online" };
const PAYMENT_RULES = {
  any: "A commission debit note can only be approved once the client's payment to the insurer is recorded on each of its policies.",
  full: "A commission debit note can only be approved once each of its policies is paid in full to the insurer (recorded client payments).",
};

/**
 * Remittance > Direct Bill Processing.
 * Direct bill: the client pays the premium directly to the insurer; the broker raises a commission debit note to the
 * insurer. Finance selects an insurer and a period, sees the direct-bill policies with their commission, VAT and total
 * due, raises a numbered debit note (maker-checker approval), prints / e-mails it and records the insurer's payments
 * (cash plus the creditable withholding tax the insurer deducts). The commission receivable is booked when the policy is
 * issued, so the screen does not post GL entries itself; each collection posts Dr Cash / Dr CWT / Cr Commission Receivable.
 * Gross remittance (broker-billed premium remitted in full): its commission is billed here on a billing statement, which
 * posts the commission when it is approved (basis "gross"); a debit note or statement bills commission of one basis.
 */
const DirectBillProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [summary, setSummary] = useState(null);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const [lineOptions, setLineOptions] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [paymentRule, setPaymentRule] = useState("none");
  const [paymentPolicy, setPaymentPolicy] = useState(null); // { policyId, policyNo } of the client payment dialog

  // raise debit note
  const [insurer, setInsurer] = useState(null);
  const [basis, setBasis] = useState("direct");
  const [periodFrom, setPeriodFrom] = useState(firstOfMonth());
  const [periodTo, setPeriodTo] = useState(new Date());
  const [productLines, setProductLines] = useState([]);
  const [items, setItems] = useState([]);
  const [itemsSummary, setItemsSummary] = useState(null);
  const [selected, setSelected] = useState([]);
  const [dnDate, setDnDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  // debit notes
  const [notes, setNotes] = useState([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesSummary, setNotesSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [noteInsurer, setNoteInsurer] = useState(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [viewNote, setViewNote] = useState(null);
  const [decision, setDecision] = useState(null); // { note, action: approve | reject | cancel, text }
  const [collect, setCollect] = useState(null); // { note, receivedDate, cashAmount, ewtAmount, paymentMode, referenceNo, form2307No, remarks }

  // billing mode
  const [modeForm, setModeForm] = useState({ policyNumber: "", billingMode: "direct", reason: "" });
  const [modeResult, setModeResult] = useState(null);

  const loadSummary = useCallback(() => remittanceService.directBillSummary().then(setSummary).catch((e) => showError(toast, e)), []);

  useEffect(() => {
    loadSummary();
    loadInsurerOptions().then(setInsurerOptions).catch((e) => showError(toast, e));
    masterService.options("line-of-business")
      .then((rows) => setLineOptions((rows || []).map((r) => ({ label: r.label, value: r.label }))))
      .catch((e) => showError(toast, e));
    // payment modes are the modes mapped to a GL cash account (accounting.cash_account_by_payment_mode)
    loadSettings()
      .then((s) => {
        setPaymentModes(Object.keys(s["accounting.cash_account_by_payment_mode"] || {}).map((m) => ({ label: MODE_LABELS[m] || m, value: m })));
        setPaymentRule(s["direct_bill.client_payment_required"] || "none");
      })
      .catch((e) => showError(toast, e));
  }, [loadSummary]);

  const loadItems = async () => {
    if (!insurer) {
      toast.current?.show({ severity: "warn", summary: "Insurer required", detail: "Select the insurer to bill", life: 3000 });
      return;
    }
    setLoadingItems(true);
    try {
      const res = await remittanceService.directBillItems({ insurerCode: insurer, basis, from: isoDate(periodFrom), to: isoDate(periodTo), productLine: productLines });
      setItems(res.data || []);
      setItemsSummary(res.summary || null);
      setSelected(res.data || []);
      if (!(res.data || []).length) toast.current?.show({ severity: "info", summary: "Nothing to bill", detail: "No unbilled direct-bill commission for this insurer and period", life: 4000 });
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoadingItems(false);
    }
  };

  const selectedTotals = useMemo(() => {
    const sum = (k) => round2(selected.reduce((s, x) => s + Number(x[k] || 0), 0));
    return { count: selected.length, grossPremium: sum("grossPremium"), commission: sum("commission"), vat: sum("vat"), totalDue: sum("totalDue"), expectedEwt: sum("expectedEwt"), netReceivable: sum("netReceivable") };
  }, [selected]);

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await remittanceService.listDebitNotes({ perPage: 200, status: statusFilter === "All" ? undefined : statusFilter, insurerCode: noteInsurer || undefined });
      setNotes(res.data || []);
      setNotesTotal(res.total ?? (res.data || []).length);
      setNotesSummary(res.summary || null);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoadingNotes(false);
    }
  }, [statusFilter, noteInsurer]);

  useEffect(() => {
    if (activeIndex === 1) loadNotes();
  }, [activeIndex, loadNotes]);

  const refreshAll = async () => {
    await Promise.all([loadSummary(), activeIndex === 1 ? loadNotes() : Promise.resolve()]);
  };

  const raise = async (submit) => {
    if (!insurer || !selected.length) {
      toast.current?.show({ severity: "warn", summary: "Nothing selected", detail: "Select the insurer and at least one policy", life: 3000 });
      return;
    }
    if (!(selectedTotals.totalDue > 0)) {
      toast.current?.show({ severity: "warn", summary: "Nothing due", detail: "The selected commission nets to zero or less", life: 3000 });
      return;
    }
    setSaving(true);
    try {
      const dn = await remittanceService.raiseDebitNote({
        insurerCode: insurer, periodFrom: isoDate(periodFrom), periodTo: isoDate(periodTo), dnDate: isoDate(dnDate), dueDate: dueDate ? isoDate(dueDate) : undefined,
        itemIds: selected.map((x) => x.id), basis, remarks: remarks || undefined, submit,
      });
      showSuccess(toast, `${dn.dnNumber} ${submit ? "raised and sent for approval" : "saved as draft"} (${formatCurrency(dn.amount)})`);
      setItems([]);
      setSelected([]);
      setItemsSummary(null);
      setRemarks("");
      await loadSummary();
      setActiveIndex(1);
    } catch (e) {
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn, message) => {
    try {
      const out = await fn();
      if (message) showSuccess(toast, typeof message === "function" ? message(out) : message);
      await refreshAll();
      return out;
    } catch (e) {
      showError(toast, e);
      return undefined;
    }
  };

  const openView = async (note) => {
    try {
      setViewNote(await remittanceService.getDebitNote(note.id));
    } catch (e) {
      showError(toast, e);
    }
  };

  const printNote = (note) => remittanceService.openDebitNotePdf(note.id).catch((e) => showError(toast, e));

  const submitDecision = async () => {
    const { note, action, text } = decision;
    if ((action === "reject" || (action === "cancel" && note.statusCode === "open")) && !String(text || "").trim()) {
      toast.current?.show({ severity: "warn", summary: "Reason required", detail: `Enter the reason to ${action} ${note.dnNumber}`, life: 3000 });
      return;
    }
    const call = { approve: () => remittanceService.approveDebitNote(note.id, text || undefined), reject: () => remittanceService.rejectDebitNote(note.id, text),
      cancel: () => remittanceService.cancelDebitNote(note.id, text || undefined) }[action];
    const out = await run(call, `${note.dnNumber} ${{ approve: "approved", reject: "rejected", cancel: "cancelled" }[action]}`);
    if (out) setDecision(null);
  };

  /** Remaining EWT and cash expected on a note (EWT withheld pro rata to the cash received). */
  const remaining = (note) => {
    const ewtLeft = round2(Math.max(0, Number(note.expectedEwt) - Number(note.collectedEwt)));
    return { ewtLeft, cashLeft: round2(Number(note.balance) - ewtLeft) };
  };
  const defaultEwt = (note, cash) => {
    const { ewtLeft, cashLeft } = remaining(note);
    if (cash >= cashLeft - 0.005) return ewtLeft;
    return cashLeft > 0 ? round2((cash * ewtLeft) / cashLeft) : 0;
  };

  const openCollect = (note) => {
    const { cashLeft, ewtLeft } = remaining(note);
    setCollect({ note, receivedDate: new Date(), cashAmount: cashLeft, ewtAmount: ewtLeft, paymentMode: paymentModes[0]?.value || null, referenceNo: "", form2307No: "", remarks: "" });
  };

  const submitCollect = async () => {
    const c = collect;
    if (!(Number(c.cashAmount) + Number(c.ewtAmount) > 0)) {
      toast.current?.show({ severity: "warn", summary: "Amount required", detail: "Enter the amount received from the insurer", life: 3000 });
      return;
    }
    const out = await run(() => remittanceService.collectDebitNote(c.note.id, {
      receivedDate: isoDate(c.receivedDate), cashAmount: c.cashAmount, ewtAmount: c.ewtAmount, paymentMode: c.paymentMode, referenceNo: c.referenceNo || undefined,
      form2307No: c.form2307No || undefined, remarks: c.remarks || undefined,
    }), (dn) => `${dn.collection.collectionNumber} posted; ${dn.dnNumber} is ${dn.status.toLowerCase()}`);
    if (out) setCollect(null);
  };

  const reverseCollection = async (note, col) => {
    // eslint-disable-next-line no-alert
    const reason = await promptText(`Reason for reversing ${col.collectionNumber}`);
    if (!reason || reason.trim().length < 3) return;
    const out = await run(() => remittanceService.reverseDebitNoteCollection(note.id, col.id, reason.trim()), `${col.collectionNumber} reversed`);
    if (out) setViewNote(out);
  };

  const downloadAgeing = async () => {
    try {
      const report = await reportsService.generateReport("direct-bill-commission", { ReportCriteria: "Ageing Bucket", FromDate: isoDate(new Date(new Date().getFullYear() - 5, 0, 1)), ToDate: isoDate(new Date()) }, "xlsx");
      window.open(report.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      showError(toast, e);
    }
  };

  const changeMode = async () => {
    if (!modeForm.policyNumber.trim()) {
      toast.current?.show({ severity: "warn", summary: "Policy required", detail: "Enter the policy number", life: 3000 });
      return;
    }
    const out = await run(() => remittanceService.changeBillingMode({ policyNumber: modeForm.policyNumber.trim(), billingMode: modeForm.billingMode, reason: modeForm.reason || undefined }),
      (r) => `${r.policyNumber} is now ${r.billingModeLabel.toLowerCase()}`);
    if (out) setModeResult(out);
  };

  const money = (field) => (row) => formatCurrency(row[field]);
  const clientPaymentBody = (row) => (
    <div className="flex align-items-center gap-1">
      <Tag value={row.clientPaymentStatus || "Unpaid"} severity={PAYMENT_SEVERITY[row.clientPaymentStatus] || "danger"} />
      <Button icon="pi pi-credit-card" className="p-button-text p-button-sm" tooltip="Record client payment to insurer" onClick={() => setPaymentPolicy({ policyId: row.policyId, policyNo: row.policyNo })} aria-label="Record client payment to insurer" />
    </div>
  );
  const reloadAfterPayment = async () => {
    if (items.length) await loadItems();
    if (viewNote) setViewNote(await remittanceService.getDebitNote(viewNote.id));
  };
  const statusTag = (row) => <Tag value={row.status} severity={statusSeverity(row.statusCode === "collected" ? "completed" : row.statusCode)} />;

  const noteActions = (row) => (
    <div className="flex flex-wrap gap-1">
      <Button icon="pi pi-eye" className="p-button-text p-button-sm" tooltip="View" onClick={() => openView(row)} aria-label="View" />
      <Button icon="pi pi-print" className="p-button-text p-button-sm" tooltip="Print debit note" onClick={() => printNote(row)} aria-label="Print debit note" />
      {row.statusCode === "draft" && (
        <Button icon="pi pi-send" className="p-button-text p-button-sm" tooltip="Submit for approval" onClick={() => run(() => remittanceService.submitDebitNote(row.id), `${row.dnNumber} submitted for approval`)} aria-label="Submit for approval" />
      )}
      {row.statusCode === "for-approval" && (
        <>
          <Button icon="pi pi-check" className="p-button-text p-button-sm" tooltip="Approve" onClick={() => setDecision({ note: row, action: "approve", text: "" })} aria-label="Approve" />
          <Button icon="pi pi-times" className="p-button-text p-button-danger p-button-sm" tooltip="Reject" onClick={() => setDecision({ note: row, action: "reject", text: "" })} aria-label="Reject" />
        </>
      )}
      {["open", "partial"].includes(row.statusCode) && (
        <>
          <Button icon="pi pi-wallet" className="p-button-text p-button-sm" tooltip="Record insurer payment" onClick={() => openCollect(row)} aria-label="Record insurer payment" />
          <Button icon="pi pi-envelope" className="p-button-text p-button-sm" tooltip="E-mail to the insurer"
            onClick={() => run(() => remittanceService.sendDebitNote(row.id), (dn) => `${dn.dnNumber} e-mailed to ${dn.emailedTo}`)} aria-label="E-mail to the insurer"
            />
        </>
      )}
      {["draft", "for-approval", "open"].includes(row.statusCode) && !(Number(row.collectedAmount) > 0) && (
        <Button icon="pi pi-ban" className="p-button-text p-button-sm" tooltip="Cancel" onClick={() => setDecision({ note: row, action: "cancel", text: "" })} aria-label="Cancel" />
      )}
    </div>
  );

  const collectPreview = collect ? (() => {
    const applied = round2(Number(collect.cashAmount || 0) + Number(collect.ewtAmount || 0));
    return { applied, after: round2(Number(collect.note.balance) - applied) };
  })() : null;

  return (
    <div className="direct-bill-processing">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>{t("remittance.directBillProcessing")}</h2>
      </div>

      <div className="grid summary-cards mb-2">
        {[
          ["Unbilled commission", summary?.unbilled],
          ["Billed, outstanding", summary?.billedOutstanding],
          ["Overdue", summary?.overdue],
          ["Receivable from insurers", summary?.total],
        ].map(([label, value]) => (
          <div className="col-12 md:col-3" key={label}>
            <Card className="summary-card">
              <div className="card-title">{label}</div>
              <div className="card-value">{formatCurrency(value || 0)}</div>
            </Card>
          </div>
        ))}
      </div>
      {PAYMENT_RULES[paymentRule] && <Message severity="warn" className="w-full justify-content-start mb-3" text={PAYMENT_RULES[paymentRule]} />}
      {summary?.pendingApproval > 0 && (
        <Message severity="info" className="w-full justify-content-start mb-3" text={`${summary.pendingApproval} debit note(s) awaiting approval`} />
      )}

      <Card>
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="1. Raise Debit Note">
            <div className="filter-section mb-3">
              <div className="grid">
                <div className="col-12 md:col-2">
                  <label>Insurer *</label>
                  <Dropdown value={insurer} options={insurerOptions} onChange={(e) => setInsurer(e.value)} placeholder="Select insurer" filter className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label>Issued from</label>
                  <Calendar value={periodFrom} onChange={(e) => setPeriodFrom(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label>Issued to</label>
                  <Calendar value={periodTo} onChange={(e) => setPeriodTo(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label>{t("directBillBasis.label")}</label>
                  <Dropdown value={basis} options={["direct", "gross"].map((b) => ({ label: t(`directBillBasis.${b}`), value: b }))}
                    onChange={(e) => { setBasis(e.value); setItems([]); setSelected([]); setItemsSummary(null); }} className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label>Line of business</label>
                  <MultiSelect value={productLines} options={lineOptions} onChange={(e) => setProductLines(e.value)} placeholder="All lines" className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label>&nbsp;</label>
                  <Button label="Load policies" icon="pi pi-search" className="w-full" onClick={loadItems} loading={loadingItems} />
                </div>
              </div>
            </div>

            <DataTable value={items} selection={selected} onSelectionChange={(e) => setSelected(e.value)} dataKey="id" className="policy-grid" loading={loadingItems}
              emptyMessage="Select an insurer and period, then load the direct-bill policies to bill" scrollable stripedRows size="small">
              <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
              <Column field="policyNo" header="Policy No" />
              <Column field="reference" header="Reference" body={(r) => (r.reference && r.reference !== r.policyNo ? r.reference : "-")} />
              <Column field="insuredName" header="Insured Name" />
              <Column field="product" header="Product" />
              <Column field="lineOfBusiness" header="Line" />
              <Column field="bookedOn" body={dateBody("bookedOn")} header="Issued" />
              <Column field="grossPremium" header="Gross Premium" body={money("grossPremium")} className="text-right" />
              <Column field="commissionRate" header="Rate" body={(r) => (r.commissionRate == null ? "-" : `${Number(r.commissionRate).toFixed(2)}%`)} className="text-right" />
              <Column field="commission" header="Commission" body={money("commission")} className="text-right" />
              <Column field="vat" header="VAT" body={money("vat")} className="text-right" />
              <Column field="totalDue" header="Total Due" body={(r) => <strong>{formatCurrency(r.totalDue)}</strong>} className="text-right" />
              <Column field="expectedEwt" header="EWT" body={money("expectedEwt")} className="text-right" />
              <Column field="clientPaymentStatus" header="Client paid insurer" body={clientPaymentBody} style={{ minWidth: "11rem" }} />
              <Column field="bookingJournal" header="Booked in" />
            </DataTable>

            {items.length > 0 && (
              <>
                <div className="grid mt-3">
                  <div className="col-12 md:col-7">
                    <div className="grid">
                      <div className="col-12 md:col-4">
                        <label>Debit note date</label>
                        <Calendar value={dnDate} onChange={(e) => setDnDate(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
                      </div>
                      <div className="col-12 md:col-4">
                        <label>Due date</label>
                        <Calendar value={dueDate} onChange={(e) => setDueDate(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" placeholder="From the settings" />
                      </div>
                      <div className="col-12">
                        <label>Remarks</label>
                        <InputTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} autoResize className="w-full" />
                      </div>
                    </div>
                  </div>
                  <div className="col-12 md:col-5">
                    <Card className="final-summary">
                      <div className="summary-table">
                        <div className="summary-row"><span>Policies selected</span><span>{selectedTotals.count} of {items.length}</span></div>
                        <div className="summary-row"><span>Gross premium (paid to the insurer)</span><span>{formatCurrency(selectedTotals.grossPremium)}</span></div>
                        <div className="summary-row"><span>Commission</span><span>{formatCurrency(selectedTotals.commission)}</span></div>
                        <div className="summary-row"><span>Output VAT</span><span>{formatCurrency(selectedTotals.vat)}</span></div>
                        <div className="divider" />
                        <div className="summary-row total"><span>Total due from the insurer</span><span>{formatCurrency(selectedTotals.totalDue)}</span></div>
                        <div className="summary-row">
                          <span>Less EWT withheld by the insurer ({round2((itemsSummary?.ewtRate || 0) * 100)}% of commission)</span>
                          <span>- {formatCurrency(selectedTotals.expectedEwt)}</span>
                        </div>
                        <div className="summary-row total"><span>Net cash expected</span><span>{formatCurrency(selectedTotals.netReceivable)}</span></div>
                      </div>
                    </Card>
                  </div>
                </div>
                <div className="action-buttons mt-3">
                  <Button label="Save draft" icon="pi pi-save" className="p-button-secondary mr-2" onClick={() => raise(false)} disabled={saving || !selected.length} />
                  <Button label="Raise debit note and submit for approval" icon="pi pi-check" onClick={() => raise(true)} loading={saving} disabled={!selected.length} />
                </div>
              </>
            )}
          </TabPanel>

          <TabPanel header="2. Debit Notes">
            <div className="filter-section mb-3">
              <div className="grid">
                <div className="col-12 md:col-3">
                  <label>Status</label>
                  <Dropdown value={statusFilter} options={STATUS_FILTERS} onChange={(e) => setStatusFilter(e.value)} className="w-full" />
                </div>
                <div className="col-12 md:col-3">
                  <label>Insurer</label>
                  <Dropdown value={noteInsurer} options={insurerOptions} onChange={(e) => setNoteInsurer(e.value)} placeholder="All insurers" showClear filter className="w-full" />
                </div>
                <div className="col-12 md:col-6 flex align-items-end justify-content-end gap-2">
                  <Button label="Refresh" icon="pi pi-refresh" className="p-button-outlined" onClick={loadNotes} />
                  <Button label="Commission receivable ageing" icon="pi pi-file-excel" className="p-button-outlined" onClick={downloadAgeing} />
                </div>
              </div>
            </div>
            <DataTable value={notes} dataKey="id" loading={loadingNotes} paginator rows={20} stripedRows size="small" scrollable
              emptyMessage="No commission debit notes" footer={notesSummary ? `${notesTotal} debit note(s) · total ${formatCurrency(notesSummary.amount)} · outstanding ${formatCurrency(notesSummary.outstanding)}` : null}>
              <Column field="dnNumber" header="Debit Note" body={(r) => <div><div>{r.dnNumber}</div><div className="text-sm text-500">{t(`directBillBasis.document.${r.basis || "direct"}`)}</div></div>} />
              <Column field="dnDate" body={dateBody("dnDate")} header="Date" />
              <Column field="insurerName" header="Insurer" />
              <Column field="policyCount" header="Policies" />
              <Column field="commission" header="Commission" body={money("commission")} className="text-right" />
              <Column field="vat" header="VAT" body={money("vat")} className="text-right" />
              <Column field="amount" header="Total Due" body={money("amount")} className="text-right" />
              <Column field="collectedAmount" header="Collected" body={money("collectedAmount")} className="text-right" />
              <Column field="balance" header="Balance" body={(r) => <strong>{formatCurrency(r.balance)}</strong>} className="text-right" />
              <Column field="dueDate" body={dateBody("dueDate")} header="Due" />
              <Column field="status" header="Status" body={statusTag} />
              <Column header="Actions" body={noteActions} style={{ minWidth: "12rem" }} />
            </DataTable>
          </TabPanel>

          <TabPanel header="3. Billing Mode">
            <p className="mt-0">
              Mark an issued policy as direct bill (the client pays the insurer) or return it to broker billing. Direct bill cancels the premium bill and books
              the commission due from the insurer; the change is refused once premium was collected or remitted, or once the commission is on a debit note.
              New policies take their billing mode from the payment step at issue (default in System Settings, direct_bill.default_billing_mode).
            </p>
            <div className="grid">
              <div className="col-12 md:col-4">
                <label>Policy number *</label>
                <InputText value={modeForm.policyNumber} onChange={(e) => setModeForm({ ...modeForm, policyNumber: e.target.value })} className="w-full" />
              </div>
              <div className="col-12 md:col-4">
                <label>Billing mode</label>
                <div className="flex gap-3 mt-2">
                  {[["direct", "Direct bill"], ["broker", "Broker billed"]].map(([v, l]) => (
                    <div className="flex align-items-center gap-2" key={v}>
                      <RadioButton inputId={`mode-${v}`} value={v} checked={modeForm.billingMode === v} onChange={(e) => setModeForm({ ...modeForm, billingMode: e.value })} />
                      <label htmlFor={`mode-${v}`} className="m-0">{l}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-12 md:col-4">
                <label>Reason</label>
                <InputText value={modeForm.reason} onChange={(e) => setModeForm({ ...modeForm, reason: e.target.value })} className="w-full" />
              </div>
            </div>
            <Button label="Change billing mode" icon="pi pi-sync" className="mt-2" onClick={changeMode} />
            {modeResult && (
              <Message className="w-full justify-content-start mt-3" severity="success"
                text={`${modeResult.policyNumber}: ${modeResult.before} → ${modeResult.billingModeLabel}${modeResult.billingMode === "direct"
                  ? ` · commission due from the insurer ${formatCurrency(modeResult.directBill?.commissionDue || 0)}` : ` · bill ${modeResult.billNumber || "-"}`}`} />
            )}
          </TabPanel>
        </TabView>
      </Card>

      <Dialog className="direct-bill-dialog" header={viewNote ? `${viewNote.dnNumber} · ${viewNote.insurerName}` : ""} visible={!!viewNote} style={{ width: "min(1100px, 95vw)" }} onHide={() => setViewNote(null)}>
        {viewNote && (
          <>
            <div className="grid">
              {[["Status", statusTag(viewNote)], ["Date", viewNote.dnDate], ["Due", viewNote.dueDate], ["Period", `${viewNote.periodFrom || "-"} to ${viewNote.periodTo || "-"}`],
                ["Total due", formatCurrency(viewNote.amount)], ["Expected EWT", formatCurrency(viewNote.expectedEwt)], ["Collected", formatCurrency(viewNote.collectedAmount)], ["Balance", formatCurrency(viewNote.balance)],
                ["Raised by", viewNote.createdBy], ["Approved by", viewNote.approvedBy || "-"], ["Sent to", viewNote.sentTo || "-"], ["Remarks", viewNote.rejectionReason || viewNote.remarks || "-"]]
                .map(([l, v]) => (
                  <div className="col-6 md:col-3" key={l}>
                    <div className="text-sm text-600">{l}</div>
                    <div>{v}</div>
                  </div>
                ))}
            </div>
            <h4>Policies</h4>
            <DataTable value={viewNote.lines} size="small" stripedRows>
              <Column field="policyNo" header="Policy No" />
              <Column field="reference" header="Reference" />
              <Column field="insuredName" header="Insured" />
              <Column field="product" header="Product" />
              <Column field="grossPremium" header="Gross Premium" body={money("grossPremium")} className="text-right" />
              <Column field="commissionRate" header="Rate" body={(r) => (r.commissionRate == null ? "-" : `${Number(r.commissionRate).toFixed(2)}%`)} className="text-right" />
              <Column field="commission" header="Commission" body={money("commission")} className="text-right" />
              <Column field="vat" header="VAT" body={money("vat")} className="text-right" />
              <Column field="amount" header="Total" body={money("amount")} className="text-right" />
              <Column field="clientPaymentStatus" header="Client paid insurer" body={clientPaymentBody} style={{ minWidth: "11rem" }} />
            </DataTable>
            <h4>Collections</h4>
            <DataTable value={viewNote.collections} size="small" stripedRows emptyMessage="No payment recorded yet">
              <Column field="collectionNumber" header="Collection" />
              <Column field="receivedDate" body={dateBody("receivedDate")} header="Received" />
              <Column field="paymentMode" header="Mode" body={(r) => MODE_LABELS[r.paymentMode] || r.paymentMode} />
              <Column field="referenceNo" header="Reference" />
              <Column field="cashAmount" header="Cash" body={money("cashAmount")} className="text-right" />
              <Column field="ewtAmount" header="EWT (2307)" body={money("ewtAmount")} className="text-right" />
              <Column field="appliedAmount" header="Applied" body={money("appliedAmount")} className="text-right" />
              <Column field="journalNumber" header="Journal" />
              <Column field="status" header="Status" body={(r) => <Tag value={r.status} severity={r.status === "posted" ? "success" : "secondary"} />} />
              <Column body={(r) => (r.status === "posted" ? <Button icon="pi pi-undo" className="p-button-text p-button-sm" tooltip="Reverse" onClick={() => reverseCollection(viewNote, r)} aria-label="Reverse" /> : null)} />
            </DataTable>
            <div className="action-buttons mt-3">
              <Button label="Print" icon="pi pi-print" className="p-button-outlined" onClick={() => printNote(viewNote)} />
            </div>
          </>
        )}
      </Dialog>

      <ClientPaymentDialog policy={paymentPolicy} paymentModes={paymentModes} toast={toast} onClose={() => setPaymentPolicy(null)} onChanged={reloadAfterPayment} />

      <Dialog className="direct-bill-dialog" header={decision ? `${{ approve: "Approve", reject: "Reject", cancel: "Cancel" }[decision.action]} ${decision.note.dnNumber}` : ""} visible={!!decision}
        style={{ width: "min(520px, 95vw)" }} onHide={() => setDecision(null)}
        footer={decision && (
          <div>
            <Button label="Close" className="p-button-text" onClick={() => setDecision(null)} />
            <Button label={{ approve: "Approve", reject: "Reject", cancel: "Cancel debit note" }[decision.action]} className={decision.action === "approve" ? "" : "p-button-danger"} onClick={submitDecision} />
          </div>
        )}>
        {decision && (
          <>
            <p className="mt-0">
              {decision.note.insurerName} · {formatCurrency(decision.note.amount)} ({decision.note.policyCount} policies).
              {decision.action === "approve" ? " The approver must be a different user from the one who raised it." : " Its commission becomes available for a new debit note."}
            </p>
            <label>{decision.action === "approve" ? "Remarks" : "Reason"}{decision.action === "reject" ? " *" : ""}</label>
            <InputTextarea value={decision.text} onChange={(e) => setDecision({ ...decision, text: e.target.value })} rows={3} className="w-full" autoResize />
          </>
        )}
      </Dialog>

      <Dialog className="direct-bill-dialog" header={collect ? `Record insurer payment · ${collect.note.dnNumber}` : ""} visible={!!collect} style={{ width: "min(640px, 95vw)" }} onHide={() => setCollect(null)}
        footer={collect && (
          <div>
            <Button label="Close" className="p-button-text" onClick={() => setCollect(null)} />
            <Button label="Post collection" icon="pi pi-check" onClick={submitCollect} />
          </div>
        )}>
        {collect && (
          <div className="grid">
            <div className="col-12">
              <Message severity="info" className="w-full justify-content-start"
                text={`Balance ${formatCurrency(collect.note.balance)} · the insurer withholds ${round2(Number(collect.note.ewtRate) * 100)}% EWT on the commission (creditable, BIR Form 2307)`} />
            </div>
            <div className="col-12 md:col-6">
              <label>Received on *</label>
              <Calendar value={collect.receivedDate} onChange={(e) => setCollect({ ...collect, receivedDate: e.value })} maxDate={new Date()} dateFormat={calendarDateFormat()} showIcon className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>Payment mode</label>
              <Dropdown value={collect.paymentMode} options={paymentModes} onChange={(e) => setCollect({ ...collect, paymentMode: e.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>Cash received *</label>
              <InputNumber value={collect.cashAmount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className="w-full"
                onValueChange={(e) => setCollect({ ...collect, cashAmount: e.value, ewtAmount: defaultEwt(collect.note, Number(e.value || 0)) })} />
            </div>
            <div className="col-12 md:col-6">
              <label>Tax withheld (EWT)</label>
              <InputNumber value={collect.ewtAmount} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className="w-full"
                onValueChange={(e) => setCollect({ ...collect, ewtAmount: e.value })} />
            </div>
            <div className="col-12 md:col-6">
              <label>Reference (bank / cheque)</label>
              <InputText value={collect.referenceNo} onChange={(e) => setCollect({ ...collect, referenceNo: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>BIR 2307 number</label>
              <InputText value={collect.form2307No} onChange={(e) => setCollect({ ...collect, form2307No: e.target.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label>Remarks</label>
              <InputTextarea value={collect.remarks} onChange={(e) => setCollect({ ...collect, remarks: e.target.value })} rows={2} autoResize className="w-full" />
            </div>
            <div className="col-12 text-right">
              Applied {formatCurrency(collectPreview.applied)} · balance after {formatCurrency(collectPreview.after)}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default DirectBillProcessing;
