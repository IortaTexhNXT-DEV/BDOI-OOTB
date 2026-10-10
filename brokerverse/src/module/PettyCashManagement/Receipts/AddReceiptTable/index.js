import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { showSuccessMessage } from "../../../../utility/toastUtils";
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
import { openConfirm } from "../../../../components/ConfirmDialog";

const AddReceiptsTable = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();

  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { funds } = usePettyCashOptions();
  const handleSubmit = async () => {
    const ok = await openConfirm({
      title: t("pettyCash.confirm.receiptsTitle"),
      message: t("pettyCash.confirm.receiptsMessage"),
      facts: [
        { label: t("pettyCash.confirm.fund"), value: selectedFund?.code || selectedFund?.pettyCashCode, hidden: !selectedFund },
        { label: t("pettyCash.confirm.lines"), value: selectedRows.length, type: "number" },
        { label: t("pettyCash.totalAmount"), value: totalAmount, type: "amount", emphasis: true },
      ],
      confirmLabel: t("pettyCash.confirm.recordReceipts"),
    });
    if (!ok) return;
    const result = await dispatch(postAddReceiptMiddleware(selectedRows));
    if (postAddReceiptMiddleware.rejected.match(result)) {
      toastRef.current.showToast({ severity: "error", detail: result.payload });
      return;
    }
    showSuccessMessage(t("pettyCash.receiptRecorded"));
    navigate("/accounts/pettycash/receipts");
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
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
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
              header={t("pettyCash.transactionCode")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionCode?.toUpperCase()}
            ></Column>
            <Column
              field="RequestNumber"
              header={t("pettyCash.requestNumber")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
              body={(rowData) => rowData.RequestNumber?.toUpperCase()}
            ></Column>
            <Column body={(row) => formatAppDate(row.Date)}
              field="Date"
              header={t("pettyCash.date")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="Amount"
              header={t("pettyCash.amount")}
              headerStyle={headerStyle}
              body={(row) => formatCurrency(row.Amount)}
              bodyClassName="bv-num"
              headerClassName="bv-num"
              className="fieldvalue_container"
              sortable
            ></Column>
            <Column
              field="Remarks"
              header={t("pettyCash.remarks")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.Remarks}
            ></Column>
          </DataTable>
        </div>
      </Card>
      <div className="grid mt-4">
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label={t("pettyCash.disbursedAmount")}
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={formatCurrency(totalAmount)}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label={t("pettyCash.balanceAmount")}
            disabled={true}
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={selectedFund?.availableCash == null ? "" : formatCurrency(selectedFund.availableCash)}
          />
        </div>
      </div>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.confirm.recordReceipts")}
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
