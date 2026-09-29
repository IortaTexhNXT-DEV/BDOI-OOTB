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
import { postExchangeStatus } from "../store/exchangeMasterMiddleware";
import { useDispatch, useSelector } from "react-redux";
import useMasterOptions from "../../../GeneralMasters/common/useMasterOptions";
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

function AddExchange() {
  const { t } = useTranslation();
  const { ExchangeList, loading } = useSelector(
    ({ exchangeMasterReducer }) => {
      return {
        loading: exchangeMasterReducer?.loading,
        ExchangeList: exchangeMasterReducer?.ExchangeList,
      };
    }
  );
  const toastRef = useRef(null);
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

  const currencyCode = useMasterOptions("currency", { valueKey: "code", labelKey: "code" });
  const ToCurrencyCode = currencyCode;

  const home = { label: t("financeMasters.master") };
  const items = [
    { label: t("financeMasters.exchangeRate"), url: "/master/finance/exchangerate" },
    {
      label: t("financeMasters.addExchangeRate"),
      url: "/master/finance/exchangerate/addexchange",
    },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const handleSubmit=(value)=>{
  // }

  const dispatch = useDispatch();
  const handleSubmit = async (values) => {
    try {
      await dispatch(postExchangeStatus(values)).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        Navigate("/master/finance/exchangerate");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CurrencyCode) {
      errors.CurrencyCode = t("validation.fieldRequired");
    }
    if (!values.ToCurrencyCode) {
      errors.ToCurrencyCode = t("financeMasters.thisFieldIsRequired");
    }
    if (!values.ExchangeRate) {
      errors.ExchangeRate = t("financeMasters.thisFieldIsRequired");
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission

    // },
    onSubmit: handleSubmit,
  });

  return (
    <div className="overall__addexchange__container">
      <CustomToast ref={toastRef} message={t("financeMasters.exchangeRateAdded", { code: "ER1234" })} />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">{t("financeMasters.addExchangeRate")}</label>
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
                label={t("financeMasters.currencyCodeLabel")}
                value={formik.values.CurrencyCode}
                onChange={(e) => formik.setFieldValue("CurrencyCode", e.value)}
                options={currencyCode}
                optionLabel="label"
                placeholder={t("financeMasters.select")}
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
                label={t("financeMasters.currencyDescription")}
                placeholder={t("financeMasters.enter")}
                value={
                  formik.values.CurrencyCode
                    ? `CurrencyCode ${formik.values.CurrencyDescription}`
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
                label={t("financeMasters.toCurrencyCode")}
                value={formik.values.ToCurrencyCode}
                onChange={(e) =>
                  formik.setFieldValue("ToCurrencyCode", e.value)
                }
                options={ToCurrencyCode}
                optionLabel="label"
                placeholder={t("financeMasters.select")}
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
                label={t("financeMasters.toCurrencyDescription")}
                placeholder={t("financeMasters.enter")}
                value={
                  formik.values.ToCurrencyCode
                    ? `ToCurrencyCode ${formik.values.ToCurrencyDescription}`
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
              {t("financeMasters.effectiveFrom")}
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.EffectiveFrom}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("EffectiveFrom", e.target.value);
              }}
              dateFormat={calendarDateFormat()}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <LabelWrapper className="calenderlable__container">
              {t("financeMasters.effectiveTo")}
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.EffectiveTo}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("EffectiveTo", e.target.value);
              }}
              dateFormat={calendarDateFormat()}
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.exchangeRateValue")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.ExchangeRate}
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

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label={t("financeMasters.save")}
          disabled={!formik.isValid}
          onClick={() => {
            formik.handleSubmit();
          }}
        />
      </div>
    </div>
  );
}

export default AddExchange;
