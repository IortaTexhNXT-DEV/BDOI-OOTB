import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { Card } from "primereact/card";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import CustomToast from "../../../../components/Toast";
import TransactionCodeMasterViewTable from "./TransactionCodeMasterViewTable";
import NavBar from "../../../../components/NavBar";
import { useDispatch, useSelector } from "react-redux";
import { postAddTransaction } from "../store/transactionCodeMasterMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  TransactionCode: "",
  TransactionName: "",
  Description: "",
  TransactionBasis: "",
  MainAccountCode: "",
  MainAccountDescription: "",
  SubAccountCode: "",
  SubAccountDescription: "",
  BranchCode: "",
  BranchDescription: "",
  DepartmentCode: "",
  DepartmentDescription: "",
  // DepartmentCode: ""
};

const BankAccountCode = [
  { label: "1101001", value: "1101001" },
  { label: "1101002", value: "1101002" },
];
const MainAccountCode = [
  { label: "1101001", value: "1101001" },
  { label: "1101002", value: "1101002" },
];
const BranchCode = [
  { label: "101", value: "101" },
  { label: "102", value: "102" },
];
const DepartmentCode = [
  { label: "1101002", value: "1101002" },
  { label: "1101003", value: "1101003" },
];
const SubAccountCode = [
  { label: "1101001", value: "1101001" },
  { label: "1101002", value: "1101002" },
];

