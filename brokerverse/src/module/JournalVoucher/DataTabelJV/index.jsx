import React from "react";
import "../DataTabelJV/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgTable from "../../../assets/icons/SvgTable";
import { useNavigate } from "react-router-dom";
import SvgIconeye from "../../../assets/icons/SvgIconeye";
import { getJournalVoucherViewData } from "../store/journalVoucherMiddleware";
import { useDispatch } from "react-redux";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

const DataTabelJV = ({ 
  handleEdit, 
  journalVoucherList, 
  pagination, 
  loading, 
  onPageChange, 
  first, 
  rowsPerPage,
  t 
}) => {
  const navigate = useNavigate();
  const translate = t || ((key) => key);

  const headerStyle = {
    // width: "19%",
    // backgroundColor: 'var(--color-danger)',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",

    color: "#000",
    border: "none",
    //     display:' flex',
    // justifycontent: 'center'
  };

  const headaction = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: " none",
    display: "flex",
  };

  const dispatch = useDispatch();
  const handleView = (rowData) => {
    dispatch(getJournalVoucherViewData(rowData));
    navigate(`/accounts/journalvoucher/detailsjournalvocture/${rowData.id}`);
  };

  const isEmpty = journalVoucherList.length === 0;
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
        <div style={{ width: "40%" }} className="table__selector">
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
        value={journalVoucherList}
        style={{ overflowY: "auto", maxWidth: "100%" }}
        responsive={true}
        className="table__view__Journal__Voture"
        paginator
        paginatorLeft
        rows={rowsPerPage || 20}
        first={first}
        totalRecords={pagination?.total || 0}
        rowsPerPageOptions={[20, 50, 100]}
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
          field="transationCode"
          header={translate("accounts.transactionCode")}
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(rowData) => rowData.transationCode?.toUpperCase()}
        ></Column>
        <Column
          field="transactionNumber"
          header={translate("accounts.transactionNumber")}
          className="fieldvalue_container"
          headerStyle={headerStyle}
        ></Column>

        <Column body={(row) => formatAppDate(row.date)}
          field="date"
          header={translate("common.date")}
          className="fieldvalue_container"
          headerStyle={headerStyle}
        ></Column>
        <Column
          field="transationDescription"
          header="Description"
          className="fieldvalue_container"
          headerStyle={headerStyle}
        ></Column>
        <Column
          field="status"
          header="Status"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          body={(r) => {
            const labels = { draft: "Draft", "for-approval": "Awaiting approval", approved: "Approved", posted: "Posted", rejected: "Rejected", reversed: "Reversed" };
            return labels[r.status] || r.status || "-";
          }}
        ></Column>

        <Column

          body={(columnData) => (
            <SvgIconeye onClick={() => handleView(columnData)} />
          )}
          style={{ textAlign: "center" }}
          headerStyle={headaction}
          header={translate("common.view")}
          className="fieldvalue_container"
        ></Column>
      </DataTable>
    </div>
  );
};

export default DataTabelJV;
