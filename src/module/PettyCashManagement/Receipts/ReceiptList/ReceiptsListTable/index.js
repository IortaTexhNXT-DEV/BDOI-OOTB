import React, { useState, useRef } from "react";
import "./index.scss";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

const ReceiptListTable = ({ AddReceiptTable }) => {
  const isEmpty = AddReceiptTable.length === 0;

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
    padding: "1rem 0",
    color: "#000",
    border: "none",
    textAlign: "center",
  };
  return (
    <div className="add__receipts__table  ">
      <div className="table__container">
        <DataTable
          value={AddReceiptTable}
          tableStyle={{ minWidth: "50rem" }}
          emptyMessage={isEmpty ? emptyTableIcon : null}
          scrollable={true}
          scrollHeight="40vh"
        >
          <Column
            field="TransactionCode"
            header="Transaction Code"
            headerStyle={headerStyle}
            sortable
            body={(rowData) => rowData.TransactionCode?.toUpperCase()}
          ></Column>
          <Column
            field="RequestNumber"
            header="Request Number"
            headerStyle={headerStyle}
            sortable
            body={(rowData) => rowData.RequestNumber?.toUpperCase()}
          ></Column>
          <Column
            field="Date"
            header="Date"
            headerStyle={headerStyle}
            sortable
          ></Column>
          <Column
            field="Amount"
            header="Amount"
            headerStyle={headerStyle}
            sortable
          ></Column>
          <Column
            field="Remarks"
            header="Remarks"
            headerStyle={headerStyle}
            sortable
            body={(rowData) => rowData.Remarks?.toUpperCase()}
          ></Column>
        </DataTable>
      </div>
    </div>
  );
};

export default ReceiptListTable;
