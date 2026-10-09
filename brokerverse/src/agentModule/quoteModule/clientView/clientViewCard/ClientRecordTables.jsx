import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import policyService from "../../../../services/policyService";
import claimsService from "../../../../services/claimsService";
import policyRenewalService from "../../../../services/policyRenewalService";
import endorsementService from "../../../../services/endorsementService";
import { getRequest } from "../../../../utility/commonServices";
import onboardingService from "../../clientOnboarding/onboardingService";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { formatDate } from "../../../../utility/dateFormat";
import { notifyError } from "../../../../utility/dialogs";
import { EmptyState, FilterBar, RowActions, StatusChip } from "../../../../components/RecordPage";
import { setPolicyHolderData } from "../../../claimsModule/claimDetails/store/claimDetailsReducers";
import { getCategoriesForLob } from "../../../endorsementModule/constants/endorsementCategories";
import { stepForStatus } from "../../../claimsModule/shared/claimJourney";

/**
 * The record lists of the client view (Operations > Clients > client): policies, quotations, claims, renewals,
 * endorsements, receipts and KYC documents of one client, each as a compact table with a search box and the row actions
 * of the record (the frequent one as an icon, the others in the More actions menu).
 */

const num = { className: "bv-num", headerClassName: "bv-num" };
const actionsColumn = { className: "bv-actions", headerClassName: "bv-actions" };
const stack = (main, sub) => <span className="bv-cell-stack"><span className="bv-nowrap">{main || "—"}</span>{sub ? <small>{sub}</small> : null}</span>;
const period = (from, to) => (from || to ? `${formatDate(from, { empty: "—" })} - ${formatDate(to, { empty: "—" })}` : "—");

/** Rows of the client loaded once (again when `also` changes), a search over the given fields, and the loading / error state. */
const useClientRows = (clientId, loader, fields, also = null) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!clientId) return undefined;
    let live = true;
    setLoading(true);
    setError("");
    loader(clientId)
      .then((list) => { if (live) setRows(list); })
      .catch((e) => { if (live) { setRows([]); setError(e?.message || String(e)); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // the loader of each table is fixed; `also` is the one extra key a loader reads (the prospect of the client)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, also]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q))) : rows;
  }, [rows, search, fields]);
  return { rows, filtered, loading, error, search, setSearch };
};

/** Search box over a client table. */
const Search = ({ value, onChange, placeholder }) => (
  <FilterBar>
    <span className="p-input-icon-left bv-filter-bar__search">
      <i className="pi pi-search" />
      <InputText value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </span>
  </FilterBar>
);
Search.propTypes = { value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, placeholder: PropTypes.string.isRequired };

const tableProps = (list, empty) => ({
  value: list.filtered, loading: list.loading, size: "small", paginator: list.filtered.length > 20, rows: 20,
  emptyMessage: list.error ? <EmptyState icon="pi-exclamation-circle" title={list.error} /> : empty,
});

// ---------------------------------------------------------------- policies
const loadPolicies = async (clientId) => {
  const r = await policyService.getPolicies(1, 200, { clientId });
  if (!r.success) throw new Error(r.error);
  return (r.data?.data || []).map((p) => ({ ...p, policyId: p.policyId || p.id }));
};
const POLICY_FIELDS = ["policyNumber", "productType", "insuranceCompanyName"];

