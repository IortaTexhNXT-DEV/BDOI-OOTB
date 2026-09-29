import React, { useState, useRef, useEffect } from "react";
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
import { useSelector } from "react-redux";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";
import usePettyCashOptions, { describe } from "../../usePettyCashOptions";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";

const initialValue = {
  PettyCashCode: "",
  PettyCashdescription: "",
  PettyCashSize: "",
  BankAccountNumber: "",
  SubAccountCode: "",
  Currency: "",
  Currencydescription: "",
  TransactionCode: "",
  Transactiondescription: "",
  BranchCode: "",
  Branchdescription: "",
  DepartmentCode: "",
  Departmentdescription: "",
  AvailableCash: "",
  TransactionLimit: "",
  MinimumCashbox: "", TransactionDate: new Date()
};

const PettyCashCodeDetails = () => {
  const { t } = useTranslation();
  const { InitiateDetails } = useSelector(({ pettyCashInitiateReducer }) => ({
    InitiateDetails: pettyCashInitiateReducer?.InitiateDetails || {},
  }));
  const { currencies, branches, departments } = usePettyCashOptions();
  const branchcodeOptions = [
    {
      label: InitiateDetails?.Branchcode,
      value: InitiateDetails?.Branchcode,
    },
  ];
  const departcodeOptions = [
    {
      label: InitiateDetails?.Departmentcode,
      value: InitiateDetails?.Departmentcode,
    },
  ];
  const currency = [
    { label: InitiateDetails?.Currency, value: InitiateDetails?.Currency },
  ];
  const selectedCurrencyCode = currency[0];
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const items = [
    { label: t("pettyCash.pettyCashLabel"), command: () => navigate("/accounts/pettycash/pettycashcodeinitiate") },
    {
      label: t("pettyCash.pettyCashCodeDetails"),
      to: "/accounts/pettycash/PettyCashCodeDetails",
      color: "red",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate("/accounts/pettycash/pettycashcodeinitiate");
  };

  const formik = useFormik({
    initialValues: initialValue,
  });

  return (
    <div className="pettycash__form">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="pettycash__title"
            onClick={() => {
              handleClick();
            }}
          >
            <SvgBackArrow />
            {t("pettyCash.pettyCashCodeDetails")}
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
      <Card className="mt-4 tabel__card__header"  >

        <div class="grid" style={{ flexDirection: "row-reverse" }}>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("pettyCash.transactionNumber")}
              value={InitiateDetails?.TransactionNumber}

            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">

            <InputField
              disabled={true}
              classNames="field__container"
              label={t("pettyCash.transactionCode")}
               value={InitiateDetails?.TransactionCode}

            />

          </div>
          <div className="calender__container col-12 md:col-3 lg-col-3 ">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.transactionDate")}
              disabled={true}
              value={InitiateDetails?.TransactionDate}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
        </div>

        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashCode")}
              disabled={true}
              value={InitiateDetails?.Pettycashcode}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashDescription")}
              disabled={true}
              value={InitiateDetails?.PettyCashdescription}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashSize")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={InitiateDetails.Pettycashsize}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.bankCode")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={InitiateDetails?.BankCode}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.bankAccountCode")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={InitiateDetails?.BankAccountCode}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.mainAccountCode")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={InitiateDetails?.MainAccountCode}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.subAccountCode")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={InitiateDetails?.SubAccountCode}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.currency")}
              placeholder={t("pettyCash.select")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={selectedCurrencyCode.value}
              options={currency}
              optionValue="value"
              optionLabel="label"
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.currencyDescription")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={describe(currencies, InitiateDetails?.Currency)}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.branchCode")}
              placeholder={t("pettyCash.select")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              optionValue="value"
              optionLabel="label"
              value={InitiateDetails.Branchcode}
              options={branchcodeOptions}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.branchDescription")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={describe(branches, InitiateDetails?.Branchcode)}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.departmentCode")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={400}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              optionValue="value"
              optionLabel="label"
              value={InitiateDetails?.Departmentcode}
              options={departcodeOptions}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.departmentDescription")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={describe(departments, InitiateDetails?.Departmentcode)}
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.availableCash")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formatCurrency(InitiateDetails?.AvailableCash)}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.maxLimit")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formatCurrency(InitiateDetails?.MaxLimit)}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.minimumCashbox")}
              disabled={true}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              value={formatCurrency(InitiateDetails?.MinimumCashbox)}
            />
          </div>
        </div>

      </Card>
    </div>
  );
};

export default PettyCashCodeDetails;
