import { BreadCrumb } from "primereact/breadcrumb";
import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import SvgDot from "../../../../../assets/icons/SvgDot";
import "./index.scss";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import SvgBack from "../../../../../assets/icons/SvgBack";
import CustomToast from "../../../../../components/Toast";
import { useNavigate, useParams } from "react-router-dom";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import countriesData from "./data";
import { useDispatch, useSelector } from "react-redux";
import {
  getEmployeEditMiddleWare,
  patchEmployeeEditMiddleware,
  postAddEmployeeMiddleware,
} from "../store/employeeMiddleware";

const AddEmployee = ({ action }) => {
  const { t } = useTranslation();
  console.log(action, "find action");
  const { employeeEditData, loading, total, employeeViewData } = useSelector(
    ({ employeeReducers }) => {
      return {
        loading: employeeReducers?.loading,
        employeeEditData: employeeReducers?.employeeEditData,
        employeeViewData: employeeReducers?.employeeViewData,
        total: employeeReducers,
      };
    }
  );
  console.log(employeeEditData, "find employeeEditData");
  const { id } = useParams();
  console.log(id, "find id");
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const [visiblePopup, setVisiblePopup] = useState("");
  useEffect(() => {
    if (action === "view") {
      setFormikValues();
    } else if (action === "edit") {
      setFormikValues();
    }
  }, [employeeEditData?.id]);

  // useEffect(() => {
  //   if (action === "edit" || action === "view") {
  //     setFormikValues();
  //   }
  // }, [action]);
  const items = [
    { label: "Employee Management" },
    { label: "Employee", url: "/master/generals/employeemanagement/employee" },
    ,
    {
      label: `${
        action === "add"
          ? "Add Employee"
          : action === "edit"
          ? "Edit Employee Details"
          : "View Employee Details"
      }`,
    },
  ];
  const home = { label: "Master" };

  const item = [
    {
      label: action === "add" ? "Em0012" : employeeEditData?.employeeType,
      label: action === "add" ? "Em0012" : employeeEditData?.employeeType,
    },
    {
      label: action === "add" ? "Em0013" : employeeEditData?.employeeType,
      label: action === "add" ? "Em0013" : employeeEditData?.employeeType,
    },
    {
      label: action === "add" ? "Em0014" : employeeEditData?.employeeType,
      label: action === "add" ? "Em0014" : employeeEditData?.employeeType,
    },
  ];
  const item1 = [
    {
      label: action === "add" ? "Level 1 Agent" : employeeEditData?.designation,
      label: action === "add" ? "Level 1 Agent" : employeeEditData?.designation,
    },
    {
      label: action === "add" ? "Level 2 Agent" : employeeEditData?.designation,
      label: action === "add" ? "Level 2 Agent" : employeeEditData?.designation,
    },
    {
      label: action === "add" ? "Level 3 Agent" : employeeEditData?.designation,
      label: action === "add" ? "Level 3 Agent" : employeeEditData?.designation,
    },
  ];

  const item2 = [
    {
      label: action === "add" ? "John Doe" : employeeEditData?.reportingTo,
      label: action === "add" ? "John Doe" : employeeEditData?.reportingTo,
    },
    {
      label: action === "add" ? "Sudarshan" : employeeEditData?.reportingTo,
      label: action === "add" ? "Sudarshan" : employeeEditData?.reportingTo,
    },
    {
      label: action === "add" ? "Uttam" : employeeEditData?.reportingTo,
      label: action === "add" ? "Uttam" : employeeEditData?.reportingTo,
    },
  ];
  const item3 = [
    {
      label: action === "add" ? "Branch0123" : employeeEditData?.branchCode,
      label: action === "add" ? "Branch0123" : employeeEditData?.branchCode,
    },
    {
      label: action === "add" ? "Branch0128" : employeeEditData?.branchCode,
      label: action === "add" ? "Branch0128" : employeeEditData?.branchCode,
    },
    {
      label: action === "add" ? "Branch0148" : employeeEditData?.branchCode,
      label: action === "add" ? "Branch0148" : employeeEditData?.branchCode,
    },
  ];
  const item4 = [
    {
      label: action === "add" ? "Depart123" : employeeEditData?.departmentCode,
      label: action === "add" ? "Depart123" : employeeEditData?.departmentCode,
    },
    {
      label: action === "add" ? "Depart163" : employeeEditData?.departmentCode,
      label: action === "add" ? "Depart163" : employeeEditData?.departmentCode,
    },
    {
      label: action === "add" ? "Depart190" : employeeEditData?.departmentCode,
      label: action === "add" ? "Depart190" : employeeEditData?.departmentCode,
    },
  ];

  const item5 = [
    {
      label:
        action === "add" ? "Driving License" : employeeEditData?.idProofType,
      label:
        action === "add" ? "Driving License" : employeeEditData?.idProofType,
    },
    {
      label: action === "add" ? "Aadhar" : employeeEditData?.idProofType,
      label: action === "add" ? "Aadhar" : employeeEditData?.idProofType,
    },
    {
      label: action === "add" ? "Pan" : employeeEditData?.idProofType,
      label: action === "add" ? "Pan" : employeeEditData?.idProofType,
    },
  ];

  const City = countriesData.city.map((city) => ({
    label: action === "add" ? city : employeeEditData.city,
    value: action === "add" ? city : employeeEditData.city,
  }));

  const State = countriesData.state.map((state) => ({
    label: action === "add" ? state : employeeEditData.state,
    value: action === "add" ? state : employeeEditData.state,
  }));

  const Country = countriesData.countries.map((country) => ({
    label: action === "add" ? country : employeeEditData.country,
    value: action === "add" ? country : employeeEditData.country,
  }));

  const initialValue = {
    employeeCode: "",
    firstName: "",
    middleName: "",
    lastName: "",
    employeeType: "",
    designation: "",
    reportingTo: "",
    branchCode: "",
    departmentCode: "",
    idProofType: "",
    idNumber: "",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    city: "",
    state: "",
    country: "",
    modifiedBy: "",
    modifiedOn: "",
  };
  const validate = (values) => {
    const errors = {};
    console.log(values, errors, "values");
    if (!values.employeeCode) {
      errors.employeeCode = "Employee Code is required";
    }
    if (!values.firstName) {
      errors.firstName = "First name Code is required";
    }

    if (!values.middleName) {
      errors.middleName = "Middle name Name is required";
    }

    if (!values.employeeType) {
      errors.employeeType = "Employee type is required";
    }
    if (!values.designation) {
      errors.designation = "Designation is required";
    }
    if (!values.reportingTo) {
      errors.reportingTo = "Reporting is required";
    }
    if (!values.branchCode) {
      errors.branchCode = "Branch code is required";
    }
    if (!values.departmentCode) {
      errors.departmentCode = "Department code is required";
    }
    if (!values.idProofType) {
      errors.idProofType = "Id proof type is required";
    }
    if (!values.idNumber) {
      errors.idNumber = "Id number is required";
    }

    if (!values.city) {
      errors.city = "City is required";
    }
    if (!values.country) {
      errors.country = "Country is required";
    }
    if (!values.state) {
      errors.state = "State is required";
    }
    if (!values.lastName) {
      errors.lastName = "Last name is required";
    }

    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const dispatch = useDispatch();
  const handleSubmit = (values) => {
    console.log(values, "values");

    if (action === "add") {
      dispatch(postAddEmployeeMiddleware(formik.values));
    }
    if (action === "edit") {
      dispatch(patchEmployeeEditMiddleware(values));
    }
    if (action === "add") {
      toastRef.current.showToast();
      setTimeout(() => {
        setVisiblePopup(false);
        navigate("/master/generals/employeemanagement/employee");
        dispatch(getEmployeEditMiddleWare({}));
        formik.resetForm();
      }, 3000);
    } else {
      navigate("/master/generals/employeemanagement/employee");
      dispatch(getEmployeEditMiddleWare({}));
      formik.resetForm();
    }
  };

  const [cityDataOption, setCityDataOption] = useState([]);
  const [stateDataOption, setStateDataOption] = useState([]);
  const [countryDataOption, setCountryDataOption] = useState([]);
  console.log(cityDataOption, "cityDataOption");

  const setFormikValues = () => {
    const cityData = employeeEditData?.city;
    const stateData = employeeEditData?.state;
    const countryData = employeeEditData?.country;

    const updatedValues = {
      id: employeeEditData?.id,
      employeeCode: employeeEditData?.employeeCode,
      firstName: employeeEditData?.firstName,
      middleName: employeeEditData?.middleName,
      lastName: employeeEditData?.lastName,
      employeeType: employeeEditData?.employeeType,
      designation: employeeEditData?.designation,
      reportingTo: employeeEditData?.reportingTo,
      branchCode: employeeEditData?.branchCode,
      departmentCode: employeeEditData?.departmentCode,
      idProofType: employeeEditData?.idProofType,
      idNumber: employeeEditData?.idNumber,
      addressLine1: employeeEditData?.addressLine1,
      addressLine2: employeeEditData?.addressLine2,
      addressLine3: employeeEditData?.addressLine3,
      city: cityData,
      state: stateData,
      country: countryData,
      modifiedBy: employeeEditData?.modifiedBy,
      modifiedOn: employeeEditData?.modifiedOn,
    };
    console.log(updatedValues, "updatedValues");
    if (cityData) {
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

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const handleBackNavigation = () => {
    formik.resetForm();
    navigate(-1);
  };
  return (
    <div className="grid add__employee_container">
      <div className="add_backbut_container">
        <div
          style={{
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
          }}
        >
          <span onClick={() => handleBackNavigation()}>
            <SvgBack />
          </span>
        </div>
        <div className="add__sub__title">
          {action === "add"
            ? "Add Employee"
            : action === "edit"
            ? "Edit Employee"
            : "View Employee"}
        </div>
      </div>
      <div className="col-12 mb-2">
        <div className="mt-2">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 mt-3 ">
        <div className="grid add__account__sub__container p-3">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.employeeCode}
              onChange={formik.handleChange("employeeCode")}
              // error={formik.errors.employeeCode}
              label={t("generalMasters.employeeCode")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.employeeCode && formik.errors.employeeCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.employeeCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.firstName}
              onChange={formik.handleChange("firstName")}
              // error={formik.errors.firstName}
              label={t("generalMasters.firstName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.firstName && formik.errors.firstName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.firstName}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.middleName}
              onChange={formik.handleChange("middleName")}
              // error={formik.errors.middleName}
              label={t("generalMasters.middleName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.middleName && formik.errors.middleName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.middleName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.lastName}
              onChange={formik.handleChange("lastName")}
              // error={formik.errors.lastName}
              label={t("generalMasters.lastName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.lastName && formik.errors.lastName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.lastName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.employeeType}
              onChange={formik.handleChange("employeeType")}
              // error={formik.errors.employeeType}
              className="dropdown__add__sub"
              label={t("generalMasters.employeeType")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              optionValue={"label"}
              optionLabel="label"
              options={item}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.employeeType && formik.errors.employeeType && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.employeeType}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.designation}
              onChange={formik.handleChange("designation")}
              // error={formik.errors.designation}
              className="dropdown__add__sub"
              label={t("generalMasters.designation")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item1}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.designation && formik.errors.designation && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.designation}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.reportingTo}
              onChange={formik.handleChange("reportingTo")}
              // error={formik.errors.reportingto}
              className="dropdown__add__sub"
              label={t("generalMasters.reportingTo")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item2}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.reportingTo && formik.errors.reportingTo && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.reportingTo}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.branchCode}
              onChange={formik.handleChange("branchCode")}
              // error={formik.errors.branchCode}
              className="dropdown__add__sub"
              label={t("generalMasters.branchCode")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item3}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.branchCode && formik.errors.branchCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.branchCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.departmentCode}
              onChange={formik.handleChange("departmentCode")}
              // error={formik.errors.departmentCode}
              className="dropdown__add__sub"
              label={t("generalMasters.departmentCode")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item4}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.departmentCode && formik.errors.departmentCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.departmentCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.idProofType}
              onChange={formik.handleChange("idProofType")}
              // error={formik.errors.idProofType}
              className="dropdown__add__sub"
              label={t("generalMasters.idProofType")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item5}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.idProofType && formik.errors.idProofType && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.idProofType}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.idNumber}
              onChange={formik.handleChange("idNumber")}
              // error={formik.errors.idNumber}
              label={t("generalMasters.idNumber")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.idNumber && formik.errors.idNumber && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.idNumber}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine1}
              onChange={formik.handleChange("addressLine1")}
              // error={formik.errors.addressLine1}
              label={t("generalMasters.addressLine1")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine1 && formik.errors.addressLine1 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine1}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine2}
              onChange={formik.handleChange("addressLine2")}
              // error={formik.errors.addressLine2}
              label={t("generalMasters.addressLine2")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine2 && formik.errors.addressLine2 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine2}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine3}
              onChange={formik.handleChange("addressLine3")}
              // error={formik.errors.addressLine3}
              label={t("generalMasters.addressLine3")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine3 && formik.errors.addressLine3 && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.addressLine3}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.city}
              onChange={formik.handleChange("city")}
              className="dropdown__add__sub"
              label={t("generalMasters.city")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={
                action == "add"
                  ? City
                  : action == "edit"
                  ? cityDataOption
                  : City
              }
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />

            {formik.touched.city && formik.errors.city && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.city}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.state}
              onChange={formik.handleChange("state")}
              // error={formik.errors.state}
              className="dropdown__add__sub"
              label={t("generalMasters.state")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={
                action == "add"
                  ? State
                  : action == "edit"
                  ? stateDataOption
                  : State
              }
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.state && formik.errors.state && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.state}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.country}
              onChange={formik.handleChange("country")}
              label={t("generalMasters.country")}
              className="dropdown__add__sub"
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={
                action == "add"
                  ? Country
                  : action == "edit"
                  ? countryDataOption
                  : Country
              }
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.country && formik.errors.country && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.country}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.modifiedBy}
              onChange={formik.handleChange("modifiedBy")}
              error={formik.errors.modifiedBy}
              label={t("generalMasters.modifiedBy")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.modifiedOn}
              onChange={formik.handleChange("modifiedOn")}
              error={formik.errors.modifiedOn}
              label={t("generalMasters.modifiedOn")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>
      </div>
      <div className="col-12 btn__view__Add mt-2">
        {action === "add" && (
          <Button
            label={t("generalMasters.save")}
            className="save__add__btn"
            onClick={() => {
              formik.handleSubmit();
            }}
            disabled={!formik.isValid}
          />
        )}
        {action === "edit" && (
          <Button
            className="save__add__btn"
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          >
            Update
          </Button>
        )}
      </div>
      <CustomToast
        ref={toastRef}
        message="Employee Code CC1234 
        is added"
      />
    </div>
  );
};
export default AddEmployee;
