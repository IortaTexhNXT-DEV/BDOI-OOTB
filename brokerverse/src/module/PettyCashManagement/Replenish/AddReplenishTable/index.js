import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { openConfirm } from "../../../../components/ConfirmDialog";
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
import { postAddReplenishMiddleware } from "../store/pettyCashReplenishMiddleware";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const AddReplenishTable = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const toastRef = useRef(null);
  const navigate = useNavigate();

  const [selectedRows, setSelectedRows] = useState([]);
  const dispatch = useDispatch();
  const { AddReplenishTable, ReplenishFund } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        AddReplenishTable: pettyCashReplenishReducer?.AddReplenishTable || [],
        ReplenishFund: pettyCashReplenishReducer?.ReplenishFund || {},
      };
    }
  );

  const isEmpty = !AddReplenishTable.length;
  const totalAmount = selectedRows.reduce((total, item) => {
    const Amount = parseFloat(item.Amount);
    return !isNaN(Amount) ? total + Amount : total;
  }, 0);
  const handleSubmit = async () => {
    const ok = await openConfirm({
      title: t("pettyCash.confirm.replenishTitle"),
      message: t("pettyCash.confirm.replenishMessage"),
      facts: [
        { label: t("pettyCash.confirm.fund"), value: ReplenishFund.code || ReplenishFund.pettyCashCode, hidden: !(ReplenishFund.code || ReplenishFund.pettyCashCode) },
        { label: t("pettyCash.confirm.lines"), value: selectedRows.length, type: "number" },
        { label: t("pettyCash.confirm.availableCash"), value: ReplenishFund.availableCash, type: "amount", hidden: ReplenishFund.availableCash === undefined },
        { label: t("pettyCash.confirm.replenishAmount"), value: totalAmount, type: "amount", emphasis: true },
      ],
      confirmLabel: t("pettyCash.confirm.recordReplenishment"),
    });
    if (!ok) return;
    const result = await dispatch(postAddReplenishMiddleware(totalAmount));
    if (postAddReplenishMiddleware.rejected.match(result)) {
      toastRef.current.showToast({ severity: "error", detail: result.payload });
      return;
    }
    showSuccessMessage(t("pettyCash.replenishmentRecorded"));
    navigate("/accounts/pettycash/replenish");
  };
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/replenish"),
    },
    {
      label: "Add Replenish",
      to: "/accounts/pettycash/addreceiptstable",
    },
  ];
  const Initiate = { label: "Accounts" };


  const handleBack = () => {
    navigate("/accounts/pettycash/addreplenish");
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
    <div className="add__replenish__table">
      <CustomToast ref={toastRef} message="Petty Cash Replenish Successfully" />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Add Replenish
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
          <div className="sub__container__title col-12 md:col-12 lg:col-6 mb-2">
            <div className="sub__request__title">Replenish list</div>
          </div>
        </div>
        <div className="table__container">
          <DataTable
            value={AddReplenishTable}
            tableStyle={{ minWidth: "50rem" }}
            scrollable={true}
            scrollHeight="40vh"
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            selectionMode="checkbox"
            emptyMessage={isEmpty ? emptyTableIcon : null}
            selection={selectedRows}
            onSelectionChange={(e) => setSelectedRows(e.value)}

          >
            <Column
              selectionMode="multiple"
              selectedItem
              className="multipleicon_container"
              headerStyle={{ width: "4rem", paddingLeft: 10 }}
            ></Column>
            <Column
              field="Transactioncode"
              header={t("pettyCash.transactionCode")}
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="DocNumber"
              header={t("pettyCash.disbursementNumber")}
              headerStyle={headerStyle}
            ></Column>

            <Column
              field="Narration"
              header={t("pettyCash.narration")}
              headerStyle={headerStyle}
            ></Column>

            <Column body={(row) => formatAppDate(row.Date)}
              field="Date"
              header={t("pettyCash.date")}
              headerStyle={headerStyle}
              sortable
            ></Column>
            <Column
              field="Remarks"
              header={t("pettyCash.requestNumber")}
              headerStyle={headerStyle}
            ></Column>
            <Column
              field="Amount"
              header={t("pettyCash.amount")}
              headerStyle={headerStyle}
              body={(row) => formatCurrency(row.Amount)}
              bodyClassName="bv-num"
              headerClassName="bv-num"
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
            textColor={"var(--text-color)"}
            textSize={"16"}
            textWeight={500}
            value={formatCurrency(totalAmount)}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label={t("pettyCash.reimbursementAmount")}
            disabled={true}
            textColor={"var(--text-color)"}
            textSize={"16"}
            textWeight={500}
            value={formatCurrency(totalAmount)}
          />
        </div>
        <div className="col-12 md:col-3 lg:col-3">
          <InputField
            classNames="input__filed"
            label={t("pettyCash.currentBalance")}
            disabled={true}
            textColor={"var(--text-color)"}
            textSize={"16"}
            textWeight={500}
            value={ReplenishFund.availableCash == null ? "" : formatCurrency(ReplenishFund.availableCash)}
          />
        </div>
      </div>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.confirm.recordReplenishment")}
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

export default AddReplenishTable;
