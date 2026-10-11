import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { schemeIssuanceService as service } from "../../services/dealerSchemesService";
import mastersService from "../../services/mastersService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { openConfirm } from "../../components/ConfirmDialog";
import PageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { isInitiator } from "../../components/ApprovalActions";
import { formatValue } from "../../components/KeyValueGrid/formatValue";
import { ApplicationDialog } from "./SchemeIssuance";

const amount = (v) => formatValue(v, { type: "amount" });
const OPEN = ["documents-pending", "ready", "declined"];

/**
 * Operations > Sales & Marketing > Scheme Issuance > Application (TIS-BRD-SCHM-01): the application with its pricing,
 * the document checklist (upload, received with a remark, waiver with approval by another user), the placement to the
 * insurer, the policy and the cancellation.
 */
const SchemeApplication = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const write = hasPermission("write:scheme-issuance");
  const approve = hasPermission("approve:scheme-issuance");
  const issueRight = hasPermission("write:policies");
  const [a, setA] = useState(null);
  const [editing, setEditing] = useState(false);
  const [insurers, setInsurers] = useState([]);
  const fileInput = useRef(null);
  const [uploadFor, setUploadFor] = useState(null);

  const load = useCallback(async () => {
    try {
      setA(await service.get(id));
    } catch (e) {
      notifyError(e.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    mastersService.options("insurance-company").then((ins) => setInsurers(ins.map((x) => ({ value: Number(x.id), label: x.label })))).catch(() => setInsurers([]));
  }, []);

  const run = async (fn, ok) => {
    try {
      const r = await fn();
      notifySuccess(r?.message || ok);
      if (r?.warning) notifyError(r.warning);
      await load();
      return r;
    } catch (e) {
      notifyError(e.message);
      return null;
    }
  };
  const facts = a ? [
    { label: t("schemeIssuance.number", "Application"), value: a.applicationNumber },
    { label: t("schemeIssuance.borrowerName", "Borrower"), value: a.borrowerName },
    { label: t("schemeIssuance.loanAccount", "TFS loan account"), value: a.loanAccount },
  ] : [];
  const ask = (title, label, onConfirm, extra = {}) => openConfirm({ title, facts, confirmLabel: label, onConfirm, ...extra }).then((done) => (done ? load() : null));

  const pickFile = (item) => {
    setUploadFor(item);
    fileInput.current?.click();
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadFor) return;
    await run(() => service.uploadItem(a.id, uploadFor.id, file));
  };
  const itemActions = (i) => {
    if (!a || !OPEN.includes(a.status)) return null;
    const out = [];
    if (write && i.status === "pending") {
      out.push(<Button key="up" icon="pi pi-upload" text size="small" label={t("schemeIssuance.uploadFile", "Upload")} onClick={() => pickFile(i)} />);
      if (!i.kyc) {
        out.push(<Button key="rc" icon="pi pi-check" text size="small" label={t("schemeIssuance.received", "Received")} onClick={() => ask(t("schemeIssuance.receivedTitle", "Received without a file"),
          t("schemeIssuance.received", "Received"), (remark) => service.itemAct(a.id, i.id, "receive", { remark }), { input: { type: "textarea", label: t("schemeIssuance.remark", "Remark"), required: true } })} />);
      }
      if (i.canWaive) {
        out.push(<Button key="wv" icon="pi pi-flag" text size="small" label={t("schemeIssuance.waive", "Request waiver")} onClick={() => ask(t("schemeIssuance.waiveTitle", "Request a waiver"),
          t("schemeIssuance.waive", "Request waiver"), (reason) => service.itemAct(a.id, i.id, "waive", { reason }), { input: { type: "textarea", label: t("schemeIssuance.reason", "Reason"), required: true } })} />);
      }
    }
    if (write && ["received", "waived"].includes(i.status)) {
      out.push(<Button key="ro" icon="pi pi-replay" text size="small" label={t("schemeIssuance.reopen", "Reopen")} onClick={() => ask(t("schemeIssuance.reopenTitle", "Reopen the document"),
        t("schemeIssuance.reopen", "Reopen"), (remark) => service.itemAct(a.id, i.id, "reopen", { remark }), { input: { type: "textarea", label: t("schemeIssuance.remark", "Remark"), required: true } })} />);
    }
    if (approve && i.status === "waiver-requested" && !isInitiator({ id: i.waiverRequestedById })) {
      out.push(<Button key="wa" icon="pi pi-check-circle" text size="small" label={t("schemeIssuance.approveWaiver", "Approve waiver")}
        onClick={() => ask(t("schemeIssuance.approveWaiverTitle", "Approve the waiver"), t("schemeIssuance.approveWaiver", "Approve waiver"), () => service.decideWaiver(a.id, i.id, "approve", {}))} />);
      out.push(<Button key="wr" icon="pi pi-times-circle" text size="small" severity="danger" label={t("schemeIssuance.rejectWaiver", "Reject waiver")}
        onClick={() => ask(t("schemeIssuance.rejectWaiverTitle", "Reject the waiver"), t("schemeIssuance.rejectWaiver", "Reject waiver"), (note) => service.decideWaiver(a.id, i.id, "reject", { note }),
          { severity: "danger", input: { type: "textarea", label: t("schemeIssuance.reason", "Reason"), required: true } })} />);
    }
    return <span className="flex flex-wrap gap-1">{out}</span>;
  };

  if (!a) return <div className="pe-page" />;
  const y1 = a.pricing?.year1;
  return (
    <div className="pe-page">
      <PageHeader home={t("distribution.home.sales", "Sales & Marketing")} section={t("schemeIssuance.title", "Scheme Issuance")} title={a.applicationNumber}
        onBack={() => navigate("/sales/scheme-issuance")}>
        {write && ["draft", ...OPEN].includes(a.status) ? <Button label={t("schemeIssuance.edit", "Edit")} icon="pi pi-pencil" outlined onClick={() => setEditing(true)} /> : null}
        {write && a.status === "ready" ? <Button label={t("schemeIssuance.send", "Send to insurer")} icon="pi pi-send"
          onClick={() => ask(t("schemeIssuance.sendTitle", "Send to the insurer"), t("schemeIssuance.send", "Send to insurer"), () => service.sendToInsurer(a.id))} /> : null}
        {write && a.status === "sent" ? <Button label={t("schemeIssuance.decline", "Insurer declined")} icon="pi pi-times" outlined severity="danger"
          onClick={() => ask(t("schemeIssuance.declineTitle", "The insurer declined"), t("schemeIssuance.decline", "Insurer declined"), (reason) => service.decline(a.id, { reason }),
            { severity: "danger", input: { type: "textarea", label: t("schemeIssuance.reason", "Reason"), required: true } })} /> : null}
        {write && a.status === "declined" ? <Button label={t("schemeIssuance.changeInsurer", "Change insurer")} icon="pi pi-sync" outlined
          onClick={() => ask(t("schemeIssuance.changeInsurerTitle", "Another insurer of the scheme"), t("schemeIssuance.changeInsurer", "Change insurer"),
            (insuranceCompanyId) => service.changeInsurer(a.id, { insuranceCompanyId }),
            { input: { type: "select", label: t("schemeIssuance.insurer", "Insurer"), required: true, options: insurers.filter((i) => i.value !== a.insuranceCompanyId) } })} /> : null}
        {write && issueRight && a.status === "sent" ? <Button label={t("schemeIssuance.issue", "Issue policy")} icon="pi pi-verified"
          onClick={() => ask(t("schemeIssuance.issueTitle", "Issue the policy"), t("schemeIssuance.issue", "Issue policy"), () => service.issue(a.id))} /> : null}
        {(write && a.status !== "sent") || approve ? (["issued", "cancelled"].includes(a.status) ? null : (
          <Button label={t("schemeIssuance.cancel", "Cancel application")} icon="pi pi-ban" text severity="danger"
            onClick={() => ask(t("schemeIssuance.cancelTitle", "Cancel the application"), t("schemeIssuance.cancel", "Cancel application"),
              (why) => service.cancel(a.id, { reasonCode: why?.reasonCode, reason: why?.note || undefined }), { severity: "danger", reason: { context: "scheme_application_cancel" } })} />
        )) : null}
      </PageHeader>

      {a.problems?.length ? (
        <div className="pe-card bv-text-alert mb-3">
          <strong>{t("schemeIssuance.draftBecause", "Draft until these are corrected:")}</strong>
          <ul className="m-0">{a.problems.map((p) => <li key={`${p.path}-${p.message}`}>{p.message}</li>)}</ul>
        </div>
      ) : null}

      <div className="pe-card">
        <DetailSection title={t("schemeIssuance.application", "Application")}>
          <KeyValueGrid columns={4} items={[
            { label: t("schemeIssuance.status", "Status"), value: <StatusChip code={a.status} label={a.statusLabel} /> },
            { label: t("schemeIssuance.scheme", "Scheme"), value: a.schemeNo ? `${a.schemeNo} (${a.schemeTypeLabel || ""})` : null },
            { label: t("schemeIssuance.loanAccount", "TFS loan account"), value: a.loanAccount },
            { label: t("schemeIssuance.bank", "Financing bank"), value: a.bankName },
            { label: t("schemeIssuance.bookingDate", "Loan booking date"), value: a.bookingDate, type: "date" },
            { label: t("schemeIssuance.loanTerm", "Loan term (months)"), value: a.loanTermMonths },
            { label: t("schemeIssuance.releaseDate", "Vehicle release date"), value: a.releaseDate, type: "date" },
            { label: t("schemeIssuance.kycSource", "KYC source"), value: a.kycSourceLabel },
            { label: t("schemeIssuance.borrowerName", "Borrower"), value: a.borrowerName },
            { label: t("schemeIssuance.idType", "ID type"), value: [a.borrower?.idType, a.borrower?.idNumber].filter(Boolean).join(" ") },
            { label: t("schemeIssuance.dealer", "Dealer"), value: a.dealerName },
            { label: t("schemeIssuance.vehicle", "Vehicle"), value: a.vehicleLabel },
            { label: t("schemeIssuance.chassis", "Chassis number"), value: a.chassisNumber },
            { label: t("schemeIssuance.invoicePrice", "Invoice price (sum insured year 1)"), value: amount(a.invoicePrice) },
            { label: t("schemeIssuance.insurer", "Insurer"), value: a.insurerName },
            { label: t("schemeIssuance.ara", "Auto Renewal Agreement"), value: a.araSignedOn ? `${formatValue(a.araSignedOn, { type: "date" })}, ${a.araPaymentMode}` : a.araPaymentMode },
            { label: t("schemeIssuance.placement", "Placement slip"), value: a.placementNumber, hidden: !a.placementNumber },
            { label: t("schemeIssuance.policy", "Policy"), value: a.policyNumber ? <Button link className="p-0" label={a.policyNumber} onClick={() => navigate(`/agent/policydetail/${a.policyId}`)} /> : null, hidden: !a.policyNumber },
            { label: t("schemeIssuance.declineReason", "Decline reason"), value: a.declineReason, hidden: !a.declineReason, span: 2 },
            { label: t("schemeIssuance.cancelReason", "Cancellation reason"), value: a.cancelReason, hidden: !a.cancelReason, span: 2 },
          ]} />
        </DetailSection>

        {a.pricing ? (
          <DetailSection className="mt-3" title={t("schemeIssuance.pricing", "Premium from the scheme")}>
            <KeyValueGrid columns={4} items={[
              { label: t("schemeIssuance.line", "Scheme line"), value: a.pricing.line },
              { label: t("schemeIssuance.policyYears", "Policy years"), value: a.pricing.policyYears },
              { label: t("schemeIssuance.year1Payer", "Year 1 paid by"), value: a.pricing.payerLabel },
              { label: t("schemeIssuance.premium", "Year 1 premium"), value: amount(y1?.grossPremium) },
            ]} />
            <DataTable value={a.pricing.schedule} dataKey="year" size="small" stripedRows className="mt-2">
              <Column field="year" header={t("schemeIssuance.year", "Year")} />
              {["sumInsured", "netPremium", "vat", "dst", "lgt", "ctpl", "grossPremium", "commission", "dealerShare"].map((k) => (
                <Column key={k} header={t(`schemeMaster.pv.${k}`, k)} body={(y) => amount(y[k])} className="bv-num" headerClassName="bv-num" />
              ))}
              <Column field="whoPays" header={t("schemeMaster.whoPays", "Who pays")} />
            </DataTable>
          </DetailSection>
        ) : null}

        <DetailSection className="mt-3" title={t("schemeIssuance.checklist", "Document checklist")}>
          <div className="mb-2">{t("schemeIssuance.gate", "{{in}} of {{required}} required documents in", a.gate || { in: 0, required: 0 })}</div>
          <DataTable value={a.items || []} dataKey="id" size="small" stripedRows emptyMessage={t("schemeIssuance.noItems", "The checklist is built once the application is complete")}>
            <Column field="document" header={t("schemeIssuance.document", "Document")} body={(i) => (
              <span className="bv-cell-stack"><span>{i.document}</span><small>{[i.kyc ? "KYC" : null, i.required ? t("schemeIssuance.required", "Required") : t("schemeIssuance.optional", "Optional")].filter(Boolean).join(" · ")}</small></span>
            )} />
            <Column header={t("schemeIssuance.status", "Status")} body={(i) => <StatusChip code={i.status === "received" || i.status === "waived" ? "active" : i.status === "waiver-requested" ? "pending-approval" : "draft"} label={i.statusLabel} />} />
            <Column header={t("schemeIssuance.fileOrRemark", "File / remark")} body={(i) => i.fileName || i.remark || i.waiverReason || ""} />
            <Column header={t("common.actions", "Actions")} body={itemActions} />
          </DataTable>
          {write && OPEN.includes(a.status) ? (
            <Button className="mt-2" label={t("schemeIssuance.addDocument", "Add a document")} icon="pi pi-plus" text
              onClick={() => ask(t("schemeIssuance.addDocument", "Add a document"), t("schemeIssuance.addConfirm", "Add"), (document) => service.addItem(a.id, { document }),
                { input: { type: "text", label: t("schemeIssuance.document", "Document"), required: true } })} />
          ) : null}
          <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={onFile} aria-label={t("schemeIssuance.uploadFile", "Upload")} />
        </DetailSection>
      </div>
      {editing ? <ApplicationDialog value={a} onHide={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} /> : null}
    </div>
  );
};

export default SchemeApplication;
