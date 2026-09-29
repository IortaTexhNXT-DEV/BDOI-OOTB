import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import SvgAdd from "../../../../../assets/icons/SvgAdd";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import SvgSearchIcon from "../../../../../assets/icons/SvgSearchIcon";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgEyeIcon from "../../../../../assets/icons/SvgEyeIcon";
import SvgEditIcon from "../../../../../assets/icons/SvgEditIcon";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  getDesignationPatchData,
  getDesignationViewData,
  getSearchDesignationMiddleware,
  getDesignationListByIdMiddleware,
} from "../store/designationMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";

const DesignationMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { designationDetailList, designationSearchList } = useSelector(
    ({ designationMainReducers }) => {
      return {
        loading: designationMainReducers?.loading,
        designationDetailList: designationMainReducers?.designationDetailList,
        designationSearchList: designationMainReducers?.designationSearchList,
      };
    }
  );
  const handleNavigate = () => {
    navigate("/master/generals/employeemanagement/designation/add/1");
  };
  const handleView = (rowData) => {
    dispatch(getDesignationViewData(rowData));
    navigate("/master/generals/employeemanagement/designation/view/2");
  };

  const handlEdit = (rowData) => {
    dispatch(getDesignationPatchData(rowData));
    navigate("/master/generals/employeemanagement/designation/edit/3");
  };
  const items = [
    { label: t("generalMasters.employeeManagement") },
    {
      label: t("generalMasters.designation"),
      url: "/master/generals/employeemanagement/designation",
    },
  ];

  const home = { label: t("generalMasters.master") };
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };
  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getDesignationListByIdMiddleware());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getDesignationListByIdMiddleware());
  }, [dispatch]);

  const [, setFirst] = useState(0);
  const [, setRowsPerPage] = useState(10);

  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const handleSubmit = (values) => {
    dispatch(getSearchDesignationMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });

  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchDesignationMiddleware({ textSearch: formik.values.search })
      );
    }
  }, [formik.values.search]);

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)}
        />
        <Button
          icon={<SvgEditIcon />}
          className="eye__btn"
          onClick={() => handlEdit(rowData)}
        />
      </div>
    );
  };

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

  return (
    <div className="grid overall__designation__master__container">
      <Toast ref={statusToast} />
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__hierarchy">Designation</div>
        <div style={{ margin: "20px 0px" }}>
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal__hierarchy"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 md:col-6 lg:col-6 add__icon__alighn__hierarchy mb-1">
        <button type="button" className="add__icon__view__hierarchy bv-add-button" onClick={handleNavigate}>
          <div className="add__icon__hierarchy">
            <SvgAdd />
          </div>
          <div className="add__text__hierarchy">{t("generalMasters.add")}</div>
        </button>
      </div>
      <div className="col-12 m-0 ">
        <div className="sub__account__sub__container__hierarchy">
          <div className="col-12 search__filter__view__hierarchy">
            <div className="col-12 md:col-12 lg:col-12">
              <div className="searchIcon__view__input__hierarchy">
                <span className="pl-3">
                  {" "}
                  <SvgSearchIcon />
                </span>
                <InputText
                  style={{ width: "100%" }}
                  classNames="input__sub__account__hierarchy"
                  placeholder={t("generalMasters.searchByDesignationCode")}
                  value={formik.values.search}
                  onChange={formik.handleChange("search")}
                />
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__hierarchy p-2">
              {t("generalMasters.designation")}
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={
                  formik.values.search !== ""
                    ? designationSearchList
                    : designationDetailList
                }
                style={{ overflowY: "auto", maxWidth: "100%" }}
                responsive={true}
                className="table__view__hierarchy"
                paginator
                paginatorLeft
                rows={5}
                rowsPerPageOptions={[5, 10, 25, 50]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}
                onPage={onPageChange}
                onPageChange={onPageChange}
                scrollable={true}
                scrollHeight="40vh"
              >
                <Column
                  field="designationCode"
                  header="Designation Code"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.designationCode?.toUpperCase()}
                ></Column>
                <Column
                  field="designationName"
                  header="Designation Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.designationName?.toUpperCase()}
                ></Column>
                <Column
                  field="departmentCode"
                  header="Department Code"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.departmentCode?.toUpperCase()}
                ></Column>
                <Column
                  field="ModifiedBy"
                  header="Modified By"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.ModifiedBy?.toUpperCase()}
                ></Column>
                <Column body={(row) => formatAppDate(row.modifiedOn)}
                  field="modifiedOn"
                  header="Modified On"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="status"
                  body={(columnData) => <MasterStatusToggle type="designation" record={columnData} onChanged={reloadList} onError={showStatusError} />}
                  header="Status"
                  headerStyle={{ textAlign: "center", ...headerStyle }}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="action"
                  body={renderViewButton}
                  header="Action"
                  headerStyle={{ ...ViewheaderStyle }}
                  className="fieldvalue_container_centered"
                ></Column>
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignationMaster;
