import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgFilters from "../../../../assets/icons/SvgFilter";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import "./index.scss";
import { TieredMenu } from "primereact/tieredmenu";
import { useDispatch, useSelector } from "react-redux";
import {
  getInitiateDetailsMiddleware,
  getInitiateListSearchMiddleware,
} from "../store/pettyCashInitiateMiddleware";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";

const InitiateTable = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Pettycashcode");

  const { InitiateList, loading, InitiateListSearch } = useSelector(
    ({ pettyCashInitiateReducer }) => {
      return {
        loading: pettyCashInitiateReducer?.loading,
        InitiateList: pettyCashInitiateReducer?.InitiateList,
        InitiateListSearch: pettyCashInitiateReducer?.InitiateListSearch,
      };
    }
  );

  console.log("first11", InitiateList);
  const searchs = [
    { name: t("pettyCash.pettyCashCode"), code: "Pettycashcode" },
    { name: t("pettyCash.transactionNumber"), code: "TransactionNumber" },
    { name: t("pettyCash.branchCode"), code: "Branchcode" },
    { name: t("pettyCash.departmentCode"), code: "Departmentcode" },
  ];

  const isEmpty = InitiateList.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("pettyCash.noDataEntered")}</div>
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
        <div className="paginatoroverall__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("pettyCash.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdowninner_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)}
        />
      </div>
    );
  };

  const handleView = (rowData) => {
    dispatch(getInitiateDetailsMiddleware(rowData));
    navigate("/accounts/pettycash/PettyCashCodeDetails");
  };
  const headerStyle = {
    // width: "12rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: 6,
    color: "#000",
    border: "none",
  };
  const ViewheaderStyle = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: " none",
    display: "flex",
  };
  useEffect(() => {
    console.log(globalFilter, "as");
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getInitiateListSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

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
  return (
    <div className="initiate__table">
      <Card className="mt-1">
        <div className="header_search_container grid">
          <div class="col-12 md:col-6 lg:col-10">
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder="Search by Petty cash Code"
                className="searchinput_left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          <div class="col-12 md:col-6 lg:col-2">
            {/* <TieredMenu model={menuitems} popup ref={menu} breakpoint="767px" /> */}
            <Dropdown
              value={search}
              onChange={(e) => setGlobalFilter(e.value)}
              options={searchs}
              optionLabel="name"
              optionValue="code"
              placeholder="Search by"
              className="sorbyfilter_container"
              dropdownIcon={<SvgDropdownicon />}
            />

            {/* <Button label="Search by" outlined icon={<SvgDropdownicon />}
              className="sorbyfilter_container"
              onClick={(e) => menu.current.toggle(e)}
            /> */}
          </div>
          <div className="sub__title">Petty Cash Code history</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? InitiateListSearch : InitiateList}
            tableStyle={{
              color: "#2e2e2e",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="Pettycashcode"
              header="Petty cash code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Pettycashcode?.toUpperCase()}
            ></Column>
            <Column
              field="Pettycashsize"
              header="Petty cash size"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Pettycashsize?.toUpperCase()}
              sortable
            ></Column>
            <Column
              field="TransactionNumber"
              header="Transaction Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
              sortable
            ></Column>
            <Column
              field="MaxLimit"
              header="Max Limit"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Branchcode"
              header="Branch code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Branchcode?.toUpperCase()}
            ></Column>
            <Column
              field="Departmentcode"
              header="Department code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Departmentcode?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionDate"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              body={renderViewButton}
              header="View"
              headerStyle={ViewheaderStyle}
              className="fieldvalue_container centered"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default InitiateTable;
