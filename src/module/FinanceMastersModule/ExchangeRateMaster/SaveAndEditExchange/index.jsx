import React, { useState, useRef, useEffect } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import { patchExchangeDetailEdit } from "../store/exchangeMasterMiddleware";

const initialValues = {
  EffectiveFrom: "",
  EffectiveTo: "",
  CurrencyCode: "",
  ToCurrencyCode: "",
  ExchangeRate: "",
  CurrencyDescription: "",
  ToCurrencyDescription: "",
};

function EditExchange() {
  const { t } = useTranslation();
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

  const PayeeType = [
    { name: "Customer", code: "NY" },
    { name: "owner", code: "RM" },
  ];
  const Criteria = [
    { name: "Specific", code: "NY" },
    { name: "payall", code: "RM" },
  ];
  const CustomerCode = [
    { name: "Cus00123", code: "NY" },
    { name: "Cus001234", code: "RM" },
  ];
  const Transactioncode = [
    { name: "Trans00123", code: "NY" },
    { name: "Trans001234", code: "RM" },
  ];
  const SelectInstrumentCurrency = [
    { name: "PHP", code: "PHP" },
    { name: "THB", code: "THB" },
    { name: "USD", code: "USD" },
  ];

  const home = { label: t("financeMasters.master") };
  const items = [
    { label: t("financeMasters.exchangeRate"), url: "/master/finance/exchangerate" },
    { label: t("financeMasters.editExchangeRate") },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const dispatch = useDispatch();

  const { getExchangeEdit, loading } = useSelector(
    ({ exchangeMasterReducer }) => {
      return {
        loading: exchangeMasterReducer?.loading,
        getExchangeEdit: exchangeMasterReducer?.getExchangeEdit,
      };
    }
  );
  console.log(getExchangeEdit, "exchangeDetailEdit");
  const handleSubmit = (value) => {
    console.log(value, "value");
    dispatch(patchExchangeDetailEdit(value));
    Navigate("/master/finance/exchangerate");

    // toastRef.current.showToast();
    // setTimeout(() => {
    //   Navigate("/master/finance/exchangerate")
    // }, 2000)
  };
  const currencyCode = [
    {
      label: getExchangeEdit?.CurrencyCode,
      value: getExchangeEdit?.CurrencyCode,
    },
  ];
  const ToCurrencyCode = [
    {
      label: getExchangeEdit?.ToCurrencyCode,
      value: getExchangeEdit?.ToCurrencyCode,
    },
  ];
  const setFormikValues = () => {
    const IsoCode = getExchangeEdit?.ISOcode;
    const updatedValues = {
      id: getExchangeEdit.id,
      EffectiveFrom: new Date(getExchangeEdit?.EffectiveFrom),
      EffectiveTo: new Date(getExchangeEdit?.EffectiveTo),
      CurrencyCode: getExchangeEdit?.CurrencyCode,
      ToCurrencyCode: getExchangeEdit?.ToCurrencyCode,
      ExchangeRate: getExchangeEdit?.ExchangeRate,
      CurrencyDescription: getExchangeEdit?.CurrencyDescription,
      ToCurrencyDescription: getExchangeEdit?.ToCurrencyDescription,
    };

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  console.log(formik.values.id, "idleo");
  useEffect(() => {
    setFormikValues();
  }, [getExchangeEdit]);

  // const formik = useFormik({
  //   initialValues:initialValues,

  //    onSubmit:handleSubmit
  // });

  return (
    <div className="overall__editexchange__container">
      {/* <CustomToast ref={toastRef} 
            // detail="Some detail text"
            // content={"Voucher Details Save Successfully"}
            /> */}
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">Edit Exchange Rate</label>
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
                // value={departmentcode}
                // onChange={(e) => setDepartmentCode(e.value)}
                value={formik.values.CurrencyCode}
                onChange={(e) => formik.setFieldValue("CurrencyCode", e.value)}
                options={currencyCode}
                optionLabel="label"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Currency  Description"
                placeholder={"Enter"}
                //   value={formik.values.CurrencyDescription}
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
                label="To Currency Code"
                // value={departmentcode}
                // onChange={(e) => setDepartmentCode(e.value)}
                value={formik.values.ToCurrencyCode}
                onChange={(e) =>
                  formik.setFieldValue("ToCurrencyCode", e.value)
                }
                options={ToCurrencyCode}
                optionLabel="label"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="To Currency  Description"
                placeholder={"Enter"}
                //   value={formik.values.ToCurrencyDescription}
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
              Effective From
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.EffectiveFrom}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("EffectiveFrom", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <LabelWrapper className="calenderlable__container">
              Effective To
            </LabelWrapper>
            <Calendar
              classNames="calender__container"
              showIcon
              value={formik.values.EffectiveTo}
              minDate={minDate}
              onChange={(e) => {
                formik.setFieldValue("EffectiveTo", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <InputField
              classNames="field__container"
              label="Exchange Rate"
              placeholder={"Enter"}
              value={formik.values.ExchangeRate}
              onChange={formik.handleChange("ExchangeRate")}
            />
          </div>
        </div>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label="Update"
          // disabled={!formik.isValid}
          // onClick={()=>{formik.handleSubmit();}}
          onClick={formik.handleSubmit}
        />
      </div>
    </div>
  );
}

export default EditExchange;
