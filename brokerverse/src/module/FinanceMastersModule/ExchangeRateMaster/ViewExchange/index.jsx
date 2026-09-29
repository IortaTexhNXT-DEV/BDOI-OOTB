import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../components/InputField";
import SubmitButton from "../../../../components/SubmitButton";
import SvgDot from "../../../../assets/icons/SvgDot";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import NavBar from "../../../../components/NavBar";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../components/LabelWrapper";
import { useFormik } from "formik";
import { Toast } from "primereact/toast";
import CustomToast from "../../../../components/Toast";
import { useSelector } from "react-redux";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const initialValues = {
  EffectiveFrom: new Date(),
  EffectiveTo: new Date(),
  CurrencyCode: "",
  ToCurrencyCode: "",
  ExchangeRate: "",
  CurrencyDescription: "",
  ToCurrencyDescription: "",
};

function ViewExchange() {
  const { t } = useTranslation();
  const { ExchangeDetailView, loading } = useSelector(
    ({ exchangeMasterReducer }) => {
      return {
        loading: exchangeMasterReducer?.loading,
        ExchangeDetailView: exchangeMasterReducer?.ExchangeDetailView,
      };
    }
  );
  const [date, setDate] = useState(null);
  const Navigate = useNavigate();
  const [departmentcode, setDepartmentCode] = useState(null);
  const [branchcode, setBranchCode] = useState(null);
  const [payeetype, setPayeeType] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [customercode, setCustomerCode] = useState(null);
  const [transactioncode, setTransactioncode] = useState(null);
  const [selectinstrumentcurrency, setSelectInstrumentCurrency] =
    useState(null);

  const currencyCode = [
    {
      label: ExchangeDetailView.CurrencyCode,
      value: ExchangeDetailView.CurrencyCode,
    },
  ];
  const ToCurrencyCode = [
    {
      label: ExchangeDetailView.ToCurrencyCode,
      value: ExchangeDetailView.ToCurrencyCode,
    },
  ];

  const home = { label: t("financeMasters.master") };
  const items = [
    { label: t("financeMasters.exchangeRate"), url: "/master/finance/exchangerate" },
    { label: t("financeMasters.viewExchangeRate") },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const handleSubmit = (value) => {
    Navigate("/master/finance/exchangerate");
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CurrencyCode) {
      errors.CurrencyCode = "This field is required";
    }
    if (!values.ToCurrencyCode) {
      errors.ToCurrencyCode = "This field is required";
    }
    if (!values.ExchangeRate) {
      errors.ExchangeRate = "This field is required";
    }

    return errors;
  };
  const effectiveFromDate = ExchangeDetailView.EffectiveFrom;
  const effectiveToDate = ExchangeDetailView.EffectiveTo;

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission

    // },
    onSubmit: handleSubmit,
  });

  return (
    <div className="overall__viewexchange__container">
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">Exchange Rate Details</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <DropDowns
                className="dropdown__container"
                label="Currency Code"
                value={ExchangeDetailView.CurrencyCode}
                onChange={(e) => formik.setFieldValue("CurrencyCode", e.value)}
                options={currencyCode}
                optionLabel="label"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.CurrencyCode && formik.errors.CurrencyCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.CurrencyCode}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Currency  Description"
                placeholder={"Enter"}
                value={
                  ExchangeDetailView.CurrencyCode
                    ? `CurrencyCode ${ExchangeDetailView.CurrencyDescription}`
                    : ""
                }
                onChange={formik.handleChange("CurrencyDescription")}
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <DropDowns
                className="dropdown__container"
                label="To Currency Code"
                value={ExchangeDetailView.ToCurrencyCode}
                onChange={(e) =>
                  formik.setFieldValue("ToCurrencyCode", e.value)
                }
                options={ToCurrencyCode}
                optionLabel="label"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.ToCurrencyCode &&
                formik.errors.ToCurrencyCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.ToCurrencyCode}
                  </div>
                )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="To Currency  Description"
                placeholder={"Enter"}
                value={
                  ExchangeDetailView.ToCurrencyCode
                    ? `ToCurrencyCode ${ExchangeDetailView.ToCurrencyDescription}`
                    : ""
                }
                onChange={formik.handleChange("ToCurrencyDescription")}
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <LabelWrapper className="calenderlable__container">
              Effective From
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={new Date(effectiveFromDate)}
              dateFormat={calendarDateFormat()}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <LabelWrapper className="calenderlable__container">
              Effective To
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={new Date(effectiveToDate)}
              dateFormat={calendarDateFormat()}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Exchange Rate"
              placeholder={"Enter"}
              value={ExchangeDetailView.ExchangeRate}
              onChange={formik.handleChange("ExchangeRate")}
            />
            {formik.touched.ExchangeRate && formik.errors.ExchangeRate && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.ExchangeRate}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/*  */}
    </div>
  );
}

export default ViewExchange;
