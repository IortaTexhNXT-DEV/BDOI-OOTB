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
} from "../store/insuranceCompanyMiddleware";
import { useSelector, useDispatch } from "react-redux";
import countriesData from "./data";
import { act } from "react-dom/test-utils";

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
      getInsuranceView: insuranceCompanyReducers?.getInsuranceView,
      getInsurancePatchData: insuranceCompanyReducers?.getInsurancePatchData,
    };
  });
  console.log(getInsuranceView, "find getInsuranceView");
  const { id } = useParams();
  console.log(id, "find route id");
  const toastRef = useRef(null);
  const navigation = useNavigate();

  // useEffect(() => {
  //   if (action === "edit" || action === "view") {
  //     if (id != null) {
  //       const filteredInsuranceCompanyList = InsuranceCompanyList.filter(
  //         (data) => data.id === parseInt(id)
  //       );
  //       setFormikValues(filteredInsuranceCompanyList);
  //       setdropdown(filteredInsuranceCompanyList)
  //     }
  //   }
  // }, [action]);

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

  const City = countriesData.city.map((city) => ({
    label: action === "add" ? city : getInsuranceView?.city,
    value: action === "add" ? city : getInsuranceView?.city,
  }));
  console.log(dropdownData, "find main");

  // const City=action === "add"? countriesData.city.map(city => ({
  //   label:city,
  //   value:  city

  // })):{ label:dropdownData[0].city,
  //   value:  dropdownData[0].city}

  const State = countriesData.state.map((state) => ({
    label: action === "add" ? state : getInsuranceView.state,
    value: action === "add" ? state : getInsuranceView.state,
  }));

  const Country = countriesData.countries.map((country) => ({
    label: action === "add" ? country : getInsuranceView.country,
    value: action === "add" ? country : getInsuranceView.country,
  }));

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
    if (!values.phoneNumber) {
      errors.phoneNumber = "Phone Number is required";
    } else if (!/^\d{10}$/.test(values.phoneNumber)) {
      errors.phoneNumber = "Invalid phone number (10 digits)";
    }

    return errors;
  };
  const handleSubmit = (values) => {
    // Handle form submission
    if (action === "add") {
      const valueWithId = {
        ...values,
        id: InsuranceCompanyList?.length + 1,
      };
      dispatch(postInsuranceCompanyMiddleWare(valueWithId));

      toastRef.current.showToast();

      {
        setTimeout(() => {
          navigation("/master/generals/insurancemanagement/insurancecompany");
          formik.resetForm();
        }, 3000);
      }
    } else if (action === "edit") {
      console.log(values, "find edit values");
      dispatch(patchInsuranceCompanyMiddleWare(values));
      navigation("/master/generals/insurancemanagement/insurancecompany");
    } else {
      navigation("/master/generals/insurancemanagement/insurancecompany");
    }
  };
  const [cityDataOption, setCityDataOption] = useState([]);
  const [stateDataOption, setStateDataOption] = useState([]);
  const [countryDataOption, setCountryDataOption] = useState([]);
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
      modifiedBy: getInsurancePatchData?.modifiedby,
      modifiedOn: getInsurancePatchData?.modifiedOn,
    };
    if (cityData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setCityDataOption([{ label: cityData, value: cityData }]);
    }
    if (stateData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setStateDataOption([{ label: stateData, value: stateData }]);
    }
    if (countryData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setCountryDataOption([{ label: countryData, value: countryData }]);
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };
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
          message="Insurance Company Code CC1234 
          is added"
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
              // value={formik.values.insuranceCompanyCode}
              value={
                action == "add"
                  ? formik.values.insuranceCompanyCode
                  : action == "edit"
                    ? formik.values.insuranceCompanyCode
                    : getInsuranceView.insuranceCompanyCode
              }
              // value={formik.values.insuranceCompanyCode}
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
                  : getInsuranceView.insuranceCompanyName
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
                  : getInsuranceView.insuranceCompanyDescription
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
                  : getInsuranceView.addressLine1
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
                  : getInsuranceView.addressLine2
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
                  : getInsuranceView.addressLine3
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
                  : getInsuranceView.city
              }
             
              onChange={(e) => formik.setFieldValue("city", e.value)}
              options={
                action == "add"
                  ? City
                  : action == "edit"
                  ? cityDataOption
                  : City
              }
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
                  : getInsuranceView.state
              }
             
              onChange={(e) => formik.setFieldValue("state", e.value)}
              // options={State}
              options={
                action == "add"
                  ? State
                  : action == "edit"
                  ? stateDataOption
                  : State
              }
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
                  : getInsuranceView.country
              }
              
              onChange={(e) => formik.setFieldValue("country", e.value)}
              // options={Country}
              options={
                action == "add"
                  ? Country
                  : action == "edit"
                  ? countryDataOption
                  : Country
              }
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
                  : getInsuranceView.phoneNumber
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
                  : getInsuranceView.email
              }
             
              onChange={(e) => formik.setFieldValue("email", e.target.value)}
            />
            {formik.touched.email && formik.errors.email && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.email}
              </div>
            )}
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
                  : getInsuranceView.modifiedBy
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
                  : getInsuranceView.modifiedOn
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
