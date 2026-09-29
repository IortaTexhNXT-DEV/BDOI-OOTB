import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SubmitButton from "../../../../../components/SubmitButton";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../../../../../components/NavBar";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { useFormik } from "formik";
import { Toast } from "primereact/toast";
import CustomToast from "../../../../../components/Toast";
import { InputText } from "primereact/inputtext";
import { FileUpload } from "primereact/fileupload";
import DepartMentList from "./DepartMentList";
import { useDispatch, useSelector } from "react-redux";
import {
  patchBranchEditMiddleware,
  postAddBranchMiddleware,
} from "../store/branchMiddleware";
import countriesData from "./data";

const initialValues = {
  BranchCode: "",
  BranchName: "",
  CompanyName: "",
  EmailID: "",
  Description: "",
  AddressLine1: "",
  AddressLine2: "",
  AddressLine3: "",
  City: "",
  State: "",
  Country: "",
  PhoneNumber: "",
  Fax: "",
};

function AddBranch({ action }) {
  const { t } = useTranslation();
  console.log(action,"actionaction");
  const { organizationBranchView, loading, getBranchPatch } = useSelector(
    ({ organizationBranchMainReducers }) => {
      return {
        loading: organizationBranchMainReducers?.loading,
        organizationBranchView:
          organizationBranchMainReducers?.organizationBranchView,
        getBranchPatch: organizationBranchMainReducers?.getBranchPatch,
      };
    }
  );
  console.log(organizationBranchView, "organizationBranchView");
  const toastRef = useRef(null);
  const [date, setDate] = useState(null);
  const Navigate = useNavigate();
  const { id } = useParams();
  const [departmentcode, setDepartmentCode] = useState(null);
  const [branchcode, setBranchCode] = useState(null);
  const [payeetype, setPayeeType] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [customercode, setCustomerCode] = useState(null);
  const [transactioncode, setTransactioncode] = useState(null);
  const [selectinstrumentcurrency, setSelectInstrumentCurrency] =
    useState(null);

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.branch"), url: "/master/generals/organization/branchmaster" },
    {
      label: action === "add" ? t("generalMasters.addBranch") : action === "edit" ? t("generalMasters.editBranch") : t("generalMasters.branchDetails"),
    },
  ];
  const currencyCode = [
    {
      label:
        action === "add"
          ? "ARIANS INSURANCE BROKERS INC"
          : organizationBranchView.CompanyName,
      value: action === "add" ? "NY" : organizationBranchView.CompanyName,
    },
  ];

  // const City = [
  //   {
  //     label: action === "add" ? "" : organizationBranchView.City,
  //     value: action === "add" ? "NY" : organizationBranchView.City,
  //   },
  // ];
  // const State = [
  //   {
  //     label: action === "add" ? "" : organizationBranchView.State,
  //     value: action === "add" ? "NY" : organizationBranchView.State,
  //   },
  // ];
  // const Country = [
  //   {
  //     label: action === "add" ? "" : organizationBranchView.Country,
  //     value: action === "add" ? "NY" : organizationBranchView.Country,
  //   },
  // ];
  // const City = [
  //   {
  //     label: action === "add" ? "ARIANS INSURANCE BROKERS INC" : organizationBranchView.CompanyName,
  //     value: action === "add" ? "ARIANS INSURANCE BROKERS INC" : organizationBranchView.CompanyName,
  //   },
  //   {
  //     label: action === "add" ? "ARIANS gh BROKERS INC" : organizationBranchView.CompanyName,
  //     value: action === "add" ? "ARIANS gh BROKERS INC" : organizationBranchView.CompanyName,
  //   },
  //   // Add more options as needed
  // ];

  // const City=countriesData.city.map((val)=>({
  //   label:val
  // }))


  const City = countriesData.city.map(city => ({

    label: action === "add" ? city : organizationBranchView.City,
    value: action === "add" ? city : organizationBranchView.City,
  }));
  console.log(City, "CitCityy");

  const State = countriesData.state.map((state) => ({
    label: action === "add" ? state : organizationBranchView.State,
    value: action === "add" ? state : organizationBranchView.State,
  }));

  const Country = countriesData.countries.map((country) => ({
    label: action === "add" ? country : organizationBranchView.Country,
    value: action === "add" ? country : organizationBranchView.Country,
  }));
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const dispatch = useDispatch();

  const handleSubmit = (value) => {
    console.log("find", action);
    // Handle form submission
    if (action == "add") {
      dispatch(postAddBranchMiddleware(formik.values));
      toastRef.current.showToast();
      // {
      setTimeout(() => {
        Navigate("/master/generals/organization/branchmaster");
      }, 3000);
    } else if (action == "edit") {
      dispatch(patchBranchEditMiddleware(value));
      toastRef.current.showToast();
      // {
      setTimeout(() => {
        Navigate("/master/generals/organization/branchmaster");
      }, 3000);
    } else {
      // alert("ji");
    }
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.BranchCode) {
      errors.BranchCode = "This field Code is required";
    }
    if (!values.BranchName) {
      errors.BranchName = "This field is required";
    }
    if (!values.CompanyName) {
      errors.CompanyName = "This field is required";
    }
    
    if (!values.EmailID) {
      errors.EmailID = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
      errors.EmailID = "Invalid email address";
    }
    
    if (!values.Description) {
      errors.Description = "This field is required";
    }
   
    if (!values.City) {
      errors.City = "This field is required";
    }
    if (!values.State) {
      errors.State = "This field is required";
    }
    if (!values.Country) {
      errors.Country = "This field is required";
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
  });
  // };
  const [companyNameOptionData, setCompanyNameOptionData] = useState([]);
  const [cityDataOption, setCityDataOption] = useState([]);
  const [stateDataOption, setStateDataOption] = useState([]);
  const [countryDataOption, setCountryDataOption] = useState([]);
  const setFormikValues = () => {
    const companyNameData = getBranchPatch?.CompanyName;
    const cityData = getBranchPatch?.City;
    const stateData = getBranchPatch?.State;
    const countryData = getBranchPatch?.Country;
    if (action == "edit") {
      const updatedValues = {
        id: getBranchPatch?.id,
        BranchCode: getBranchPatch?.BranchCode,
        BranchName: getBranchPatch?.BranchName,
        CompanyName: companyNameData,
        EmailID: getBranchPatch?.EmailID,
        Description: getBranchPatch?.Description,
        AddressLine1: getBranchPatch?.AddressLine1,
        AddressLine2: getBranchPatch?.AddressLine2,
        AddressLine3: getBranchPatch?.AddressLine3,
        City: cityData,
        State: stateData,
        Country: countryData,
        PhoneNumber: getBranchPatch?.PhoneNumber,
        Fax: getBranchPatch?.Fax,
      };

      if (companyNameData) {
        formik.setValues({ ...formik.values, ...updatedValues });
        setCompanyNameOptionData([
          { label: companyNameData, value: companyNameData },
        ]);
      }
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
    }
  };

  console.log(formik.values.id, "idd");
  useEffect(() => {
    setFormikValues();
  }, [getBranchPatch]);

  return (
    <div className="overall__addbranch__container">
      <CustomToast ref={toastRef} message="Branch code BC1234 added" />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">
          {action === "add"
            ? "Add Branch"
            : action === "edit"
            ? "Edit Branch"
            : "Branch details"}
        </label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card>
        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.branchCode")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.BranchCode
                  : action == "edit"
                  ? formik.values.BranchCode
                  : organizationBranchView.BranchCode
              }
              onChange={formik.handleChange("BranchCode")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.BranchCode && formik.errors.BranchCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.BranchCode}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.branchName")}
              placeholder={t("generalMasters.enter")}
              //   value={formik.values.CurrencyDescription}
              value={
                action == "add"
                  ? formik.values.BranchName
                  : action == "edit"
                  ? formik.values.BranchName
                  : organizationBranchView.BranchName
              }
              onChange={formik.handleChange("BranchName")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.BranchName && formik.errors.BranchName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.BranchName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("generalMasters.companyName")}
              value={
                action == "add"
                  ? formik.values.CompanyName
                  : action == "edit"
                  ? formik.values.CompanyName
                  : organizationBranchView.CompanyName
              }
              onChange={(e) => formik.setFieldValue("CompanyName", e.value)}
              options={
                action == "add"
                  ? currencyCode
                  : action == "edit"
                  ? companyNameOptionData
                  : currencyCode
              }
              optionLabel="label"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.CompanyName && formik.errors.CompanyName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.CompanyName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailIdBranch")}
              placeholder={t("generalMasters.enter")}
              //   value={formik.values.CurrencyDescription}
              value={
                action == "add"
                  ? formik.values.EmailID
                  : action == "edit"
                  ? formik.values.EmailID
                  : organizationBranchView.EmailID
              }
              onChange={formik.handleChange("EmailID")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.EmailID && formik.errors.EmailID && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.EmailID}
              </div>
            )}
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.description")}
                placeholder={t("generalMasters.enter")}
                //   value={formik.values.CurrencyDescription}
                value={
                  action == "add"
                    ? formik.values.Description
                    : action == "edit"
                    ? formik.values.Description
                    : organizationBranchView.Description
                }
                onChange={formik.handleChange("Description")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.Description && formik.errors.Description && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.Description}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.addressLine1")}
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.AddressLine1
                    : action == "edit"
                    ? formik.values.AddressLine1
                    : organizationBranchView.AddressLine1
                }
                onChange={formik.handleChange("AddressLine1")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.AddressLine1 && formik.errors.AddressLine1 && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.AddressLine1}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.addressLine2")}
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.AddressLine2
                    : action == "edit"
                    ? formik.values.AddressLine2
                    : organizationBranchView?.AddressLine2
                }
                onChange={formik.handleChange("AddressLine2")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.AddressLine2 && formik.errors.AddressLine2 && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.AddressLine2}
                </div>
              )}
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.addressLine3")}
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.AddressLine3
                    : action == "edit"
                    ? formik.values.AddressLine3
                    : organizationBranchView.AddressLine3
                }
                onChange={formik.handleChange("AddressLine3")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.AddressLine3 && formik.errors.AddressLine3 && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.AddressLine3}
                </div>
              )}
            </div>
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("generalMasters.city")}
              value={
                action == "add"
                  ? formik.values.City
                  : action == "edit"
                  ? formik.values.City
                  : organizationBranchView.City
              }
              onChange={(e) => formik.setFieldValue("City", e.value)}
              options={
                action == "add"
                  ? City
                  : action == "edit"
                  ? cityDataOption
                  : City
              }
              optionLabel="label"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.City && formik.errors.City && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.City}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("generalMasters.state")}
              value={
                action == "add"
                  ? formik.values.State
                  : action == "edit"
                  ? formik.values.State
                  : organizationBranchView.State
              }
              onChange={(e) => formik.setFieldValue("State", e.value)}
              options={
                action == "add"
                  ? State
                  : action == "edit"
                  ? stateDataOption
                  : State
              }
              optionLabel="label"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.State && formik.errors.State && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.State}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("generalMasters.country")}
              optionLabel="label"
              value={
                action == "add"
                  ? formik.values.Country
                  : action == "edit"
                  ? formik.values.Country
                  : organizationBranchView.Country
              }
              onChange={(e) => formik.setFieldValue("Country", e.value)}
              options={
                action == "add"
                  ? Country
                  : action == "edit"
                  ? countryDataOption
                  : Country
              }
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.Country && formik.errors.Country && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.Country}
              </div>
            )}
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <label className="label_text">Phone Number</label>
            <div className="p-inputgroup flex-1">
              <span className="p-inputgroup-addon">
                <div>+91</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.PhoneNumber
                    : action == "edit"
                    ? formik.values.PhoneNumber
                    : organizationBranchView.PhoneNumber
                }
                onChange={formik.handleChange("PhoneNumber")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.PhoneNumber && formik.errors.PhoneNumber && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.PhoneNumber}
                </div>
              )}
            </div>
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <label className="label_text">Fax</label>
            <div className="p-inputgroup flex-1">
              <span className="p-inputgroup-addon">
                <div>020</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.Fax
                    : action == "edit"
                    ? formik.values.Fax
                    : organizationBranchView.Fax
                }
                onChange={formik.handleChange("Fax")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.Fax && formik.errors.Fax && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.Fax}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {action != "add" && <DepartMentList action={action} />}

      <div className="next_container">
        {action === "add" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.save")}
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.update")}
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

export default AddBranch;
