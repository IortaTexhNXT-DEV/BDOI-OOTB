import React, { useRef } from "react";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import CustomToast from "../../../../components/Toast";
import { Button } from "primereact/button";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import usePettyCashOptions, { describe } from "../../usePettyCashOptions";
import { useDispatch, useSelector } from "react-redux";
import { getAddReplenishTableMiddleware } from "../store/pettyCashReplenishMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const initialValue = {
  PettycashCode: "",
  PettycashDescription: "",
  BankCode: "",
  BankAccountName: "",
  SubAccountCode: "",
  SubAccountDescription: "",
  TransactionCode: "",
  BranchCode: "",
  Branchdescription: "",
  Departmentdescription: "",
  DisbursementFromdate: new Date(),
  DisbursementTodate: new Date(),
};

const AddReplenish = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toastRef = useRef(null);

  const { ReplenishList, loading } = useSelector(
    ({ pettyCashReplenishReducer }) => {
      return {
        loading: pettyCashReplenishReducer?.loading,
        ReplenishList: pettyCashReplenishReducer?.ReplenishList,
      };
    }
  );
  const items = [
    {
      label: "Petty Cash",
      command: () => navigate("/accounts/pettycash/replenish"),
    },
    {
      label: "Add Replenish",
      to: "/accounts/pettycash/addreplenish",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/replenish");
  };
  const { funds, banks, subAccounts, transactionCodes, branches, departments } =
    usePettyCashOptions();
  const handleSubmit = async (values) => {
    const result = await dispatch(getAddReplenishTableMiddleware(values));
    if (getAddReplenishTableMiddleware.rejected.match(result)) {
      toastRef.current?.showToast({ severity: "error", detail: result.payload });
      return;
    }
    navigate("/accounts/pettycash/addreplenishtable");
  };

  const validate = (values) => {
    const errors = {};

    if (!values.PettycashCode) {
      errors.PettycashCode = "Receipt Number is required";
    }

    if (!values.BankCode) {
      errors.BankCode = "Bank Code is required";
    }

   

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  const handleTrans = (option) =>
    formik.setFieldValue("TransactionDescription", describe(transactionCodes, option?.code));
  const handleBankcode = (option) =>
    formik.setFieldValue("BankAccountName", describe(banks, option?.code));
  const handleBranch = (option) =>
    formik.setFieldValue("BranchDescription", describe(branches, option?.code));
  const handleDepart = (option) =>
    formik.setFieldValue("DepartmentDescription", describe(departments, option?.code));
  const handleSubAccount = (option) =>
    formik.setFieldValue("SubAccountDescription", describe(subAccounts, option?.code));
  const handlePettyCashDescribtion = (fund) =>
    formik.setFieldValue("PettycashDescription", fund?.description || "");



  return (
    <div className="add__replenish__container">
      <CustomToast ref={toastRef} />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
         
          <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Replenish
          </label>
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
      <form onSubmit={formik.handleSubmit}>
        <Card className="mt-6">
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
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
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
            <InputField
                classNames="input__filed"
                label="Transaction Code"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 xl:col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Number"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value=""
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Petty cash Code*"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.PettycashCode}
                options={funds}
                onChange={(e) => {
                  formik.setFieldValue("PettycashCode", e.value).then(() => {
                    handlePettyCashDescribtion(e.value);
                  });
                }}
                optionLabel="label"
                error={
                  formik.touched.PettycashCode && formik.errors.PettycashCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Petty cash Description"
                //   placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.PettycashDescription}
                onChange={formik.handleChange("PettycashDescription")}
                // error={
                //   formik.touched.PettycashDescription &&
                //   formik.errors.PettycashDescription
                // }
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Bank Code*"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BankCode}
                options={banks}
                onChange={(e) => {
                  formik.setFieldValue("BankCode", e.value).then(() => {
                    handleBankcode(e.value);
                  });
                }}
                optionLabel="code"
                error={formik.touched.BankCode && formik.errors.BankCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Bank Account Name"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.BankAccountName}
                onChange={formik.handleChange("BankAccountName")}
                error={
                  formik.touched.BankAccountName &&
                  formik.errors.BankAccountName
                }
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Sub Account Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.SubAccountCode}
                options={subAccounts}
                onChange={(e) => {
                  formik.setFieldValue("SubAccountCode", e.value).then(() => {
                    handleSubAccount(e.value);
                  });
                }}
                optionLabel="label"
                error={
                  formik.touched.SubAccountCode && formik.errors.SubAccountCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Sub Account Description"
                // placeholder="Enter"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.SubAccountDescription}
                onChange={formik.handleChange("SubAccountDescription")}
                error={
                  formik.touched.SubAccountDescription &&
                  formik.errors.SubAccountDescription
                }
              />
            </div>
          </div>
          <div className="grid ">
            <div className="calender__container col-12 md:col-3 lg:col-3 ">
              <LabelWrapper className="calenderlable__container">
                Disbursement From date
              </LabelWrapper>
              <Calendar
                showIcon
                placeholder="Select"
                className="calendar_container"
                value={formik.values.DisbursementFromdate}
                onChange={(e) => {
                  formik.setFieldValue("DisbursementFromdate", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
            <div className="calender__container col-12 md:col-3 lg:col-3 ">
              <LabelWrapper className="calenderlable__container">
                Disbursement To date
              </LabelWrapper>
              <Calendar
                showIcon
                placeholder="Select"
                className="calendar_container"
                value={formik.values.DisbursementTodate}
                onChange={(e) => {
                  formik.setFieldValue("DisbursementTodate", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
          </div>
        </Card>
      </form>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label="Next"
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReplenish;
