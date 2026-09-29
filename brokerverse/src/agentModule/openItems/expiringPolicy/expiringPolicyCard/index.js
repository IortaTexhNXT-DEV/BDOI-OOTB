import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgMotorTable from "../../../../assets/agentIcon/SvgMotorTable";
import SvgDownArrow from "../../../../assets/agentIcon/SvgDownArrow";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import SvgDots from "../../../../assets/agentIcon/SvgDot";
import { Menu } from "primereact/menu";
import { useSelector, useDispatch } from "react-redux";
import { getexpiringtableMiddleware, getExpiringSearchDataMiddleWare } from "../expiringPolicyCard/store/expiringMiddleware";
import { Avatar } from "primereact/avatar";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const ExpiringPolicyCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Name");
  const [, setdisableOption] = useState("");
  const dispatch = useDispatch();
  const menu = useRef(null);

  const { expiringtabledata, expiringSearchList } = useSelector(
    ({ agentExpiringMainReducers }) => {
      return {
        loading: agentExpiringMainReducers?.loading,
        expiringtabledata: agentExpiringMainReducers?.expiringtabledata,
        expiringSearchList: agentExpiringMainReducers?.expiringSearchList,
      };
    }
  );

  const policy = [
    { name: t("openItems.name"), code: "Name" },
    { name: t("openItems.policyNumber"), code: "policy Number" },
  ];

  const handleMenuToggle = (event, menuRef, rowData) => {
    menuRef.current.toggle(event);
    setdisableOption(
      rowData.Payment === "Pending" || rowData.Payment === "Reviewing"
    );
  };
  const handleMenuClick = (menuItem) => {
    if (menuItem == "renewal") {
      navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${123}`);
    }
  };

  const renderViewEditButton = (rowData) => {
    const menuItems = [
      {
        label: t("openItems.reminder"),
      },

      {
        label: t("openItems.renewal"),
        command: () => handleMenuClick("renewal"),
      },
    ];
    return (
      <div className="action__container">
        <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
        <div
          className="action__Svg"
          onClick={(event) => handleMenuToggle(event, menu, rowData)}
        >
          <SvgDots />
        </div>
      </div>
    );
  };

  useEffect(() => {
    dispatch(getexpiringtableMiddleware());
  }, [dispatch]);

  useEffect(() => {
    if (globalFilter && search) {
      dispatch(
        getExpiringSearchDataMiddleWare({
          field: globalFilter,
          value: search,
        })
      );
    }
  }, [search]);


  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };


  const handleSvg = (type, index) => {
    const colors = [
      "#D4635D",
      "#67D07A",
      "#D4635D",
      "#874EFF",
      "#EDC63B",
      "#A36EFF",
      "#5DCB67",
      "#0072d8",
      "#D8BFD8",
      "#FFA07A",
    ];

    const backgroundColor =
      colors[parseInt(index) % colors.length] || "#CCCCCC";

    return (
      <Avatar
        label={type.charAt(0)}
        size="xlarge"
        shape="circle"
        style={{ backgroundColor: backgroundColor, color: "#fff" }}
      />
    );
  };

  const renderName = (rowData) => {
    return (
      <div className="name__box__container">
        <div>{handleSvg(rowData.AssuredName, rowData.id)}</div>
        <div>
          <div className="name__text">{rowData.AssuredName?.toUpperCase()}</div>
          <div className="assuredname__sub___text">
            Client ID :{rowData.Actions?.toUpperCase()}{" "}
          </div>
        </div>
      </div>
    );
  };

  const renderPolicyNumber = (rowData) => {
    return (
      <div className="policy__number__container">
        <div>
          <SvgMotorTable />
        </div>
        <div>
          <div className="policy__number__text">
            {rowData.PolicyNumber?.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };


  const renderExpiryDate = (rowData) => {
    return (
      <div className="expiry__data__container">
        <div className="expiry__data__text">
          {formatAppDate(rowData.ExpiryDate)}
        </div>
      </div>
    );
  };

  const renderExpiry = (rowData) => {
    return (
      <div className="days__count__container">
        <div className="days__count__text">{rowData.Expiry?.toUpperCase()}</div>
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
          <React.Fragment>
            <span
              className="table__selector__text"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("openItems.rowsPerPage")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
              dropdownIcon={<SvgDownArrow />}
            />
          </React.Fragment>
        </div>
      );
    },
  };


  return (
    <div className="expiring__policy__card__container mt-4">
      <Card>
        <div class="grid">
          <div class="col-12 md:col-9 lg:col-9">
            <span className="p-input-icon-left">
              <i className="pi pi-search" />
              <InputText
                placeholder={t("openItems.search")}
                style={{
                  width: "100%",
                  padding: "1rem 2.75rem",
                  borderRadius: "10px",
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <Dropdown
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.value)}
              options={policy}
              optionLabel="name"
              optionValue="code"
              placeholder={t("openItems.searchBy")}
              className="feat_searchby_container"
              dropdownIcon={<SvgDownArrow />}
            />
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={search ? expiringSearchList : expiringtabledata}
            tableStyle={{ minWidth: "50rem" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="60vh"
          >
            <Column
              body={renderName}
              header={t("openItems.assuredName")}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderPolicyNumber}
              header={t("openItems.policyNumber")}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderExpiryDate}
              header={t("openItems.expiryDate")}
              headerStyle={headerStyle}
            ></Column>
            <Column
              body={renderExpiry}
              header={t("openItems.expiry")}
              headerStyle={headerStyle}
            ></Column>
          <Column
              body={renderViewEditButton}
              header={t("openItems.actions")}
              headerStyle={headerStyle}
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default ExpiringPolicyCard;