export const PolicyTab = ({ clientId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, loadPolicies, POLICY_FIELDS);
  const [endorse, setEndorse] = useState(null);

  const unpaid = (p) => ["Pending", "Reviewing"].includes(p.paymentStatus);
  const reportClaim = (p) => {
    dispatch(setPolicyHolderData({ policyHolderName: p.insuredName || p.client?.displayName || "", policyNumber: p.policyNumber, claimNumber: "" }));
    navigate("/agent/claimrequest/claimdetails/new", {
      state: { policyId: p.policyId, leadRefId: p.leadId, quoteRefId: p.quoteRefId || p.quotationId, policyRefId: p.policyId, clientId, lob: p.productType, productType: p.productType },
    });
  };
  const renew = (p) => navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${p.policyId}`, { state: { policyId: p.policyId, clientId, policy: p } });
  const categories = endorse ? getCategoriesForLob(endorse.policy.productType || endorse.policy.lob) : [];
  const startEndorsement = () => {
    const { policy, selected } = endorse;
    const lob = policy.productType || policy.lob;
    navigate(`/agent/endorsement/personaldetails/${policy.policyId}`, {
      state: { types: categories.filter((c) => selected.includes(c.key)).map((c) => c.typeId), policyId: policy.policyId, clientId, clientNumber: policy.client?.clientCode,
        clientName: policy.insuredName, lob, productType: lob },
    });
    setEndorse(null);
  };

  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.policies")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-file" title={t("client360.empty.policies")} />)} dataKey="policyId" sortField="expiry" sortOrder={-1}>
        <Column field="policyNumber" header={t("client360.col.policy")} sortable body={(p) => stack(p.policyNumber, p.lob)} />
        <Column field="productType" header={t("client360.col.productInsurer")} sortable body={(p) => stack(p.productType || p.product, p.insuranceCompanyName)} />
        <Column field="expiry" header={t("client360.col.period")} sortable body={(p) => period(p.inception || p.issuedDate, p.expiry)} />
        <Column field="grossPremium" header={t("client360.col.premium")} sortable body={(p) => formatCurrency(Number(p.grossPremium) || 0)} {...num} />
        <Column field="status" header={t("client360.col.status")} sortable body={(p) => <StatusChip status={p.status} />} />
        <Column field="paymentStatus" header={t("client360.col.payment")} sortable body={(p) => <StatusChip status={p.paymentStatus} />} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(p) => (
          <RowActions actions={[{ icon: "pi pi-eye", label: t("client360.action.viewPolicy"), onClick: () => navigate(`/agent/policydetail/${p.policyId}`) }]}
            menu={[
              { label: t("client360.action.reportClaim"), icon: "pi pi-flag", command: () => reportClaim(p), disabled: unpaid(p) },
              { label: t("client360.action.renew"), icon: "pi pi-refresh", command: () => renew(p), disabled: unpaid(p) },
              { label: t("client360.action.endorse"), icon: "pi pi-pencil", command: () => setEndorse({ policy: p, selected: [] }), disabled: unpaid(p) },
            ]} />
        )} />
      </DataTable>
      <Dialog header={t("client360.endorseHeader", { policy: endorse?.policy.policyNumber || "" })} visible={!!endorse} onHide={() => setEndorse(null)} style={{ width: "32rem" }}
        breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setEndorse(null)} />
            <Button label={t("endorsement.proceed")} icon="pi pi-arrow-right" iconPos="right" disabled={!endorse?.selected.length} onClick={startEndorsement} />
          </div>
        )}>
        {endorse ? (
          <div className="client360-endorse">
            <p className="bv-panel-note mt-0">{t("client360.endorseHint")}</p>
            {categories.map((c) => (
              <span key={c.key} className="client360-endorse__item">
                <Checkbox inputId={`end-${c.key}`} checked={endorse.selected.includes(c.key)}
                  onChange={(e) => setEndorse({ ...endorse, selected: e.checked ? [...endorse.selected, c.key] : endorse.selected.filter((k) => k !== c.key) })} />
                <label htmlFor={`end-${c.key}`}>{c.translationKey ? t(c.translationKey) : c.name}</label>
              </span>
            ))}
          </div>
        ) : null}
      </Dialog>
    </>
  );
};
PolicyTab.propTypes = { clientId: PropTypes.string.isRequired };

// ---------------------------------------------------------------- quotations
const loadQuotations = async (clientId, leadId) => {
  const calls = [getRequest("quotations", { clientId, page: 1, pageSize: 200 })];
  if (leadId) calls.push(getRequest("quotations", { leadRefId: leadId, page: 1, pageSize: 200 }));
  const seen = new Set();
  return (await Promise.all(calls)).flatMap((r) => r.data?.data || []).filter((q) => (seen.has(q.id) ? false : seen.add(q.id)));
};
const QUOTE_FIELDS = ["quotationNumber", "productType", "insuranceCompanyName", "status"];

export const QuotationTab = ({ clientId, leadId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, (id) => loadQuotations(id, leadId), QUOTE_FIELDS, leadId);
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.quotations")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-file-edit" title={t("client360.empty.quotations")} />)} dataKey="id" sortField="createdAt" sortOrder={-1}>
        <Column field="quotationNumber" header={t("client360.col.quotation")} sortable body={(q) => stack(q.quotationNumber || q.generatedQuotationId, q.lob)} />
        <Column field="productType" header={t("client360.col.productInsurer")} sortable body={(q) => stack(q.productType, q.insuranceCompanyName)} />
        <Column field="createdAt" header={t("client360.col.created")} sortable body={(q) => formatDate(q.createdAt)} />
        <Column field="grossPremium" header={t("client360.col.premium")} sortable body={(q) => formatCurrency(Number(q.grossPremium) || 0)} {...num} />
        <Column field="status" header={t("client360.col.status")} sortable body={(q) => <StatusChip status={q.status || q.quotationStatus} />} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(q) => (
          <RowActions actions={[{ icon: "pi pi-eye", label: t("client360.action.viewQuotation"), onClick: () => navigate(`/agent/quotedetailview/${q.id}`) }]}
            menu={[{ label: t("client360.action.openPolicy"), icon: "pi pi-file", command: () => navigate(`/agent/policydetail/${q.policyId}`), hidden: !q.policyId }]} />
        )} />
      </DataTable>
    </>
  );
};
QuotationTab.propTypes = { clientId: PropTypes.string.isRequired, leadId: PropTypes.string };
QuotationTab.defaultProps = { leadId: null };

// ---------------------------------------------------------------- claims
const loadClaims = async (clientId) => {
  const r = await claimsService.getClaims({ clientId });
  if (!r.success) throw new Error(r.error);
  const data = r.data?.claims || r.data || [];
  return Array.isArray(data) ? data : [];
};
const CLAIM_FIELDS = ["claimNumber", "policyNumber", "lossType", "typeOfIncident", "claimStatus"];
const CONTINUE_ROUTE = {
  review: (id) => `/agent/claimrequest/requestapproval/${id}`,
  adjuster: (id) => `/agent/claimrequest/adjustersubmission/${id}`,
  approval: (id) => `/agent/claimrequest/settlementapproval/${id}`,
};

export const ClaimTab = ({ clientId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, loadClaims, CLAIM_FIELDS);
  const next = (c) => CONTINUE_ROUTE[stepForStatus(c.lifecycleStatus)];
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.claims")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-flag" title={t("client360.empty.claims")} />)} dataKey="id" sortField="reportedDate" sortOrder={-1}>
        <Column field="claimNumber" header={t("client360.col.claim")} sortable body={(c) => stack(c.claimNumber, c.policyNumber)} />
        <Column field="dateOfIncident" header={t("client360.col.loss")} sortable body={(c) => stack(formatDate(c.dateOfIncident), c.typeOfIncident || c.lossType)} />
        <Column field="reportedDate" header={t("client360.col.reported")} sortable body={(c) => formatDate(c.reportedDate)} />
        <Column field="estimatedClaimAmount" header={t("client360.col.estimate")} sortable body={(c) => formatCurrency(Number(c.estimatedClaimAmount ?? c.estimateAmount) || 0)} {...num} />
        <Column field="claimStatus" header={t("client360.col.status")} sortable body={(c) => <StatusChip status={c.lifecycleStatus} label={c.claimStatus || c.status} />} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(c) => (
          <RowActions actions={[{ icon: "pi pi-eye", label: t("client360.action.viewClaim"), onClick: () => navigate(`/agent/claimdetail/${c.id}`) }]}
            menu={[
              { label: t("client360.action.continueClaim"), icon: "pi pi-arrow-right", command: () => navigate(next(c)(c.id), { state: { claimId: c.id, clientId } }), hidden: !next(c) },
              { label: t("client360.action.claimHistory"), icon: "pi pi-history", command: () => navigate(`/agent/claimaudittrail/${c.id}`) },
            ]} />
        )} />
      </DataTable>
    </>
  );
};
ClaimTab.propTypes = { clientId: PropTypes.string.isRequired };

// ---------------------------------------------------------------- renewals
const loadRenewals = async (clientId) => {
  const r = await policyRenewalService.getRenewals({ clientId, limit: 200 });
  if (!r.success) throw new Error(r.error);
  return r.data?.data || r.data || [];
};
const RENEWAL_FIELDS = ["renewalNumber", "policyNumber", "product", "status"];

export const RenewalTab = ({ clientId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, loadRenewals, RENEWAL_FIELDS);
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.renewals")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-refresh" title={t("client360.empty.renewals")} />)} dataKey="id" sortField="expiryDate" sortOrder={1}>
        <Column field="policyNumber" header={t("client360.col.policy")} sortable body={(r) => stack(r.policyNumber, r.renewalNumber)} />
        <Column field="product" header={t("client360.col.productInsurer")} sortable body={(r) => stack(r.product, r.insurer)} />
        <Column field="expiryDate" header={t("client360.col.expiry")} sortable body={(r) => formatDate(r.expiryDate)} />
        <Column field="currentPremium" header={t("client360.col.currentPremium")} sortable body={(r) => formatCurrency(Number(r.currentPremium) || 0)} {...num} />
        <Column field="renewalPremium" header={t("client360.col.renewalPremium")} sortable body={(r) => (r.renewalPremium ? formatCurrency(r.renewalPremium) : "—")} {...num} />
        <Column field="status" header={t("client360.col.status")} sortable body={(r) => <StatusChip status={r.statusCode} label={r.status} />} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(r) => (
          <RowActions actions={[{ icon: "pi pi-eye", label: t("client360.action.viewPolicy"), onClick: () => navigate(`/agent/policydetail/${r.policyId}`) }]}
            menu={[{ label: t("client360.action.continueRenewal"), icon: "pi pi-arrow-right", hidden: !r.isOpen,
              command: () => navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${r.policyId}`, { state: { policyId: r.policyId, clientId } }) }]} />
        )} />
      </DataTable>
    </>
  );
};
RenewalTab.propTypes = { clientId: PropTypes.string.isRequired };

