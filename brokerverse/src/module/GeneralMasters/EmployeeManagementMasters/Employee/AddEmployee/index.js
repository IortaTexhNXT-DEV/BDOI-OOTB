import { BreadCrumb } from "primereact/breadcrumb";
import { useRef, useEffect } from "react";
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
import useMasterOptions, { useFieldOptions, useMasterRecordOptions } from "../../../common/useMasterOptions";
import { useDispatch, useSelector } from "react-redux";
import {
  getEmployeEditMiddleWare,
  patchEmployeeEditMiddleware,
  postAddEmployeeMiddleware,
} from "../store/employeeMiddleware";

const AddEmployee = ({ action }) => {
  const { t } = useTranslation();
  const { employeeEditData } = useSelector(
    ({ employeeReducers }) => {
      return {
        loading: employeeReducers?.loading,
        employeeEditData: employeeReducers?.employeeEditData,
        employeeViewData: employeeReducers?.employeeViewData,
        total: employeeReducers,
      };
    }
  );
  const { id } = useParams();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  useEffect(() => {
    if (id && (action === "edit" || action === "view")) dispatch(getEmployeEditMiddleWare(id));
  }, [action, id, dispatch]);
  useEffect(() => {
    if (action === "view") {
      setFormikValues();
    } else if (action === "edit") {
      setFormikValues();
    }
  }, [employeeEditData?.id]);

  const items = [
    { label: "Employee Management" },
    { label: "Employee", url: "/master/generals/employeemanagement/employee" },
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

  const item = useFieldOptions("employee", "employeeType");
  const item1 = useMasterOptions("designation");
  const item2 = useMasterRecordOptions("employee", (row) => ({
    label: [row.firstName, row.lastName].filter(Boolean).join(" "),
    value: row.employeeCode,
  }));
  const item3 = useMasterOptions("branch", { valueKey: "code" });
  const item4 = useMasterOptions("department", { valueKey: "code" });
  const item5 = useFieldOptions("employee", "idProofType");
  const City = useMasterOptions("city");
  const State = useMasterOptions("state");
  const Country = useMasterOptions("country");

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
    if (!values.firstName) {
      errors.firstName = "First name is required";
    }
    // middle name is optional (many employees have none)

    if (!values.employeeType) {
      errors.employeeType = "Employee type is required";
    }
    if (!values.designation) {
      errors.designation = "Designation is required";
    }
    if (!values.reportingTo) {
      errors.reportingTo = "Reporting to is required";
    }
    if (!values.branchCode) {
      errors.branchCode = "Branch code is required";
    }
    if (!values.departmentCode) {
      errors.departmentCode = "Department code is required";
    }
    if (!values.idProofType) {
      errors.idProofType = "ID proof type is required";
    }
    if (!values.idNumber) {
      errors.idNumber = "ID number is required";
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
  const handleSubmit = async (values) => {
    const thunk = action === "add" ? postAddEmployeeMiddleware : patchEmployeeEditMiddleware;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "add" ? undefined : { detail: t("financeMasters.saveSuccessfully") });
      setTimeout(() => {
        navigate("/master/generals/employeemanagement/employee");
        formik.resetForm();
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

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
              value={formik.values.employeeCode}
              disabled
              placeholder={t("generalMasters.issuedOnSave")}
              label={t("generalMasters.employeeCode")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
            />
            {formik.touched.employeeCode && formik.errors.employeeCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.employeeCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.firstName}
              onChange={formik.handleChange("firstName")}
              label={t("generalMasters.firstName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.firstName && formik.errors.firstName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.firstName}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.middleName}
              onChange={formik.handleChange("middleName")}
              label={t("generalMasters.middleName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.middleName && formik.errors.middleName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.middleName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.lastName}
              onChange={formik.handleChange("lastName")}
              label={t("generalMasters.lastName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.lastName && formik.errors.lastName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.lastName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.employeeType}
              onChange={formik.handleChange("employeeType")}
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
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.employeeType}
              </div>
            )}
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.designation}
              onChange={formik.handleChange("designation")}
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
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.designation}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.reportingTo}
              onChange={formik.handleChange("reportingTo")}
              className="dropdown__add__sub"
              label={t("generalMasters.reportingTo")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item2}
              optionValue={"value"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.reportingTo && formik.errors.reportingTo && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.reportingTo}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.branchCode}
              onChange={formik.handleChange("branchCode")}
              className="dropdown__add__sub"
              label={t("generalMasters.branchCode")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item3}
              optionValue={"value"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.branchCode && formik.errors.branchCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.branchCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.departmentCode}
              onChange={formik.handleChange("departmentCode")}
              className="dropdown__add__sub"
              label={t("generalMasters.departmentCode")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={item4}
              optionValue={"value"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.departmentCode && formik.errors.departmentCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.departmentCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.idProofType}
              onChange={formik.handleChange("idProofType")}
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
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.idProofType}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.idNumber}
              onChange={formik.handleChange("idNumber")}
              label={t("generalMasters.idNumber")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.idNumber && formik.errors.idNumber && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.idNumber}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine1}
              onChange={formik.handleChange("addressLine1")}
              label={t("generalMasters.addressLine1")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine1 && formik.errors.addressLine1 && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.addressLine1}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine2}
              onChange={formik.handleChange("addressLine2")}
              label={t("generalMasters.addressLine2")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine2 && formik.errors.addressLine2 && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.addressLine2}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={formik.values.addressLine3}
              onChange={formik.handleChange("addressLine3")}
              label={t("generalMasters.addressLine3")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
            />
            {formik.touched.addressLine3 && formik.errors.addressLine3 && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
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
              options={City}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />

            {formik.touched.city && formik.errors.city && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.city}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              disabled={action === "view" ? true : false}
              value={formik.values.state}
              onChange={formik.handleChange("state")}
              className="dropdown__add__sub"
              label={t("generalMasters.state")}
              classNames="label__sub__add"
              placeholder={t("generalMasters.select")}
              options={State}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.state && formik.errors.state && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
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
              options={Country}
              optionValue={"label"}
              optionLabel="label"
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
            {formik.touched.country && formik.errors.country && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
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
          />
        )}
        {action === "edit" && (
          <Button
            className="save__add__btn"
            onClick={formik.handleSubmit}
          >
            Update
          </Button>
        )}
      </div>
      <CustomToast
        ref={toastRef}
        message={`Employee Code ${formik.values.employeeCode || ""} is added`}
      />
    </div>
  );
};
export default AddEmployee;
