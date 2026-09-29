import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import NavBar from "../../../../../components/NavBar";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import InputField from "../../../../../components/InputField";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { MultiSelect } from "primereact/multiselect";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../../components/Toast";
import SvgDropdownicon from "../../../../../assets/icons/SvgDropdownicon";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import {
  patchInsuranceCompanyMiddleWare,
  postInsuranceCompanyMiddleWare,
  getInsuranceViewMiddleWare,
  getInsurancePatchData as loadInsurancePatchData,
} from "../store/insuranceCompanyMiddleware";
import { useSelector, useDispatch } from "react-redux";
import { act } from "react-dom/test-utils";
import useMasterOptions from "../../../common/useMasterOptions";

const InsuranceDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [dropdownData, setdropdown] = useState({});
  const {
    InsuranceCompanyList,
    getInsuranceView,
    loading,
    getInsurancePatchData,
  } = useSelector(({ insuranceCompanyReducers }) => {
    return {
      loading: insuranceCompanyReducers?.loading,
      InsuranceCompanyList: insuranceCompanyReducers?.InsuranceCompanyList,
      getInsuranceView: insuranceCompanyReducers?.InsuranceMasterView || {},
      getInsurancePatchData: insuranceCompanyReducers?.InsuranceMasterPatchData,
    };
  });
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

  const items = [
    {
      label: t("generalMasters.insuranceManagement"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: t("generalMasters.insuranceCompany"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: action === "add" ? t("generalMasters.addInsuranceCompany") : action === "edit" ? t("generalMasters.editInsuranceCompany") : t("generalMasters.insuranceCompanyDetails"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const City = useMasterOptions("city");

  // const City=action === "add"? countriesData.city.map(city => ({
  //   label:city,
  //   value:  city

  // })):{ label:dropdownData[0].city,
  //   value:  dropdownData[0].city}

  const State = useMasterOptions("state");

  const Country = useMasterOptions("country");

  const customValidation = (values) => {
    const errors = {};

    if (!values.insuranceCompanyCode) {
      errors.insuranceCompanyCode = t("validation.fieldRequired");
    }
    if (!values.insuranceCompanyName) {
      errors.insuranceCompanyName = t("validation.fieldRequired");
    }
    if (!values.insuranceCompanyDescription) {
      errors.insuranceCompanyDescription = t("validation.fieldRequired");
    }
   
    if (!values.city) {
      errors.city = t("validation.fieldRequired");
    }
    if (!values.state) {
      errors.state = t("validation.fieldRequired");
    }
    if (!values.country) {
      errors.country = t("validation.fieldRequired");
    }
    
    if (!values.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Invalid email address";
    }
    // credit terms: optional whole numbers of days (empty = the configured default)
    ["premiumWarrantyDays", "remittanceTermsDays"].forEach((key) => {
      const v = values[key];
      if (v !== "" && v !== null && v !== undefined && !/^\d{1,4}$/.test(String(v).trim())) {
        errors[key] = t("numberingMasters.creditTerms.daysInvalid");
      }
    });
    if (!values.phoneNumber) {
      errors.phoneNumber = "Phone Number is required";
    } else if (!/^\+?[\d\s()-]{7,20}$/.test(values.phoneNumber)) {
      errors.phoneNumber = "Invalid phone number";
    }

    return errors;
  };
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/insurancecompany");
      return;
    }
    const thunk = action === "add" ? postInsuranceCompanyMiddleWare : patchInsuranceCompanyMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/insurancecompany");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = () => {
    const cityData = getInsurancePatchData?.city;
    const stateData = getInsurancePatchData?.state;
    const countryData = getInsurancePatchData?.country;

    const updatedValues = {
      id: getInsurancePatchData?.id,
      insuranceCompanyCode: getInsurancePatchData?.insuranceCompanyCode,
      insuranceCompanyName: getInsurancePatchData?.insuranceCompanyName,
      insuranceCompanyDescription:
        getInsurancePatchData?.insuranceCompanyDescription,
      addressLine1: getInsurancePatchData?.addressLine1,
      addressLine2: getInsurancePatchData?.addressLine2,
      addressLine3: getInsurancePatchData?.addressLine3,
      city: cityData,
      state: stateData,
      country: countryData,
      email: getInsurancePatchData?.email,
      phoneNumber: getInsurancePatchData?.phoneNumber,
      premiumWarrantyDays: getInsurancePatchData?.premiumWarrantyDays ?? "",
      remittanceTermsDays: getInsurancePatchData?.remittanceTermsDays ?? "",
      defaultBillingMode: getInsurancePatchData?.defaultBillingMode ?? "",
      modifiedBy: getInsurancePatchData?.modifiedBy,
      modifiedOn: getInsurancePatchData?.modifiedOn,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  // load the record by the id in the address, so a refreshed or shared link works too
  useEffect(() => {
    if (id && action === "view") dispatch(getInsuranceViewMiddleWare(id));
    if (id && action === "edit") dispatch(loadInsurancePatchData(id));
  }, [id, action]);

  useEffect(() => {
    if (action === "view" || action === "edit") {
      setFormikValues();
    }
  }, [getInsurancePatchData]);

  const formik = useFormik({
    initialValues: {
      id: id,
      insuranceCompanyCode: "",
      insuranceCompanyName: "",
      insuranceCompanyDescription: "",
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      city: "",
      state: "",
      country: "",
      email: "",
      phoneNumber: "",
      premiumWarrantyDays: "",
      remittanceTermsDays: "",
      defaultBillingMode: "",
      modifiedBy: "",
      modifiedOn: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="action__insurance__company_container">
      <div className="grid m-0 top-container">
        <CustomToast
          ref={toastRef}
          message={`Insurance Company Code ${formik.values.insuranceCompanyCode} is added`}
        />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? t("generalMasters.addInsuranceCompany")
                : action === "edit"
                ? t("generalMasters.editInsuranceCompany")
                : t("generalMasters.insuranceCompanyDetails")}
            </div>
          </div>
        </div>
        <div className="col-12 p-0">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="card__container">
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.insuranceCompanyCode")}
              value={
                action == "add"
                  ? formik.values.insuranceCompanyCode
                  : action == "edit"
                    ? formik.values.insuranceCompanyCode
                    : getInsuranceView?.insuranceCompanyCode
              }
              onChange={(e) =>
                formik.setFieldValue("insuranceCompanyCode", e.target.value)
              }
            />
            {formik.touched.insuranceCompanyCode &&
              formik.errors.insuranceCompanyCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.insuranceCompanyCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.insuranceCompanyName")}
              value={
                action == "add"
                  ? formik.values.insuranceCompanyName
                  : action == "edit"
                  ? formik.values.insuranceCompanyName
                  : getInsuranceView?.insuranceCompanyName
              }
              
              onChange={(e) =>
                formik.setFieldValue("insuranceCompanyName", e.target.value)
              }
            />
            {formik.touched.insuranceCompanyName &&
              formik.errors.insuranceCompanyName && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.insuranceCompanyName}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.insuranceCompanyDescription")}
              value={
                action == "add"
                  ? formik.values.insuranceCompanyDescription
                  : action == "edit"
                  ? formik.values.insuranceCompanyDescription
                  : getInsuranceView?.insuranceCompanyDescription
              }
             
              onChange={(e) =>
                formik.setFieldValue(
                  "insuranceCompanyDescription",
                  e.target.value
                )
              }
            />
            {formik.touched.insuranceCompanyDescription &&
              formik.errors.insuranceCompanyDescription && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.insuranceCompanyDescription}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.addressLine1")}
              value={
                action == "add"
                  ? formik.values.addressLine1
                  : action == "edit"
                  ? formik.values.addressLine1
                  : getInsuranceView?.addressLine1
              }
              
              onChange={(e) =>
                formik.setFieldValue("addressLine1", e.target.value)
              }
            />
            {formik.touched.addressLine1 && formik.errors.addressLine1 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine1}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.addressLine2")}
              value={
                action == "add"
                  ? formik.values.addressLine2
                  : action == "edit"
                  ? formik.values.addressLine2
                  : getInsuranceView?.addressLine2
              }
             
              onChange={(e) =>
                formik.setFieldValue("addressLine2", e.target.value)
              }
            />
            {formik.touched.addressLine2 && formik.errors.addressLine2 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine2}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.addressLine3")}
              value={
                action == "add"
                  ? formik.values.addressLine3
                  : action == "edit"
                  ? formik.values.addressLine3
                  : getInsuranceView?.addressLine3
              }
              
              onChange={(e) =>
                formik.setFieldValue("addressLine3", e.target.value)
              }
            />
            {formik.touched.addressLine3 && formik.errors.addressLine3 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine3}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__corrections"
              optionLabel="label"
              label={t("generalMasters.city")}
              value={
                action == "add"
                  ? formik.values.city
                  : action == "edit"
                  ? formik.values.city
                  : getInsuranceView?.city
              }
             
              onChange={(e) => formik.setFieldValue("city", e.value)}
              options={City}
            />
            {formik.touched.city && formik.errors.city && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.city}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__corrections"
              optionLabel="label"
              label={t("generalMasters.state")}
              value={
                action == "add"
                  ? formik.values.state
                  : action == "edit"
                  ? formik.values.state
                  : getInsuranceView?.state
              }
             
              onChange={(e) => formik.setFieldValue("state", e.value)}
              options={State}
            />
            {formik.touched.state && formik.errors.state && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.state}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__corrections"
              optionLabel="label"
              label={t("generalMasters.country")}
              value={
                action == "add"
                  ? formik.values.country
                  : action == "edit"
                  ? formik.values.country
                  : getInsuranceView?.country
              }
              
              onChange={(e) => formik.setFieldValue("country", e.value)}
              options={Country}
            />
            {formik.touched.country && formik.errors.country && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.country}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.phoneNumber")}
              value={
                action == "add"
                  ? formik.values.phoneNumber
                  : action == "edit"
                  ? formik.values.phoneNumber
                  : getInsuranceView?.phoneNumber
              }
              
              onChange={(e) =>
                formik.setFieldValue("phoneNumber", e.target.value)
              }
            />
            {formik.touched.phoneNumber && formik.errors.phoneNumber && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.phoneNumber}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.emailId")}
              value={
                action == "add"
                  ? formik.values.email
                  : action == "edit"
                  ? formik.values.email
                  : getInsuranceView?.email
              }
             
              onChange={(e) => formik.setFieldValue("email", e.target.value)}
            />
            {formik.touched.email && formik.errors.email && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.email}
              </div>
            )}
          </div>
          <div className="col-12 p-0 pl-2 pt-3">
            <div className="insurance__credit__terms__title">{t("numberingMasters.creditTerms.title")}</div>
            <div className="insurance__credit__terms__hint">{t("numberingMasters.creditTerms.hint")}</div>
          </div>
          {[
            ["premiumWarrantyDays", "numberingMasters.creditTerms.premiumWarrantyDays"],
            ["remittanceTermsDays", "numberingMasters.creditTerms.remittanceTermsDays"],
          ].map(([key, label]) => (
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 " key={key}>
              <InputField
                disabled={action === "view"}
                classNames="input__field__corrections"
                className="input__label__corrections"
                placeholder={t("numberingMasters.creditTerms.useDefault")}
                label={t(label)}
                value={(action === "add" || action === "edit" ? formik.values[key] : getInsuranceView?.[key]) ?? ""}
                onChange={(e) => formik.setFieldValue(key, e.target.value)}
              />
              {formik.errors[key] && (
                <div style={{ fontSize: 12, color: "red" }}>{formik.errors[key]}</div>
              )}
            </div>
          ))}
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <DropDowns
              disabled={action === "view"}
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder={t("numberingMasters.creditTerms.useDefault")}
              classNames="select__label__corrections"
              optionLabel="label"
              label={t("numberingMasters.creditTerms.defaultBillingMode")}
              value={(action === "add" || action === "edit" ? formik.values.defaultBillingMode : getInsuranceView?.defaultBillingMode) || ""}
              onChange={(e) => formik.setFieldValue("defaultBillingMode", e.value)}
              options={[
                { label: t("numberingMasters.creditTerms.useDefault"), value: "" },
                { label: t("numberingMasters.creditTerms.broker"), value: "broker" },
                { label: t("numberingMasters.creditTerms.direct"), value: "direct" },
              ]}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("generalMasters.modifiedBy")}
              value={
                action == "add"
                  ? formik.values.modifiedBy
                  : action == "edit"
                  ? formik.values.modifiedBy
                  : getInsuranceView?.modifiedBy
              }
             
              onChange={(e) =>
                formik.setFieldValue("modifiedBy", e.target.value)
              }
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("generalMasters.modifiedOn")}
              value={
                action == "add"
                  ? formik.values.modifiedOn
                  : action == "edit"
                  ? formik.values.modifiedOn
                  : getInsuranceView?.modifiedOn
              }
            
              onChange={(e) =>
                formik.setFieldValue("modifiedOn", e.target.value)
              }
            />
          </div>
        </div>
      </div>
      <div className="flex justify-content-end mt-5">
        {action === "add" && (
          <Button
            className="save__action"
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          >
            Save
          </Button>
        )}
        {action === "edit" && (
          <Button
            className="save__action"
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          >
            Update
          </Button>
        )}
      </div>
    </div>
  );
};

export default InsuranceDetailsAction;