// ---------------------------------------------------------------- endorsements
const loadEndorsements = async (clientId) => {
  const r = await endorsementService.getEndorsements({ clientId, perPage: 200 });
  if (!r.success) throw new Error(r.error);
  const data = r.data?.items || r.data || [];
  return Array.isArray(data) ? data : [];
};
const ENDORSEMENT_FIELDS = ["endorsementNumber", "policyNumber", "endorsementType", "status"];

export const EndorsementTab = ({ clientId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, loadEndorsements, ENDORSEMENT_FIELDS);
  const open = (e) => {
    const ref = e.endorsementId || e.id || e.endorsementNumber;
    if (!e.policyId) {
      notifyError(t("client360.endorsementNoPolicy"));
      return;
    }
    const status = String(e.status || "").toUpperCase();
    const state = { endorsementNumber: ref, policyId: e.policyId, clientId };
    if (status === "REJECTED") navigate(`/agent/endorsement/rejected/${ref}`, { state });
    else navigate(`/agent/endorsementdetailedviewonly/${ref}`, { state });
  };
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.endorsements")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-pencil" title={t("client360.empty.endorsements")} />)} dataKey="id" sortField="effectiveDate" sortOrder={-1}>
        <Column field="endorsementNumber" header={t("client360.col.endorsement")} sortable body={(e) => stack(e.endorsementNumber, e.policyNumber)} />
        <Column field="endorsementType" header={t("client360.col.type")} sortable body={(e) => t(`client360.endorsementType.${e.endorsementType}`, e.endorsementType || "—")} />
        <Column field="effectiveDate" header={t("client360.col.effective")} sortable body={(e) => formatDate(e.effectiveDate)} />
        <Column field="premiumDelta" header={t("client360.col.premiumChange")} sortable body={(e) => formatCurrency(Number(e.premiumDelta) || 0)} {...num} />
        <Column field="status" header={t("client360.col.status")} sortable body={(e) => <StatusChip status={e.status} />} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(e) => (
          <RowActions actions={[{ icon: "pi pi-eye", label: t("client360.action.viewEndorsement"), onClick: () => open(e) }]} />
        )} />
      </DataTable>
    </>
  );
};
EndorsementTab.propTypes = { clientId: PropTypes.string.isRequired };

