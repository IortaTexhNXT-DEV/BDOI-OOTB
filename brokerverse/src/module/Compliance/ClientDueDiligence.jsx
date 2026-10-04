import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { AmlTag, KYC_STATUSES, PageHeader, PartyCell, RATINGS, showDate, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Client Due Diligence: every client with its risk rating, KYC status, open screening hits and next KYC
 * refresh; a row opens the client's AML profile.
 */
const ClientDueDiligence = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const ratings = [...useOptionList(RATINGS, "rating"), { value: "unrated", label: t("aml.unrated") }];
  const statuses = useOptionList(KYC_STATUSES, "kycStatus");
  const types = useOptionList(["individual", "corporate"], "clientType");
  const [filters, setFilters] = useState({ rating: params.get("rating") || null, kycStatus: params.get("kycStatus") || null, clientType: null, search: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.clients(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.cddTitle")} intro={t("aml.cddIntro")}
        actions={<Button icon="pi pi-user-plus" label={t("aml.onboardClient")} onClick={() => navigate("/agent/client-onboarding")} />} />
      <div className="admin__filters">
        <Dropdown value={filters.rating} options={ratings} showClear placeholder={t("aml.colRating")} onChange={(e) => setFilter({ rating: e.value || null })} />
        <Dropdown value={filters.kycStatus} options={statuses} showClear placeholder={t("aml.colKycStatus")} onChange={(e) => setFilter({ kycStatus: e.value || null })} />
        <Dropdown value={filters.clientType} options={types} showClear placeholder={t("aml.colClientType")} onChange={(e) => setFilter({ clientType: e.value || null })} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("aml.searchClients")} onChange={(e) => setFilter({ search: e.target.value })} />
        </span>
      </div>
      <DataTable value={rows} dataKey="clientId" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.noClients")}
        selectionMode="single" onRowSelect={(e) => navigate(`/compliance/aml/clients/${e.data.clientId}`)}>
        <Column header={t("aml.colClient")} body={(r) => <PartyCell name={r.clientName} code={r.clientCode} />} />
        <Column header={t("aml.colClientType")} body={(r) => t(`aml.clientType.${r.clientType}`, { defaultValue: r.clientType })} />
        <Column header={t("aml.colRating")} body={(r) => <AmlTag value={r.riskRating} group="rating" />} />
        <Column field="riskScore" header={t("aml.colScore")} sortable />
        <Column header={t("aml.colKycStatus")} body={(r) => <AmlTag value={r.kycStatus} group="kycStatus" />} />
        <Column field="openHits" header={t("aml.colOpenHits")} sortable />
        <Column header={t("aml.colPep")} body={(r) => (r.isPep ? t("aml.yes") : "")} />
        <Column field="nextReviewOn" header={t("aml.colNextReview")} sortable body={(r) => showDate(r.nextReviewOn)} />
        <Column header={t("aml.colOnboardedVia")} body={(r) => t(`aml.onboardedVia.${r.onboardedVia}`, { defaultValue: r.onboardedVia })} />
      </DataTable>
    </div>
  );
};

export default ClientDueDiligence;
