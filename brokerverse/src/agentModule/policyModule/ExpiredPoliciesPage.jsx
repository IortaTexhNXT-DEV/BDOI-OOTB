import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import BatchRenewalService from "../../services/batchRenewalService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { calendarDateFormat, formatDate, toIsoDate } from "../../utility/dateFormat";
import "./index.scss";

const STATE_SEVERITY = { due: "info", grace: "warning", lapsed: "warning", "in-progress": null, renewed: "success", closed: "danger" };
const toDate = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);

/**
 * Renewal Policy: policies expiring in the window (and expired ones still renewable), each with its renewal state and
 * the action that fits it. A policy already renewed shows its new policy instead of a Renew action, and one whose
 * renewal window has closed is marked for a new business quotation.
 */
const ExpiredPoliciesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const [filters, setFilters] = useState({ expiryFrom: null, expiryTo: null, search: "", state: "All" });
  const [ready, setReady] = useState(false);
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
        setFilters((f) => ({ ...f, expiryFrom: from, expiryTo: to }));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await BatchRenewalService.getRenewablePolicies({
        renewableOnly: "",
        includeRenewed: "true",
        expiryFrom: filters.expiryFrom ? toIsoDate(filters.expiryFrom) : "",
        expiryTo: filters.expiryTo ? toIsoDate(filters.expiryTo) : "",
        search: filters.search.trim(),
        state: filters.state === "All" ? "" : filters.state,
      });
      setRows(list);
    } catch (e) {
      setError(e?.response?.data?.message || t("renewalPolicy.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    if (ready) load();
    // filters are applied with the Search button; the first load uses the defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const stateOptions = useMemo(
    () => ["All", "due", "grace", "lapsed", "in-progress", "renewed", "closed"].map((s) => ({ label: t(`renewalPolicy.states.${s}`), value: s })),
    [t]
  );

  const renew = (p) =>
    navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${p.policyId}`, {
      state: { policyId: p.policyId, policyNumber: p.policyNumber, insuredName: p.clientName, lob: p.lob, productType: p.product },
    });

  const expiryText = (p) => {
    const d = Number(p.daysToExpiry);
    if (d === 0) return t("renewalPolicy.expiresToday");
    return d > 0 ? t("renewalPolicy.expiresIn", { count: d }) : t("renewalPolicy.expiredAgo", { count: -d });
  };

  const action = (p) => {
    if (p.renewalState === "renewed") {
      return p.newPolicyId ? (
        <Button type="button" size="small" text label={t("renewalPolicy.openNewPolicy", { number: p.newPolicyNumber || "" })} onClick={() => navigate(`/agent/policydetail/${p.newPolicyId}`)} />
      ) : null;
    }
    if (!p.canRenew) return <span className="text-color-secondary text-sm">{t("renewalPolicy.quoteAsNew")}</span>;
    return (
      <Button type="button" size="small" outlined label={p.renewalState === "in-progress" ? t("renewalPolicy.continue") : t("renewalPolicy.renew")} onClick={() => renew(p)} />
    );
  };

  const right = { textAlign: "right" };

  return (
    <div className="policy__table__container mt-4">
      <div className="grid mt-3">
        <div className="col-12">
          <label className="leadlisting__overal__container__title">{t("expiredPolicies.title")}</label>
          <div className="mt-3">
            <BreadCrumb model={[{ label: t("expiredPolicies.breadcrumb") }]} home={{ label: t("expiredPolicies.home") }} className="breadCrums" />
          </div>
        </div>

        <div className="col-12">
          <div className="renewal-policy__filters">
            <span>
              <label htmlFor="rp-from">{t("renewalPolicy.expiryFrom")}</label>
              <Calendar inputId="rp-from" value={filters.expiryFrom} onChange={(e) => setFilters({ ...filters, expiryFrom: e.value })} dateFormat={calendarDateFormat()} showIcon />
            </span>
            <span>
              <label htmlFor="rp-to">{t("renewalPolicy.expiryTo")}</label>
              <Calendar inputId="rp-to" value={filters.expiryTo} onChange={(e) => setFilters({ ...filters, expiryTo: e.value })} dateFormat={calendarDateFormat()} showIcon minDate={filters.expiryFrom || undefined} />
            </span>
            <span>
              <label htmlFor="rp-state">{t("renewalPolicy.state")}</label>
              <Dropdown inputId="rp-state" value={filters.state} options={stateOptions} onChange={(e) => setFilters({ ...filters, state: e.value })} />
            </span>
            <span className="renewal-policy__search">
              <label htmlFor="rp-search">{t("renewalPolicy.search")}</label>
              <InputText id="rp-search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={t("renewalPolicy.searchPlaceholder")} />
            </span>
            <Button type="button" icon="pi pi-search" label={t("renewalPolicy.apply")} onClick={load} loading={loading} />
          </div>
          {error && <small className="p-error block mt-2">{error}</small>}
        </div>

        <div className="col-12">
          <DataTable
            value={rows}
            loading={loading && !rows.length}
            dataKey="policyId"
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            size="small"
            sortField="expiryDate"
            sortOrder={1}
            emptyMessage={t("renewalPolicy.empty")}
            scrollable
            tableStyle={{ minWidth: "84rem" }}
          >
            <Column field="policyNumber" className="bv-nowrap" header={t("renewalPolicy.policyNumber")} sortable />
            <Column field="clientName" header={t("renewalPolicy.client")} sortable />
            <Column field="product" header={t("renewalPolicy.product")} sortable />
            <Column field="insuranceCompanyName" header={t("renewalPolicy.insurer")} sortable />
            <Column field="salesPerson" header={t("renewalPolicy.salesPerson")} sortable />
            <Column field="expiryDate" className="bv-nowrap" header={t("renewalPolicy.expiry")} sortable body={(p) => formatDate(p.expiryDate)} />
            <Column field="daysToExpiry" className="bv-nowrap" header={t("renewalPolicy.term")} sortable body={expiryText} />
            <Column field="grossPremium" className="bv-nowrap" header={t("renewalPolicy.premium")} sortable alignHeader="right" bodyStyle={right} body={(p) => formatCurrency(p.grossPremium)} />
            <Column field="paymentStatus" className="bv-nowrap" header={t("renewalPolicy.payment")} sortable />
            <Column
              field="renewalState"
              className="bv-nowrap"
              header={t("renewalPolicy.state")}
              sortable
              body={(p) => <Tag value={p.renewalStateLabel} severity={STATE_SEVERITY[p.renewalState] || undefined} title={p.message || ""} />}
            />
            <Column header="" body={action} style={{ width: "11rem" }} frozen alignFrozen="right" />
          </DataTable>
        </div>
      </div>
    </div>
  );
};

export default ExpiredPoliciesPage;
