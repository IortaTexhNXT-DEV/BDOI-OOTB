import React, { useState, useRef } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
// import CustomToast from "../../../../components/Toast";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import ReplenishtDetailViewTable from "./ReplenishDetailviewTable";
import { useSelector } from "react-redux";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";

const ReplenishtDetailView = () => {
  const navigate = useNavigate();

  const { ViewReplenish, loading, AddReplenishTable } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        ViewReplenish: pettyCashReplenishReducer?.ViewReplenish,
        AddReplenishTable: pettyCashReplenishReducer?.AddReplenishTable,
      };
    }
  );

  console.log(ViewReplenish, "ViewReplenish");

  //   const toastRef = useRef(null);
  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/replenish"),
    },
    {
      label: "Replenish Detail view",
      to: "/accounts/pettycash/replenishtdetailview",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/replenish");
  };

  return (
    <div className="add__replenish__view__container">
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
            Replenish Detail view
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
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Date"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value="24/01/2024"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Transaction Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value="Trans0012"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Transaction Number"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value="Trans0012"
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Petty cash Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReplenish.Pettycashcode}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Petty cash Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"Pettycash-0018"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Bank Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReplenish.BankCode}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
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
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <InputField
              classNames="input__filed"
              label="Sub Account Code"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={ViewReplenish.SubAccount}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <InputField
              classNames="input__filed"
              label="Sub Account Description"
              //   placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={"SubAC-01"}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="calender__container col-12 md:col-3 lg:col-3 ">
            <LabelWrapper className="calenderlable__container">
              Disbursement From date
            </LabelWrapper>
            <Calendar
              disabled={true}
              showIcon
              placeholder="Select"
              className="calendar_container"
              value={new Date()}
              dateFormat="yy-mm-dd"
            />
          </div>
          <div className="calender__container col-12 md:col-3 lg:col-3 ">
            <LabelWrapper className="calenderlable__container">
              Disbursement To date
            </LabelWrapper>
            <Calendar
              disabled={true}
              showIcon
              placeholder="Select"
              className="calendar_container"
              value={new Date()}
              dateFormat="yy-mm-dd"
            />
          </div>
        </div>
      </Card>
      <Card className="mt-3">
        <ReplenishtDetailViewTable AddReplenishTable={AddReplenishTable} />
      </Card>
    </div>
  );
};

export default ReplenishtDetailView;
