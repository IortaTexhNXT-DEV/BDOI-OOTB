import React, { useEffect, useState } from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import "./index.scss";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import { useDispatch, useSelector } from "react-redux";
import {
  getReceiptSearchMiddleware,
  getViewReceiptMiddleware,
  getReceiptListMiddleware,
} from "../store/pettyCashReceiptsMiddleware";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const PettyCashReceiptsTable = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("ReceiptNo");

  const { ReceiptList, ReceiptSearch } = useSelector(
    ({ pettyCashReceiptsReducer }) => {
      return {
        loading: pettyCashReceiptsReducer?.loading,
        ReceiptList: pettyCashReceiptsReducer?.ReceiptList,
        ReceiptSearch: pettyCashReceiptsReducer?.ReceiptSearch,
      };
    }
  );

  const searchs = [
    { name: "Receipt No", code: "ReceiptNo" },
    { name: "Requester Name", code: "RequesterName" },
    { name: "Branch Code", code: "Branchcode" },
    { name: "Transaction code", code: "Transactioncode" },
    { name: "Bank Code", code: "BankCode" },
    { name: "SubAccount", code: "SubAccount" },
    { name: "Transaction Number", code: "TransactionNumber" },
    { name: "Date", code: "Date" },
  ];

  useEffect(() => {
    dispatch(getReceiptListMiddleware());
  }, [dispatch]);

  const isEmpty = !ReceiptList?.length;

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
        <div className="paginator__container__receipt">
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

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn p-0"
          onClick={() => handleView(rowData)} aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
      </div>
    );
  };

  const handleView = (rowData) => {
    dispatch(getViewReceiptMiddleware(rowData));
    navigate("/accounts/pettycash/receiptlist");
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };


  useEffect(() => {
    if (globalFilter?.length > 0) {
      if (search?.length > 0) {
        dispatch(
          getReceiptSearchMiddleware({
            field: globalFilter,
            value: search,
          })
        );
      }
    }
  }, [search]);

  return (
    <div className="petty__cash__receipts__table">
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
          <div class="col-12 md:col-6 lg:col-2 search__container">
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
          <div className="sub__title">Receipts history</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? ReceiptSearch : ReceiptList}
            tableStyle={{
              minWidth: "50rem",
              color: "#2e2e2e",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
            className="receipt__table__parent"
          >
            <Column
              field="ReceiptNo"
              header="Receipt No"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.ReceiptNo?.toUpperCase()}
            ></Column>
            <Column
              field="RequesterName"
              header="Requester Name"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.RequesterName}
            ></Column>
            <Column
              field="Branchcode"
              header="Branch code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Branchcode?.toUpperCase()}
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
              headerStyle={headerStyle}
              className="fieldvalue_container_date"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default PettyCashReceiptsTable;
