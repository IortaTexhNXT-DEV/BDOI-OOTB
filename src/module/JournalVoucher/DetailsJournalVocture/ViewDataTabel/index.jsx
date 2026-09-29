import React from "react";
import "../ViewDataTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../../assets/icons/SvgTable";
const ViewDataTabel = ({
  handleEdit,
  newDataTable,
  journalVoucherPostTabelData,
  pagination,
  loading,
  onPageChange,
  first,
  rowsPerPage,
}) => {
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  // Map journalVoucherPostTabelData to match the table format
  const mappedTableData = journalVoucherPostTabelData.map((item) => ({
    id: item.id,
    mainAC: item.mainAccount || item.mainAC || "",
    subAC: item.subAccount || item.subAC || "",
    Currency: item.currencyCode || item.Currency || "",
    foreignAmount: item.foreignAmount || item.foreign || "",
    localAmount: item.localAmount || item.local || "500.00",
    Remarks: item.remarks || item.Remarks || "",
    Entry: item.entryType || item.Entry || "",
  }));

  const isEmpty = mappedTableData.length === 0;
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
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <div style={{ width: "44%" }} className="table__selector">
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
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

  return (
    <div className="journal__table__container">
      <DataTable
        value={mappedTableData}
        style={{ overflowY: "auto", maxWidth: "100%" }}
        responsive={true}
        className="table__view__Journal__Voture"
        paginator
        paginatorLeft
        rows={rowsPerPage || 10}
        first={first || 0}
        totalRecords={pagination?.total || 0}
        rowsPerPageOptions={[5, 10, 20, 50]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        emptyMessage={isEmpty ? emptyTableIcon : null}
        scrollable={true}
        scrollHeight="40vh"
        onPage={onPageChange}
        loading={loading}
        lazy
      >
        <Column
          field="mainAC"
          header="Main A/c"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.mainAC || "-"}
        ></Column>
        <Column
          field="subAC"
          header="Sub A/c"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.subAC || "-"}
        ></Column>

        <Column
          field="Remarks"
          header="Remarks"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.Remarks || "-"}
        ></Column>
        <Column
          field="Currency"
          header="Currency"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.Currency || "-"}
        ></Column>
        <Column
          field="foreignAmount"
          header="Foreign Amount"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.foreignAmount || "0.00"}
        ></Column>

        <Column
          field="localAmount"
          header="Local Amount"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.localAmount || "0.00"}
        ></Column>
        <Column
          field="Entry"
          header="Entry"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.Entry || "-"}
        ></Column>
      </DataTable>
    </div>
  );
};

export default ViewDataTabel;
