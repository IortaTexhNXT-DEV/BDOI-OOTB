import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgFilters from "../../../assets/icons/SvgFilters";
import InputField from "../../../components/InputField";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import { Paginator } from "primereact/paginator";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Link, useNavigate } from "react-router-dom";
import SvgTable from "../../../assets/icons/SvgTable";
import ToggleButton from "../../../components/ToggleButton";
import { TieredMenu } from "primereact/tieredmenu";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import remittanceService, { masterService } from "../../../services/remittanceService";
import { showError, showSuccess } from "../../Remittance/shared";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../components/RowActions";
import PageActions from "../../../components/PageActions";

const RemittanceMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);

  const [remittanceData, setRemittanceData] = useState([]);
  const toast = useRef(null);

  const loadMasters = async () => {
    try {
      setRemittanceData(await remittanceService.masterOverview());
    } catch (error) {
      showError(toast, error);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const items = [
    { label: t("financeMasters.remittanceMaster"), url: "/master/finance/remittance" },
  ];

  const home = { label: t("financeMasters.master") };

  const categories = [
    { label: t("financeMasters.all"), value: "all" },
    { label: t("financeMasters.automatedRemittance"), value: "automated" },
    { label: t("financeMasters.statementTemplates"), value: "statement" },
    { label: t("financeMasters.settlementParameters"), value: "settlement" },
    { label: t("financeMasters.bulkProcessing"), value: "bulkprocessing" },
    { label: t("financeMasters.exception"), value: "exception" },
    { label: t("financeMasters.agencyBill"), value: "agencybill" },
    { label: t("financeMasters.adjustment"), value: "adjustment" },
    { label: t("financeMasters.notification"), value: "notification" },
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
      (selectedCategory === "bulkprocessing" && item.type === "BulkProcessing") ||
      (selectedCategory === "exception" && item.type === "Exception") ||
      (selectedCategory === "agencybill" && item.type === "AgencyBill") ||
      (selectedCategory === "adjustment" && item.type === "Adjustment") ||
      (selectedCategory === "notification" && item.type === "Notification");

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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
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

  const renderActions = (rowData) => <RowActions onView={() => handleView(rowData)} onEdit={() => handleEdit(rowData)} />;

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
      bulkprocessing: "bulkprocessingmaster",
      exception: "exceptionmaster",
      agencybill: "agencybillmaster",
      adjustment: "adjustmentmaster",
      notification: "notificationmaster",
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
      "BulkProcessing": `${baseRoute}/bulkprocessingmaster/${mode}`,
      "Exception": `${baseRoute}/exceptionmaster/${mode}`,
      "AgencyBill": `${baseRoute}/agencybillmaster/${mode}`,
      "Adjustment": `${baseRoute}/adjustmentmaster/${mode}`,
      "Notification": `${baseRoute}/notificationmaster/${mode}`,
    };
    return typeRoutes[type] || baseRoute;
  };

  const handleStatusChange = async (rowData) => {
    try {
      await masterService.setStatus(rowData.typeCode, rowData.id, rowData.status ? "Inactive" : "Active");
      showSuccess(toast, `${rowData.code} ${rowData.status ? "deactivated" : "activated"}`);
      loadMasters();
    } catch (error) {
      showError(toast, error);
    }
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
      <Toast ref={toast} />
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="remittance__master__title">Remittance Master</div>
          {/* each value has one place: approval limits, schedules and the remittance settings live on their own screens */}
          <div className="remittance__master__note">
            {t("financeMasters.remittanceMasterNote")}{" "}
            <Link to="/master/generals/usermanagement/authority-matrix">{t("remittance.authorityMatrix")}</Link>
            {" · "}
            <Link to="/finance/remittance/scheduling">{t("remittance.scheduling")}</Link>
            {" · "}
            <Link to="/master/configuration/settings">{t("financeMasters.configurationSettings")}</Link>
          </div>
        </div>
        <div className="col-12 p-0 flex justify-content-end">
          <PageActions onAdd={handleAdd} />
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
                className="filter-button" aria-label="Filter" tooltip="Filter" tooltipOptions={{ position: "top" }} />
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
                    if (rowData.type === "Settlement") return rowData.settlementFrequency || "-";
                    if (rowData.type === "BulkProcessing") return rowData.fileFormat;
                    return "-";
                  }}
                  header={t("financeMasters.configuration")}
                  style={{ width: "18%" }}
                />
                <Column
                  body={(rowData) => {
                    if (rowData.type === "Automated") return formatAppDate(rowData.lastRun);
                    if (rowData.type === "Statement") return formatAppDate(rowData.lastUsed);
                    return formatAppDate(rowData.lastUpdated);
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
                  body={renderActions}
                  header={t("common.actions")}
                  {...actionsColumn}
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