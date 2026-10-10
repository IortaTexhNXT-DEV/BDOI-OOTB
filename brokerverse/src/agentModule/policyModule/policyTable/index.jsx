import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import DetailDialog from "../../../components/DetailDialog";
import KeyValueGrid from "../../../components/KeyValueGrid";
import { Menu } from "primereact/menu";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { Tag } from "primereact/tag";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import "../../policyModule/index.scss";
import policyService from "../../../services/policyService";
import { extractPolicyListFromResponse } from "../store/policyMiddleWare";
import StatusBadge from "../../../components/StatusBadge";
import { getCategoriesForLob, MOTOR_CATEGORIES } from "../../endorsementModule/constants/endorsementCategories";
import { calendarDateFormat, formatDate as formatAppDate, toDate } from "../../../utility/dateFormat";
import useMasterOptions from "../../../module/GeneralMasters/common/useMasterOptions";
import { useListState, useServerList } from "../../../hooks/useServerList";

// Legacy export for backward compatibility (Motor categories)
export const categories = MOTOR_CATEGORIES;

const NO_FILTERS = {
  paymentStatus: "", productType: "", insuranceCompanyName: "", clientName: "",
  issuedDateFrom: null, issuedDateTo: null, expiryDateFrom: null, expiryDateTo: null, premiumMin: null, premiumMax: null,
};
const DATE_FILTERS = ["issuedDateFrom", "issuedDateTo", "expiryDateFrom", "expiryDateTo"];

const daysTo = (value) => {
  const d = toDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
};

/**
 * Operations > Policies list: paged, searched (policy number, insured, client, plate / chassis / motor number) and
 * filtered by the server. The search, applied filters and page are kept while a policy is opened.
 */
