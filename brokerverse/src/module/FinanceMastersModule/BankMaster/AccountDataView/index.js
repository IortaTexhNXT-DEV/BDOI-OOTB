import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { TieredMenu } from "primereact/tieredmenu";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { useDispatch, useSelector } from "react-redux";
import SvgEditicon from "../../../../assets/icons/SvgEdit";
import SvgEdit from "../../../../assets/icons/SvgEdits";
import ToggleButton from "../../../../components/ToggleButton";
import SvgTable from "../../../../assets/icons/SvgTable";
import {
  getAccountDetailsView,
  getPatchAccountDetailsView,
  getSeachAddAccountDetails,
} from "../store/bankMasterMiddleware";

const Index = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const { AccountDetailsList, loading, searchAccountDetails } = useSelector(
    ({ bankMasterReducer }) => {
      return {
        loading: bankMasterReducer?.loading,
        AccountDetailsList: bankMasterReducer?.AccountDetailsList,
        searchAccountDetails: bankMasterReducer?.searchAccountDetails,
      };
    }
  );
  const dispatch = useDispatch();
  const handleView = (columnData) => {
    dispatch(getAccountDetailsView(columnData));
    navigate("/master/finance/bank/accountdataview/viewaccountdetail");
  };
  const handleEdit = (columnData) => {
    dispatch(getPatchAccountDetailsView(columnData));
    navigate("/master/finance/bank/accountdataview/editaccountdetail");
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
            {t("financeMasters.rowCount")}{" "}
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

  const menu = useRef(null);
  const menuitems = [
    {
      label: "Name",
    },
    {
      label: "Date",
    },
    {
      label: "Voucher Number",
    },
  ];

  const headerStyle = {
    // width: '19%',
    // backgroundColor: 'red',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  const items = [
    { label: t("financeMasters.bank"), url: "/master/finance/bank" },
    { label: t("financeMasters.accountDetails") },
  ];
  const renderToggleButton = () => {
    return (
      <div>
        <ToggleButton />
      </div>
    );
  };
  const home = { label: t("financeMasters.master") };

  const navigate = useNavigate();
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [globalFilter, setGlobalFilter] = useState("");

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };
  const isEmpty = AccountDetailsList?.length === 0 || "undefined";
  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div style={{ textAlign: "center" }}>No data entered</div>
    </div>
  );

  const onGlobalFilterChange = (event) => {
    setGlobalFilter(event.target.value);
  };

  const handlePolicy = () => {
    navigate("/master/finance/bank/accountdataview/addaccountdetail");
  };
  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getSeachAddAccountDetails(search));
    }
  }, [search]);

  return (
    <div className="overall__accountdataview__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.accountDetails")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">

          <button type="button" className="addbutton_container bv-add-button" onClick={handlePolicy}>
            <SvgAdd />
            <p className="addtext">{t("financeMasters.addAccount")}</p>
          </button>
        </div>
      </div>

      <Card

      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-12 lg:col-12" style={{ paddingLeft: 0 }}>
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("financeMasters.searchByAccountNumber")}
                className="searchinput_left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          {/* </div> */}
        </div>
        <div className="headlist_lable">Bank Account List</div>

        {/* </div> */}

        <div>
          <DataTable
            value={search ? searchAccountDetails : AccountDetailsList}
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="AccountNumber"
              header={t("financeMasters.accountNumber")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="AccountName"
              header={t("financeMasters.accountName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.AccountName?.toUpperCase()}
            ></Column>
            <Column
              field="AccountType"
              header="Account Type"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.AccountType?.toUpperCase()}
            ></Column>
            <Column
              field="MainAccount"
              header={t("financeMasters.mainAccount")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.MainAccount?.toUpperCase()}
            ></Column>

            <Column
              field="TransactionLimit"
              header={t("financeMasters.maxTransactionLimit")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            <Column
              field="MaxTransactionLimit"
              header={t("financeMasters.maxTransactionLimit")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            <Column
              body={(columnData) => <ToggleButton id={columnData.id} />}
              header={t("financeMasters.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => (
                <div className="action_icons">
                  <SvgIconeye onClick={() => handleView(columnData)} />
                  <SvgEdit onClick={() => handleEdit(columnData)} />
                </div>
              )}
              header={t("financeMasters.action")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default Index;
