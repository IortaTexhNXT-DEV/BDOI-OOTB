import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
// import CustomToast from "../../../../components/Toast";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import DisbursementDetailviewTable from "./DisbursementDetailviewTable";
import { useSelector } from "react-redux";
import { useFormik } from "formik";

// const initialValue = {
//   PettyCashCode: "",
//   TransactionCode: "",
//   BranchCode: "",
//   DepartmentCode: "",
// };

const DisbursementDetailview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ViewDisbursment, loading, getViewDisbursment } = useSelector(
    ({ pettyCashDisbursementReducers }) => {
      return {
        loading: pettyCashDisbursementReducers?.loading,
        ViewDisbursment: pettyCashDisbursementReducers?.ViewDisbursment,
        getViewDisbursment: pettyCashDisbursementReducers?.getViewDisbursment
      };
    }
  );

  console.log(getViewDisbursment, "getViewDisbursment");

  const items = [
    {
      label: t("pettyCash.pettyCashLabel"),
      command: () => navigate("/accounts/pettycash/disbursement"),
    },
    {
      label: t("pettyCash.disbursementDetailView"),
      to: "/accounts/pettycash/disbursementdetailview",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleBack = () => {
    navigate("/accounts/pettycash/disbursement");
  };

  // const formik = useFormik({
  //   initialValues: initialValue,
  // });

  const PettycashCodetOptions = [
    {
      label: ViewDisbursment?.PettycashCode,
      value: ViewDisbursment?.PettycashCode,
    },
  ];

  const TransactioncodeOptions = [
    {
      label: ViewDisbursment?.Transactioncode,
      value: ViewDisbursment?.Transactioncode,
    },
  ];

  const BranchcodeOptions = [
    {
      label: ViewDisbursment?.Branchcode,
      value: ViewDisbursment?.Branchcode,
    },
  ];

  const DepartmentcodeOptions = [
    {
      label: ViewDisbursment?.Departmentcode,
      value: ViewDisbursment?.Departmentcode,
    },
  ];

  return (
    <div className="add__disbursement__view__container">
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
            {t("pettyCash.disbursementDetailView")}
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
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.date")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={getViewDisbursment?.Date}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.transactionNumber")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={getViewDisbursment?.TransactionNumber}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.pettyCashCodeRequired")}
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.PettyCashCode}
              options={[{label:getViewDisbursment?.PettyCashCode,value:getViewDisbursment?.PettyCashCode}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.criteria")}
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.Criteria}
              options={[{label:getViewDisbursment?.Criteria,value:getViewDisbursment?.Criteria}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.vatMainAccount")}
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.VATMainAccount}
              options={[{label:getViewDisbursment?.VATMainAccount,value:getViewDisbursment?.VATMainAccount}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label="VAT Sub Account"
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.VATSubAccount}
              options={[{label:getViewDisbursment?.VATSubAccount,value:getViewDisbursment?.VATSubAccount}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.whtMainAccount")}
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.WHTMainAccount}
              options={[{label:getViewDisbursment?.WHTMainAccount,value:getViewDisbursment?.WHTMainAccount}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label="WHT Sub Account"
              placeholder="Select"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={getViewDisbursment?.WHTSubAccount}
              options={[{label:getViewDisbursment?.WHTSubAccount,value:getViewDisbursment?.WHTSubAccount}]}
                optionLabel="label"
            // optionLabel="pettycashcode"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.remarks")}
              placeholder={t("pettyCash.enterRemarks")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={getViewDisbursment?.Remarks}
            />
          </div>
        </div>
      </Card>
      <Card className="mt-3">
        <DisbursementDetailviewTable />
      </Card>
    </div>
  );
};

export default DisbursementDetailview;
