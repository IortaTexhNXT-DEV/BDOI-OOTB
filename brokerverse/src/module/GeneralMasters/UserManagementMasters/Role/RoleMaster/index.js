import React, { useEffect, useState, useRef } from "react";
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
import { Checkbox } from "primereact/checkbox";
import { useDispatch, useSelector } from "react-redux";
import {
  getSearchRoleMiddleware,
  getRoleListMiddleware,
} from "../store/roleMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import userService from "../../../../../services/userService";
import { formatDate } from "../../../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";
import PageActions from "../../../../../components/PageActions";

const RoleMaster = () => {
  const { t } = useTranslation();
  const { roleTableList, roleSearchList } = useSelector(
    ({ roleMainReducers }) => {
      return {
        loading: roleMainReducers?.loading,
        roleTableList: roleMainReducers?.roleTableList,
        roleSearchList: roleMainReducers?.roleSearchList,
      };
    }
  );
  const [search, setSearch] = useState("");
  // the roles of the base platform (setting access.platform_roles) are listed only when asked for
  const [showPlatform, setShowPlatform] = useState(false);
  const rows = (search ? roleSearchList : roleTableList)?.filter((role) => showPlatform || !role.platform);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getRoleListMiddleware());
  const toggleRoleStatus = (role, active) =>
    userService.updateRole(role.id, { status: active ? "active" : "inactive" });
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getRoleListMiddleware());
  }, [dispatch]);
  const handleNavigate = () => {
    navigate("/master/generals/usermanagement/role/add/1");
  };
  // the view and edit screens load the record of the address
  const handleView = (rowData) => {
    navigate(`/master/generals/usermanagement/role/view/${rowData.id}`);
  };

  const handlEdit = (rowData) => {
    navigate(`/master/generals/usermanagement/role/edit/${rowData.id}`);
  };

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getSearchRoleMiddleware(search));
    }
  }, [search]);
  const items = [
    { label: t("generalMasters.userManagement") },
    {
      label: t("generalMasters.role"),
      url: "/master/generals/usermanagement/role",
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

  const [, setFirst] = useState(0);
  const [, setRowsPerPage] = useState(10);

  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
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
    <div className="grid overall__role__master__container">
      <Toast ref={statusToast} />
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__hierarchy">Role Master</div>
        <div className="mt-3">
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
                  placeholder={t("generalMasters.searchByRoleName")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex align-items-center gap-2 mt-3">
                <Checkbox inputId="role-platform" checked={showPlatform} onChange={(e) => setShowPlatform(e.checked)} />
                <label htmlFor="role-platform">{t("generalMasters.includePlatformRoles", "Include the base platform roles")}</label>
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__hierarchy pl-2">Role List</div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={rows}
                style={{ overflowY: "auto", maxWidth: "100%" }}
                responsive={true}
                className="table__view__hierarchy"
                paginator
                paginatorLeft
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}
                onPage={onPageChange}
                onPageChange={onPageChange}
                scrollable={true}
                scrollHeight="40vh"
              >
                <Column
                  field="roleCode"
                  header="Role Code"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.roleCode?.toUpperCase()}
                ></Column>
                <Column
                  field="roleName"
                  header="Role Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.roleName}
                ></Column>
                <Column
                  field="department"
                  header={t("generalMasters.department", "Department")}
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>

                <Column
                  field="modifiedBy"
                  header="Modified By"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.modifiedBy || t("generalMasters.systemSetup", "System set-up")}
                ></Column>
                <Column
                  field="modifiedOn"
                  header="Modified On"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => formatDate(rowData.modifiedOn)}
                ></Column>
                <Column
                  field="status"
                  body={(columnData) => <MasterStatusToggle type="role" record={columnData} onToggle={toggleRoleStatus} onChanged={reloadList} onError={showStatusError} />}
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

export default RoleMaster;
