import React, { useEffect, useState } from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../../assets/icons/SvgTable";
import RowActions from "../../../../components/RowActions";
import "./index.scss";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { useDispatch, useSelector } from "react-redux";
import {
  getReplenishListMiddleware,
  getReplenishSearchMiddleware,
  getViewReplenishMiddleware,
} from "../store/pettyCashReplenishMiddleware";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const PettyCashReplenishTable = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("Pettycashcode");

  const { ReplenishList, ReplenishSearch } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        ReplenishList: pettyCashReplenishReducer?.ReplenishList,
        ReplenishSearch: pettyCashReplenishReducer?.ReplenishSearch,
      };
    }
  );

  const searchs = [
    { name: "Pettycash Code", code: "Pettycashcode" },
    { name: "Branch code", code: "Branchcode" },
    { name: "Transaction code", code: "Transactioncode" },
    { name: "Bank Code", code: "BankCode" },
    { name: "Sub Account", code: "SubAccount" },
    { name: "Transaction Number", code: "TransactionNumber" },
    { name: "Date", code: "Date" },
  ];

  useEffect(() => {
    dispatch(getReplenishListMiddleware());
  }, [dispatch]);

  const isEmpty = !ReplenishList?.length;

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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              Row count :{" "}
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

  const renderViewButton = (rowData) => <RowActions onView={() => handleView(rowData)} />;

  const handleView = (rowData) => {
    dispatch(getViewReplenishMiddleware(rowData));
    navigate("/accounts/pettycash/replenishtdetailview");
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    paddingLeft: 0,
    color: "#000",
    border: "none",
  };
  const headeraction = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontfamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: " none",
    display: "flex",
  };

  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getReplenishSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

  return (
    <div className="petty__cash__replenish__table">
      <Card className="mt-4">
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
          </div>
          <div className="sub__title">Replenish history</div>
        </div>
        <div className="card tabel__card__header">
          <DataTable
            value={search ? ReplenishSearch : ReplenishList}
            tableStyle={{
              minWidth: "50rem",
              color: "var(--text-color)",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
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
              field="Transactioncode"
              header="Transaction code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Transactioncode?.toUpperCase()}
            ></Column>
            <Column
              field="BankCode"
              header="Bank Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.BankCode?.toUpperCase()}
            ></Column>
            <Column
              field="SubAccount"
              header="Sub Account"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.SubAccount?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionNumber"
              header="Transaction Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
              sortable
            ></Column>
            <Column body={(row) => formatAppDate(row.Date)}
              field="Date"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="View"
              header="View"
              body={renderViewButton}
              headerStyle={headeraction}
              style={{ textAlign: "center" }}
              className="fieldvalue_container_date"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default PettyCashReplenishTable;
