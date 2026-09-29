import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import "./index.scss";
import SvgDropdownicon from "../../../assets/icons/SvgDropdownicon";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgFilters from "../../../assets/icons/SvgFilters";
import InputField from "../../../components/InputField";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { Paginator } from "primereact/paginator";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import ToggleButton from "../../../components/ToggleButton";
import SvgEditicons from "../../../assets/icons/SvgEditicons";
import { TieredMenu } from "primereact/tieredmenu";
import { Card } from "primereact/card";

const RemittanceMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);

  // Mock data for remittance masters
  const [remittanceData] = useState([
    {
      id: 1,
      code: "ARM-0001",
      name: "Monthly Auto Remittance",
      type: "Automated",
      frequency: "Monthly",
      insurers: 5,
      status: true,
      lastRun: "2025-09-15",
    },
    {
      id: 2,
      code: "STM-001",
      name: "Standard Statement Template",
      type: "Statement",
      format: "Monthly",
      columns: 12,
      status: true,
      lastUsed: "2025-09-20",
    },
    {
      id: 3,
      code: "STP-001",
      name: "Regular Settlement",
      type: "Settlement",
      approvalLevels: 3,
      limit: "500,000",
      status: true,
      lastUpdated: "2025-09-10",
    },
    {
      id: 4,
      code: "ARM-0002",
      name: "Quarterly Auto Remittance",
      type: "Automated",
      frequency: "Quarterly",
      insurers: 3,
      status: false,
      lastRun: "2025-07-01",
    },
    {
      id: 5,
      code: "REC-0001",
      name: "Standard Reconciliation Rule",
      type: "Reconciliation",
      matchingRules: "4 Rules",
      tolerance: "2.5%",
      status: true,
      lastUpdated: "2025-09-22",
    },
    {
      id: 6,
      code: "BFM-001",
      name: "Standard CSV Import",
      type: "BulkProcessing",
      fileFormat: "CSV",
      maxRecords: 50000,
      status: true,
      lastUpdated: "2025-09-21",
    },
    {
      id: 7,
      code: "SCH-0001",
      name: "Monthly Remittance Schedule",
      type: "Schedule",
      frequency: "Monthly",
      nextRun: "2025-10-01",
      status: true,
      lastUpdated: "2025-09-23",
    },
    {
      id: 8,
      code: "ETM-001",
      name: "Standard Wire Transfer",
      type: "Electronic",
      transferType: "Domestic",
      methods: "4 Methods",
      status: true,
      lastUpdated: "2025-09-24",
    },
    {
      id: 9,
      code: "AWF-001",
      name: "Standard Approval Workflow",
      type: "ApprovalWorkflow",
      levels: "3 Levels",
      pattern: "Sequential",
      status: true,
      lastUpdated: "2025-09-25",
    },
    {
      id: 10,
      code: "EXC-001",
      name: "Exception Handling Master",
      type: "Exception",
      exceptionTypes: "7 Types",
      autoResolve: "Enabled",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 11,
      code: "RPT-001",
      name: "Daily Remittance Report",
      type: "ReportTemplate",
      category: "Operational",
      frequency: "Daily",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 12,
      code: "ABL-001",
      name: "Agency Bill Configuration",
      type: "AgencyBill",
      frequency: "Monthly",
      agencies: "25 Active",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 13,
      code: "DBL-001",
      name: "Standard Direct Bill",
      type: "DirectBill",
      billMethod: "Policy-wise",
      paymentTerms: "30 Days",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 14,
      code: "ADJ-001",
      name: "Standard Adjustment Config",
      type: "Adjustment",
      adjustmentTypes: "6 Types",
      approvalMatrix: "Configured",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 15,
      code: "NTF-001",
      name: "Email Notification Template",
      type: "Notification",
      channels: "Email, SMS",
      templates: "8 Active",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 16,
      code: "HST-001",
      name: "History Configuration",
      type: "History",
      retention: "24 Months",
      archival: "Enabled",
      status: true,
      lastUpdated: "2025-09-26",
    },
    {
      id: 17,
      code: "ANL-001",
      name: "Executive Dashboard",
      type: "Analytics",
      widgets: "15 Widgets",
      refreshRate: "5 Min",
      status: true,
      lastUpdated: "2025-09-26",
    },
  ]);

  const items = [
    { label: t("financeMasters.remittanceMaster"), url: "/master/finance/remittance" },
  ];

  const home = { label: t("financeMasters.master") };

  const categories = [
    { label: t("financeMasters.all"), value: "all" },
    { label: t("financeMasters.automatedRemittance"), value: "automated" },
    { label: t("financeMasters.statementTemplates"), value: "statement" },
    { label: t("financeMasters.settlementParameters"), value: "settlement" },
    { label: t("financeMasters.reconciliation"), value: "reconciliation" },
    { label: t("financeMasters.bulkProcessing"), value: "bulkprocessing" },
    { label: t("financeMasters.schedule"), value: "schedule" },
    { label: t("financeMasters.electronicTransfer"), value: "electronic" },
    { label: t("financeMasters.approvalWorkflow"), value: "approvalworkflow" },
    { label: t("financeMasters.exception"), value: "exception" },
    { label: t("financeMasters.reportTemplate"), value: "reporttemplate" },
    { label: t("financeMasters.agencyBill"), value: "agencybill" },
    { label: t("financeMasters.directBill"), value: "directbill" },
    { label: t("financeMasters.adjustment"), value: "adjustment" },
    { label: t("financeMasters.notification"), value: "notification" },
    { label: t("financeMasters.history"), value: "history" },
    { label: t("financeMasters.analytics"), value: "analytics" },
  ];

  const filteredData = remittanceData.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "automated" && item.type === "Automated") ||
      (selectedCategory === "statement" && item.type === "Statement") ||
      (selectedCategory === "settlement" && item.type === "Settlement") ||
      (selectedCategory === "reconciliation" && item.type === "Reconciliation") ||
      (selectedCategory === "bulkprocessing" && item.type === "BulkProcessing") ||
      (selectedCategory === "schedule" && item.type === "Schedule") ||
      (selectedCategory === "electronic" && item.type === "Electronic") ||
      (selectedCategory === "approvalworkflow" && item.type === "ApprovalWorkflow") ||
      (selectedCategory === "exception" && item.type === "Exception") ||
      (selectedCategory === "reporttemplate" && item.type === "ReportTemplate") ||
      (selectedCategory === "agencybill" && item.type === "AgencyBill") ||
      (selectedCategory === "directbill" && item.type === "DirectBill") ||
      (selectedCategory === "adjustment" && item.type === "Adjustment") ||
      (selectedCategory === "notification" && item.type === "Notification") ||
      (selectedCategory === "history" && item.type === "History") ||
      (selectedCategory === "analytics" && item.type === "Analytics");

    return matchesSearch && matchesCategory;
  });

  const menu = useRef(null);
  const menuitems = [
    { label: t("financeMasters.name") },
    { label: t("financeMasters.code") },
    { label: t("financeMasters.type") },
    { label: t("financeMasters.status") },
  ];

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 50, value: 50 },
      ];

      return (
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("financeMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </React.Fragment>
      );
    },
  };

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="view-eye-button"
          onClick={() => handleView(rowData)}
        />
      </div>
    );
  };

  const renderEditButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEditicons />}
          className="edit-button"
          onClick={() => handleEdit(rowData)}
        />
      </div>
    );
  };

  const renderStatus = (rowData) => {
    return (
      <div className="center-content">
        <ToggleButton
          isChecked={rowData.status}
          onChange={() => handleStatusChange(rowData)}
        />
      </div>
    );
  };

  const handleView = (rowData) => {
    const route = getRouteByType(rowData.type, "view");
    navigate(route, { state: { data: rowData, mode: "view" } });
  };

  const handleEdit = (rowData) => {
    const route = getRouteByType(rowData.type, "edit");
    navigate(route, { state: { data: rowData, mode: "edit" } });
  };

  const handleAdd = () => {
    const typeMap = {
      automated: "automatedremittance",
      statement: "statementtemplate",
      settlement: "settlementparameter",
      reconciliation: "reconciliationmaster",
      bulkprocessing: "bulkprocessingmaster",
      schedule: "schedulemaster",
      electronic: "electronictransfermaster",
      approvalworkflow: "approvalworkflowmaster",
      exception: "exceptionmaster",
      reporttemplate: "reporttemplatemaster",
      agencybill: "agencybillmaster",
      directbill: "directbillmaster",
      adjustment: "adjustmentmaster",
      notification: "notificationmaster",
      history: "historyconfiguration",
      analytics: "analyticsconfiguration",
    };

    const route = selectedCategory === "all"
      ? "/master/finance/remittance/automatedremittance/add"
      : `/master/finance/remittance/${typeMap[selectedCategory]}/add`;

    navigate(route, { state: { mode: "add" } });
  };

  const getRouteByType = (type, mode) => {
    const baseRoute = "/master/finance/remittance";
    const typeRoutes = {
      "Automated": `${baseRoute}/automatedremittance/${mode}`,
      "Statement": `${baseRoute}/statementtemplate/${mode}`,
      "Settlement": `${baseRoute}/settlementparameter/${mode}`,
      "Reconciliation": `${baseRoute}/reconciliationmaster/${mode}`,
      "BulkProcessing": `${baseRoute}/bulkprocessingmaster/${mode}`,
      "Schedule": `${baseRoute}/schedulemaster/${mode}`,
      "Electronic": `${baseRoute}/electronictransfermaster/${mode}`,
      "ApprovalWorkflow": `${baseRoute}/approvalworkflowmaster/${mode}`,
      "Exception": `${baseRoute}/exceptionmaster/${mode}`,
      "ReportTemplate": `${baseRoute}/reporttemplatemaster/${mode}`,
      "AgencyBill": `${baseRoute}/agencybillmaster/${mode}`,
      "DirectBill": `${baseRoute}/directbillmaster/${mode}`,
      "Adjustment": `${baseRoute}/adjustmentmaster/${mode}`,
      "Notification": `${baseRoute}/notificationmaster/${mode}`,
      "History": `${baseRoute}/historyconfiguration/${mode}`,
      "Analytics": `${baseRoute}/analyticsconfiguration/${mode}`,
    };
    return typeRoutes[type] || baseRoute;
  };

  const handleStatusChange = (rowData) => {
    // Handle status change
    console.log("Status changed for:", rowData);
  };

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const isEmpty = filteredData.length === 0;

  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  return (
    <div className="container__remittance__master">
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="remittance__master__title">Remittance Master</div>
        </div>
        <div className="col-12 p-0 flex justify-content-end">
          <Button
            icon={
              <div className="pr-2">
                <SvgAdd />
              </div>
            }
            className="main__btn__action"
            onClick={handleAdd}
          >
            {t("financeMasters.add")}
          </Button>
        </div>
        <div className="col-12 p-0">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="grid m-0 table__container">
        <div className="col-12 p-0">
          <Card>
            <div className="filter-section mb-3">
            <div className="category-selector">
              <label className="selector-label">{t("financeMasters.masterType")}</label>
              <Dropdown
                value={selectedCategory}
                options={categories}
                onChange={(e) => setSelectedCategory(e.value)}
                placeholder={t("financeMasters.selectMasterType")}
                className="master-dropdown"
              />
            </div>

            <div className="search-filter">
              <InputField
                placeholder={t("financeMasters.searchByNameOrCode")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<SvgSearchIcon />}
                className="search-field"
              />

              <Button
                icon={<SvgFilters />}
                onClick={(event) => menu.current.toggle(event)}
                className="filter-button"
              />
              <TieredMenu model={menuitems} popup ref={menu} />
            </div>
          </div>
            {isEmpty ? (
              <div className="empty-state">
                {emptyTableIcon}
                <p>No remittance configurations found</p>
              </div>
            ) : (
              <>
                <DataTable
                value={filteredData.slice(first, first + rows)}
                className="remittance-table"
                showGridlines={false}
                responsiveLayout="scroll"
              >
                <Column field="code" header={t("financeMasters.code")} style={{ width: "10%" }} />
                <Column field="name" header={t("financeMasters.name")} style={{ width: "22%" }} />
                <Column field="type" header={t("financeMasters.type")} style={{ width: "12%" }} />
                <Column
                  body={(rowData) => {
                    if (rowData.type === "Automated") return rowData.frequency;
                    if (rowData.type === "Statement") return rowData.format;
                    if (rowData.type === "Settlement") return `${rowData.approvalLevels} Levels`;
                    if (rowData.type === "Reconciliation") return rowData.matchingRules;
                    if (rowData.type === "BulkProcessing") return rowData.fileFormat;
                    if (rowData.type === "Schedule") return rowData.frequency;
                    if (rowData.type === "Electronic") return rowData.transferType;
                    return "-";
                  }}
                  header={t("financeMasters.configuration")}
                  style={{ width: "18%" }}
                />
                <Column
                  body={(rowData) => {
                    if (rowData.type === "Automated") return rowData.lastRun;
                    if (rowData.type === "Statement") return rowData.lastUsed;
                    if (rowData.type === "Schedule") return rowData.nextRun;
                    return rowData.lastUpdated || "-";
                  }}
                  header={t("financeMasters.lastActivity")}
                  style={{ width: "12%" }}
                />
                <Column
                  body={renderStatus}
                  header="Status"
                  style={{ width: "10%" }}
                  bodyStyle={{ textAlign: "center" }}
                  headerStyle={{ textAlign: "center" }}
                />
                <Column
                  body={renderViewButton}
                  header={t("financeMasters.view")}
                  style={{ width: "8%" }}
                  bodyStyle={{ textAlign: "center" }}
                  headerStyle={{ textAlign: "center" }}
                />
                <Column
                  body={renderEditButton}
                  header={t("financeMasters.edit")}
                  style={{ width: "8%" }}
                  bodyStyle={{ textAlign: "center" }}
                  headerStyle={{ textAlign: "center" }}
                />
                </DataTable>

                <Paginator
                first={first}
                rows={rows}
                totalRecords={filteredData.length}
                template={template2}
                onPageChange={onPageChange}
                />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RemittanceMaster;