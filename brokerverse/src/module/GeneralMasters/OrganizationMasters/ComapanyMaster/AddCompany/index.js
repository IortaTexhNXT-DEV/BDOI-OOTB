import { useState, useRef, useEffect } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import {
  patchCompanyEditMiddleware,
  postAddCompanyMiddleware,
} from "../store/companyMiddleware";
import useMasterOptions from "../../../common/useMasterOptions";
import { phoneCountryCode } from "../../../../../utility/phoneFormat";
import { Checkbox } from "primereact/checkbox";
import { BASE_URL } from "../../../../../utility/constant";
import authService from "../../../../../services/authService";

function AddCompany({ action }) {
  const { t } = useTranslation();
  const { companyView, getcompanyEdit } = useSelector(
    ({ organizationCompanyMainReducers }) => {
      return {
        loading: organizationCompanyMainReducers?.loading,
        companyView: organizationCompanyMainReducers?.companyView,
        getcompanyEdit: organizationCompanyMainReducers?.getcompanyEdit,
      };
    }
  );
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const Navigate = useNavigate();

  const City = useMasterOptions("city");

  const State = useMasterOptions("state");

  const Country = useMasterOptions("country");

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.company"), url: "/master/generals/organization/companymaster" },
    {
      label: action === "add" ? t("generalMasters.addCompany") : action === "edit" ? t("generalMasters.editCompany") : t("generalMasters.companyDetails"),
    },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const setFormikValues = (data) => {
  // };

  const initialValues = {
    id: "",
    CompanyCode: "",
    CompanyName: "",
    LicenseNumber: "",
    TIN: "",
    IsPrimary: false,
    EmailID: "",
    Logo: "",
    Websitelink: "",
    Description: "",
    AddressLine1: "",
    AddressLine2: "",
    AddressLine3: "",
    PinCode: "",
    City: "",
    State: "",
    Country: "",
    PhoneNumber: "",
    Fax: "",
  };
  const saveAndReturn = async (thunk, values, message) => {
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(message ? { detail: message } : undefined);
      setTimeout(() => {
        Navigate("/master/generals/organization/companymaster");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const handleSubmit = (values) => {
    if (action === "add") saveAndReturn(postAddCompanyMiddleware, values);
    if (action === "edit") saveAndReturn(patchCompanyEditMiddleware, values, t("financeMasters.saveSuccessfully"));
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CompanyCode) {
      errors.CompanyCode = "This field is required";
    }
    if (!values.CompanyName) {
      errors.CompanyName = "This field is required";
    }
    // Licence, TIN, e-mail, website, description, postal code, phone and fax are optional: what is filled in is
    // printed on the letterhead of documents and reports (primary company).
    if (values.EmailID && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
      errors.EmailID = "Invalid email address";
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

    if (values.PhoneNumber && !/^\+?[\d\s()-]{7,20}$/.test(values.PhoneNumber)) {
      errors.PhoneNumber = "Invalid phone number";
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
  });
  const setFormikValues = () => {
    const cityData = getcompanyEdit?.City;
    const stateData = getcompanyEdit?.State;
    const countryData = getcompanyEdit?.Country;
    if (action == "edit") {
      const updatedValues = {
        id: getcompanyEdit?.id,
        CompanyCode: getcompanyEdit?.CompanyCode,
        CompanyName: getcompanyEdit?.CompanyName,
        LicenseNumber: getcompanyEdit?.LicenseNumber,
        TIN: getcompanyEdit?.TIN || "",
        IsPrimary: getcompanyEdit?.IsPrimary === true || getcompanyEdit?.IsPrimary === "true",
        EmailID: getcompanyEdit?.EmailID,
        Logo: getcompanyEdit?.Logo,
        Websitelink: getcompanyEdit?.Websitelink,
        Description: getcompanyEdit?.Description,
        AddressLine1: getcompanyEdit?.AddressLine1,
        AddressLine2: getcompanyEdit?.AddressLine2,
        AddressLine3: getcompanyEdit?.AddressLine3,
        PinCode: getcompanyEdit?.PinCode,
        City: cityData,
        State: stateData,
        Country: countryData,
        PhoneNumber: getcompanyEdit?.PhoneNumber,
        Fax: getcompanyEdit?.Fax,
      };

      formik.setValues({ ...formik.values, ...updatedValues });
    }
  };

  useEffect(() => {
    setFormikValues();
  }, [getcompanyEdit]);

  // Logo: uploaded to the file store; the canonical object URL (without the expiring signature) is saved on the company
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "company-logo");
      const response = await fetch(`${BASE_URL}/s3/upload`, { method: "POST", headers: { ...authService.getAuthHeader() }, body: formData });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || `Upload failed (${response.status})`);
      const signed = String(json.url || json.data?.url || "");
      formik.setFieldValue("Logo", signed.split("?")[0]);
      setLogoPreview(signed);
    } catch (error) {
      toastRef.current?.showToast({ severity: "error", detail: error.message });
    } finally {
      setLogoUploading(false);
    }
  };
  const view = action === "view";
  const record = action === "view" ? companyView || {} : formik.values;

  return (
    <div className="overall__addcompany__container">
      <CustomToast ref={toastRef} message={`Company code ${formik.values.CompanyCode} added`} />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">
          {action === "add"
            ? " Add Company"
            : action === "edit"
              ? "Edit Company"
              : "Company details"}
        </label>

        <BreadCrumb
          model={items}
          home={home}
          className="breadcrumbs_container"
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      <Card style={{ marginTop: "20px" }}>
        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.companyCode")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.CompanyCode
                  : action == "edit"
                    ? formik.values.CompanyCode
                    : companyView.CompanyCode
              }

              onChange={formik.handleChange("CompanyCode")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.CompanyCode && formik.errors.CompanyCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.CompanyCode}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.companyName")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.CompanyName
                  : action == "edit"
                    ? formik.values.CompanyName
                    : companyView.CompanyName
              }

              onChange={formik.handleChange("CompanyName")}

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
              label={t("generalMasters.licenseNumber")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.LicenseNumber
                  : action == "edit"
                    ? formik.values.LicenseNumber
                    : companyView.LicenseNumber
              }
              onChange={formik.handleChange("LicenseNumber")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.LicenseNumber && formik.errors.LicenseNumber && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.LicenseNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailId")}
              placeholder={t("generalMasters.enter")}
              value={
                action === "add"
                  ? formik.values.EmailID
                  : action === "edit"
                    ? formik.values.EmailID
                    : companyView.EmailID
              }
              onChange={(e) => {
                const inputValue = typeof e === 'string' ? e.toLowerCase() : e;
                formik.handleChange("EmailID")(inputValue);
              }}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.EmailID && formik.errors.EmailID && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.EmailID}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label="TIN"
              placeholder={t("generalMasters.enter")}
              value={record.TIN || ""}
              onChange={formik.handleChange("TIN")}
              disabled={view}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 28 }}>
            <Checkbox
              inputId="company-is-primary"
              checked={record.IsPrimary === true || record.IsPrimary === "true"}
              onChange={(e) => formik.setFieldValue("IsPrimary", !!e.checked)}
              disabled={view}
            />
            <label htmlFor="company-is-primary">Letterhead company — used on documents and reports</label>
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <label className="uploadtext_container">Logo (printed on documents)</label>
            <div className="p-inputgroup flex-1">
              <InputText
                className="field__container"
                placeholder="Logo URL or upload"
                value={record.Logo || ""}
                onChange={formik.handleChange("Logo")}
                disabled={view}
              />
              {!view && (
                <label className="p-button p-component p-button-outlined" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                  {logoUploading ? "Uploading..." : "Upload"}
                  <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={uploadLogo} />
                </label>
              )}
            </div>
            {(logoPreview || record.Logo) && (
              <img src={logoPreview || record.Logo} alt="Logo" style={{ maxHeight: 40, maxWidth: 160, marginTop: 6 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.websiteLink")}
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.Websitelink
                    : action == "edit"
                      ? formik.values.Websitelink
                      : companyView.Websitelink
                }
                onChange={formik.handleChange("Websitelink")}
                disabled={action === "view" ? true : false}
              />
              {formik.touched.Websitelink && formik.errors.Websitelink && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.Websitelink}
                </div>
              )}
            </div>
          </div>
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
                      : companyView.Description
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
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine1")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.AddressLine1
                  : action == "edit"
                    ? formik.values.AddressLine1
                    : companyView.AddressLine1
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
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine2")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.AddressLine2
                  : action == "edit"
                    ? formik.values.AddressLine2
                    : companyView.AddressLine2
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
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine3")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.AddressLine3
                  : action == "edit"
                    ? formik.values.AddressLine3
                    : companyView.AddressLine3
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
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.zipCode")}
              placeholder={t("generalMasters.enter")}
              value={
                action == "add"
                  ? formik.values.PinCode
                  : action == "edit"
                    ? formik.values.PinCode
                    : companyView.PinCode
              }
              onChange={formik.handleChange("PinCode")}
              disabled={action === "view" ? true : false}
            />
            {formik.touched.PinCode && formik.errors.PinCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.PinCode}
              </div>
            )}
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("generalMasters.city")}
              value={
                action == "add"
                  ? formik.values.City
                  : action == "edit"
                    ? formik.values.City
                    : companyView.City
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
                    : companyView.State
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
              value={
                action == "add"
                  ? formik.values.Country
                  : action == "edit"
                    ? formik.values.Country
                    : companyView.Country
              }
              onChange={(e) => formik.setFieldValue("Country", e.value)}

              options={Country}
              optionLabel="label"
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
                      : companyView.PhoneNumber
                }
                onChange={formik.handleChange("PhoneNumber")}
                disabled={action === "view" ? true : false}
              />
            </div>
            {formik.touched.PhoneNumber && formik.errors.PhoneNumber && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.PhoneNumber}
              </div>
            )}
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <label className="label_text">Fax</label>
            <div className="p-inputgroup flex-1">
              <span className="p-inputgroup-addon">
                <div>{phoneCountryCode()}</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText
                placeholder={t("generalMasters.enter")}
                value={
                  action == "add"
                    ? formik.values.Fax
                    : action == "edit"
                      ? formik.values.Fax
                      : companyView.Fax
                }
                onChange={formik.handleChange("Fax")}
                disabled={action === "view" ? true : false}
              />
            </div>
            {formik.touched.Fax && formik.errors.Fax && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.Fax}
              </div>
            )}
          </div>
        </div>
      </Card>

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

export default AddCompany;
