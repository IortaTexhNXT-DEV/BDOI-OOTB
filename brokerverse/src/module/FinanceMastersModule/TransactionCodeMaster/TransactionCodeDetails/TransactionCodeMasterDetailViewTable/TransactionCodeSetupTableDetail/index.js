import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import "./index.scss";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import { useSelector } from "react-redux";

const TransactionCodeSetupTableDetail = () => {
  const { t } = useTranslation();
  const { TransactionCodeSetup } =
    useSelector(({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        TransactionCodeSetup:
          transactionCodeMasterReducer?.TransactionCodeSetup,
      };
    });
  const [products] = useState([]);

  const isEmpty = products.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("financeMasters.noDataEntered")}</div>
    </div>
  );


  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  return (
    <div className="transactioncode__master__table__Detail__view">
      {/* <Card className="mt-1"> */}
      <div className="card">
        <DataTable
          value={TransactionCodeSetup}
          tableStyle={{
            minWidth: "50rem",
            color: "#2e2e2e",
          }}
          scrollable={true}
          scrollHeight="40vh"
          emptyMessage={isEmpty ? emptyTableIcon : null}
        >
          <Column
            field="AccountingPeriodStart"
            header="Accounting Period start"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="AccountingPeriodEnd"
            header="Accounting Period End"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
          <Column
            field="TransactionNumberFrom"
            header="Transaction No from"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
          <Column
            field="TransactionNumberTo"
            header="Transaction No To"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="lastUsed"
            header="Last Used"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
        </DataTable>
      </div>
      {/* </Card> */}
    </div>
  );
};

export default TransactionCodeSetupTableDetail;
