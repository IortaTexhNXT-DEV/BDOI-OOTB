import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabPanel, TabView } from "primereact/tabview";
import { lockInService as service, saveBlob } from "../../../services/dealerSchemesService";
import { hasPermission } from "../../../utils/canOpen";
import { notifyError, notifySuccess } from "../../../utility/dialogs";
import { openConfirm } from "../../../components/ConfirmDialog";
import PageHeader from "../../../components/PageHeader";
import StatusChip from "../../../components/StatusChip";
import RowActions from "../../../components/RowActions";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import { isInitiator } from "../../../components/ApprovalActions";
import { formatValue } from "../../../components/KeyValueGrid/formatValue";
import ImportDialog from "../../../components/ImportDialog";

const TABS = ["due", "held", "pending", "in-lock-in"];
const DECISIONS = ["renew", "hold", "release", "not-renewed"];
const CONTEXTS = { renew: "lockin_renew", hold: "lockin_hold", release: "lockin_release", "not-renewed": "lockin_not_renewed" };
const LOAN_SEVERITY = { current: "active", closed: "draft", "past-due": "rejected", fraud: "rejected", terminated: "rejected", "early-terminated": "rejected", "legal-dispute": "rejected" };

/**
 * Operations > Renewals > Lock-in Review (TIS-BRD-SCHM-03 FR-LCK-030 to 041, TIS-BRD-RPT-SLS-05): lock-in and Scheme 2
 * accounts reviewed 60 days before expiry (the daily job raises the review items and tasks), the decision (renew under
 * lock-in, hold to a re-review date, release to standard renewal or not for renewal, the last two approved by another
 * user), accounts whose notices are held by the TFS loan status, the TFS account status uploads and the Lock-in /
 * Scheme 2 expiry report.
 */
