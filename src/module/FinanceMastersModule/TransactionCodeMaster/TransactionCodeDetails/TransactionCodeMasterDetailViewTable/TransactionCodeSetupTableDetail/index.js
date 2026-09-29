import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import "./index.scss";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import { useSelector } from "react-redux";

const TransactionCodeSetupTableDetail = () => {
  const { t } = useTranslation();
  const { TransactioncodeListsearch, TransactionCodeSetup, loading } =
    useSelector(({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        TransactionCodeSetup:
          transactionCodeMasterReducer?.TransactionCodeSetup,
      };
    });
  const [products, setProducts] = useState([]);

  const navigate = useNavigate();
  const isEmpty = products.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("financeMasters.noDataEntered")}</div>
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
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{
                color: "var(--text-color)",
                userSelect: "none",
                width: "127%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
              }}
            >
              {t("financeMasters.rowCount")}{" "}
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

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
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
            color: "#1C2536",
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
