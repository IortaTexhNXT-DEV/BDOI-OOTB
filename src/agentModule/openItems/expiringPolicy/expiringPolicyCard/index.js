import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import TableDropdownField from "../../../component/tableDropDwonField";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgMotorTable from "../../../../assets/agentIcon/SvgMotorTable";
import SvgProfileC from "../../../../assets/agentIcon/SvgProfileC";
import SvgArrow from "../../../../assets/agentIcon/SvgArrow";
import SvgDownArrow from "../../../../assets/agentIcon/SvgDownArrow";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgDots from "../../../../assets/agentIcon/SvgDot";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { useSelector, useDispatch } from "react-redux";
import ClientListing from "../../../quoteModule/clientListing";
import { getExpiringSearchDataMiddleWare } from "../expiringPolicyCard/store/expiringMiddleware";
import { collectFromHash } from "@fullcalendar/core/internal";
import { Avatar } from "primereact/avatar";

const ExpiringPolicyCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Name");
  const [displayDialog, setDisplayDialog] = useState("");
  const [disableOption, setdisableOption] = useState("");
  const dispatch = useDispatch();
  const menu = useRef(null);

  const { expiringtabledata, expiringSearchList, loading } = useSelector(
    ({ agentExpiringMainReducers }) => {
      console.log(agentExpiringMainReducers, "find mainred");
      return {
        loading: agentExpiringMainReducers?.loading,
        expiringtabledata: agentExpiringMainReducers?.expiringtabledata,
        expiringSearchList: agentExpiringMainReducers?.expiringSearchList,
      };
    }
  );
  console.log(expiringSearchList, "find1");

  // const [globalFilter, setGlobalFilter] = useState("policy Number");
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
      // <div className="btn__container__view__edit">
      //   <Menu model={menuItems} popup ref={menu} breakpoint="767px" />
      //   <Button
      //     icon={<SvgDot />}
      //     className="view__btn"
      //     onClick={(event) => handleMenuToggle(event, menu, rowData)}
      //   />
      // </div>
    );
  };

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

  const TableData = [
    {
      AssuredName: "John Doe",
      PolicyNumber: "P12345",
      ExpiryDate: "2024 JAN 15",
      policyIssued: "2025 JAN 15",
      Expiry: "30 Days",
      Actions: "127332",
    },
    {
      AssuredName: "Jane Smith",
      PolicyNumber: "P67890",
      ExpiryDate: "2024 JAN 22",
      policyIssued: "2025 JAN 15",
      Expiry: "Expired",
      Actions: "1272721",
    },
    {
      AssuredName: "Bob Johnson",
      PolicyNumber: "P54321",
      ExpiryDate: "2024 JAN 10",
      policyIssued: "2025 JAN 15",
      Expiry: "45 Days",
      Actions: "1270002",
    },
    {
      AssuredName: "Alice Williams",
      PolicyNumber: "P98765",
      ExpiryDate: "2024 JAN 05",
      policyIssued: "2025 JAN 15",
      Expiry: "10 Days",
      Actions: "120002",
    },
    {
      AssuredName: "Mike Davis",
      PolicyNumber: "P23456",
      ExpiryDate: "2024 JAN 18",
      policyIssued: "2025 JAN 15",
      Expiry: "25 Days",
      Actions: "111172",
    },
    {
      AssuredName: "Sara Miller",
      PolicyNumber: "P78901",
      ExpiryDate: "2024 JAN 01",
      policyIssued: "2025 JAN 15",
      Expiry: "20 Days",
      Actions: "12000",
    },
    {
      AssuredName: "Chris Brown",
      PolicyNumber: "P65432",
      ExpiryDate: "2024 JAN 12",
      Expiry: "35 Days",
      Actions: "1221112",
    },
    {
      AssuredName: "Emily Taylor",
      PolicyNumber: "P12398",
      ExpiryDate: "2024 JAN 28",
      policyIssued: "2025 JAN 15",
      Expiry: "28 Days",
      Actions: "12002",
    },
    {
      AssuredName: "David Wilson",
      PolicyNumber: "P56789",
      ExpiryDate: "2024-08-03",
      Expiry: "40 Days",
      Actions: "12233",
    },
    {
      AssuredName: "Grace Anderson",
      PolicyNumber: "P87654",
      ExpiryDate: "2024-07-20",
      policyIssued: "2025 JAN 15",
      Expiry: "12 Days",
      Actions: "127272",
    },
  ];

  const headerStyle = {
    textalign: "center",
    fontSize: 16,
    fontFamily: "Poppins",
    fontWeight: 500,
    color: "#000",
    border: " none",
  };

  const renderAssuredName = (rowData) => {
    return (
      <div className="assured__container">
        <div>
          <SvgProfileC />
        </div>
        <div>
          <div className="assuredname__text">{rowData.AssuredName}</div>
          <div className="assuredname__sub___text">
            Client ID :{rowData.Actions}{" "}
          </div>
        </div>
      </div>
    );
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
      "#6366F1",
      "#D8BFD8",
      "#FFA07A",
    ];

    const backgroundColor =
      colors[parseInt(index) % colors.length] || "#CCCCCC";
    console.log(parseInt(index) % colors.length, "find");

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
  const renderGross = (rowData) => {
    return (
      <div className="expiry__data__container">
        <div className="expiry__data__text">{rowData.gross?.toUpperCase()}</div>
      </div>
    );
  };

  const renderIssuedDate = (rowData) => {
    return (
      <div className="expiry__data__container">
        <div className="expiry__data__text">
          {rowData.policyIssued?.toUpperCase()}
        </div>
      </div>
    );
  };

  const renderExpiryDate = (rowData) => {
    return (
      <div className="expiry__data__container">
        <div className="expiry__data__text">
          {rowData.ExpiryDate?.toUpperCase()}
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

  // const renderAction = () => {
  //   return (
  //     <div className="action__container">
  //       <div
  //         className="action__Svg"
  //         onClick={() => {
  //           handlesubmit();
  //         }}
  //       >
  //         <SvgDots/>
  //       </div>
  //     </div>
  //   );
  // };

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

  const handlesubmit = () => {
    // navigate("/agent/policydetailedviewonly");
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
            // value={TableData}
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
            {/* <Column
              body={renderGross}
              header="Gross premium"
              headerStyle={headerStyle}
            ></Column> */}
            {/* <Column
              body={renderIssuedDate}
              header={t("openItems.policyIssued")}
              headerStyle={headerStyle}
            ></Column> */}
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
