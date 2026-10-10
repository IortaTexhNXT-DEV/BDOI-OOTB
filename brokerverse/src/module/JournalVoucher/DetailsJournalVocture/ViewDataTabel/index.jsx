import React from "react";
import "../ViewDataTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useTranslation } from "react-i18next";
import { EMPTY_VALUE, formatValue } from "../../../../components/KeyValueGrid";
const ViewDataTabel = ({
  journalVoucherPostTabelData,
  pagination,
  loading,
  onPageChange,
  first,
  rowsPerPage,
}) => {
  const { t } = useTranslation();
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
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
    localAmount: item.localAmount ?? item.local ?? "",
    Remarks: item.remarks || item.Remarks || "",
    Entry: item.entryType || item.Entry || "",
    costCentre: item.costCentre || "",
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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
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
        rows={rowsPerPage || 20}
        first={first || 0}
        totalRecords={pagination?.total || 0}
        rowsPerPageOptions={[20, 50, 100]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        emptyMessage={isEmpty ? emptyTableIcon : null}
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
          body={(rowData) => (Number(rowData.foreignAmount) ? formatValue(rowData.foreignAmount, { type: "amount", currency: rowData.Currency || undefined }) : EMPTY_VALUE)}
        ></Column>

        <Column
          field="localAmount"
          header="Local Amount"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => formatValue(rowData.localAmount === "" ? null : rowData.localAmount, { type: "amount" })}
          bodyClassName="bv-num"
          headerClassName="bv-num"
        ></Column>
        <Column
          field="costCentre"
          header={t("jvTools.costCentre")}
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
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
