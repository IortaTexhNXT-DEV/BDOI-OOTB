import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import UserSecurityActions from "./UserSecurityActions";
import { Tag } from "primereact/tag";
import userService from "../../../../../services/userService";
import { Toast } from "primereact/toast";
import { useDispatch, useSelector } from "react-redux";
import {
  getSearchUserMiddleware,
  getUserEditDataMiddleWare,
  getUserViewDataMiddleWare,
  getUserMiddleware,
} from "../store/userMiddleware";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";

const UserMaster = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const handleNavigate = () => {
    navigate("/master/generals/usermanagement/user/add");
  };
  const { userList, searchList } = useSelector(({ userReducers }) => {
    return {
      loading: userReducers?.loading,
      userList: userReducers?.userList || [],
      searchList: userReducers?.userSearchList || [],
    };
  });
  const dispatch = useDispatch();

  // Fetch users on component mount
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getUserMiddleware({ page: 1, limit: 100 }));
  const toggleUserStatus = (user, active) => userService.setUserStatus(user.id, active ? "active" : "inactive");
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getUserMiddleware({ page: 1, limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getSearchUserMiddleware(search));
    }
  }, [search, dispatch]);

  const handleView = (rowData) => {
    // Use fullUserData if available, otherwise use rowData
    const userData = rowData.fullUserData || rowData;
    dispatch(getUserViewDataMiddleWare(userData));
    navigate(`/master/generals/usermanagement/user/view/${rowData?.id}`);
  };

  const handlEdit = (rowData) => {
    // Use fullUserData if available, otherwise use rowData
    const userData = rowData.fullUserData || rowData;
    dispatch(getUserEditDataMiddleWare(userData));
    navigate(`/master/generals/usermanagement/user/edit/${rowData?.id}`);
  };
  const items = [
    { label: "Users and Access" },
    {
      label: "User",
      url: "/master/generals/usermanagement/user",
    },
  ];

  const home = { label: "Master" };
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    width: "16%",
  };

  const renderViewButton = (rowData) => (
    <RowActions onView={() => handleView(rowData)} onEdit={() => handlEdit(rowData)}>
      <UserSecurityActions row={rowData} onChanged={search ? () => dispatch(getSearchUserMiddleware(search)) : reloadList} />
    </RowActions>
  );

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
    <div className="grid overall__user__master__container">
      <Toast ref={statusToast} />
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title__hierarchy">User</div>
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
        <button type="button" className="add__icon__view__hierarchy bv-add-button" onClick={handleNavigate}>
          <span className="add__icon__hierarchy">
            <SvgAdd />
          </span>
          <span className="add__text__hierarchy">{t("generalMasters.add")}</span>
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
                  placeholder={t("generalMasters.searchByEmployeeCode")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-12 ">
            <div className="main__tabel__title__hierarchy pl-2">User List</div>
          </div>
          <div
            className="col-12 md:col-12 lg-col-12"
            style={{ maxWidth: "100%" }}
          >
            <div className="card">
              <DataTable
                value={search ? searchList : userList}
                style={{
                  overflowY: "auto",
                  maxWidth: "100%",
                }}
                responsive={true}
                className="table__view__hierarchy"
                paginator
                paginatorLeft
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}
                scrollable={true}
                scrollHeight="50vh"
              >
                <Column
                  field="userName"
                  header="User Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="assignedRole"
                  header="Assigned Role"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="email"
                  header="E-mail"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.email || rowData.fullUserData?.email || "-"}
                ></Column>
                <Column
                  field="displayName"
                  header="Display Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>

                <Column
                  field="status"
                  body={(columnData) => (
                    <div className="flex align-items-center gap-2">
                      <MasterStatusToggle
                        type="user"
                        record={columnData}
                        onToggle={toggleUserStatus}
                        onChanged={reloadList}
                        onError={showStatusError}
                      />
                      {String(columnData.status).toLowerCase() === "locked" && (
                        <Tag severity="warning" value={t("security.locked")} icon="pi pi-lock" />
                      )}
                    </div>
                  )}
                  header="Status"
                  headerStyle={headerStyle}
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

export default UserMaster;
