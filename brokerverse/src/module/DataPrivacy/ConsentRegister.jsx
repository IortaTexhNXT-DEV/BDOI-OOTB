import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import privacyService, { errorMessage } from "../../services/privacyService";
import { ConsentStatusTag, PageHeader, showDateTime, useOptions } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Master > Data Privacy > Consent Register: consents given, refused and withdrawn by clients and prospects, across
 * parties (read-only; consents are recorded on the client and prospect screens).
 */
const ConsentRegister = () => {
  const { t } = useTranslation();
  const options = useOptions();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ purpose: null, status: null, partyType: null, channel: null, current: true, search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await privacyService.consentRegister({ ...filters, current: filters.current ? "true" : undefined }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("privacy.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="admin__page access__page privacy__page">
      <Toast ref={toast} />
      <PageHeader title={t("privacy.registerTitle")} />
      <div className="admin__filters">
        <Dropdown value={filters.purpose} options={options.purposes} showClear placeholder={t("privacy.colPurpose")} onChange={(e) => setFilter({ purpose: e.value || null })} />
        <Dropdown value={filters.status} options={options.consentStatuses} showClear placeholder={t("privacy.colStatus")} onChange={(e) => setFilter({ status: e.value || null })} />
        <Dropdown value={filters.partyType} options={options.partyTypes} showClear placeholder={t("privacy.colPartyType")} onChange={(e) => setFilter({ partyType: e.value || null })} />
        <Dropdown value={filters.channel} options={options.channels} showClear placeholder={t("privacy.colChannel")} onChange={(e) => setFilter({ channel: e.value || null })} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("privacy.searchParty")} onChange={(e) => setFilter({ search: e.target.value })} />
        </span>
        <div className="access__toggle">
          <InputSwitch inputId="cr-current" checked={filters.current} onChange={(e) => setFilter({ current: e.value })} />
          <label htmlFor="cr-current">{t("privacy.currentOnly")}</label>
        </div>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("privacy.noConsents")}>
        <Column header={t("privacy.colParty")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.partyName}</span>
            <span className="access__muted">{`${t(`privacy.partyType.${r.partyType}`)} ${r.partyCode || ""}`}</span>
          </div>
        )} />
        <Column header={t("privacy.colPurpose")} body={(r) => t(`privacy.purpose.${r.purpose}`)} />
        <Column header={t("privacy.colStatus")} body={(r) => <ConsentStatusTag status={r.status} />} />
        <Column header={t("privacy.colChannel")} body={(r) => t(`privacy.channel.${r.channel}`)} />
        <Column field="noticeVersion" header={t("privacy.colNoticeVersion")} />
        <Column field="recordedAt" header={t("privacy.colRecorded")} sortable body={(r) => showDateTime(r.recordedAt)} />
        <Column field="recordedBy" header={t("privacy.colRecordedBy")} />
        <Column field="evidence" header={t("privacy.colEvidence")} />
        <Column header={t("privacy.colWithdrawn")} body={(r) => (r.withdrawnAt ? `${showDateTime(r.withdrawnAt)}${r.withdrawalReason ? ` (${r.withdrawalReason})` : ""}` : "")} />
      </DataTable>
    </div>
  );
};

export default ConsentRegister;
