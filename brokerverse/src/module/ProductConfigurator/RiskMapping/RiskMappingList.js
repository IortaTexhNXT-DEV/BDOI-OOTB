import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import productConfiguratorService from "../../../services/productConfiguratorService";
import { statusLabel } from "../../../utils/statusSeverity";
import { ConfiguratorPage, HistoryDialog, RowActions, StatusTag, STATUS_OPTIONS, confirmStatusChange, pagingFor } from "../shared/ConfiguratorPage";
import "./RiskMapping.scss";

/**
 * Product Configurator > Risk Mapping: how each product line describes its risk. The IAR risk sections are used by the
 * IAR prospect and quotation screens (sections offered and their default rates); the other definitions are kept for
 * reference and are not read by the quote screens yet.
 */
const RiskMappingList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const [definitionType, setDefinitionType] = useState(null);
  const [history, setHistory] = useState(null);

  const definitionOptions = [
    ["VEHICLE_DETAILS", "defVehicle"], ["PROPERTY_RISK_FIELDS", "defProperty"], ["TRAVEL_RISK_FIELDS", "defTravel"], ["LIABILITY_FIELDS", "defLiability"],
    ["HEALTH_COVER_FIELDS", "defHealth"], ["LIFE_COVER_FIELDS", "defLife"], ["RISK_SECTIONS", "defRiskSections"],
  ].map(([value, key]) => ({ value, label: t(`productRiskMapping.${key}`) }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorService.getRiskMappings({ search: search.trim() || undefined, status: status || undefined, definitionType: definitionType || undefined });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("productRiskMapping.error"), detail: error.message || t("productRiskMapping.failedLoad") });
    } finally {
      setLoading(false);
    }
  }, [search, status, definitionType, t]);

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  const usedBy = (row) => (row.definitionType === "RISK_SECTIONS" && String(row.lobCode).toUpperCase() === "IAR"
    ? <Tag value={t("productRiskMapping.usedByIar")} severity="success" />
    : <span className="pc-muted">{t("productRiskMapping.referenceOnly")}</span>);

  const toggle = async (row) => {
    const deactivate = row.status === "Active";
    const done = await confirmStatusChange({
      deactivate,
      kindLabel: t("productConfigurator.kinds.risk-mapping"),
      record: { code: row.productCode, name: row.productName },
      t,
      run: () => productConfiguratorService.updateRiskMapping(row.id, { status: deactivate ? "Inactive" : "Active" }),
    });
    if (!done) return;
    toast.current?.show({ severity: "success", summary: t("productRiskMapping.success"), detail: t("productRiskMapping.updated") });
    loadData();
  };

  return (
    <ConfiguratorPage screen="riskMapping" usage={t("productRiskMapping.usage")}>
      <Toast ref={toast} />
      <div className="pc-filters" role="search">
        <span className="p-input-icon-left pc-filters__search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("productRiskMapping.searchPlaceholder")} aria-label={t("productConfigurator.filters.search")} />
        </span>
        <Dropdown value={definitionType} options={definitionOptions} onChange={(e) => setDefinitionType(e.value)} placeholder={t("productRiskMapping.filterDefinition")} showClear className="pc-filters__field" aria-label={t("productRiskMapping.filterDefinition")} />
        <Dropdown value={status} options={STATUS_OPTIONS.map((x) => ({ label: statusLabel(x), value: x }))} onChange={(e) => setStatus(e.value)} placeholder={t("productConfigurator.filters.status")} showClear className="pc-filters__field" aria-label={t("productConfigurator.filters.status")} />
      </div>
      <DataTable value={rows} loading={loading} dataKey="id" {...pagingFor(rows.length)} emptyMessage={t("productRiskMapping.noRows")} size="small">
        <Column header={t("productRiskMapping.product")} body={(r) => <div className="pc-cell-stack"><span>{r.productCode} · {r.productName}</span><small className="pc-muted">{r.lineOfBusiness || r.lobCode}</small></div>} />
        <Column header={t("productRiskMapping.definition")} body={(r) => r.definitionLabel || definitionOptions.find((o) => o.value === r.definitionType)?.label || r.definitionType} />
        <Column header={t("productRiskMapping.riskSections")} body={(r) => (r.definitionType === "RISK_SECTIONS" ? r.sectionCount ?? 0 : "—")} />
        <Column header={t("productRiskMapping.usedBy")} body={usedBy} />
        <Column field="status" header={t("productRiskMapping.status")} body={(r) => <StatusTag status={r.status} />} />
        <Column
          header={t("productConfigurator.actions.title")}
          body={(r) => (
            <RowActions
              row={r}
              onView={(row) => navigate(`/product-configurator/risk-mapping/${row.id}`)}
              onToggle={toggle}
              onHistory={(row) => setHistory({ ...row, label: row.productCode })}
            />
          )}
        />
      </DataTable>
      <HistoryDialog kind="risk-mapping" row={history} onHide={() => setHistory(null)} />
    </ConfiguratorPage>
  );
};

export default RiskMappingList;
