import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import complianceService, { errorMessage } from "../../services/complianceService";
import { PageHeader, StateTag, Stats, showDate } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Insurance Commission > Insurer Authority: every insurer with its IC certificate of authority (number and
 * validity from the insurer master) and its state. What a missing or expired certificate does at request for
 * quotation, firm order and policy issue is the setting compliance.insurer_authority_check.
 */
const InsurerAuthority = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [report, setReport] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ state: null, status: null, search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await complianceService.insurerAuthority(filters));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);
  const s = report.summary || {};

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.ia.title")} intro={t("compliance.ia.intro")}
        actions={<Button icon="pi pi-file-excel" label={t("compliance.export")} outlined onClick={() => complianceService.exportInsurerAuthority(filters).catch((e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) }))} />} />
      {report.mode ? <Message severity={report.mode === "block" ? "info" : "warn"} className="w-full justify-content-start mb-2" text={t(`compliance.ia.mode.${report.mode}`)} /> : null}
      <Stats loading={loading} selected={filters.state} onSelect={(state) => setFilters((f) => ({ ...f, state }))} items={[
        { key: "valid", label: t("compliance.state.valid"), value: s.valid },
        { key: "expiring", label: t("compliance.ia.expiringWithin", { days: report.expiringDays ?? 60 }), value: s.expiring },
        { key: "expired", label: t("compliance.state.expired"), value: s.expired },
        { key: "missing,no-validity", label: t("compliance.ia.missing"), value: (s.missing || 0) + (s.noValidity || 0) },
      ]} />
      <div className="admin__filters">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("compliance.search")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
        <div className="access__toggle">
          <InputSwitch inputId="ia-all" checked={filters.status === "all"} onChange={(e) => setFilters((f) => ({ ...f, status: e.value ? "all" : null }))} />
          <label htmlFor="ia-all">{t("compliance.ia.includeInactive")}</label>
        </div>
      </div>
      <DataTable value={report.items} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} className="access__table" emptyMessage={t("compliance.ia.none")}>
        <Column header={t("compliance.ia.insurer")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.name}</span>
            <span className="access__muted">{`${r.code || ""}${r.status !== "active" ? ` · ${r.status}` : ""}`}</span>
          </div>
        )} />
        <Column field="certificateNumber" header={t("compliance.ia.certificate")} />
        <Column field="validUntil" header={t("compliance.ia.validUntil")} sortable body={(r) => showDate(r.validUntil)} />
        <Column field="daysLeft" header={t("compliance.ia.daysLeft")} />
        <Column header={t("compliance.colState")} body={(r) => <StateTag value={r.state} />} />
        <Column header="" body={(r) => <Button label={t("compliance.ia.openMaster")} text size="small" onClick={() => navigate(`/master/generals/insurancemanagement/insurancecompany/edit/${r.id}`)} />} />
      </DataTable>
    </div>
  );
};

export default InsurerAuthority;
