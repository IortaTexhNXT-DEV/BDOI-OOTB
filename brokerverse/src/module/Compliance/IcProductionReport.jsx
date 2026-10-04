import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { PageHeader, fromIsoDay, isoDay, money } from "./icCommon";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./ic.scss";

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

/**
 * Compliance > Insurance Commission > IC Production Report: premiums placed by insurer and IC line of business for a
 * period, by month, quarter or year, with the policy detail; downloadable as Excel in the IC layout.
 */
const IcProductionReport = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [params, setParams] = useState({ from: startOfYear(), to: isoDay(new Date()), groupBy: "quarter" });
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setR(await complianceService.production(params));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [params, t]);
  useEffect(() => { load(); }, [load]);

  const lines = r?.lines || [];
  const lineColumns = lines.map((l) => <Column key={l} header={l} body={(x) => money(x.premium[l])} style={{ textAlign: "right" }} />);
  const groups = ["month", "quarter", "year"].map((value) => ({ value, label: t(`compliance.icp.${value}`) }));

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.icp.title")} intro={t("compliance.icp.intro")}
        actions={<Button icon="pi pi-file-excel" label={t("compliance.icp.download")} onClick={() => complianceService.exportProduction(params).catch((e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) }))} />} />
      <div className="admin__filters">
        <Calendar value={fromIsoDay(params.from)} dateFormat="dd/mm/yy" showIcon aria-label={t("compliance.from")} onChange={(e) => e.value && setParams((p) => ({ ...p, from: isoDay(e.value) }))} />
        <Calendar value={fromIsoDay(params.to)} dateFormat="dd/mm/yy" showIcon aria-label={t("compliance.to")} onChange={(e) => e.value && setParams((p) => ({ ...p, to: isoDay(e.value) }))} />
        <SelectButton value={params.groupBy} options={groups} onChange={(e) => e.value && setParams((p) => ({ ...p, groupBy: e.value }))} />
      </div>
      <h4>{t("compliance.icp.byInsurer")}</h4>
      <div className="compliance__table-scroll">
        <DataTable value={r ? [...r.rows, { insurer: t("compliance.icp.total"), ...r.totals }] : []} dataKey="insurer" size="small" stripedRows className="access__table" loading={loading} emptyMessage={t("compliance.icp.none")}>
          <Column field="insurer" header={t("compliance.ia.insurer")} />
          {lineColumns}
          <Column header={t("compliance.icp.totalPremium")} body={(x) => <strong>{money(x.totalPremium)}</strong>} style={{ textAlign: "right" }} />
          <Column header={t("compliance.icp.commission")} body={(x) => money(x.commission)} style={{ textAlign: "right" }} />
          <Column field="policies" header={t("compliance.icp.policies")} />
        </DataTable>
      </div>
      <h4>{t("compliance.icp.byPeriod")}</h4>
      <div className="compliance__table-scroll">
        <DataTable value={r?.byPeriod || []} dataKey="period" size="small" stripedRows className="access__table" loading={loading}>
          <Column field="period" header={t(`compliance.icp.${params.groupBy}`)} />
          {lineColumns}
          <Column header={t("compliance.icp.totalPremium")} body={(x) => money(x.totalPremium)} style={{ textAlign: "right" }} />
          <Column header={t("compliance.icp.commission")} body={(x) => money(x.commission)} style={{ textAlign: "right" }} />
        </DataTable>
      </div>
    </div>
  );
};

export default IcProductionReport;
