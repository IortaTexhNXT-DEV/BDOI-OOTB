import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/icons/SvgAdd";
import "../TaxationMaster/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgEditIcon from "../../../assets/icons/SvgEditicons";
import { useDispatch, useSelector } from "react-redux";
import {
  getTaxationSearchList,
  getTaxationView,
  getpatchTaxationEdit,
  getTaxationData,
} from "./store/taxationMiddleWare";
import SvgTable from "../../../assets/icons/SvgTable";
import MasterStatusToggle from "../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

const TaxationMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleNavigate = () => {
    navigate("/master/finance/taxation/addtaxation");
  };

  const items = [{ label: t("financeMasters.taxation"), url: "/master/finance/taxation" }];
  const home = { label: t("financeMasters.master") };
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };


  const [search, setSearch] = useState("");

  const { taxationList, taxationSearchList } = useSelector(
    ({ taxationMainReducers }) => {
      return {
        loading: taxationMainReducers?.loading,
        taxationList: taxationMainReducers?.taxationList,
        taxationSearchList: taxationMainReducers?.taxationSearchList,
      };
    }
  );

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

  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getTaxationData());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getTaxationData());
  }, [dispatch]);
  const handleView = (rowData) => {
    dispatch(getTaxationView(rowData));
    navigate("/master/finance/taxation/taxationdetails");
  };
  const handlEdit = (rowData) => {
    dispatch(getpatchTaxationEdit(rowData));
    navigate("/master/finance/taxation/taxationedit");
  };
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
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
              {t("financeMasters.rowCount")}{" "}
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

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getTaxationSearchList(search));
    }
  }, [search]);
  return (
    <div className="grid  container__taxation">
      <Toast ref={statusToast} />
      <div className="col-12"></div>
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__taxation">Taxation Master</div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal__taxation"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 md:col-6 lg:col-6 add__icon__alighn__taxation mb-1">
        <button type="button" className="add__icon__view__taxation bv-add-button" onClick={handleNavigate}>
          <div className="add__icon__taxation">
            <SvgAdd />
          </div>
          <div className="add__text__taxation">{t("financeMasters.add")}</div>
        </button>
      </div>
      <div className="col-12 m-0 ">
        <div className="sub__account__sub__container__taxation">
          <div className="col-12 search__filter__view__taxation">
            <div className="col-12 md:col-12 lg:col-12">
              <div className="searchIcon__view__input__taxation">

                <i className="pi pi-search pl-3" />
                <InputText
                  style={{ width: "100%" }}
                  classNames="input__sub__account__taxation"
                  placeholder={t("financeMasters.searchByTaxCode")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__taxation p-2">
              {t("financeMasters.taxationList")}
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={search ? taxationSearchList : taxationList}
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
                  field="taxCode"
                  header={t("financeMasters.taxCode")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.taxCode?.toUpperCase()}
                  sortable
                ></Column>
                <Column
                  field="taxName"
                  header={t("financeMasters.taxName")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.taxName}
                  //   sortable
                ></Column>
                <Column
                  field="taxRate"
                  header="Tax Rate"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => (rowData.taxRate ?? "") === "" ? "" : `${rowData.taxRate}%`}
                  sortable
                ></Column>
                <Column body={(row) => formatAppDate(row.effectiveFrom)}
                  field="effectiveFrom"
                  header={t("financeMasters.effectiveFrom")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column body={(row) => formatAppDate(row.effectiveTo)}
                  field="effectiveTo"
                  header={t("financeMasters.effectiveTo")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="status"
                  body={(columnData) => <MasterStatusToggle type="taxation" record={columnData} onChanged={reloadList} onError={showStatusError} />}
                  header={t("financeMasters.status")}
                  headerStyle={{ textAlign: "center", ...headerStyle }}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="action"
                  body={renderViewButton}
                  header={t("financeMasters.action")}
                  headerStyle={{ ...ViewheaderStyle }}
                  className="fieldvalue_container centered"
                ></Column>
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxationMaster;
