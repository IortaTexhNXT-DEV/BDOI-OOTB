import React from "react";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { formatValue } from "../../../components/KeyValueGrid";
import { useTranslation } from "react-i18next";

const TableData = ({ reversalJVList, reversalJVGetDataList }) => {
  const { t } = useTranslation();

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
        <div className="table__selector">
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
    <div className="reversal__table__container">
      <DataTable
        value={reversalJVGetDataList}
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="reversal__table__main"
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="mainAccount"
          header="Main A/c"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="subAccount"
          header="Sub A/c"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="branchCode"
          header="Department"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="remarks"
          header="Remarks"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="localAmount"
          header={t("accounts.correctionJVForm.amount")}
          body={(r) => formatValue(r.localAmount, { type: "amount" })}
          className="fieldvalue_container"
          bodyClassName="bv-num"
          headerClassName="bv-num"
        ></Column>
        <Column
          field="entryType"
          header="Entry"
          className="fieldvalue_container last_chlid"
        ></Column>
      </DataTable>
    </div>
  );
};

export default TableData;
