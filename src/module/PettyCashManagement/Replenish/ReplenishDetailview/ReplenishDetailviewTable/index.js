import React, { useState, useRef } from "react";
import "./index.scss";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

const ReplenishtDetailViewTable = ({ AddReplenishTable }) => {
  const isEmpty = AddReplenishTable.length === 0;
  console.log(AddReplenishTable, "AddReplenishTable");
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
  return (
    <div className="add__replenish__table">
      <div className="table__container">
        <DataTable
          value={AddReplenishTable}
          tableStyle={{ minWidth: "50rem" }}
          emptyMessage={isEmpty ? emptyTableIcon : null}
          scrollable={true}
          scrollHeight="40vh"
        >
          <Column
            field="Transactioncode"
            header="Transaction Code"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="DocNumber"
            header="Disbursement Doc Number"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="Narration"
            header="Narration"
            headerStyle={headerStyle}
          ></Column>
          <Column field="Date" header="Date" headerStyle={headerStyle}></Column>
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
        </DataTable>
      </div>
    </div>
  );
};

export default ReplenishtDetailViewTable;
