import React, { useState, useRef } from "react";
import "./index.scss";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useSelector } from "react-redux";
import { Dropdown } from "primereact/dropdown";

const DisbursementDetailviewTable = () => {
  const { AddDisbursmentTable, loading } = useSelector(
    ({ pettyCashDisbursementReducers }) => {
      return {
        loading: pettyCashDisbursementReducers?.loading,
        AddDisbursmentTable: pettyCashDisbursementReducers?.AddDisbursmentTable,
      };
    }
  );
  console.log(AddDisbursmentTable, "AddDisbursmentTable");
  const isEmpty = AddDisbursmentTable.length === 0;
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    textAlign: "center",
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
              className="pagedropdownunique_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
  return (
    <div className="add__disbursement__table">
      <div className="table__container">
        <div className="sub__request__title mt-2 mb-2">Request List</div>
        <DataTable
          value={AddDisbursmentTable}
          tableStyle={{ minWidth: "50rem" }}
          emptyMessage={isEmpty ? emptyTableIcon : null}
          scrollable={true}
          scrollHeight="40vh"
          paginator
          rows={5}
          rowsPerPageOptions={[5, 10, 25, 50]}
          // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          currentPageReportTemplate="{first} - {last} of {totalRecords}"
          paginatorTemplate={template2}
        >
          <Column
            field="RequestNumber"
            header="Requested By"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="ExpenseCode"
            header=" Expense Code"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="SubAc"
            header="Sub Ac"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="Purpose"
            header="Purpose"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="Remarks"
            header="Remarks"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="Amount"
            header="Amount"
            headerStyle={headerStyle}
          ></Column>
          <Column field="VAT" header="VAT" headerStyle={headerStyle}></Column>
          <Column field="WHT" header="WHT" headerStyle={headerStyle}></Column>
          <Column
            field="NetAmount"
            header="Net Amount"
            headerStyle={headerStyle}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default DisbursementDetailviewTable;
