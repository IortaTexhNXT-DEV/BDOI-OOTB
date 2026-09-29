import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import { useDispatch, useSelector } from "react-redux";
import ToggleButton from "../../../../components/ToggleButton";
import SvgEditicons from "../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../assets/icons/SvgTable";
import {
  getCompanyEditData,
  getCompanyViewMiddleWare,
  getSearchCompanyMiddleware,
} from "./store/companyMiddleware";
import { useFormik } from "formik";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { companyTableList, loading, companySearchList } = useSelector(
    ({ organizationCompanyMainReducers }) => {
      return {
        loading: organizationCompanyMainReducers?.loading,
        companyTableList: organizationCompanyMainReducers?.companyTableList,
        companySearchList: organizationCompanyMainReducers?.companySearchList,
      };
    }
  );
  console.log(companyTableList, "companyTableList");
  const dispatch = useDispatch();
  const handleView = (columnData) => {
    dispatch(getCompanyViewMiddleWare(columnData));
    navigate(
      `/master/generals/organization/companymaster/view/${columnData.id}`
    );
  };
  const handleEdit = (columnData) => {
    dispatch(getCompanyEditData(columnData));
    navigate(
      `/master/generals/organization/companymaster/edit/${columnData?.id}`
    );
  };
  const handlePolicy = (id) => {
    navigate(`/master/generals/organization/companymaster/add/${123}`);
  };

  console.log("first", companyTableList);

  const isEmpty = companyTableList.length === 0;

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
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
              {t("generalMasters.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
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
    width: "26%",
    // backgroundColor: 'red',
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
      label: t("generalMasters.company"),
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

  const handleSubmit = (values) => {
    console.log(values.search, "getSearchCompanyMiddleware");
    dispatch(getSearchCompanyMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchCompanyMiddleware({ textSearch: formik.values.search })
      );
    }
  }, [formik.values.search]);

  return (
    <div className="overall__company__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("generalMasters.companyMaster")}</label>
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

      <Card

      //   className="overallcard_container"
      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12" style={{ paddingLeft: 0 }}>
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("generalMasters.searchByCompanyCode")}
                className="searchinput_left"
                value={formik.values.search}
                onChange={formik.handleChange("search")}
              />
            </span>
          </div>
        </div>
        <div className="headlist_lable">{t("generalMasters.company")}</div>

        {/* </div> */}

        <div>
          <DataTable
            value={
              formik.values.search !== "" ? companySearchList : companyTableList
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
              field="CompanyCode"
              header={t("generalMasters.companyCode")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CompanyName"
              header={t("generalMasters.companyName")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.CompanyName?.toUpperCase()}
            ></Column>
            <Column
              field="LicenseNumber"
              header={t("generalMasters.licenseNumber")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Country"
              header={t("generalMasters.country")}
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
              className="fieldvalue_container"
              headerStyle={headerStyle}
            />
            <Column
              body={(columnData) => (
                <div className="action_icons">
                  <SvgIconeye onClick={() => handleView(columnData)} />
                  <SvgEditicons onClick={() => handleEdit(columnData)} />
                </div>
              )}
              header={t("generalMasters.view")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default Index;