const TransactionCodeMasterView = () => {
  const { t } = useTranslation();
  const { TransactioncodeList, loading } = useSelector(({ transactionCodeMasterReducer }) => {
    return {
      loading: transactionCodeMasterReducer?.loading,
      TransactioncodeList: transactionCodeMasterReducer?.TransactioncodeList,

      // addJournalVoucher: journalVoucherReducers?.addJournalVoucher

    };
  });
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const items = [
    {
      label: "Transaction code",
      url: "/master/finance/transactioncode",
    },
    {
      label: "Add Transaction Code",
      url: "/master/finance/transactioncode/addtransactioncode",
    },
  ];
  const Initiate = { label: "Master" };

  const handleClick = () => {
    // navigate("/master/finance/transactioncode");
    navigate(-1);
  };

  const dispatch = useDispatch();
  const handleSubmit = (values) => {
    console.log(values, "values");
    const valueWithId = {
      ...values,
      id: TransactioncodeList?.length + 1,
    };
    dispatch(postAddTransaction(valueWithId));
    toastRef.current.showToast();
    // {
    setTimeout(() => {
      navigate("/master/finance/transactioncode");
    }, 3000);
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.TransactionCode) {
      errors.TransactionCode = t("financeMasters.thisFieldCodeRequired");
    }
    if (!values.TransactionName) {
      errors.TransactionName = t("financeMasters.thisFieldIsRequired");
    }
    if (!values.Description) {
      errors.Description = t("financeMasters.thisFieldIsRequired");
    }
    if (!values.TransactionBasis) {
      errors.TransactionBasis = t("financeMasters.thisFieldIsRequired");
    }
    if (!values.MainAccountCode) {
      errors.MainAccountCode = t("financeMasters.thisFieldIsRequired");
    }

    // if (!values.MainAccountDescription) {
    //   errors.MainAccountDescription = "This field is required";
    // }
    if (!values.SubAccountCode) {
      errors.SubAccountCode = t("financeMasters.thisFieldIsRequired");
    }
    // if (!values.SubAccountDescription) {
    //   errors.SubAccountDescription = "This field is required";
    // }
    if (!values.DepartmentCode) {
      errors.DepartmentCode = t("financeMasters.thisFieldIsRequired");
    }
    // if (!values. DepartmentDescription) {
    //   errors. DepartmentDescription= "This field is required";
    // }
    if (!values.BranchCode) {
      errors.BranchCode = t("financeMasters.thisFieldIsRequired");
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  return (
    <div className="transactioncode__master__view">
      {/* <CustomToast ref={toastRef} message="Petty Cash Initiated Successfully"/> */}
      <CustomToast ref={toastRef} message={t("financeMasters.saveSuccessfully")} />
      <div className="grid  m-0">
        <div className="col-12 md:col-12 lg:col-12">
        <div>
          <span onClick={handleClick}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Transaction Code
            {/* {action === "add"
            ? "Add Country"
            : action === "edit"
              ? "Edit Country"
              : "Country Details"} */}
          </label>
        </div>
          {/* <div
            className="Transaction__Code__Master__title"
            onClick={() => {
              handleClick();
            }}
          >
            <SvgBackArrow />
            Add Transaction Code
          </div> */}
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
        <Card className="mt-4">
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <InputField
                classNames="input__filed"
                label={t("financeMasters.transactionCode")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionCode}
                onChange={formik.handleChange("TransactionCode")}
                error={
                  formik.touched.TransactionCode &&
                  formik.errors.TransactionCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label={t("financeMasters.transactionName")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.TransactionName}
                onChange={formik.handleChange("TransactionName")}
                error={
                  formik.touched.TransactionName &&
                  formik.errors.TransactionName
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
                error={
                  formik.touched.Description &&
                  formik.errors.Description
                }
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("financeMasters.transactionBasis")}
                placeholder={t("financeMasters.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.TransactionBasis}
                options={BankAccountCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("TransactionBasis", e.value);
                  // handleAccountcode(e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.TransactionBasis &&
                  formik.errors.TransactionBasis
                }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("financeMasters.mainAccountCode")}
                placeholder={t("financeMasters.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.MainAccountCode}
                options={MainAccountCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("MainAccountCode", e.value);
                  // handleAccountcode(e.value.);
                }}
                optionLabel="label"
                error={
                  formik.touched.MainAccountCode &&
                  formik.errors.MainAccountCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label={t("financeMasters.mainAccountDescription")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                value={
                  formik.values.MainAccountCode
                    ? `MainAccountCode ${formik.values.MainAccountDescription}`
                    : ""
                }
                //value={formik.values.MainAccountDescription}
                onChange={formik.handleChange("MainAccountDescription")}
              // error={
              //   formik.touched.MainAccountDescription &&
              //   formik.errors.MainAccountDescription
              // }
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
                options={SubAccountCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("SubAccountCode", e.value);
                  // handleAccountcode(e.value.);
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
                label={t("financeMasters.subAccountDescription")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formik.values.SubAccountDescription}
                value={
                  formik.values.SubAccountCode
                    ? `MainAccountCode ${formik.values.SubAccountDescription}`
                    : ""
                }
                onChange={formik.handleChange("SubAccountDescription")}
              // error={
              //   formik.touched.SubAccountDescription &&
              //   formik.errors.SubAccountDescription
              // }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("financeMasters.branchCode")}
                placeholder={t("financeMasters.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.BranchCode}
                options={BranchCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("BranchCode", e.value);
                  // handleAccountcode(e.value.);
                }}
                optionLabel="label"
                error={formik.touched.BranchCode && formik.errors.BranchCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label={t("financeMasters.branchDescription")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formik.values.BranchDescription}
                value={
                  formik.values.BranchCode
                    ? `BranchCode ${formik.values.BranchDescription}`
                    : ""
                }
                onChange={formik.handleChange("BranchDescription")}
              // error={
              //   formik.touched.BranchDescription &&
              //   formik.errors.BranchDescription
              // }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("financeMasters.departmentCodeLabel")}
                placeholder={t("financeMasters.select")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.DepartmentCode}
                options={DepartmentCode}
                onChange={(e) => {
                  console.log(e.value);
                  formik.setFieldValue("DepartmentCode", e.value);
                  // handleAccountcode(e.value.);
                }}
                optionLabel="label"
                error={formik.touched.DepartmentCode && formik.errors.DepartmentCode}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label={t("financeMasters.departmentDescription")}
                placeholder={t("financeMasters.enter")}
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                // value={formik.values.DepartmentDescription}
                value={
                  formik.values.DepartmentCode
                    ? `DepartmentCode ${formik.values.DepartmentDescription}`
                    : ""
                }
                onChange={formik.handleChange("DepartmentDescription")}
              // error={
              //   formik.touched.DepartmentDescription &&
              //   formik.errors.DepartmentDescription
              // }
              />
            </div>
          </div>
        </Card>
      </form>
      <TransactionCodeMasterViewTable />
      <div className="btn__container">
        <Button
          label={t("financeMasters.save")}
          className="add__btn"
          onClick={() => {
            formik.handleSubmit();
          }}
          disabled={!formik.isValid}
        />
      </div>
    </div>
  );
};

export default TransactionCodeMasterView;
