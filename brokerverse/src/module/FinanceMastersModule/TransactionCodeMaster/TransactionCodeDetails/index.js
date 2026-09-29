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
import TransactionCodeMasterDetailViewTable from "./TransactionCodeMasterDetailViewTable";
import NavBar from "../../../../components/NavBar";
import { useSelector } from "react-redux";

const TransactionCodeDetails = () => {
  const { t } = useTranslation();
  const { TrascationcodeDetailsView, TransactioncodeList, loading } =
    useSelector(({ transactionCodeMasterReducer }) => {
      return {
        loading: transactionCodeMasterReducer?.loading,
        TrascationcodeDetailsView:
          transactionCodeMasterReducer?.TrascationcodeDetailsView,
        // addJournalVoucher: journalVoucherReducers?.addJournalVoucher
      };
    });
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const items = [
    {
      label: t("sidebar.Transaction code") || "Transaction code",
      url: "/master/finance/transactioncode",
    },
    {
      label: t("breadcrumb.transactionCodeDetails"),
      // url: "/master/finance/transactioncode/transactioncodedetails/${}",
    },
  ];
  const Initiate = { label: t("breadcrumb.master") };

  const handleClick = () => {
    navigate("/master/finance/transactioncode");
  };
  const pettycashcodeOptions = [
    {
      label: TrascationcodeDetailsView?.TransactionBasis,
      value: TrascationcodeDetailsView?.TransactionBasis,
    },
  ];
  const MainAccountCodeOptions = [
    {
      label: TrascationcodeDetailsView?.MainAccountCode,
      value: TrascationcodeDetailsView?.MainAccountCode,
    },
  ];
  const SubAccountCodeOptions = [
    {
      label: TrascationcodeDetailsView?.SubAccountCode,
      value: TrascationcodeDetailsView?.SubAccountCode,
    },
  ];
  const BranchCodeOptions = [
    {
      label: TrascationcodeDetailsView?.BranchCode,
      value: TrascationcodeDetailsView?.BranchCode,
    },
  ];
  const DepartmentCodeOptions = [
    {
      label: TrascationcodeDetailsView?.DepartmentCode,
      value: TrascationcodeDetailsView?.DepartmentCode,
    },
  ];

  const validate = () => { };

  const handleSubmit = () => {
    navigate("/master/finance/transactioncode");
  };

  const formik = useFormik({
    initialValues: {
      TransactionCode: TrascationcodeDetailsView?.TransactionCode,
      TransactionName: TrascationcodeDetailsView?.TransactionName,
      Description: TrascationcodeDetailsView?.Description,
      TransactionBasis: TrascationcodeDetailsView?.TransactionBasis,
      MainAccountCode: TrascationcodeDetailsView?.MainAccountCode,
      MainAccountDescription: TrascationcodeDetailsView?.MainAccountDescription,
      SubAccountCode: TrascationcodeDetailsView?.SubAccountCode,
      SubAccountDescription: TrascationcodeDetailsView?.SubAccountDescription,
      BranchCode: TrascationcodeDetailsView?.BranchCode,
      BranchDescription: TrascationcodeDetailsView?.BranchDescription,
      DepartmentCode: TrascationcodeDetailsView?.DepartmentCode,
      DepartmentDescription: TrascationcodeDetailsView?.DepartmentDescription,
    },
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  return (
    <div className="transactioncode__master__detail__view">
      {/* <CustomToast ref={toastRef} message="Petty Cash Initiated Successfully"/> */}
      <div className="grid  m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div
            className="Transaction__Code__Master__title"
            onClick={() => {
              handleClick();
            }}
          >
            <SvgBackArrow />
            {t("breadcrumb.transactionCodeDetails")}
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
                label="Transaction Code"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.TransactionCode}
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
                label="Transaction Name"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.TransactionName}
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
                disabled={true}
                value={TrascationcodeDetailsView.Description}
                onChange={formik.handleChange("Description")}
                error={formik.touched.Description && formik.errors.Description}
              />
            </div>
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Transaction Basis"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={TrascationcodeDetailsView.TransactionBasis}
                options={pettycashcodeOptions}
                // onChange={(e) => {
                //   console.log(e.value);
                //   formik.setFieldValue("TransactionBasis", e.value);
                //   //   handleAccountcode(e.value.TransactionBasis);
                // }}
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
                label="Main Account Code"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={TrascationcodeDetailsView.MainAccountCode}
                options={MainAccountCodeOptions}
                onChange={(e) => {
                  formik.setFieldValue("MainAccountCode", e.value);
                  //   handleAccountcode(e.value.MainAccountCode);
                }}
                // optionLabel="MainAccountCode"
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
                label="Main Account Description"
                // placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.MainAccountDescription}
                onChange={formik.handleChange("MainAccountDescription")}
                error={
                  formik.touched.MainAccountDescription &&
                  formik.errors.MainAccountDescription
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
                disabled={true}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={TrascationcodeDetailsView.SubAccountCode}
                options={SubAccountCodeOptions}
                // onChange={(e) => {
                //   console.log(e.value);
                //   formik.setFieldValue("Description", e.value);
                //   handleAccountcode(e.value.);
                // }}
                optionLabel="label"
              // error={
              //   formik.touched.BankAccountNumber &&
              //   formik.errors.BankAccountNumber
              // }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Sub Account Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.SubAccountDescription}

              // onChange={formik.handleChange("TransactionName")}
              // error={
              //   formik.touched.TransactionName &&
              //   formik.errors.TransactionName
              // }
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
                disabled={true}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={TrascationcodeDetailsView.BranchCode}
                options={BranchCodeOptions}
                optionLabel="label"
              // onChange={(e) => {
              //   console.log(e.value);
              //   formik.setFieldValue("Description", e.value);
              //   handleAccountcode(e.value.);
              // }}
              // optionLabel="Description"
              // error={
              //   formik.touched.BankAccountNumber &&
              //   formik.errors.BankAccountNumber
              // }
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Branch Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.BranchDescription}
              // onChange={formik.handleChange("TransactionName")}
              // error={
              //   formik.touched.TransactionName &&
              //   formik.errors.TransactionName
              // }
              />
            </div>
          </div>
          <div className="grid mt-1">
            <div className="col-12 md:col-3 lg-col-3 input__view">
              <DropDowns
                className="input__filed"
                label="Department"
                placeholder="Select"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={TrascationcodeDetailsView.DepartmentCode}
                optionLabel="label"
                options={DepartmentCodeOptions}
              />
            </div>
            <div className="col-12 md:col-6 lg-col-6 input__view">
              <InputField
                classNames="input__filed"
                label="Department Description"
                placeholder="Enter"
                textColor={"#111927"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={TrascationcodeDetailsView.DepartmentDescription}
              // onChange={formik.handleChange("TransactionName")}
              // error={
              //   formik.touched.TransactionName &&
              //   formik.errors.TransactionName
              // }
              />
            </div>
          </div>
        </Card>
      </form>
      <TransactionCodeMasterDetailViewTable />
    </div>
  );
};

export default TransactionCodeDetails;
