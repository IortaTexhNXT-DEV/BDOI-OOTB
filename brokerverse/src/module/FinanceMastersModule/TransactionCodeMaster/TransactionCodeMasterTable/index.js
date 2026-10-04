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
import { useFormik } from "formik";
import {
  getTransactioncodeListsearch,
  getTrascationcodeDetailsView,
  getpatchTrascationcodeDetailsEdit,
  getTransactioncodeListMiddleware,
} from "../store/transactionCodeMasterMiddleware";
import { useDispatch, useSelector } from "react-redux";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";

const TransactionCodeMasterTable = () => {
  const { t } = useTranslation();
  const { TransactioncodeListsearch, TransactioncodeList } =
    useSelector(({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        TransactioncodeList: transactionCodeMasterReducer?.TransactioncodeList,
        TransactioncodeListsearch:
          transactionCodeMasterReducer?.TransactioncodeListsearch,
        // addJournalVoucher: journalVoucherReducers?.addJournalVoucher
      };
    });
  const [products] = useState([{ TransactionCode: "100101" }]);
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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
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
          onClick={() => handleView(rowData)} aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
        <Button
          icon={<SvgEditicons />}
          className="eye__btn"
          onClick={() => handleEdit(rowData)} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
      </div>
    );
  };


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
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >

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
              body={(rowData) => rowData.TransactionName}
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
