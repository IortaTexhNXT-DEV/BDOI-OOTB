import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabMenu } from "primereact/tabmenu";
import { MultiSelect } from "primereact/multiselect";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import { RadioButton } from "primereact/radiobutton";
import PageHeader from "../../../components/PageHeader";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import EligibilityNote from "../../../components/EligibilityNote";
import DateField from "../../../components/DateField";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { hasPermission } from "../../../utils/canOpen";
import ConfirmDialog, { openConfirm } from "../../../components/ConfirmDialog";
import { printPdf } from "../../../components/Print";
import remittanceService, { masterService } from "../../../services/remittanceService";
import reportsService from "../../../services/reportsService";
import { REMITTANCE_ROUTES, calendarDateFormat, dateBody, formatDate, isoDate, loadInsurerOptions, loadSettings, money as codeMoney, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";
import ClientPaymentDialog, { PAYMENT_SEVERITY } from "./ClientPaymentDialog";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const STATUS_FILTERS = ["All", "Draft", "Pending Approval", "Open", "Partially Collected", "Collected", "Settled by retention", "Rejected", "Cancelled"];
const TABS = ["raise", "notes", "run", "mode"];
const MODE_LABELS = { "bank-transfer": "Bank transfer", check: "Cheque", cash: "Cash", card: "Card", gcash: "GCash", online: "Online" };

/** The row menu of a debit note, View first; Approve and Reject only when the server's decision allows them. */
export const noteActions = (row) => {
  const s = row.statusCode;
  return [
    { code: "view", allowed: true },
    { code: "print", allowed: true },
    { code: "submit", allowed: s === "draft" },
    { code: "approve", allowed: s === "for-approval" && !!row.decision?.canDecide },
    { code: "reject", allowed: s === "for-approval" && !!row.decision?.canDecide },
    { code: "collect", allowed: ["open", "partial"].includes(s) },
    { code: "email", allowed: ["open", "partial"].includes(s) },
    { code: "cancel", allowed: ["draft", "for-approval", "open", "settled"].includes(s) && !(Number(row.collectedAmount) > 0) },
  ].filter((a) => a.allowed);
};

/**
 * Accounts > Remittance > Insurer billing (/finance/remittance/billing; the Direct Bill Processing screen until the
 * Phase 4 billing statements). ?note=<id> opens a debit note.
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
  // amounts read "PHP 1,234.56" as on every remittance screen
  const formatCurrency = codeMoney;
  const toast = useRef(null);
  const [params, setParams] = useSearchParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const tab = TABS[activeIndex];
  // billing run: the next billing dates, the runs and Run billing now
  const [runs, setRuns] = useState(null);
  const [runForm, setRunForm] = useState({ billingDate: isoDate(new Date()), insurer: null });
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const [lineOptions, setLineOptions] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
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
  const [decision, setDecision] = useState(null); // { note, action: reject | cancel }
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
      .then((s) => setPaymentModes(Object.keys(s["accounting.cash_account_by_payment_mode"] || {}).map((m) => ({ label: MODE_LABELS[m] || m, value: m }))))
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
    if (tab === "notes") loadNotes();
    if (tab === "run") remittanceService.billingRuns().then(setRuns).catch((e) => showError(toast, e));
  }, [tab, loadNotes]);

  const refreshAll = async () => {
    await Promise.all([loadSummary(), tab === "notes" ? loadNotes() : Promise.resolve()]);
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

  const setNoteParam = useCallback((id) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (id) next.set("note", id);
    else next.delete("note");
    return next;
  }, { replace: true }), [setParams]);
  const noteParam = params.get("note");
  useEffect(() => {
    if (!noteParam) {
      setViewNote(null);
      return;
    }
    remittanceService.getDebitNote(noteParam).then(setViewNote).catch((e) => showError(toast, e));
  }, [noteParam]);
  const openView = (note) => setNoteParam(note.id);
  const closeView = () => setNoteParam(null);

  const printNote = (note) => printPdf(remittanceService.debitNotePdfPath(note.id)).catch((e) => showError(toast, e));

  const noteFacts = (note) => [
    { label: t("remittance.billing.facts.insurer"), value: note.insurerName },
    { label: t("remittance.billing.facts.policies"), value: note.policyCount, type: "number" },
    { label: t("remittance.billing.facts.amount"), value: note.amount, type: "amount" },
  ];
  const refreshView = async (id) => {
    if (viewNote && viewNote.id === id) setViewNote(await remittanceService.getDebitNote(id));
  };
  const approve = async (note) => {
    const answer = await openConfirm({
      title: t("remittance.billing.approveTitle", { reference: note.dnNumber }), facts: noteFacts(note),
      input: { type: "textarea", label: t("remittance.billing.approveRemarks"), required: false, maxLength: 500 },
      confirmLabel: t("remittance.billing.actions.approve"),
      onConfirm: (remarks) => remittanceService.approveDebitNote(note.id, remarks || undefined),
    });
    if (answer === null || answer === false) return;
    showSuccess(toast, t("remittance.billing.approved", { reference: note.dnNumber }));
    await refreshAll();
    await refreshView(note.id);
  };
  const afterReason = async (result) => {
    const d = decision;
    setDecision(null);
    if (!result?.confirmed) return;
    showSuccess(toast, t(`remittance.billing.${d.action === "reject" ? "rejected" : "cancelled"}`, { reference: d.note.dnNumber }));
    await refreshAll();
    await refreshView(d.note.id);
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
    let out;
    const answer = await openConfirm({
      title: t("remittance.billing.reverseTitle", { reference: col.collectionNumber }), severity: "danger",
      facts: [{ label: t("remittance.billing.facts.note"), value: note.dnNumber }, { label: t("remittance.billing.facts.applied"), value: col.appliedAmount, type: "amount" }],
      input: { type: "textarea", label: t("remittance.billing.reverseReason"), required: true, minLength: 3, maxLength: 500 },
      confirmLabel: t("remittance.billing.reverse"),
      onConfirm: async (reason) => { out = await remittanceService.reverseDebitNoteCollection(note.id, col.id, String(reason).trim()); },
    });
    if (answer === null || answer === false) return;
    showSuccess(toast, t("remittance.billing.reversed", { reference: col.collectionNumber }));
    await refreshAll();
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
      <StatusChip label={row.clientPaymentStatus || "Unpaid"} severity={PAYMENT_SEVERITY[row.clientPaymentStatus] || "danger"} />
      <Button type="button" link size="small" className="rm-link" label={t("remittance.billing.clientPayment")} onClick={() => setPaymentPolicy({ policyId: row.policyId, policyNo: row.policyNo })} />
    </div>
  );
  const reloadAfterPayment = async () => {
    if (items.length) await loadItems();
    if (viewNote) setViewNote(await remittanceService.getDebitNote(viewNote.id));
  };
  const statusTag = (row) => (
    <>
      <StatusChip label={row.status} severity={statusSeverity(["collected", "settled"].includes(row.statusCode) ? "completed" : row.statusCode)} />
      {row.overdue ? <StatusChip label={t("remittance.billing.overdue")} severity="danger" className="ml-1" /> : null}
    </>
  );
  const runBillingNow = async () => {
    setRunning(true);
    try {
      const r = await remittanceService.runBilling({ billingDate: runForm.billingDate, insurerId: insurerOptions.find((o) => o.value === runForm.insurer)?.id });
      showSuccess(toast, r.message);
      setRuns(await remittanceService.billingRuns());
      await loadSummary();
    } catch (e) {
      showError(toast, e);
    } finally {
      setRunning(false);
    }
  };

  const onNoteAction = (row) => (action) => {
    if (action.code === "view") openView(row);
    if (action.code === "print") printNote(row);
    if (action.code === "submit") run(() => remittanceService.submitDebitNote(row.id), `${row.dnNumber} submitted for approval`);
    if (action.code === "approve") approve(row);
    if (action.code === "reject" || action.code === "cancel") setDecision({ note: row, action: action.code });
    if (action.code === "collect") openCollect(row);
    if (action.code === "email") run(() => remittanceService.sendDebitNote(row.id), (dn) => `${dn.dnNumber} e-mailed to ${dn.emailedTo}`);
  };
  const noteActionLabel = (a) => t(`remittance.billing.actions.${a.code}`);
  const noteStatus = (row) => (
    <span className="rm-status-cell">
      {statusTag(row)}
      {row.statusCode === "for-approval" && row.decision && !row.decision.canDecide && row.decision.blockedReason
        ? <span className="rm-row-result">{row.decision.blockedReason}</span> : null}
    </span>
  );

  const collectPreview = collect ? (() => {
    const applied = round2(Number(collect.cashAmount || 0) + Number(collect.ewtAmount || 0));
    return { applied, after: round2(Number(collect.note.balance) - applied) };
  })() : null;

  return (
    <div className="direct-bill-processing rm-page">
      <Toast ref={toast} />
      <PageHeader title={t("remittance.billing.title")} home={t("remittance.common.accounts")} section={{ label: t("remittance.common.remittance"), to: REMITTANCE_ROUTES.landing }}
        trail={[t("remittance.billing.title")]} help={t("remittance.billing.help")}
        actions={<RowActions label={t("remittance.common.moreActions")} actions={[{ code: "ageing", label: t("remittance.billing.ageing"), allowed: true }]} onAction={downloadAgeing} />} />
      {summary?.pendingApproval > 0 ? (
        <div className="rm-strip"><StatusChip label={t("remittance.billing.awaitingApproval", { count: summary.pendingApproval })} severity="warning" /></div>
      ) : null}
      <StatCards items={[
        ["unbilled", summary?.unbilled], ["outstanding", summary?.billedOutstanding], ["overdue", summary?.overdue], ["receivable", summary?.total],
      ].map(([key, value]) => ({ key, label: t(`remittance.billing.kpis.${key}`), value: summary ? codeMoney(value || 0) : null }))} />

      <TabMenu model={TABS.map((key) => ({ label: t(`remittance.billing.tabs.${key}`) }))} activeIndex={activeIndex}
        onTabChange={(e) => setActiveIndex(e.index)} className="rm-tabs" />
      <Card>
        {tab === "raise" ? (
          <div>
            <div className="filter-section mb-3">
              <div className="grid">
                <div className="col-12 md:col-3">
                  <label className="bv-field-label">{t("remittance.billing.fields.insurer")}<span className="required-marker">*</span></label>
                  <Dropdown value={insurer} options={insurerOptions} onChange={(e) => setInsurer(e.value)} placeholder={t("remittance.billing.fields.chooseInsurer")} filter className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label className="bv-field-label">{t("remittance.billing.fields.issuedFrom")}</label>
                  <Calendar value={periodFrom} onChange={(e) => setPeriodFrom(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label className="bv-field-label">{t("remittance.billing.fields.issuedTo")}</label>
                  <Calendar value={periodTo} onChange={(e) => setPeriodTo(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
                </div>
                <div className="col-12 md:col-2">
                  <label className="bv-field-label">{t("directBillBasis.label")}</label>
                  <Dropdown value={basis} options={["direct", "gross"].map((b) => ({ label: t(`directBillBasis.${b}`), value: b }))}
                    onChange={(e) => { setBasis(e.value); setItems([]); setSelected([]); setItemsSummary(null); }} className="w-full" />
                </div>
                <div className="col-12 md:col-3">
                  <label className="bv-field-label">{t("remittance.billing.fields.line")}</label>
                  <MultiSelect value={productLines} options={lineOptions} onChange={(e) => setProductLines(e.value)} placeholder={t("remittance.billing.fields.allLines")} className="w-full" />
                </div>
                <div className="col-12 flex justify-content-end">
                  <Button label={t("remittance.billing.loadPolicies")} outlined className="rm-nowrap" onClick={loadItems} loading={loadingItems} />
                </div>
              </div>
            </div>

            <DataTable value={items} selection={selected} onSelectionChange={(e) => setSelected(e.value)} dataKey="id" className="policy-grid" loading={loadingItems}
              emptyMessage={t("remittance.billing.emptyPolicies")} scrollable stripedRows size="small">
              <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
              <Column field="policyNo" header={t("remittance.billing.columns.policyNo")} />
              <Column field="reference" header={t("remittance.billing.columns.reference")} body={(r) => (r.reference && r.reference !== r.policyNo ? r.reference : "-")} />
              <Column field="insuredName" header={t("remittance.billing.columns.insured")} />
              <Column field="product" header={t("remittance.billing.columns.product")} />
              <Column field="lineOfBusiness" header={t("remittance.billing.columns.line")} />
              <Column field="bookedOn" body={dateBody("bookedOn")} header={t("remittance.billing.columns.issued")} />
              <Column field="grossPremium" header={t("remittance.billing.columns.grossPremium")} body={money("grossPremium")} className="text-right" />
              <Column field="commissionRate" header={t("remittance.billing.columns.rate")} body={(r) => (r.commissionRate == null ? "-" : `${Number(r.commissionRate).toFixed(2)}%`)} className="text-right" />
              <Column field="commission" header={t("remittance.billing.columns.commission")} body={money("commission")} className="text-right" />
              <Column field="vat" header={t("remittance.billing.columns.vat")} body={money("vat")} className="text-right" />
              <Column field="totalDue" header={t("remittance.billing.columns.totalDue")} body={(r) => <strong>{formatCurrency(r.totalDue)}</strong>} className="text-right" />
              <Column field="expectedEwt" header={t("remittance.billing.columns.ewt")} body={money("expectedEwt")} className="text-right" />
              <Column field="clientPaymentStatus" header={t("remittance.billing.columns.clientPaid")} body={clientPaymentBody} style={{ minWidth: "11rem" }} />
              <Column field="bookingJournal" header={t("remittance.billing.columns.bookedIn")} />
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
                  <Button label={t("remittance.billing.saveDraft")} outlined className="mr-2" onClick={() => raise(false)} disabled={saving || !selected.length} />
                  <Button label={t("remittance.billing.raiseAndSubmit")} onClick={() => raise(true)} loading={saving} disabled={!selected.length} />
                </div>
              </>
            )}
          </div>
        ) : null}

        {tab === "notes" ? (
          <div>
            <div className="filter-section mb-3">
              <div className="grid">
                <div className="col-12 md:col-3">
                  <label className="bv-field-label">{t("remittance.billing.fields.status")}</label>
                  <Dropdown value={statusFilter} options={STATUS_FILTERS} onChange={(e) => setStatusFilter(e.value)} className="w-full" />
                </div>
                <div className="col-12 md:col-3">
                  <label className="bv-field-label">{t("remittance.billing.fields.insurer")}</label>
                  <Dropdown value={noteInsurer} options={insurerOptions} onChange={(e) => setNoteInsurer(e.value)} placeholder={t("remittance.billing.fields.allInsurers")} showClear filter className="w-full" />
                </div>
                <div className="col-12 md:col-6 flex align-items-end justify-content-end gap-2">
                  <Button label={t("remittance.billing.refresh")} outlined onClick={loadNotes} />
                </div>
              </div>
            </div>
            <DataTable value={notes} dataKey="id" loading={loadingNotes} paginator rows={20} stripedRows size="small" scrollable
              emptyMessage={t("remittance.billing.emptyNotes")} footer={notesSummary ? `${notesTotal} debit note(s) · total ${formatCurrency(notesSummary.amount)} · outstanding ${formatCurrency(notesSummary.outstanding)}` : null}>
              <Column field="dnNumber" header={t("remittance.billing.columns.debitNote")} body={(r) => (
                <div>
                  <div>{r.dnNumber}</div>
                  <div className="text-sm text-500">{[t(`directBillBasis.document.${r.basis || "direct"}`), r.productLine].filter(Boolean).join(" · ")}</div>
                </div>
              )} />
              <Column field="dnDate" body={dateBody("dnDate")} header={t("remittance.billing.columns.date")} />
              <Column field="insurerName" header={t("remittance.billing.columns.insurer")} />
              <Column field="policyCount" header={t("remittance.billing.columns.policies")} />
              <Column field="commission" header={t("remittance.billing.columns.commission")} body={money("commission")} className="text-right" />
              <Column field="vat" header={t("remittance.billing.columns.vat")} body={money("vat")} className="text-right" />
              <Column field="amount" header={t("remittance.billing.columns.totalDue")} body={money("amount")} className="text-right" />
              <Column field="collectedAmount" header={t("remittance.billing.columns.collected")} body={money("collectedAmount")} className="text-right" />
              <Column field="balance" header={t("remittance.billing.columns.balance")} body={(r) => <strong>{formatCurrency(r.balance)}</strong>} className="text-right" />
              <Column field="dueDate" body={dateBody("dueDate")} header={t("remittance.billing.columns.due")} />
              <Column field="status" header={t("remittance.billing.columns.status")} body={noteStatus} style={{ minWidth: "10rem" }} />
              <Column header={<span className="p-sr-only">{t("remittance.billing.actionsHeader")}</span>} align="center" style={{ width: "3.5rem" }}
                body={(r) => <RowActions label={t("remittance.billing.actionsFor", { reference: r.dnNumber })} actions={noteActions(r)} labelOf={noteActionLabel} onAction={onNoteAction(r)} />} />
            </DataTable>
          </div>
        ) : null}

        {tab === "run" ? (
          <div>
            <KeyValueGrid columns={3} className="mb-3" items={[
              { label: t("remittance.billing.run.nextDates"), value: (runs?.nextBillingDates || []).map((d) => formatDate(d)).join(" · ") || null },
              { label: t("remittance.billing.run.lastRun"), value: runs?.runs?.[0] ? `${formatDate(runs.runs[0].billingDate)} · ${runs.runs[0].message || ""}` : null, span: 2 },
            ]} />
            {hasPermission("write:remittance") ? (
              <div className="grid align-items-end mb-2">
                <div className="col-12 md:col-3">
                  <label className="bv-field-label" htmlFor="rm-bill-date">{t("remittance.billing.run.billingDate")}<span className="required-marker">*</span></label>
                  <DateField id="rm-bill-date" value={runForm.billingDate} max={isoDate(new Date())} onChange={(e) => setRunForm({ ...runForm, billingDate: e.target.value })} />
                </div>
                <div className="col-12 md:col-4">
                  <label className="bv-field-label">{t("remittance.billing.fields.insurer")}</label>
                  <Dropdown value={runForm.insurer} options={insurerOptions} onChange={(e) => setRunForm({ ...runForm, insurer: e.value })} placeholder={t("remittance.billing.fields.allInsurers")}
                    showClear filter className="w-full" />
                </div>
                <div className="col-12 md:col-5 flex justify-content-end">
                  <Button label={t("remittance.billing.run.runNow")} icon="pi pi-play" loading={running} disabled={!runForm.billingDate} onClick={runBillingNow} />
                </div>
              </div>
            ) : null}
            <DataTable value={runs?.runs || []} dataKey="id" size="small" stripedRows paginator rows={10} emptyMessage={t("remittance.billing.run.empty")}>
              <Column header={t("remittance.billing.run.billingDate")} body={(r) => formatDate(r.billingDate)} />
              <Column header={t("remittance.billing.run.trigger")} body={(r) => (r.trigger === "job" ? t("remittance.billing.run.job") : r.user || t("remittance.billing.run.user"))} />
              <Column header={t("remittance.billing.fields.insurer")} body={(r) => r.insurer || t("remittance.billing.fields.allInsurers")} />
              <Column field="statements" header={t("remittance.billing.run.statements")} className="text-right" headerClassName="text-right" />
              <Column header={t("remittance.billing.columns.status")} body={(r) => <StatusChip code={r.result} label={t(`remittance.billing.run.results.${r.result}`)} />} />
              <Column field="message" header={t("remittance.billing.run.message")} />
            </DataTable>
          </div>
        ) : null}

        {tab === "mode" ? (
          <div>
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
            <Button label={t("remittance.billing.changeMode")} outlined className="mt-2" onClick={changeMode} />
            {modeResult && (
              <Message className="w-full justify-content-start mt-3" severity="info"
                text={`${modeResult.policyNumber}: ${modeResult.before} → ${modeResult.billingModeLabel}${modeResult.billingMode === "direct"
                  ? ` · commission due from the insurer ${formatCurrency(modeResult.directBill?.commissionDue || 0)}` : ` · bill ${modeResult.billNumber || "-"}`}`} />
            )}
          </div>
        ) : null}
      </Card>

      <Dialog className="direct-bill-dialog" header={viewNote ? `${viewNote.dnNumber} · ${viewNote.insurerName}` : ""} visible={!!viewNote} style={{ width: "min(1100px, 95vw)" }} onHide={closeView}>
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
              <Column field="status" header="Status" body={(r) => <StatusChip label={r.status} severity={r.status === "posted" ? "success" : "secondary"} />} />
              <Column body={(r) => (r.status === "posted" ? <Button type="button" link size="small" className="rm-link" label={t("remittance.billing.reverse")} onClick={() => reverseCollection(viewNote, r)} /> : null)} />
            </DataTable>
            <div className="action-buttons mt-3 flex flex-wrap align-items-center gap-2">
              {viewNote.statusCode === "for-approval" && viewNote.decision && !viewNote.decision.canDecide && viewNote.decision.blockedReason
                ? <EligibilityNote reason={viewNote.decision.blockedReason} className="mr-auto" /> : null}
              <Button label={t("remittance.billing.actions.print")} outlined onClick={() => printNote(viewNote)} />
              {viewNote.basis !== "direct" ? ["xlsx", "csv"].map((f) => (
                <Button key={f} label={t(`remittance.billing.export.${f}`)} icon="pi pi-download" outlined
                  onClick={() => remittanceService.download(remittanceService.statementExportPath(viewNote.id, f), `billing-statement-${viewNote.dnNumber}.${f}`).catch((e) => showError(toast, e))} />
              )) : null}
              {viewNote.statusCode === "for-approval" && viewNote.decision?.canDecide ? (
                <>
                  <Button label={t("remittance.billing.actions.reject")} outlined severity="danger" onClick={() => setDecision({ note: viewNote, action: "reject" })} />
                  <Button label={t("remittance.billing.actions.approve")} onClick={() => approve(viewNote)} />
                </>
              ) : null}
            </div>
          </>
        )}
      </Dialog>

      <ClientPaymentDialog policy={paymentPolicy} paymentModes={paymentModes} toast={toast} onClose={() => setPaymentPolicy(null)} onChanged={reloadAfterPayment} />

      <ConfirmDialog visible={!!decision} onHide={afterReason} reason={{ context: decision?.action === "cancel" ? "billing_cancel" : "billing_reject" }} severity="danger"
        title={decision ? t(`remittance.billing.${decision.action}Title`, { reference: decision.note.dnNumber }) : ""} facts={decision ? noteFacts(decision.note) : []}
        note={t("remittance.billing.releaseNote")} confirmLabel={decision ? t(`remittance.billing.actions.${decision.action}`) : ""}
        onConfirm={(reason) => (decision.action === "reject" ? remittanceService.rejectDebitNote(decision.note.id, reason) : remittanceService.cancelDebitNote(decision.note.id, reason))} />

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
              <div className="rm-strip__facts">{t("remittance.billing.collectFacts", { balance: formatCurrency(collect.note.balance), rate: round2(Number(collect.note.ewtRate) * 100) })}</div>
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
