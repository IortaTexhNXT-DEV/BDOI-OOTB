import React from "react";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { formatValue } from "../../../components/KeyValueGrid";
import { useTranslation } from "react-i18next";

const TableData = ({ reversalJVList, reversalJVGetDataList }) => {
  const { t } = useTranslation();

  return (
    <div className="reversal__table__container">
      <DataTable
        value={reversalJVGetDataList}
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        className="reversal__table__main"
        scrollable={true}
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
