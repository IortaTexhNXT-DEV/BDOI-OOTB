import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "../BranchMaster/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import Productdata from "./mock";
import { Dropdown } from "primereact/dropdown";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import ToggleButton from "../../../../components/ToggleButton";
import SvgEditicons from "../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import {
  getOrganizationBranchView,
  getPatchBranchData,
  getSearchBranchMiddleware,
} from "./store/branchMiddleware";
import { useFormik } from "formik";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branchTableList, loading, branchTabelSearchList } = useSelector(
    ({ organizationBranchMainReducers }) => {
      return {
        loading: organizationBranchMainReducers?.loading,
        branchTableList: organizationBranchMainReducers?.branchTableList,
        branchTabelSearchList:
          organizationBranchMainReducers?.branchTabelSearchList,
      };
    }
  );
  console.log(branchTableList, "branchTableList");

  const handlePolicy = (id) => {
    navigate(`/master/generals/organization/branchmaster/add/${123}`);
  };
  const dispatch = useDispatch();
  const handleSubmit = (values) => {
    console.log(values.search, "getSearchBranchMiddleware");
    dispatch(getSearchBranchMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(getSearchBranchMiddleware({ textSearch: formik.values.search }));
    }
  }, [formik.values.search]);
  const handleView = (columnData) => {
    dispatch(getOrganizationBranchView(columnData));
    console.log(columnData, "columnData");
    navigate(
      `/master/generals/organization/branchmaster/view/${columnData.id}`
    );
  };
  const handleEdit = (columnData) => {
    dispatch(getPatchBranchData(columnData));
    console.log(columnData, "columnData");
    navigate(
      `/master/generals/organization/branchmaster/edit/${columnData.id}`
    );
  };

  const isEmpty = Productdata.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("generalMasters.noDataEntered")}</div>
    </div>
  );

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <div className="table__selector">
          <span style={{ color: "var(--text-color)", userSelect: "none" }}>
            {t("generalMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </div>
      );
    },
  };

  const menu = useRef(null);
  const menuitems = [
    {
      label: t("generalMasters.name"),
    },
    {
      label: t("generalMasters.date"),
    },
    {
      label: t("generalMasters.voucherNumber"),
    },
  ];

  const renderToggleButton = () => {
    return (
      <div>
        <ToggleButton />
      </div>
    );
  };

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };
  const headeractionStyle = {
    display: "flex",
    justifyContent: "center",
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };

  const items = [
    {
      id: 1,
      label: t("generalMasters.branch"),
      // url: '/accounts/paymentvoucher'
    },
  ];
  const home = { label: t("generalMasters.master") };

  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [globalFilter, setGlobalFilter] = useState("");

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const onGlobalFilterChange = (event) => {
    setGlobalFilter(event.target.value);
  };

  return (
    <div className="overall__branch__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("generalMasters.branch")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          {/* <SvgFilters/> */}

          <div className="addbutton_container" onClick={handlePolicy}>
            <SvgAdd />
            <p className="addtext">{t("generalMasters.add")}</p>
          </div>
        </div>
      </div>

      <Card>
        <div className="header_search_container">
          <div class="col-12 md:col-12 lg:col-12" style={{ paddingLeft: 0 }}>
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("generalMasters.searchByBranchCode")}
                className="searchinput_left"
                value={formik.values.search}
                onChange={formik.handleChange("search")}
              />
            </span>
          </div>
        </div>
        <div className="headlist_lable">{t("generalMasters.branchList")}</div>
        <div>
          <DataTable
            value={
              formik.values.search !== ""
                ? branchTabelSearchList
                : branchTableList
            }
            tableStyle={{ minWidth: "50rem", color: "#1C2536" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="BranchCode"
              header={t("generalMasters.branchCode")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CompanyName"
              header={t("generalMasters.branchName")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.CompanyName?.toUpperCase()}
            ></Column>
            <Column
              field="Country"
              header={t("generalMasters.country")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="EmailID"
              header={t("generalMasters.emailId")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => <ToggleButton id={columnData.id} />}
              header={t("common.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => (
                <div className="action_icons">
                  <SvgIconeye onClick={() => handleView(columnData)} />
                  <SvgEditicons onClick={() => handleEdit(columnData)} />
                </div>
              )}
              header={t("common.actions")}
              headerStyle={headeractionStyle}
              className="fieldvalueaction_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default Index;
