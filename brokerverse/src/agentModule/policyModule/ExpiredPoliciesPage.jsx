import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import BatchRenewalService from "../../services/batchRenewalService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import StatCards from "../../components/StatCards";
import { EmptyState, FilterBar, PageHeader, RowActions, SectionCard, StatusChip } from "../../components/RecordPage";
import { calendarDateFormat, formatDate, toIsoDate } from "../../utility/dateFormat";
import "./index.scss";

const STATES = ["due", "grace", "lapsed", "in-progress", "renewed", "closed"];
const STATE_SEVERITY = { due: "info", grace: "warning", lapsed: "warning", "in-progress": "info", renewed: "success", closed: "secondary" };

/**
 * Renewals > Renewal Policy: policies expiring in the window (and expired ones still renewable), each with its renewal
 * state and the action that fits it: renew, continue a renewal in progress, open the new policy of a renewed one. A
 * policy whose renewal window has closed is quoted as new business.
 */
const ExpiredPoliciesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const [range, setRange] = useState(null);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // the default window comes from the renewal settings: expired within the lapsed-renewal window up to the pipeline
  useEffect(() => {
    BatchRenewalService.getRenewalOptions()
      .then((o) => {
        const from = new Date();
        from.setDate(from.getDate() - (Number(o.graceDays || 0) + Number(o.lapsedRenewalDays || 0)));
        const to = new Date();
        to.setDate(to.getDate() + Number(o.pipelineDays || 90));
        setRange([from, to]);
      })
      .catch(() => setRange([]));
  }, []);

  const [from, to] = range || [];
  const load = useCallback(async () => {
    if (range === null || (from && !to)) return;
    setLoading(true);
    setError("");
    try {
      setRows(await BatchRenewalService.getRenewablePolicies({
        renewableOnly: "", includeRenewed: "true", expiryFrom: from ? toIsoDate(from) : "", expiryTo: to ? toIsoDate(to) : "", search: "", state: "",
      }));
    } catch (e) {
      setError(e?.response?.data?.message || t("renewalPolicy.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [range, from, to, t]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => (!state || p.renewalState === state)
      && (!q || [p.policyNumber, p.clientName, p.clientCode, p.product].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, search, state]);

  const figures = STATES.filter((s) => s !== "closed" || rows.some((p) => p.renewalState === s)).map((s) => ({
    key: s, label: t(`renewalPolicy.states.${s}`), value: rows.filter((p) => p.renewalState === s).length, onClick: () => setState(state === s ? "" : s), active: state === s,
  }));

  const renew = (p) => navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${p.policyId}`, {
    state: { policyId: p.policyId, policyNumber: p.policyNumber, insuredName: p.clientName, lob: p.lob, productType: p.product },
  });
  const expiryNote = (p) => {
    const d = Number(p.daysToExpiry);
    if (d === 0) return t("renewalPolicy.expiresToday");
    return d > 0 ? t("renewalPolicy.expiresIn", { count: d }) : t("renewalPolicy.expiredAgo", { count: -d });
  };
  const actions = (p) => {
    const main = [];
    if (p.renewalState === "renewed") {
      if (p.newPolicyId) main.push({ icon: "pi pi-external-link", label: t("renewalPolicy.openNewPolicy", { number: p.newPolicyNumber || "" }), onClick: () => navigate(`/agent/policydetail/${p.newPolicyId}`) });
    } else if (p.canRenew) {
      main.push(p.renewalState === "in-progress"
        ? { icon: "pi pi-arrow-right", label: t("renewalPolicy.continue"), onClick: () => renew(p) }
        : { icon: "pi pi-refresh", label: t("renewalPolicy.renew"), onClick: () => renew(p) });
    }
    return (
      <RowActions actions={[{ icon: "pi pi-eye", label: t("renewalPolicy.viewPolicy"), onClick: () => navigate(`/agent/policydetail/${p.policyId}`) }, ...main]}
        menu={[{ label: t("renewalPolicy.quoteAsNew"), icon: "pi pi-info-circle", disabled: true, hidden: p.canRenew || p.renewalState === "renewed" }]} />
    );
  };

  return (
    <div className="bv-ops-page renewal-policy-page">
      <PageHeader title={t("expiredPolicies.title")}
        crumbs={[{ label: t("sidebar.Operations", "Operations") }, { label: t("renewalPages.renewals"), onClick: () => navigate("/renewal/queue") }, { label: t("expiredPolicies.title") }]} />
      <StatCards items={figures} />
      <SectionCard>
        <FilterBar active={!!(search || state)} onClear={() => { setSearch(""); setState(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("renewalPolicy.searchPlaceholder")} aria-label={t("renewalPolicy.search")} />
          </span>
          <Calendar value={range && range.length ? range : null} onChange={(e) => setRange(e.value || [])} selectionMode="range" readOnlyInput showIcon showButtonBar
            dateFormat={calendarDateFormat()} placeholder={t("renewalPolicy.expiryBetween")} aria-label={t("renewalPolicy.expiryBetween")} className="renewal-policy__range" />
        </FilterBar>
        {error ? <small className="p-error block mb-2">{error}</small> : null}
        <DataTable value={filtered} loading={loading} dataKey="policyId" paginator rows={20} rowsPerPageOptions={[20, 50, 100]} size="small" sortField="expiryDate" sortOrder={1}
          emptyMessage={<EmptyState icon="pi-calendar" title={t("renewalPolicy.emptyTitle")} text={t("renewalPolicy.empty")} />}>
          <Column field="policyNumber" header={t("renewalPolicy.policyClient")} sortable
            body={(p) => <span className="bv-cell-stack"><span className="bv-nowrap">{p.policyNumber}</span><small>{p.clientName}</small></span>} />
          <Column field="product" header={t("renewalPolicy.productInsurer")} sortable
            body={(p) => <span className="bv-cell-stack"><span>{p.product}</span><small>{p.insuranceCompanyName}</small></span>} />
          <Column field="salesPerson" header={t("renewalPolicy.salesPerson")} sortable />
          <Column field="expiryDate" header={t("renewalPolicy.expiry")} sortable
            body={(p) => <span className="bv-cell-stack"><span className="bv-nowrap">{formatDate(p.expiryDate)}</span><small>{expiryNote(p)}</small></span>} />
          <Column field="grossPremium" header={t("renewalPolicy.premium")} sortable body={(p) => formatCurrency(p.grossPremium)} className="bv-num" headerClassName="bv-num" />
          <Column field="paymentStatus" header={t("renewalPolicy.payment")} sortable body={(p) => <StatusChip status={p.paymentStatus} />} />
          <Column field="renewalState" header={t("renewalPolicy.state")} sortable
            body={(p) => <span title={p.message || ""}><StatusChip label={p.renewalStateLabel} severity={STATE_SEVERITY[p.renewalState] || "info"} /></span>} />
          <Column header={t("renewalPolicy.actions")} body={actions} className="bv-actions" headerClassName="bv-actions" />
        </DataTable>
      </SectionCard>
    </div>
  );
};

export default ExpiredPoliciesPage;
