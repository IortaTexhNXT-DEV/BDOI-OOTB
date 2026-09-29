import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgIconeye from "../../../../../assets/icons/SvgIconeye";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { InputSwitch } from "primereact/inputswitch";
import ToggleButton from "../../../../../components/ToggleButton";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import {
  getInsurancePatchData,
  getInsuranceViewMiddleWare,
  getSearchInsuranceCompanyMiddleware,
} from "../store/insuranceCompanyMiddleware";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { InsuranceCompanyList, loading, SearchTableList } = useSelector(
    ({ insuranceCompanyReducers }) => {
      return {
        loading: insuranceCompanyReducers?.loading,
        InsuranceCompanyList: insuranceCompanyReducers?.InsuranceCompanyList,
        SearchTableList: insuranceCompanyReducers?.SearchTableList,
      };
    }
  );
  console.log(InsuranceCompanyList, "InsuranceCompanyList");
  const headeraction = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    // display:'flex',
    // justifyContent:'space-around',
    // alignItem:'center'
  };

  const headerstyle = {
    // width: '10rem',
    // backgroundColor: 'red',
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };
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
  const renderActionButton = (rowData) => {
    console.log(rowData, "rowDatarowData");
    return (
      <div className="action__button__container">
        <Button
          icon={<SvgIconeye />}
          onClick={() => handleView(rowData)}
          className="action__button p-0"
        />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEdit(rowData)}
          className="action__button p-0 w-auto"
        />
      </div>
    );
  };

  const handleView = (rowData) => {
    console.log(rowData, "find");
    dispatch(getInsuranceViewMiddleWare(rowData));
    navigate(
      `/master/generals/insurancemanagement/insurancecompany/view/${rowData?.id}`
    );
  };
  const handleEdit = (rowData) => {
    console.log(rowData, "rowData");
    dispatch(getInsurancePatchData(rowData));
    navigate(
      `/master/generals/insurancemanagement/insurancecompany/edit/${rowData?.id}`
    );
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsuranceCompanyMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsuranceCompanyMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="insurance__company__table__container">
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("generalMasters.searchByInsuranceCompanyCode")}
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">{t("generalMasters.insuranceCompanyList")}</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== "" ? SearchTableList : InsuranceCompanyList
        }
        paginator
        rows={5}
        rowsPerPageOptions={[5, 10, 25, 50]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="insuranceCompanyCode"
          header={t("generalMasters.companyCodeHeader")}
          className="fieldvalue_container"
          headerStyle={headerstyle}
          sortable
        ></Column>
        <Column
          field="insuranceCompanyName"
          header={t("generalMasters.companyName")}
          className="fieldvalue_container"
          headerStyle={headerstyle}
          body={(rowData) => rowData.insuranceCompanyName?.toUpperCase()}
        ></Column>
        <Column
          field="email"
          header={t("generalMasters.eMail")}
          className="fieldvalue_container"
          headerStyle={headerstyle}
        ></Column>
        <Column
          field="phoneNumber"
          headerStyle={headerstyle}
          header={t("generalMasters.phoneNumber")}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="modifiedby"
          header={t("generalMasters.modifiedBy")}
          headerStyle={headerstyle}
          className="fieldvalue_container"
          body={(rowData) => rowData.modifiedby?.toUpperCase()}
        ></Column>
        <Column
          field="modifiedOn"
          header={t("generalMasters.modifiedOn")}
          className="fieldvalue_container"
          headerStyle={headerstyle}
        ></Column>
        <Column
          field="status"
          header={t("common.status")}
          className="fieldvalue_container"
          headerStyle={headerstyle}
          body={(columnData) => <ToggleButton id={columnData.id} />}
        ></Column>
        <Column
          // style={{
          //   padding: "20px 1rem 17px 0px",
          // }}
          // field="id"
          body={renderActionButton}
          header={t("common.actions")}
          // className="fieldvalue_container"
          // headerStyle={{
          //   display: "flex",
          //   justifyContent: "center",
          //   alignItems: "center",
          // }}
          className="fieldvalueaction_container"
          headerStyle={headeraction}
        ></Column>
      </DataTable>
    </div>
  );
};

export default TableData;
