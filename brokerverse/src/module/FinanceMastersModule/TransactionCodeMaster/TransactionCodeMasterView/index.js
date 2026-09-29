import React, { useRef, useEffect } from "react";
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
import { getUserGroupAccess, postAddTransaction } from "../store/transactionCodeMasterMiddleware";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import useTransactionCodeOptions from "../useTransactionCodeOptions";

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
  const codeOptions = useTransactionCodeOptions();
  const BankAccountCode = codeOptions.basis;
  const MainAccountCode = codeOptions.mainAccounts;
  const SubAccountCode = codeOptions.subAccounts;
  const BranchCode = codeOptions.branches;
  const DepartmentCode = codeOptions.departments;
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
    navigate(-1);
  };

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getUserGroupAccess([]));
  }, [dispatch]);
  const handleSubmit = async (values) => {
    try {
      await dispatch(postAddTransaction(values)).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        navigate("/master/finance/transactioncode");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.TransactionCode) {
      errors.TransactionCode = t("validation.fieldRequired");
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

    if (!values.SubAccountCode) {
      errors.SubAccountCode = t("financeMasters.thisFieldIsRequired");
    }
    if (!values.DepartmentCode) {
      errors.DepartmentCode = t("financeMasters.thisFieldIsRequired");
    }
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
      <CustomToast ref={toastRef} message={t("financeMasters.saveSuccessfully")} />
      <div className="grid  m-0">
        <div className="col-12 md:col-12 lg:col-12">
        <div>
          <span onClick={handleClick}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          Add Transaction Code
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
                  formik.setFieldValue("TransactionBasis", e.value);
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
                onChange={formik.handleChange("MainAccountDescription")}
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
                value={
                  formik.values.SubAccountCode
                    ? `MainAccountCode ${formik.values.SubAccountDescription}`
                    : ""
                }
                onChange={formik.handleChange("SubAccountDescription")}
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
                value={
                  formik.values.BranchCode
                    ? `BranchCode ${formik.values.BranchDescription}`
                    : ""
                }
                onChange={formik.handleChange("BranchDescription")}
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
                value={
                  formik.values.DepartmentCode
                    ? `DepartmentCode ${formik.values.DepartmentDescription}`
                    : ""
                }
                onChange={formik.handleChange("DepartmentDescription")}
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
