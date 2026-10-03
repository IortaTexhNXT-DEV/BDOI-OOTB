import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import "./index.scss";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import { useSelector } from "react-redux";

const UserGroupAccessDetail = () => {
  const { t } = useTranslation();
  const {
    UserGroupAccessList,
  } = useSelector(({ transactionCodeMasterReducer }) => {
    return {
      loading: transactionCodeMasterReducer?.loading,
      UserGroupAccessList: transactionCodeMasterReducer?.UserGroupAccessList,
      // TransactioncodeListsearch: transactionCodeMasterReducer?.TransactioncodeListsearch,
      getUserAccessData: transactionCodeMasterReducer?.getUserAccessData,
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
    <div className="transactioncode__master__table_UserGroupAccess">
      {/* <Card className="mt-1"> */}
      <div className="card">
        <DataTable
          value={UserGroupAccessList}
          tableStyle={{
            minWidth: "50rem",
            color: "#2e2e2e",
          }}
          scrollable={true}
          scrollHeight="40vh"
          emptyMessage={isEmpty ? emptyTableIcon : null}
        >
          <Column
            field="UserRole"
            header="User Role"
            headerStyle={headerStyle}
            className="fieldvalue_container"
          ></Column>
          <Column
            field="MinimumTransaction"
            header="Minimum Transaction"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
          <Column
            field="MaximumTransaction"
            header="Maximum Transaction"
            headerStyle={headerStyle}
            className="fieldvalue_container"
            //   sortable
          ></Column>
        </DataTable>
      </div>
      {/* </Card> */}
    </div>
  );
};

export default UserGroupAccessDetail;
