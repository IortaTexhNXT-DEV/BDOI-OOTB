import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import "./index.scss";
import SvgEditIcon from "../../../../assets/icons/SvgEdit";
import { useFormik } from "formik";
import {
  getTransactioncodeListsearch,
  getTrascationcodeDetailsView,
  getpatchTrascationcodeDetailsEdit,
  patchTrascationcodeDetailsEdit,
  getTransactioncodeListMiddleware,
} from "../store/transactionCodeMasterMiddleware";
import { useDispatch, useSelector } from "react-redux";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";

const TransactionCodeMasterTable = () => {
  const { t } = useTranslation();
  const { TransactioncodeListsearch, TransactioncodeList, loading } =
    useSelector(({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        TransactioncodeList: transactionCodeMasterReducer?.TransactioncodeList,
        TransactioncodeListsearch:
          transactionCodeMasterReducer?.TransactioncodeListsearch,
        // addJournalVoucher: journalVoucherReducers?.addJournalVoucher
      };
    });
  const [products, setProducts] = useState([{ TransactionCode: "100101" }]);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();
  const isEmpty = products.length === 0;

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
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
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

  const renderViewButton = (rowData) => {
    return (
      <div className="center-content">
        <Button
          icon={<SvgEyeIcon />}
          className="eye__btn"
          onClick={() => handleView(rowData)}
        />
        <Button
          icon={<SvgEditicons />}
          className="eye__btn"
          onClick={() => handleEdit(rowData)}
        />
      </div>
    );
  };

  const [selectedRows, setSelectedRows] = useState([]);

  const handleView = (rowData) => {
    dispatch(getTrascationcodeDetailsView(rowData));
    navigate(`/master/finance/transactioncode/transactioncodedetails`);
  };

  const handleEdit = (rowData) => {
    dispatch(getpatchTrascationcodeDetailsEdit(rowData));
    navigate(`/master/finance/transactioncode/transactioncodeedit`);
  };

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };

  const ViewheaderStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
  };
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getTransactioncodeListMiddleware());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getTransactioncodeListMiddleware());
  }, [dispatch]);
  const handleSubmit = (values) => {
    dispatch(getTransactioncodeListsearch({ textSearch: values.search }));
  };

  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  const handlecheck = (rowData) => {
    const selectedIndex = selectedRows.findIndex(
      (row) => row.id === rowData.id
    );
    let updatedSelectedRows = [];

    if (selectedIndex === -1) {
      updatedSelectedRows = [...selectedRows, rowData];
    } else {
      updatedSelectedRows = selectedRows.filter((row) => row.id !== rowData.id);
    }

    setSelectedRows(updatedSelectedRows);
  };

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getTransactioncodeListsearch(search));
    }
  }, [search]);

  return (
    <div className="transactioncode__master__table">
      <Toast ref={statusToast} />
      <Card className="mt-4">
        <div className="header__search__container grid">
          <form
            onSubmit={formik.handleSubmit}
            class="col-12 md:col-12 lg:col-12"
          >
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder="Search By Transaction Code"
                className="searchinput__left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </form>

          <div className="sub__title">Transaction code List</div>
        </div>
        <div className="card">
          <DataTable
            value={search ? TransactioncodeListsearch : TransactioncodeList}
            tableStyle={{
              minWidth: "50rem",
              color: "#2e2e2e",
            }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            // selection={selectedRows}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
            // selectionMode="checkbox"
          >
            {/* <Column
              header={<input type="checkbox" />}
              body={(rowData) => (
                <input
                  type="checkbox"
                  checked={selectedRows.some((row) => row.id === rowData.id)}
                  onClick={() => handlecheck(rowData)}
                />
              )}
              headerStyle={headerStyle}
              style={{ textAlign: "center" }}
            /> */}
            {/* <Column
              selectionMode="multiple"
              selectedItem
              headerStyle={{ width: "2rem" }}
              style={{textAlign:'center'}}
            ></Column> */}

            <Column
              field="TransactionCode"
              header="Transaction Code"
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionCode?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionName"
              header="Transaction Name"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionName?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionBasis"
              header="Transaction Basis"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionBasis?.toUpperCase()}
            ></Column>
            <Column
              field="BranchCode"
              header="Branch Code"
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.BranchCode?.toUpperCase()}
            ></Column>
            <Column
              field="DepartmentCode"
              header="Department Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.DepartmentCode?.toUpperCase()}
            ></Column>
            <Column
              body={(columnData) => <MasterStatusToggle type="transaction-code" record={columnData} onChanged={reloadList} onError={showStatusError} />}
              header="Status"
              headerStyle={{ textAlign: "center", ...headerStyle }}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={renderViewButton}
              header="View"
              headerStyle={{ ...ViewheaderStyle }}
              className="fieldvalue_container_centered "
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default TransactionCodeMasterTable;
