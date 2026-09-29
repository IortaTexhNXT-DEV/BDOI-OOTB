import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { useFormik } from "formik";
import CustomToast from "../../../../../components/Toast";
import { InputText } from "primereact/inputtext";
import DepartMentList from "./DepartMentList";
import { useDispatch, useSelector } from "react-redux";
import {
  patchBranchEditMiddleware,
  postAddBranchMiddleware,
} from "../store/branchMiddleware";
import useMasterOptions from "../../../common/useMasterOptions";
import { phoneCountryCode } from "../../../../../utility/phoneFormat";

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
  const { organizationBranchView, getBranchPatch } = useSelector(
    ({ organizationBranchMainReducers }) => {
      return {
        loading: organizationBranchMainReducers?.loading,
        organizationBranchView:
          organizationBranchMainReducers?.organizationBranchView,
        getBranchPatch: organizationBranchMainReducers?.getBranchPatch,
      };
    }
  );
  const toastRef = useRef(null);
  const Navigate = useNavigate();

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.branch"), url: "/master/generals/organization/branchmaster" },
    {
      label: action === "add" ? t("generalMasters.addBranch") : action === "edit" ? t("generalMasters.editBranch") : t("generalMasters.branchDetails"),
    },
  ];
  const companyOptions = useMasterOptions("company");
  const City = useMasterOptions("city");
  const State = useMasterOptions("state");
  const Country = useMasterOptions("country");
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const dispatch = useDispatch();

  const saveAndReturn = async (thunk, values, message) => {
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(message ? { detail: message } : undefined);
      setTimeout(() => {
        Navigate("/master/generals/organization/branchmaster");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const handleSubmit = (values) => {
    if (action === "add") saveAndReturn(postAddBranchMiddleware, values);
    if (action === "edit") saveAndReturn(patchBranchEditMiddleware, values, t("financeMasters.saveSuccessfully"));
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.BranchCode) {
      errors.BranchCode = "This field is required";
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

      formik.setValues({ ...formik.values, ...updatedValues });
    }
  };

  useEffect(() => {
    setFormikValues();
  }, [getBranchPatch]);

  return (
    <div className="overall__addbranch__container">
      <CustomToast ref={toastRef} message={`Branch code ${formik.values.BranchCode} added`} />
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
              options={companyOptions}
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
              options={City}
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
              options={State}
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
              options={Country}
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
                <div>{phoneCountryCode()}</div>
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

      {action !== "add" && <DepartMentList
          action={action}
          branchCode={action === "view" ? organizationBranchView?.BranchCode : formik.values.BranchCode}
        />}

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
