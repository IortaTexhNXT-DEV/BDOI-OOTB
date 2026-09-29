import React, { useState, useRef } from "react";
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
import {
  PettyCashCode,
  BankAccountCode,
  SubAccount,
  CurrencyType,
  Transcode,
  Branchcode,
  Departcode, TransactionCode
} from "../../mock";
import {
  postInitiateMiddleware,
} from "../store/pettyCashInitiateMiddleware";
import { useDispatch, useSelector } from "react-redux";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../components/LabelWrapper";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";

const initialValue = {
  TransactionDate: new Date(),
  TransactionCode: "",
  TransactionNumber: "",
  PettyCashCodes: "",
  PettyCashdescription: "",
  PettyCashSize: "",
  BankCode: "",
  BankAccountCode: "",
  MainAccountCode: "",
  SubAccountCode: "",
  Currency: "",
  Currencydescription: "",
  BranchCode: "",
  Branchdescription: "",
  DepartmentCode: "",
  Departmentdescription: "",
  AvailableCash: "",
  MaxLimit: "",
  MinimumCashbox: "",
};

const InitiateForm = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const validate = (values) => {
    const errors = {};

    if (!values.PettyCashCodes) {
      errors.PettyCashCodes = t("pettyCash.pettyCashCodeRequiredMsg");
    }

    if (!values.BankCode) {
      errors.BankCode = t("pettyCash.bankCodeRequired");
    }

    if (!values.BankAccountCode) {
      errors.BankAccountCode = t("pettyCash.bankAccountCodeRequired");
    }

    if (!values.MainAccountCode) {
      errors.MainAccountCode = t("pettyCash.currencyRequired");
    }

    // if (!values.TransactionCode) {
    //   errors.TransactionCode = "Transaction Code is required";
    // }

    // if (!values.BranchCode) {
    //   errors.BranchCode = "Branch Code is required";
    // }

    // if (!values.DepartmentCode) {
    //   errors.DepartmentCode = "Department Code is required";
    // }
    return errors;
  };

  const { InitiateList, loading } = useSelector(
    ({ pettyCashInitiateReducer }) => {
      return {
        loading: pettyCashInitiateReducer?.loading,
        InitiateList: pettyCashInitiateReducer?.InitiateList,
      };
    }
  );

  const handleSubmit = (value) => {
    const valueWithId = {
      ...value,
      id: InitiateList?.length + 1,
    };
    console.log("first", valueWithId)
    dispatch(postInitiateMiddleware(valueWithId));
    toastRef.current.showToast();
    setTimeout(() => {
      navigate("/accounts/pettycash/pettycashcodeinitiate");
    }, 2000);
  };
  const items = [
    { label: t("pettyCash.pettyCashLabel"), command: () => navigate("/accounts/pettycash/pettycashcodeinitiate") },
    {
      label: t("pettyCash.pettyCashCodeInitiateLabel"),
      command: () => navigate("/accounts/pettycash/pettycashcodeinitiate"),
    },
    {
      label: t("pettyCash.initiate"),
      to: "/accounts/pettycash/pettycashcodeinitiate/initiate",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate("/accounts/pettycash/pettycashcodeinitiate");
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const handlePettyCashDescribtion = (value) => {
    console.log("first", value)
    let description = "";
    let pettycashsize = "";
    let AvailableCash = "";
    let translimit = "";
    let maxlimit = "";
    switch (value) {
      case "PC001":
        description = "PC-1";
        break;
      case "PC002":
        description = "PC-2";
        break;
      case "PC003":
        description = "PC-3";
        break;
      case "PC004":
        description = "PC-4";
        break;
      default:
        description = "Unknown";
        break;
    }
    switch (value) {
      case "PC001":
        pettycashsize = "1000";
        break;
      case "PC002":
        pettycashsize = "2000";
        break;
      case "PC003":
        pettycashsize = "3000";
        break;
      case "PC004":
        pettycashsize = "4000";
        break;
      default:
        pettycashsize = "Unknown";
        break;
    }
    switch (value) {
      case "PC001":
        AvailableCash = "10,000";
        break;
      case "PC002":
        AvailableCash = "20,000";
        break;
      case "PC003":
        AvailableCash = "30,000";
        break;
      // case "1818810131":
      //   Availablecash = "40,000";
      //   break;
      default:
        AvailableCash = "Unknown";
        break;
    }
    switch (value) {
      case "PC001":
        maxlimit = "1000";
        break;
      case "PC002":
        maxlimit = "2000";
        break;
      case "PC003":
        maxlimit = "3000";
        break;
      // case "1818810131":
      //   maxlimit = "4000";
      //   break;
      default:
        maxlimit = "Unknown";
        break;
    }
    switch (value) {
      case "PC001":
        translimit = "10,000";
        break;
      case "PC002":
        translimit = "20,000";
        break;
      case "PC003":
        translimit = "30,000";
        break;
      // case "1818810131":
      //   translimit = "40,000";
      //   break;
      default:
        translimit = "Unknown";
        break;
    }
    formik.setFieldValue("AvailableCash", AvailableCash);
    formik.setFieldValue("MaxLimit", translimit);
    formik.setFieldValue("MinimumCashbox", maxlimit);
    formik.setFieldValue("PettyCashSize", pettycashsize);
    formik.setFieldValue("PettyCashdescription", description);
  };
  const handlecurrency = (value) => {
    let currency = "";
    switch (value.CurrencyType) {
      case "THB":
        currency = "Thai Baht";
        break;
      // case "US":
      //   currency = "United states Currency";
      //   break;
      case "USD":
        currency = "United States Currency";
        break;
      case "PHP":
        currency = "Philippine Peso";
        break;
      default:
        currency = "Unknown";
        break;
    }
    formik.setFieldValue("Currencydescription", currency);
  };

  const handleTrans = (value) => {
    let Trans = "";
    switch (value.Transcode) {
      case "PRM":
        Trans = "Trans-1";
        break;
      case "COMM":
        Trans = "Trans-2";
        break;
      case "REMT":
        Trans = "Trans-3";
        break;
      // case "Trans00123":
      //   Trans = "Trans-4";
      //   break;
      default:
        Trans = "Unknown";
        break;
    }
    formik.setFieldValue("Transactiondescription", Trans);
  };
  const handleBranch = (value) => {
    let Branch = "";
    switch (value) {
      case "THB001":
        Branch = "Branch-1";
        break;
      case "THB002":
        Branch = "Branch-2";
        break;
      case "THB003":
        Branch = "Branch-3";
        break;
      case "THB004":
        Branch = "Branch-4";
        break;
      default:
        Branch = "Unknown";
        break;
    }
    formik.setFieldValue("Branchdescription", Branch);
  };
  const handleDepart = (value) => {
    let Depart = "";
    switch (value) {
      case "FIN":
        Depart = "Depart-1";
        break;
      case "MKT":
        Depart = "Depart-2";
        break;
      case "IT":
        Depart = "Depart-3";
        break;
      case "SLS":
        Depart = "Depart-4";
        break;
      default:
        Depart = "Unknown";
        break;
    }
    formik.setFieldValue("Departmentdescription", Depart);
  };
  const handleAccountcode = (value) => {
    console.log("first3", value)
    // let AvailableCash = "";
    // let translimit = "";
    // let maxlimit = "";
    // switch (value) {
    //   case "Bk001":
    //     AvailableCash = "10,000";
    //     break;
    //   case "Bk002":
    //     AvailableCash = "20,000";
    //     break;
    //   case "Bk003":
    //     AvailableCash = "30,000";
    //     break;
    //   // case "1818810131":
    //   //   Availablecash = "40,000";
    //   //   break;
    //   default:
    //     AvailableCash = "Unknown";
    //     break;
    // }
    // switch (value) {
    //   case "Bk001":
    //     maxlimit = "1000";
    //     break;
    //   case "Bk002":
    //     maxlimit = "2000";
    //     break;
    //   case "Bk003":
    //     maxlimit = "3000";
    //     break;
    //   // case "1818810131":
    //   //   maxlimit = "4000";
    //   //   break;
    //   default:
    //     maxlimit = "Unknown";
    //     break;
    // }
    // switch (value) {
    //   case "Bk001":
    //     translimit = "10,000";
    //     break;
    //   case "Bk002":
    //     translimit = "20,000";
    //     break;
    //   case "Bk003":
    //     translimit = "30,000";
    //     break;
    //   // case "1818810131":
    //   //   translimit = "40,000";
    //   //   break;
    //   default:
    //     translimit = "Unknown";
    //     break;
    // }
    // formik.setFieldValue("AvailableCash", AvailableCash);
    // formik.setFieldValue("MaxLimit", translimit);
    // formik.setFieldValue("MinimumCashbox", maxlimit);
  };
  return (
    <div className="pettycash__form">
      <CustomToast ref={toastRef} message={t("pettyCash.initiatedSuccessfully")} />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
        <div>
          <span onClick={handleClick}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          {t("pettyCash.addPettyCash")}
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


      <Card className="mt-4">


        <div class="grid" style={{ flexDirection: "row-reverse" }}>
          {/* <div class="col-12 md:col-6 lg:col-3">
        <div class="text-center p-3 border-round-sm bg-primary font-bold">col-12 md:col-6 lg:col-3</div>
    </div> */}
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("pettyCash.transactionNumber")}
              // placeholder={"Enter"}
              // value={formik.values.TransactionDescription}
              value={
                formik.values.TransactionNumber

              }
              // value={formik.values.Transactioncode}

              onChange={formik.handleChange("TransactionNumber")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.transactionCode")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            // value={formik.values.PettyCashdescription}
            // onChange={formik.handleChange("PettyCashdescription")}
            // error={
            //   formik.touched.PettyCashdescription &&
            //   formik.errors.PettyCashdescription
            // }
            />

          </div>
          <div className="calender__container col-12 md:col-3 lg-col-3 ">
            <LabelWrapper className="calenderlable__container">
              {t("pettyCash.transactionDate")}
            </LabelWrapper>
            <Calendar
              showIcon
              placeholder={t("pettyCash.select")}
              className="calendar_container"
              value={formik.values.TransactionDate}

              onChange={(e) => {
                formik.setFieldValue("TransactionDate", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              error={formik.errors.TransactionDate}

            />
          </div>
        </div>


        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.pettyCashCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.PettyCashCodes}
              options={PettyCashCode}
              onChange={(e) => {
                console.log(e.value, "qwerty");
                formik.setFieldValue("PettyCashCodes", e.value).then(() => {
                  handlePettyCashDescribtion(e.value.PettyCashCodes);
                })
              }}
              optionLabel="PettyCashCodes"
              error={
                formik.touched.PettyCashCodes && formik.errors.PettyCashCodes
              }
            />
            {/* {formik.touched.PettyCashCode &&
              formik.errors.PettyCashCode && (
                <div style={{ fontSize: 8, color: "red",marginTop:4 }}>
                  {formik.errors.PettyCashCode}
                </div>
              )} */}

          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashDescription")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.PettyCashdescription}
              onChange={formik.handleChange("PettyCashdescription")}
            // error={
            //   formik.touched.PettyCashdescription &&
            //   formik.errors.PettyCashdescription
            // }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashSize")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.PettyCashSize}
              onChange={formik.handleChange("PettyCashSize")}
              error={
                formik.touched.PettyCashSize && formik.errors.PettyCashSize
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.bankCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.BankCode}
              options={BankAccountCode}
              onChange={(e) => {
                console.log(e.value, "first4");
                formik.setFieldValue("BankCode", e.value).then(() => {
                  handleAccountcode(e.value.BankAccountCode);
                })

              }}
              optionLabel="BankAccountCode"
              error={
                formik.touched.BankCode &&
                formik.errors.BankCode
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.bankAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.BankAccountCode}
              options={SubAccount}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("BankAccountCode", e.value);
              }}
              optionLabel="SubAccount"
              error={
                formik.touched.BankAccountCode && formik.errors.BankAccountCode
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.mainAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.MainAccountCode}
              options={CurrencyType}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("MainAccountCode", e.value).then(() => {
                  // handlecurrency(e.value);
                })
              }}
              optionLabel="CurrencyType"
              error={formik.touched.MainAccountCode && formik.errors.MainAccountCode}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.subAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.SubAccountCode}
              options={SubAccount}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("SubAccountCode", e.value);
              }}
              optionLabel="SubAccount"
              error={
                formik.touched.SubAccountCode && formik.errors.SubAccountCode
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.currency")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.Currency}
              options={CurrencyType}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("Currency", e.value).then(() => {
                  handlecurrency(e.value);
                })

              }}
              optionLabel="CurrencyType"
              error={formik.touched.Currency && formik.errors.Currency}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.currencyDescription")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Currencydescription}
              onChange={formik.handleChange("Currencydescription")}
              error={
                formik.touched.Currencydescription &&
                formik.errors.Currencydescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.branchCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.BranchCode}
              options={Branchcode}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("BranchCode", e.value).then(() => {
                  handleBranch(e.value.Branchcode);
                })

              }}
              optionLabel="Branchcode"
              error={formik.touched.BranchCode && formik.errors.BranchCode}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.branchDescription")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Branchdescription}
              onChange={formik.handleChange("Branchdescription")}
              error={
                formik.touched.Branchdescription &&
                formik.errors.Branchdescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.departmentCode")}
              placeholder={t("pettyCash.select")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formik.values.DepartmentCode}
              options={Departcode}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("DepartmentCode", e.value).then(() => {
                  handleDepart(e.value.Departcode);
                })

              }}
              optionLabel="Departcode"
              error={
                formik.touched.DepartmentCode && formik.errors.DepartmentCode
              }
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.departmentDescription")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Departmentdescription}
              onChange={formik.handleChange("Departmentdescription")}
              error={
                formik.touched.Departmentdescription &&
                formik.errors.Departmentdescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.availableCash")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.AvailableCash}
              onChange={formik.handleChange("AvailableCash")}
              error={
                formik.touched.AvailableCash && formik.errors.AvailableCash
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.maxLimit")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.MaxLimit}
              onChange={formik.handleChange("MaxLimit")}
              error={
                formik.touched.MaxLimit &&
                formik.errors.MaxLimit
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.minimumCashbox")}
              // placeholder="Enter"
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.MinimumCashbox}
              onChange={formik.handleChange("MinimumCashbox")}
              error={
                formik.touched.MinimumCashbox && formik.errors.MinimumCashbox
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.approve")}
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
              disabled={!formik.isValid}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitiateForm;
