import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import productConfiguratorService from "../../../services/productConfiguratorService";
import "./RiskMapping.scss";

const RiskMappingList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const [definitionType, setDefinitionType] = useState(null);

  const statusOptions = [
    { label: t("productRiskMapping.active", "Active"), value: "Active" },
    { label: t("productRiskMapping.inactive", "Inactive"), value: "Inactive" },
    { label: t("productRiskMapping.draft", "Draft"), value: "Draft" },
  ];

  const definitionOptions = [
    {
      label: t("productRiskMapping.defVehicle", "Vehicle details"),
      value: "VEHICLE_DETAILS",
    },
    {
      label: t("productRiskMapping.defProperty", "Property risk fields"),
      value: "PROPERTY_RISK_FIELDS",
    },
    {
      label: t("productRiskMapping.defTravel", "Travel risk fields"),
      value: "TRAVEL_RISK_FIELDS",
    },
    {
      label: t("productRiskMapping.defLiability", "Liability cover fields"),
      value: "LIABILITY_FIELDS",
    },
    {
      label: t("productRiskMapping.defHealth", "Health cover fields"),
      value: "HEALTH_COVER_FIELDS",
    },
    {
      label: t("productRiskMapping.defLife", "Life cover fields"),
      value: "LIFE_COVER_FIELDS",
    },
    {
      label: t("productRiskMapping.defRiskSections", "Risk sections"),
      value: "RISK_SECTIONS",
    },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await productConfiguratorService.getRiskMappings({
        search: search || undefined,
        status: status || undefined,
        definitionType: definitionType || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productRiskMapping.error", "Error"),
        detail:
          error.message ||
          t("productRiskMapping.failedLoad", "Failed to load risk mappings"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusBody = (row) => {
    const severity = row.status === "Active" ? "success" : "warning";
    return <Tag value={row.status} severity={severity} />;
  };

  const definitionBody = (row) => {
    if (row.definitionType === "RISK_SECTIONS") {
      return (
        <Button
          label={row.definitionLabel || t("productRiskMapping.defRiskSections", "Risk sections")}
          className="p-button-link p-0"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/product-configurator/risk-mapping/${row.id}`);
          }}
        />
      );
    }
    return row.definitionLabel || "—";
  };

  const sectionsBody = (row) =>
    row.definitionType === "RISK_SECTIONS" ? row.sectionCount ?? 0 : "—";

  const actionBody = (row) => (
    <Button
      icon="pi pi-arrow-right"
      className="p-button-rounded p-button-text p-button-primary"
      onClick={() => navigate(`/product-configurator/risk-mapping/${row.id}`)} aria-label="Open" tooltip="Open" tooltipOptions={{ position: "top" }} />
  );

  return (
    <div className="risk-mapping-list p-3">
      <Toast ref={toast} />
      <Card title={t("productRiskMapping.cardTitle", "Risk Mapping")}>
        <p className="text-color-secondary mb-3">
          {t(
            "productRiskMapping.subtitle",
            "Product definitions. Industrial All Risks (IAR) is defined by risk sections instead of vehicle details — one policy, many independent sections."
          )}
        </p>
        <div className="mb-3 flex flex-wrap gap-2 justify-content-between align-items-center">
          <span className="p-input-icon-left" style={{ minWidth: 280, flex: 1 }}>
            <i className="pi pi-search" />
            <InputText
              className="w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "productRiskMapping.searchPlaceholder",
                "Search product code, name, line of business..."
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadData();
              }}
            />
          </span>
          <Dropdown
            value={status}
            options={statusOptions}
            onChange={(e) => setStatus(e.value)}
            placeholder={t("productRiskMapping.filterStatus", "Status")}
            showClear
            style={{ minWidth: 140 }}
          />
          <Dropdown
            value={definitionType}
            options={definitionOptions}
            onChange={(e) => setDefinitionType(e.value)}
            placeholder={t("productRiskMapping.filterDefinition", "Definition")}
            showClear
            style={{ minWidth: 180 }}
          />
          <Button
            icon="pi pi-search"
            label={t("productRiskMapping.search", "Search")}
            onClick={loadData}
          />
        </div>
        <DataTable
          value={rows}
          loading={loading}
          paginator
          rows={20}
          emptyMessage={t("productRiskMapping.noRows", "No products found")}
          onRowClick={(e) =>
            navigate(`/product-configurator/risk-mapping/${e.data.id}`)
          }
          rowClassName={() => "cursor-pointer"}
        >
          <Column
            field="productCode"
            header={t("productRiskMapping.productCode", "Product Code")}
          />
          <Column
            field="productName"
            header={t("productRiskMapping.product", "Product")}
          />
          <Column
            field="lineOfBusiness"
            header={t("productRiskMapping.lob", "Line of Business")}
          />
          <Column
            header={t("productRiskMapping.definition", "Definition")}
            body={definitionBody}
          />
          <Column
            header={t("productRiskMapping.riskSections", "Risk Sections")}
            body={sectionsBody}
          />
          <Column
            field="status"
            header={t("productRiskMapping.status", "Status")}
            body={statusBody}
          />
          <Column body={actionBody} style={{ width: 70 }} />
        </DataTable>
      </Card>
    </div>
  );
};

export default RiskMappingList;