// ---------------------------------------------------------------- receipts
const loadReceipts = async (clientId) => {
  const r = await getRequest("receipts", { clientId, page: 1, pageSize: 200 });
  return r.data?.data || [];
};
const RECEIPT_FIELDS = ["receiptNumber", "policyNumber", "paymentMode", "receiptStatus"];

export const ReceiptTab = ({ clientId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const list = useClientRows(clientId, loadReceipts, RECEIPT_FIELDS);
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.receipts")} />
      <DataTable {...tableProps(list, <EmptyState icon="pi-wallet" title={t("client360.empty.receipts")} />)} dataKey="id" sortField="receiptDate" sortOrder={-1}>
        <Column field="receiptNumber" header={t("client360.col.receipt")} sortable body={(r) => stack(r.receiptNumber, r.transactionNumber)} />
        <Column field="receiptDate" header={t("client360.col.date")} sortable body={(r) => formatDate(r.receiptDate)} />
        <Column field="policyNumber" header={t("client360.col.policy")} sortable />
        <Column field="paymentMode" header={t("client360.col.mode")} sortable body={(r) => t(`client360.paymentMode.${r.paymentMode}`, r.paymentMode || "—")} />
        <Column field="amount" header={t("client360.col.amount")} sortable body={(r) => formatCurrency(Number(r.amount) || 0)} {...num} />
        <Column field="receiptStatus" header={t("client360.col.status")} sortable body={(r) => <StatusChip status={r.status} label={r.receiptStatus} />} />
      </DataTable>
    </>
  );
};
ReceiptTab.propTypes = { clientId: PropTypes.string.isRequired };