const LockInReview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const write = hasPermission("write:lock-in");
  const approve = hasPermission("approve:lock-in");
  const uploadRight = hasPermission("write:loan-status");
  const [tab, setTab] = useState(0);
  const [asOf, setAsOf] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [data, setData] = useState({ items: [] });
  const [counts, setCounts] = useState({});
  const [review, setReview] = useState(null);
  const [decision, setDecision] = useState({ decision: "renew", reason: null, remark: "", reReviewDate: "" });
  const [errors, setErrors] = useState({});
  const [batches, setBatches] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const query = useMemo(() => ({ tab: TABS[tab] || "due", asOf: asOf || undefined, search: search || undefined, source: source || undefined }), [tab, asOf, search, source]);
  const load = useCallback(async () => {
    if (tab > 3) return;
    try {
      const r = await service.reviews(query);
      setData(r.data || { items: [] });
      setCounts(r.counts || {});
    } catch (e) {
      notifyError(e.message);
    }
  }, [query, tab]);
  const loadBatches = useCallback(async () => {
    try {
      setBatches(await service.uploads());
    } catch (e) {
      notifyError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 4) loadBatches(); }, [tab, loadBatches]);

  const openReview = useCallback(async (reviewId) => {
    try {
      const r = await service.review(reviewId);
      setErrors({});
      setDecision({ decision: r.decision || "renew", reason: null, remark: "", reReviewDate: "" });
      setReview(r);
    } catch (e) {
      notifyError(e.message);
    }
  }, []);
  useEffect(() => {
    const id = params.get("review");
    if (id) openReview(id);
  }, [params, openReview]);

  const saveDecision = async () => {
    setErrors({});
    if (reasonProblem(decision.reason)) {
      setErrors({ reasonCode: t("lockInReview.reasonRequired", "Select the reason") });
      return;
    }
    try {
      const r = await service.decide(review.id, { decision: decision.decision, reasonCode: reasonPayload(decision.reason).reasonCode, remark: decision.remark, reReviewDate: decision.decision === "hold" ? decision.reReviewDate : undefined });
      notifySuccess(r.message);
      setReview(null);
      load();
    } catch (e) {
      const byPath = Object.fromEntries((e.errors || []).map((x) => [x.path, x.message]));
      setErrors({ ...byPath, form: e.message });
    }
  };
  const decideApproval = async (action) => {
    const done = await openConfirm({
      title: action === "approve" ? t("lockInReview.approveTitle", "Approve the decision") : t("lockInReview.returnTitle", "Return the decision"),
      severity: action === "return" ? "danger" : null,
      facts: [{ label: t("lockInReview.policy", "Policy"), value: review.account?.policyNumber }, { label: t("lockInReview.decision", "Decision"), value: review.decisionLabel },
        { label: t("lockInReview.reason", "Reason"), value: review.reason }],
      confirmLabel: action === "approve" ? t("lockInReview.approve", "Approve") : t("lockInReview.return", "Return"),
      ...(action === "return" ? { input: { type: "textarea", label: t("lockInReview.returnNote", "Reason for returning"), required: true } } : {}),
      onConfirm: (note) => service.approve(review.id, action, action === "return" ? { note } : {}),
    });
    if (!done) return;
    setReview(null);
    load();
  };
  const report = async () => {
    try {
      saveBlob(await service.report(query), `lock-in-scheme2-expiry-${data.asOf || "today"}.xlsx`);
    } catch (e) {
      notifyError(e.message);
    }
  };
  const download = async (fn, name) => {
    try {
      saveBlob(await fn(), name);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const table = (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("lockInReview.search", "Policy, insured or loan")} aria-label={t("lockInReview.search", "Policy, insured or loan")} />
        </span>
        <div className="w-12rem"><DateField id="lkr-asof" value={asOf} onChange={(e) => setAsOf(e.target.value || "")} aria-label={t("lockInReview.asOf", "As of")} /></div>
        <Dropdown value={source} aria-label={t("lockInReview.source", "Lock-in")} onChange={(e) => setSource(e.value || "")}
          options={[{ value: "", label: t("lockInReview.allSources", "All lock-ins") }, { value: "scheme1-ara", label: "Scheme 1 ARA" }, { value: "scheme2", label: "Scheme 2" },
            { value: "promotion", label: t("lockInReview.promotion", "Promotion") }]} />
      </div>
      <DataTable value={data.items || []} dataKey="policyId" size="small" stripedRows paginator rows={20} sortField="daysToExpiry" sortOrder={1}
        emptyMessage={t("lockInReview.none", "No accounts")}>
        <Column field="policyNumber" header={t("lockInReview.policy", "Policy")} sortable body={(r) => (
          <span className="bv-cell-stack"><Button link className="p-0" label={r.policyNumber} onClick={() => navigate(`/agent/policydetail/${r.policyId}`)} /><small>{r.insured}</small></span>
        )} />
        <Column field="sourceLabel" header={t("lockInReview.source", "Lock-in")} body={(r) => (
          <span className="bv-cell-stack"><span>{r.sourceLabel}</span><small>{r.yearLabel || r.reference || ""}</small></span>
        )} />
        <Column field="daysToExpiry" header={t("lockInReview.expiry", "Expiry")} sortable body={(r) => (
          <span className="bv-cell-stack"><span>{formatValue(r.expiryDate, { type: "date" })}</span><small>{t("lockInReview.days", "{{count}} days", { count: r.daysToExpiry })}</small></span>
        )} />
        <Column field="reviewDate" header={t("lockInReview.reviewDate", "Review date")} body={(r) => formatValue(r.reviewDate, { type: "date" })} />
        <Column field="loanStatus" header={t("lockInReview.loan", "TFS loan")} body={(r) => (
          <span className="bv-cell-stack"><StatusChip code={LOAN_SEVERITY[r.loanStatus] || "draft"} label={r.loanStatusLabel || "-"} /><small>{r.loanAccount}</small>
            {r.staleWarning ? <small className="bv-text-alert">{r.staleWarning}</small> : null}</span>
        )} />
        <Column header={t("lockInReview.notices", "Notices")} body={(r) => <span className="bv-nowrap" title={r.treatment?.label}>{r.treatment?.label}</span>} />
        <Column header={t("lockInReview.reviewStatus", "Review")} body={(r) => (r.reviewStatusLabel ? <StatusChip code={r.reviewStatus} label={r.reviewStatusLabel} /> : null)} />
        <Column field="owner" header={t("lockInReview.owner", "Owner")} />
        <Column header={t("common.actions", "Actions")} body={(r) => (r.reviewId ? <RowActions onView={() => openReview(r.reviewId)} /> : null)} />
      </DataTable>
    </>
  );

  const acc = review?.account || {};
  const canDecide = write && review && ["review-due", "on-hold", "returned"].includes(review.status);
  const canApprove = approve && review?.status === "pending-approval" && !isInitiator({ id: review.decidedById });
  return (
    <div className="pe-page">
      <PageHeader home={t("lockInReview.home", "Policy servicing")} section={t("lockInReview.section", "Renewals")} title={t("lockInReview.title", "Lock-in Review")}
        trail={[t("lockInReview.title", "Lock-in Review")]}>
        <Button label={t("lockInReview.report", "Lock-in / Scheme 2 expiry report")} icon="pi pi-file-excel" outlined onClick={report} />
      </PageHeader>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          {TABS.map((k) => (
            <TabPanel key={k} header={`${t(`lockInReview.tabs.${k}`, k)} (${counts[k] ?? 0})`}>{tab === TABS.indexOf(k) ? table : null}</TabPanel>
          ))}
          <TabPanel header={t("lockInReview.tabs.uploads", "Loan status uploads")}>
            {uploadRight ? (
              <div className="flex flex-wrap gap-2 align-items-center mb-3">
                <Button label={t("lockInReview.upload", "Upload loan status")} icon="pi pi-upload" outlined onClick={() => setImporting(true)} />
                <Button label={t("lockInReview.template", "Download template")} icon="pi pi-download" text onClick={() => download(service.uploadsTemplate, "TFS_Loan_Status_Upload_Template.xlsx")} />
              </div>
            ) : null}
            {result ? (
              <div className="mb-3">
                {(result.errors || []).map((x) => <div key={x.message} className="bv-text-alert">{x.message}</div>)}
                {(result.warnings || []).map((x) => <div key={x.message} className="bv-muted">{x.message}</div>)}
              </div>
            ) : null}
            <DataTable value={batches} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("lockInReview.noUploads", "No uploads yet. Upload the TFS account status file.")}>
              <Column field="batchNumber" header={t("lockInReview.batch", "Batch")} />
              <Column field="fileName" header={t("lockInReview.fileName", "File")} />
              <Column field="rowsTotal" header={t("lockInReview.rows", "Rows")} className="bv-num" headerClassName="bv-num" />
              <Column field="updated" header={t("lockInReview.updated", "Updated")} className="bv-num" headerClassName="bv-num" />
              <Column field="notChanged" header={t("lockInReview.notChanged", "Not changed")} className="bv-num" headerClassName="bv-num" />
              <Column field="failed" header={t("lockInReview.failed", "Failed")} className="bv-num" headerClassName="bv-num" />
              <Column field="noticesHeld" header={t("lockInReview.noticesHeld", "Notices held")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("lockInReview.uploadedAt", "Uploaded")} body={(b) => formatValue(b.createdAt, { type: "datetime" })} bodyClassName="bv-nowrap" />
              <Column header={t("common.actions", "Actions")} body={(b) => (b.failed ? (
                <Button icon="pi pi-download" text rounded aria-label={t("lockInReview.failedRows", "Failed rows")} tooltip={t("lockInReview.failedRows", "Failed rows")}
                  tooltipOptions={{ position: "top" }} onClick={() => download(() => service.failedRows(b.id), `${b.batchNumber}-failed.xlsx`)} />
              ) : null)} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>

      <Dialog visible={Boolean(review)} onHide={() => setReview(null)} modal style={{ width: "64rem" }} breakpoints={{ "960px": "96vw" }}
        header={review ? t("lockInReview.reviewOf", "Lock-in review: {{policy}}", { policy: acc.policyNumber }) : ""}
        footer={(
          <div className="flex gap-2 justify-content-end">
            {canApprove ? <Button label={t("lockInReview.return", "Return")} icon="pi pi-undo" severity="danger" outlined onClick={() => decideApproval("return")} /> : null}
            {canApprove ? <Button label={t("lockInReview.approve", "Approve")} icon="pi pi-check" onClick={() => decideApproval("approve")} /> : null}
            <Button label={t("common.close", "Close")} text onClick={() => setReview(null)} />
            {canDecide ? <Button label={t("lockInReview.saveDecision", "Save decision")} icon="pi pi-save" onClick={saveDecision} /> : null}
          </div>
        )}>
        {review ? (
          <>
            <DetailSection title={t("lockInReview.account", "Account")}>
              <KeyValueGrid columns={4} items={[
                { label: t("lockInReview.reviewStatus", "Review"), value: <StatusChip code={review.status} label={review.statusLabel} /> },
                { label: t("lockInReview.insured", "Insured"), value: acc.insured },
                { label: t("lockInReview.insurer", "Insurer"), value: acc.insurer },
                { label: t("lockInReview.expiry", "Expiry"), value: acc.expiryDate, type: "date" },
                { label: t("lockInReview.source", "Lock-in"), value: `${acc.sourceLabel || ""} ${acc.reference || ""}`.trim() },
                { label: t("lockInReview.year", "Lock-in year"), value: acc.yearLabel },
                { label: t("lockInReview.lockInEnd", "Lock-in ends"), value: acc.lockInEnd, type: "date" },
                { label: t("lockInReview.notices", "Notices"), value: acc.treatment?.label },
                { label: t("lockInReview.loan", "TFS loan"), value: [acc.loanAccount, acc.loanStatusLabel].filter(Boolean).join(" - ") },
                { label: t("lockInReview.loanDate", "Loan status date"), value: acc.loanStatusDate, type: "date" },
                { label: t("lockInReview.vehicle", "Vehicle"), value: acc.unit },
                { label: t("lockInReview.premium", "Premium"), value: formatValue(acc.premium, { type: "amount" }) },
                { label: t("lockInReview.decision", "Decision"), value: review.decisionLabel, hidden: !review.decision },
                { label: t("lockInReview.reason", "Reason"), value: [review.reason, review.remark].filter(Boolean).join(": "), hidden: !review.reason, span: 2 },
                { label: t("lockInReview.returnNote", "Reason for returning"), value: review.returnNote, hidden: !review.returnNote, span: 2 },
              ]} />
            </DetailSection>
            {canDecide ? (
              <DetailSection className="mt-3" title={t("lockInReview.decision", "Decision")}>
                <div className="grid formgrid p-fluid">
                  <div className="field col-12 md:col-4">
                    <label htmlFor="lkr-decision">{t("lockInReview.decision", "Decision")}</label>
                    <Dropdown inputId="lkr-decision" value={decision.decision} onChange={(e) => setDecision((d) => ({ ...d, decision: e.value, reason: null }))}
                      options={DECISIONS.map((d) => ({ value: d, label: t(`lockInReview.decisions.${d}`, d) }))} />
                    <FieldError error={errors.decision} />
                  </div>
                  {decision.decision === "hold" ? (
                    <div className="field col-12 md:col-4">
                      <label htmlFor="lkr-rereview">{t("lockInReview.reReviewDate", "Re-review date")}</label>
                      <DateField id="lkr-rereview" value={decision.reReviewDate} onChange={(e) => setDecision((d) => ({ ...d, reReviewDate: e.target.value }))} />
                      <FieldError error={errors.reReviewDate} />
                    </div>
                  ) : null}
                  <div className="field col-12">
                    <ReasonPicker key={decision.decision} context={CONTEXTS[decision.decision]} value={decision.reason} onChange={(v) => setDecision((d) => ({ ...d, reason: v }))} showErrors={Boolean(errors.reasonCode)} />
                    <FieldError error={errors.reasonCode} />
                  </div>
                  <div className="field col-12">
                    <label htmlFor="lkr-remark">{t("lockInReview.remark", "Remark (at least 10 characters)")}</label>
                    <InputText id="lkr-remark" value={decision.remark} onChange={(e) => setDecision((d) => ({ ...d, remark: e.target.value }))} invalid={Boolean(errors.remark)} />
                    <FieldError error={errors.remark} />
                  </div>
                </div>
                {errors.form ? <FieldError error={errors.form} /> : null}
              </DetailSection>
            ) : null}
            {review.loanHistory?.length ? (
              <DetailSection className="mt-3" title={t("lockInReview.loanHistory", "Loan status history")}>
                <DataTable value={review.loanHistory} size="small" stripedRows>
                  <Column header={t("lockInReview.statusDate", "Status date")} body={(h) => formatValue(h.status_date, { type: "date" })} />
                  <Column header={t("lockInReview.change", "Change")} body={(h) => `${h.from_status || "-"} > ${h.to_status}`} />
                  <Column field="source" header={t("lockInReview.by", "Source")} />
                  <Column field="remark" header={t("lockInReview.remarkShort", "Remark")} />
                </DataTable>
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </Dialog>
      <ImportDialog visible={importing} onHide={() => setImporting(false)} title={t("lockInReview.upload", "Upload loan status")} accept=".xlsx"
        fileTypes={t("lockInReview.fileTypes", "Excel workbook (.xlsx)")}
        targets={[{ label: t("lockInReview.tabs.uploads", "Loan status uploads"), templatePath: "/lock-in/uploads/template", uploadPath: "/lock-in/uploads" }]}
        onUploaded={(r) => { setResult(r); loadBatches(); }} />
    </div>
  );
};

export default LockInReview;
