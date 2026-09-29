import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import SvgAdd from "../../../../../assets/icons/SvgAdd";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import NavBar from "../../../../../components/NavBar";
import SvgSearchIcon from "../../../../../assets/icons/SvgSearchIcon";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import SvgEyeIcon from "../../../../../assets/icons/SvgEyeIcon";
import SvgEditIcon from "../../../../../assets/icons/SvgEditIcon";
import ToggleButton from "../../../../../components/ToggleButton";
import { useDispatch, useSelector } from "react-redux";
import {
  getSearchUserMiddleware,
  getUserEditDataMiddleWare,
  getUserViewDataMiddleWare,
  getUserMiddleware,
} from "../store/userMiddleware";

const UserMaster = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const handleNavigate = () => {
    navigate("/master/generals/usermanagement/user/add");
  };
  const handleNavigateedit = () => {
    // navigate('/master/finance/hierarchy/hierarchydetails')
  };
  const { loading, userList, searchList } = useSelector(({ userReducers }) => {
    return {
      loading: userReducers?.loading,
      userList: userReducers?.userList || [],
      searchList: userReducers?.userSearchList || [],
    };
  });
  const dispatch = useDispatch();

  // Fetch users on component mount
  useEffect(() => {
    dispatch(getUserMiddleware({ page: 1, limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getSearchUserMiddleware(search));
    }
  }, [search, dispatch]);

  const handleView = (rowData) => {
    console.log(rowData, "rowData");
    // Use fullUserData if available, otherwise use rowData
    const userData = rowData.fullUserData || rowData;
    dispatch(getUserViewDataMiddleWare(userData));
    navigate(`/master/generals/usermanagement/user/view/${rowData?.id}`);
  };

  const handlEdit = (rowData) => {
    console.log(rowData, "gg");
    // Use fullUserData if available, otherwise use rowData
    const userData = rowData.fullUserData || rowData;
    dispatch(getUserEditDataMiddleWare(userData));
    navigate(`/master/generals/usermanagement/user/edit/${rowData?.id}`);
  };
  const items = [
    { label: "User Management" },
    {
      label: "User",
      url: "/master/generals/usermanagement/user",
    },
  ];

  const home = { label: "Master" };
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    width: "16%",
  };
  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    textAlign: "center",
    border: "none",
    textAlign: "center",
    // marginLeft:"6px"
    //  display: "flex",
    //  justifyContent: "center",alignItem:"center",
    //  width:"6%"
  };

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const renderViewButton = (rowData) => {
    console.log(rowData, "rowDatarowData");
    return (
      <div className="center__content__but">
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
        <div className="add__icon__view__hierarchy" onClick={handleNavigate}>
          <div className="add__icon__hierarchy">
            <SvgAdd />
          </div>
          <div className="add__text__hierarchy">{t("generalMasters.add")}</div>
        </div>
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
                rows={5}
                rowsPerPageOptions={[5, 10, 25, 50]}
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
                  body={(rowData) => rowData.userName?.toUpperCase()}
                ></Column>
                <Column
                  field="assignedRole"
                  header="Assigned Role"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.assignedRole?.toUpperCase()}
                ></Column>
                <Column
                  field="email"
                  header="E-mail"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="displayName"
                  header="Display Name"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                  body={(rowData) => rowData.displayName?.toUpperCase()}
                ></Column>

                <Column
                  field="status"
                  body={(columnData) => <ToggleButton id={columnData.id} />}
                  header="Status"
                  headerStyle={headerStyle}
                  className="fieldvalue_container"
                ></Column>
                <Column
                  field="action"
                  body={renderViewButton}
                  header="Action"
                  headerStyle={ViewheaderStyle}
                  // className="fieldvalue_container"
                  //  className="fieldvalue_container_centered"
                ></Column>
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserMaster;