// ---------------------------------------------------------------- KYC documents
const loadDocuments = async (clientId) => {
  const r = await getRequest(`clients/${encodeURIComponent(clientId)}/profile`);
  return r.data?.data?.documents || [];
};
const DOCUMENT_FIELDS = ["docType", "fileName", "description"];

export const DocumentTab = ({ clientId, onOnboarding }) => {
  const { t } = useTranslation();
  const list = useClientRows(clientId, loadDocuments, DOCUMENT_FIELDS);
  const open = async (d) => {
    try {
      const url = await onboardingService.documentUrl(d.storageKey);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      notifyError(e?.message || t("client360.downloadFailed"));
    }
  };
  return (
    <>
      <Search value={list.search} onChange={list.setSearch} placeholder={t("client360.search.documents")} />
      <DataTable {...tableProps(list, (
        <EmptyState icon="pi-id-card" title={t("client360.empty.documents")} text={t("client360.empty.documentsText")}
          action={<Button outlined icon="pi pi-id-card" label={t("onboarding.identification")} onClick={onOnboarding} />} />
      ))} dataKey="id">
        <Column field="docType" header={t("client360.col.document")} sortable body={(d) => stack(t(`client360.docType.${d.docType}`, d.docType || "—"), d.fileName)} />
        <Column field="relatedType" header={t("client360.col.relatesTo")} body={(d) => t(`client360.related.${d.relatedType}`, d.relatedType || "—")} />
        <Column field="expiryDate" header={t("client360.col.expiry")} sortable body={(d) => formatDate(d.expiryDate, { empty: "—" })} />
        <Column field="uploadedAt" header={t("client360.col.uploaded")} sortable body={(d) => stack(formatDate(d.uploadedAt), d.uploadedBy)} />
        <Column header={t("client360.col.actions")} {...actionsColumn} body={(d) => (
          <RowActions actions={[{ icon: "pi pi-external-link", label: t("client360.action.openDocument"), onClick: () => open(d), hidden: !d.storageKey }]} />
        )} />
      </DataTable>
    </>
  );
};
DocumentTab.propTypes = { clientId: PropTypes.string.isRequired, onOnboarding: PropTypes.func.isRequired };
