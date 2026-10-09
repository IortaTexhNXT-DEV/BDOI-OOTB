import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import SvgSearchIcon from "../../../../../assets/icons/SvgSearchIcon";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { useDispatch, useSelector } from "react-redux";
import {
  getHierarchyPatchMiddleWare,
  getHierarchyViewMiddleWare,
  getSearchHirarchyMiddleware,
  getHirarchyListMiddleware,
} from "../store/hierarchyMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";
import PageActions from "../../../../../components/PageActions";

const HierarchyMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleNavigate = () => {
    navigate("/master/generals/employeemanagement/hierarchy/add");
  };
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getHirarchyListMiddleware());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getHirarchyListMiddleware());
  }, [dispatch]);
  useEffect(() => {
    if (search.length > 0) {
      dispatch(getSearchHirarchyMiddleware(search));
    }
  }, [search]);

  const { hierarchTableList, hierarchSeachList } = useSelector(
    ({ hierarchyTableReducers }) => {
      return {
        loading: hierarchyTableReducers?.loading,
        hierarchTableList: hierarchyTableReducers?.hierarchTableList,
        hierarchSeachList: hierarchyTableReducers?.hierarchSeachList,
        total: hierarchyTableReducers,
      };
    }
  );
  const handleView = (rowData) => {
    dispatch(getHierarchyViewMiddleWare(rowData));
    navigate(
      `/master/generals/employeemanagement/hierarchy/view/${rowData.id}`
    );
  };

  const handlEdit = (rowData) => {
    dispatch(getHierarchyPatchMiddleWare(rowData));
    navigate(
      `/master/generals/employeemanagement/hierarchy/edit/${rowData?.id}`
    );
  };
  const items = [
    { label: t("generalMasters.employeeManagement") },
    {
      label: t("generalMasters.hierarchy"),
      url: "/master/generals/employeemanagement/hierarchy",
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

  const renderViewButton = (rowData) => <RowActions onView={() => handleView(rowData)} onEdit={() => handlEdit(rowData)} />;

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
            {t("generalMasters.rowCount")}{" "}
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
  return (
    <div className="grid overall__hierarchy__master__container">
      <Toast ref={statusToast} />
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__hierarchy">Hierarchy Master</div>
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
        <PageActions onAdd={handleNavigate} />
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
                  placeholder={t("generalMasters.searchByRankName")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__hierarchy p-2">
              Hierarchy List
            </div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={search ? hierarchSeachList : hierarchTableList}
                style={{ overflowY: "auto", maxWidth: "100%" }}
                responsive={true}
                className="table__view__hierarchy"
                paginator
                paginatorLeft
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}
                scrollable={true}
                scrollHeight="40vh"
              >
                <Column
                  field="rankCode"
                  header="Rank Code"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.rankCode?.toUpperCase()}
                ></Column>
                <Column
                  field="rankName"
                  header="Rank Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.rankName}
                ></Column>
                <Column
                  field="levelNumber"
                  header="Level Number"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => String(rowData.levelNumber ?? "")}
                ></Column>
                <Column
                  field="modifiedBy"
                  header="Modified By"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.modifiedBy}
                ></Column>
                <Column body={(row) => formatAppDate(row.modifiedOn)}
                  field="modifiedOn"
                  header="Modified On"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="status"
                  body={(columnData) => <MasterStatusToggle type="hierarchy" record={columnData} onChanged={reloadList} onError={showStatusError} />}
                  header="Status"
                  headerStyle={{ textAlign: "center", ...headerStyle }}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  body={renderViewButton}
                  header={t("common.actions")}
                  {...actionsColumn}
                />
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchyMaster;
