import React, { useState, useEffect } from "react";
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
import ToggleButton from "../../../../../components/ToggleButton";
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { getSearchInsurancelineOfBusinessMiddleware } from "../store/insuranceLineOfBusinessMiddleware";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { InsuranceLineOfBusinessList, loading, SearchTableList } = useSelector(
    ({ insuranceLineOfBusinessReducers }) => {
      return {
        loading: insuranceLineOfBusinessReducers?.loading,
        InsuranceLineOfBusinessList:
          insuranceLineOfBusinessReducers?.InsuranceLineOfBusinessList,
        SearchTableList: insuranceLineOfBusinessReducers?.SearchTableList,
      };
    }
  );
  // const navigate = useNavigation();

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
          {/* <React.Fragment> */}
          <span style={{ color: "var(--text-color)", userSelect: "none" }}>
            {t("generalMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
          {/* </React.Fragment> */}
        </div>
      );
    },
  };
  const renderActionButton = (rowData) => {
    return (
      <div className="action__button__container">
        <Button
          icon={<SvgIconeye />}
          onClick={() => handleView(rowData.id)}
          className="action__button p-0"
        />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEdit(rowData.id)}
          className="action__button p-0 w-auto"
        />
      </div>
    );
  };
  const handleView = (id) => {
    navigate(`/master/generals/insurancemanagement/lineofbusiness/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/lineofbusiness/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsurancelineOfBusinessMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsurancelineOfBusinessMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="line__business__compnay_container">
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
          <div className="table__title">{t("generalMasters.lineOfBusiness")}</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== ""
            ? SearchTableList
            : InsuranceLineOfBusinessList
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
          field="businessCode"
          header="Line of Business Code"
          className="fieldvalue_container"
          sortable
          body={(rowData) => rowData.businessCode?.toUpperCase()}
        ></Column>
        <Column
          field="LOBName"
          header="LOB Name"
          className="fieldvalue_container"
          body={(rowData) => rowData.LOBName?.toUpperCase()}
        ></Column>

        <Column
          field="modifiedby"
          header="Modified by"
          className="fieldvalue_container"
          body={(rowData) => rowData.modifiedby?.toUpperCase()}
        ></Column>
        <Column
          field="modifiedOn"
          header="Modified On"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="status"
          header="status"
          className="fieldvalue_container"
          body={(columnData) => <ToggleButton id={columnData.id} />}
        ></Column>
        <Column
          field="id"
          body={renderActionButton}
          header="Action"
          headerStyle={{ textAlign: "center" }}
          className="fieldvalueaction_container"
          // style={{textAlign:'center'}}
        ></Column>
      </DataTable>
    </div>
  );
};

export default TableData;
