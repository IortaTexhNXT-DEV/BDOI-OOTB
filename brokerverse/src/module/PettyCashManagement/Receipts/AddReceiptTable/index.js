import React, { useState, useRef } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import CustomToast from "../../../../components/Toast";
import SvgTable from "../../../../assets/icons/SvgTable";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import InputField from "../../../../components/InputField";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { useDispatch, useSelector } from "react-redux";
import { postAddReceiptMiddleware } from "../store/pettyCashReceiptsMiddleware";
import usePettyCashOptions from "../../usePettyCashOptions";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const AddReceiptsTable = () => {

  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { funds } = usePettyCashOptions();
  const handleSubmit = async () => {
    const result = await dispatch(postAddReceiptMiddleware(selectedRows));
    if (postAddReceiptMiddleware.rejected.match(result)) {
      toastRef.current.showToast({ severity: "error", detail: result.payload });
      return;
    }
    toastRef.current.showToast();
    setTimeout(() => {
      navigate("/accounts/pettycash/receipts");
    }, 2000);
  };
  const headaction = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: " none",
    display: "flex",
  };
  const [selectedRows, setSelectedRows] = useState([]);
  const { AddReceiptTable } = useSelector(
    ({ pettyCashReceiptsReducer }) => {
      return {
        loading: pettyCashReceiptsReducer?.loading,
        AddReceiptTable: pettyCashReceiptsReducer?.AddReceiptTable,
      };
    }
  );
  const totalAmount = selectedRows.reduce((total, item) => {
    const Amount = parseFloat(item.Amount);
    return !isNaN(Amount) ? total + Amount : total;
  }, 0);

  const isEmpty = !AddReceiptTable?.length;
  const selectedFund = funds.find(
    (fund) => fund.code === selectedRows[0]?.PettyCashCode
  );
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/receipts"),
    },
    {
      label: "Add Receipt",
      to: "/accounts/pettycash/addreceiptstable",
    },
  ];
  const Initiate = { label: "Accounts" };



  const handleBack = () => {
    navigate("/accounts/pettycash/addreceipts");
  };

  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
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
    <div className="add__receipts__table">
      <CustomToast ref={toastRef} message="Petty Cash Receipt Successfully" />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Add Receipt
          </div>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>
      <Card>
        <div className="sub__container grid ">
          <div className="sub__container__title col-12 md:col-12 lg:col-6">
            <div className="sub__request__title">Receipt List</div>
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={AddReceiptTable}
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            emptyMessage={isEmpty ? emptyTableIcon : null}
            selection={selectedRows}
            onSelectionChange={(e) => setSelectedRows(e.value)}
            selectionMode="checkbox"
            // rowClas/
          >

            <Column
              selectionMode="multiple"
              // selectedItem
              headerStyle={headaction}
              style={{ textAlign: "center" }}
            ></Column>

            <Column
              field="TransactionCode"
              header="Transaction Code"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionCode?.toUpperCase()}
            ></Column>
            <Column
              field="RequestNumber"
              header="Request Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.RequestNumber?.toUpperCase()}
            ></Column>
            <Column body={(row) => formatAppDate(row.Date)}
              field="Date"
              header="Date"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="Amount"
              header="Amount"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="Remarks"
              header="Remarks"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Remarks?.toUpperCase()}
            ></Column>
          </DataTable>
        </div>
      </Card>
      <div className="grid mt-4">
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label="Disbursed Amount"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={totalAmount}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label="Balance Amount"
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={selectedFund?.availableCash ?? ""}
          />
        </div>
      </div>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label="Approve"
              className="add__btn"
              disabled={selectedRows.length === 0}
              onClick={() => {
                handleSubmit();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReceiptsTable;
