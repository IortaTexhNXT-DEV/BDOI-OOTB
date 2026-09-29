import React from "react";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import usePettyCashOptions, { describe } from "../../usePettyCashOptions";
import { setReceiptDraft } from "../store/pettyCashReceiptsReducer";
import { useDispatch, useSelector } from "react-redux";
import { getAddReceiptTableMiddleware } from "../store/pettyCashReceiptsMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  ReceiptNumber: "",
  Requester: "",
  BankCode: "",
  BankAccountName: "",
  SubAccountCode: "",
  SubAccountDescription: "",
  TransactionCode: "",
  TransactionDescription: "",
  BranchCode: "",
  BranchDescription: "",
  DepartmentCode: "",
  DepartmentDescription: "",
};

const AddReceipts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = [
    { label: "Petty Cash", command: () => navigate("/accounts/pettycash/receipts") },
    {
      label: "Add Receipt",
      to: "/accounts/pettycash/addreceipts",
    },
  ];
  const Initiate = { label: "Accounts" };

  const handleBack = () => {
    navigate("/accounts/pettycash/receipts");
  };

  const { requesters, banks, subAccounts, transactionCodes, branches, departments } =
    usePettyCashOptions();
  const handleSubmit = (values) => {
    dispatch(setReceiptDraft(values));
    dispatch(getAddReceiptTableMiddleware());
    navigate("/accounts/pettycash/addreceiptstable");
  };
  const validate = (values) => {
    const errors = {};

    if (!values.Requester) {
      errors.Requester = "Receipt Number is required";
    }

    if (!values.BankCode) {
      errors.BankCode = "Bank Code is required";
    }

    if (!values.SubAccountCode) {
      errors.SubAccountCode = "Sub Account Code is required";
    }
    if (!values.TransactionCode) {
      errors.TransactionCode = "Transaction Code is required";
    }
    if (!values.BranchCode) {
      errors.BranchCode = "Branch Code is required";
    }
    if (!values.DepartmentCode) {
      errors.DepartmentCode = "Currency is required";
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

  return (
    <div className="add__receipts__container">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Receipt
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
        <Card className="mt-3">
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label="Receipt Number"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.ReceiptNumber}
                onChange={formik.handleChange("ReceiptNumber")}
                error={
                  formik.touched.ReceiptNumber && formik.errors.ReceiptNumber
                }
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Requester"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.Requester}
                options={requesters}
                onChange={(e) => {
                  formik.setFieldValue("Requester", e.value);

                }}
                optionLabel="label"
                error={formik.touched.Requester && formik.errors.Requester}

              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Bank Code"
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
                  })

                }}
                optionLabel="code"
                error={formik.touched.BankCode && formik.errors.BankCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Bank Account Name"
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
          <div className="grid mt-1">
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
                  })

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
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Transaction Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.TransactionCode}
                options={transactionCodes}
                onChange={(e) => {
                  formik.setFieldValue("TransactionCode", e.value).then(() => {
                    handleTrans(e.value);
                  })

                }}
                optionLabel="code"
                error={
                  formik.touched.TransactionCode &&
                  formik.errors.TransactionCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Transaction Description"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionDescription}
                onChange={formik.handleChange("TransactionDescription")}
                error={
                  formik.touched.TransactionDescription &&
                  formik.errors.TransactionDescription
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Branch Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BranchCode}
                options={branches}
                onChange={(e) => {
                  formik.setFieldValue("BranchCode", e.value).then(() => {
                    handleBranch(e.value);
                  })

                }}
                optionLabel="code"
                error={formik.touched.BranchCode && formik.errors.BranchCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Branch Description"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.BranchDescription}
                onChange={formik.handleChange("BranchDescription")}
                error={
                  formik.touched.BranchDescription &&
                  formik.errors.BranchDescription
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Department Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.DepartmentCode}
                options={departments}
                onChange={(e) => {
                  formik.setFieldValue("DepartmentCode", e.value).then(() => {
                    handleDepart(e.value);
                  })

                }}
                optionLabel="code"
                error={
                  formik.touched.DepartmentCode && formik.errors.DepartmentCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Department Description"
                disabled={true}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.DepartmentDescription}
                onChange={formik.handleChange("DepartmentDescription")}
                error={
                  formik.touched.DepartmentDescription &&
                  formik.errors.DepartmentDescription
                }
              />
            </div>
          </div>
        </Card>
      </form>
      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}

              disabled={!formik.isValid}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReceipts;
