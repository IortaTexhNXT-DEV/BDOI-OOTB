import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "../PettyDataTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import {
  getPatchPettyCashEdit,
  getPettyCashView,
  pettyCashMaster,
} from "../store/pettyCashMasterMiddleWare";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";
const PettyDataTabel = ({ newDataTable, pettyCashList }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );
  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    // padding: 6,
    color: "#000",
    border: "none",
  };
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

  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(pettyCashMaster());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(pettyCashMaster());
  }, [dispatch]);
  const handleView = (columnData) => {
    dispatch(getPettyCashView(columnData));
    navigate(`/master/finance/pettycash/pettycashdetail/${columnData.id}`);
  };
  const handleEdit = (columnData) => {
    dispatch(getPatchPettyCashEdit(columnData));
    navigate(`/master/finance/pettycash/editpettycash/${columnData.id}`);
  };

  return (
    <div className="petty__cash__table__container">
      <Toast ref={statusToast} />
      <DataTable
        value={pettyCashList}
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="table__view__Journal__Voture"
        emptyMessage={emptyTableIcon}
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="pettycashcode"
          header="Petty Cash Code"
          className="fieldvalue_container"
          body={(rowData) => String(rowData.pettycashcode ?? "").toUpperCase()}
        ></Column>
        <Column
          field="pettycashname"
          header="Petty Cash Name"
          className="fieldvalue_container"
          body={(rowData) => String(rowData.pettycashname ?? "").toUpperCase()}
        ></Column>

        <Column
          field="pettycashsize"
          header="Petty Cash Size"
          className="fieldvalue_container"
          body={(rowData) => String(rowData.pettycashsize ?? "").toUpperCase()}
        ></Column>
        <Column
          field="minicashbox"
          header="Minimum Cash Box"
          className="fieldvalue_container"
          body={(rowData) => String(rowData.minicashbox ?? "").toUpperCase()}
        ></Column>
        <Column
          field="transactionlimit"
          header="Transaction Limit"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="status"
          body={(columnData) => <MasterStatusToggle type="petty-cash" record={columnData} onChanged={reloadList} onError={showStatusError} />}
          header="Status"
          headerStyle={{ textAlign: "center", ...headerStyle }}
          className="fieldvalue_container"
        ></Column>

        <Column
          field="action"
          body={(columnData) => (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ marginRight: 5 }}>
                {" "}
                <SvgIconeye onClick={() => handleView(columnData)} />
              </span>
              <SvgEditicons onClick={() => handleEdit(columnData)} />
            </div>
          )}
          header="View"
          className="fieldvalue_container"
          headerStyle={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          style={{ textAlign: "center" }}
        ></Column>
      </DataTable>
    </div>
  );
};

export default PettyDataTabel;