const PolicyTable = ({ filterExpiredOnly = false, setDisplayDialog, displayDialog }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const menu = useRef(null);
  const [state, patch] = useListState(filterExpiredOnly ? "policies-expired" : "policies", { search: "", applied: NO_FILTERS, showFilters: false });
  // filters being edited in the panel; they reach the server with Apply
  const [draft, setDraft] = useState(state.applied);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [menuPolicy, setMenuPolicy] = useState(null);
  const insurers = useMasterOptions("insurance-company");

  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const applied = { ...state.applied };
    DATE_FILTERS.forEach((k) => { applied[k] = applied[k] ? toDate(applied[k]) : null; });
    if (filterExpiredOnly && !applied.expiryDateTo) {
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      applied.expiryDateTo = soon;
    }
    const res = await policyService.getPolicies(page, pageSize, { ...applied, query: state.search.trim() });
    if (!res.success) throw new Error(res.error);
    const { policies, total } = extractPolicyListFromResponse(res.data, page, pageSize);
    return { rows: policies.map((p) => policyService.transformPolicyData(p)), total };
  }, [state.applied, state.search, filterExpiredOnly]);
  const list = useServerList(fetchPage, { key: filterExpiredOnly ? "policies-expired" : "policies" });

  const paymentStatusOptions = [
    { label: t("policyList.all"), value: "" },
    { label: t("policyList.completed"), value: "Completed" },
    { label: t("policyList.pending"), value: "Pending" },
    { label: t("policyList.reviewing"), value: "Reviewing" },
    { label: t("policyList.failed"), value: "Failed" },
  ];
  const productTypeOptions = [
    { label: t("policyList.all"), value: "" },
    { label: t("policyList.motorComprehensive"), value: "Motor Comprehensive" },
    { label: t("policyList.motorCTPL"), value: "Motor CTPL" },
    { label: t("policyList.motorThirdParty"), value: "Motor Third Party" },
    { label: t("policyList.fireAndAlliedPerils"), value: "Fire and Allied Perils" },
  ];
  const insurerOptions = [{ label: t("policyList.all"), value: "" }, ...insurers.map((i) => ({ label: i.label, value: i.label }))];
  const setDraftField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const applyFilters = () => patch({ applied: draft });
  const clearFilters = () => {
    setDraft(NO_FILTERS);
    patch({ applied: NO_FILTERS, search: "" });
  };
  const activeFilters = Object.entries(state.applied).filter(([, v]) => v !== "" && v !== null && v !== undefined).length;

  // ------------------------------------------------------------------ row actions
  const policyIdOf = (p) => p?.policyId || p?.policy_id || p?.id;
  const lobOf = (p) => p?.ProductDescription || p?.productType || p?.quotation?.productType || null;
  const viewPolicy = (p) => { const id = policyIdOf(p); if (id) navigate(`/agent/policydetail/${id}`); };
  const startClaim = (p) => {
    const lob = lobOf(p);
    navigate("/agent/claimrequest/claimdetails/new", {
      state: { policyId: policyIdOf(p), leadRefId: p?.leadId || p?.lead?.id, quoteRefId: p?.quoteId || p?.quotation?.id, policyRefId: policyIdOf(p), lob, productType: lob },
    });
  };
  const startRenewal = (p) => {
    const lob = lobOf(p);
    navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${policyIdOf(p)}`, {
      state: { policyId: policyIdOf(p), policyNumber: p?.policyNumber, insuredName: p?.insuredName, ...(lob && { lob, productType: lob }) },
    });
  };
  const startEndorsement = (p) => {
    const lob = lobOf(p);
    setDisplayDialog({ display: true, policyId: policyIdOf(p), lob, productType: lob, policyNumber: p?.policyNumber, insuredName: p?.insuredName });
  };
  const inForce = (p) => {
    const status = String(p?.status || "").toLowerCase();
    const days = daysTo(p?.PolicyExpiry || p?.expiry);
    return !["expired", "lapsed", "cancelled", "renewed"].includes(status) && !(days !== null && days < 0);
  };
  const unpaid = (p) => ["Pending", "Reviewing"].includes(p?.Payment);
  const menuItems = menuPolicy ? [
    { label: t("policyList.claim", { defaultValue: "Claim" }), icon: "pi pi-exclamation-circle", command: () => startClaim(menuPolicy), disabled: unpaid(menuPolicy) },
    ...(filterExpiredOnly ? [{ label: t("policyList.renewal", { defaultValue: "Renewal" }), icon: "pi pi-refresh", command: () => startRenewal(menuPolicy) }] : []),
    ...(inForce(menuPolicy) ? [{ label: t("policyDetail.endorsement"), icon: "pi pi-file-edit", command: () => startEndorsement(menuPolicy), disabled: unpaid(menuPolicy) }] : []),
  ] : [];

  const actions = (p) => (
    <div className="flex gap-1 justify-content-end">
      <Button icon="pi pi-eye" text rounded size="small" aria-label={t("policyList.viewPolicy", { defaultValue: "View policy" })} tooltip={t("policyList.viewPolicy", { defaultValue: "View policy" })}
        tooltipOptions={{ position: "top" }} onClick={() => viewPolicy(p)} />
      <Button icon="pi pi-ellipsis-v" text rounded size="small" aria-label={t("policyList.moreActions", { defaultValue: "More actions" })} tooltip={t("policyList.moreActions", { defaultValue: "More actions" })}
        tooltipOptions={{ position: "top" }} aria-haspopup onClick={(e) => { setMenuPolicy(p); menu.current.toggle(e); }} />
    </div>
  );

  const expiry = (p) => {
    const value = p.PolicyExpiry || p.expiry;
    const days = daysTo(value);
    const note = days === null ? null : days < 0 ? t("policyList.expired", { defaultValue: "Expired" }) : days <= 5 ? t("policyList.expiresInDays", { count: days, defaultValue: "Expires in {{count}} day(s)" }) : null;
    return (
      <span className="nowrap">
        {formatAppDate(value, { empty: "-" })}
        {note && <span className="bv-cell-sub">{note}</span>}
      </span>
    );
  };

  // ------------------------------------------------------------------ endorsement dialog
  const endorsementLob = displayDialog?.lob || displayDialog?.productType || null;
  const endorsementCategories = getCategoriesForLob(endorsementLob);
  const selectedTypes = () => endorsementCategories.filter((cat) => selectedCategories.some((s) => s.key === cat.key)).map((cat) => cat.typeId);
  const hideDialog = () => setDisplayDialog({ display: false, policyId: null, lob: null, productType: null });
  const proceed = () => {
    const types = selectedTypes();
    const policyId = displayDialog.policyId;
    hideDialog();
    navigate(`/agent/endorsement/personaldetails/${policyId}`, { state: { types, lob: endorsementLob, productType: endorsementLob } });
  };
  const toggleCategory = (e) => setSelectedCategories((list) => (e.checked ? [...list, e.value] : list.filter((c) => c.key !== e.value.key)));

  const field = (label, control) => (
    <div className="col-12 md:col-6 lg:col-3">
      <label className="block mb-2">{label}</label>
      {control}
    </div>
  );

  return (
    <div>
      <div className="bv-list-toolbar">
        <span className="p-input-icon-left bv-list-search">
          <i className="pi pi-search" />
          <InputText placeholder={t("policyTable.search")} aria-label={t("policyTable.search")} value={state.search} onChange={(e) => patch({ search: e.target.value })} />
        </span>
        <Button label={state.showFilters ? t("policyTable.hideFilters") : t("policyTable.showFilters")} icon="pi pi-filter" outlined badge={activeFilters ? String(activeFilters) : undefined}
          onClick={() => patch({ showFilters: !state.showFilters })} />
        {activeFilters > 0 && <Button label={t("policyTable.clearFilters")} icon="pi pi-times" text onClick={clearFilters} />}
      </div>

      {state.showFilters && (
        <div className="filter-container-bg p-3 mb-3 border-round">
          <div className="grid">
            {field(t("policyTable.paymentStatus"), <Dropdown value={draft.paymentStatus} onChange={(e) => setDraftField("paymentStatus", e.value)} options={paymentStatusOptions} className="w-full" />)}
            {field(t("policyTable.productType"), <Dropdown value={draft.productType} onChange={(e) => setDraftField("productType", e.value)} options={productTypeOptions} className="w-full" />)}
            {field(t("policyTable.insuranceCompany"), <Dropdown value={draft.insuranceCompanyName} onChange={(e) => setDraftField("insuranceCompanyName", e.value)} options={insurerOptions} filter className="w-full" />)}
            {field(t("policyTable.clientName"), <InputText value={draft.clientName} onChange={(e) => setDraftField("clientName", e.target.value)} className="w-full" />)}
            {DATE_FILTERS.map((k) => (
              <React.Fragment key={k}>
                {field(t(`policyTable.${k}`), <Calendar value={draft[k] ? toDate(draft[k]) : null} onChange={(e) => setDraftField(k, e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />)}
              </React.Fragment>
            ))}
            {field(t("policyTable.premiumMin"), <InputNumber value={draft.premiumMin} onValueChange={(e) => setDraftField("premiumMin", e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" />)}
            {field(t("policyTable.premiumMax"), <InputNumber value={draft.premiumMax} onValueChange={(e) => setDraftField("premiumMax", e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" />)}
            <div className="col-12 flex gap-2 justify-content-end">
              <Button label={t("policyTable.clearFilters")} icon="pi pi-times" outlined onClick={clearFilters} />
              <Button label={t("policyTable.applyFilters")} icon="pi pi-check" onClick={applyFilters} />
            </div>
          </div>
        </div>
      )}

      <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
      <DataTable {...list.tableProps} scrollable dataKey="id" size="small" stripedRows className="corrections__table__main" emptyMessage={t("listCommon.noRecords")}>
        <Column header={t("policyTable.policyNumber")} body={(p) => <span className="nowrap">{p.policyNumber?.toUpperCase() || "-"}</span>} />
        <Column header={t("policyTable.clientId")} body={(p) => <span className="nowrap">{p.ClientCode}</span>} />
        <Column header={t("policyTable.clientNameHeader")} body={(p) => p.ClientName} style={{ minWidth: "11rem" }} />
        <Column header={t("policyTable.grossPremiumHeader")} body={(p) => formatCurrency(p.grossPremium)} />
        <Column header={t("policyTable.policyIssued")} body={(p) => formatAppDate(p.PolicyIssued, { empty: "-" })} />
        <Column header={t("policyTable.policyExpiry")} body={expiry} />
        <Column header={t("policyTable.productDescription")} body={(p) => p.ProductDescription || "-"} />
        {!filterExpiredOnly && <Column header={t("policyTable.payment")} body={(p) => <StatusBadge status={p.Payment || "Pending"} type="payment" showTooltip={false} />} />}
        {filterExpiredOnly && <Column header={t("policyTable.status", { defaultValue: "Status" })} body={(p) => <Tag value={p.status} severity="secondary" />} />}
        <Column header={t("policyTable.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" frozen alignFrozen="right" />
      </DataTable>

      <DetailDialog visible={!!displayDialog?.display} onHide={hideDialog} size="md"
        header={displayDialog?.policyNumber ? `${t("policyDetail.endorsement")} · ${displayDialog.policyNumber}` : t("policyDetail.endorsement")}
        footer={(
          <>
            <Button label={t("policyTable.cancel")} text onClick={hideDialog} />
            <Button label={t("policyTable.startEndorsement")} icon="pi pi-arrow-right" iconPos="right" onClick={proceed} disabled={!selectedTypes().length} />
          </>
        )}>
        <KeyValueGrid columns={2} className="mb-3" items={[
          { label: t("policyTable.policyNumber"), value: displayDialog?.policyNumber },
          { label: t("policyTable.insured"), value: displayDialog?.insuredName },
        ]} />
        <fieldset className="endorsement-types">
          <legend>{t("policyTable.endorsementTypes")}</legend>
          {endorsementCategories.map((category) => (
            <div key={category.key} className="endorsement-types__option">
              <Checkbox inputId={category.key} name="category" value={category} onChange={toggleCategory} checked={selectedCategories.some((item) => item.key === category.key)} />
              <label htmlFor={category.key}>{category.translationKey ? t(category.translationKey) : category.name}</label>
            </div>
          ))}
        </fieldset>
      </DetailDialog>
    </div>
  );
};

export default PolicyTable;
