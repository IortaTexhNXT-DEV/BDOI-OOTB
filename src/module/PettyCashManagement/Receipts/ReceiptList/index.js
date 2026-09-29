import React from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
// import CustomToast from "../../../../components/Toast";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import ReceiptListTable from "./ReceiptsListTable";
import { useSelector } from "react-redux";

const ReceiptList = () => {
  const navigate = useNavigate();
  //   const toastRef = useRef(null);
  const { ViewReceipt, loading,AddReceiptTable } = useSelector(
    ({ pettyCashReceiptsReducer }) => {
      return {
        loading: pettyCashReceiptsReducer?.loading,
        ViewReceipt: pettyCashReceiptsReducer?.ViewReceipt,
        AddReceiptTable:pettyCashReceiptsReducer?.AddReceiptTable
      };
    }
  );

  console.log(ViewReceipt,"ViewReceipt")

  const items = [
    { label: "Petty Cash", command: () => navigate( "/accounts/pettycash/receipts") },
    {
      label: "Receipts Detail View",
      to: "/accounts/pettycash/receiptlist",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/receipts");
  };

  return (
    <div className="add__receipts__view__container">
      {/* <CustomToast ref={toastRef} /> */}
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleBack();
            }}
          >
            <SvgBackArrow />
            Receipts Detail View
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
      <Card className="mt-3">
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Receipt Number"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"1010011"}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Requester"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReceipt.RequesterName}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Bank Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReceipt.BankCode}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Bank Account Name"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"Bank-01"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Sub Account Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReceipt.SubAccount}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Sub Account Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"SubAccount-001"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Transaction Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReceipt.Transactioncode}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Transaction Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"Transactioncode-001"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Branch Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReceipt.Branchcode}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Branch Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"Branchcode-001"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Department Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"Depart-001"}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Department Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"DepartDescription-001"}
            />
          </div>
        </div>
      </Card>
      <Card className="mt-3 tabel__border__header">
        <ReceiptListTable AddReceiptTable={AddReceiptTable}/>
      </Card>
    </div>
  );
};

export default ReceiptList;
