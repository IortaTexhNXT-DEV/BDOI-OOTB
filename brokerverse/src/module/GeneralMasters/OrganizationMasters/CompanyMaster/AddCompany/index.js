import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { useFormik } from "formik";
import CustomToast from "../../../../../components/Toast";
import { InputText } from "primereact/inputtext";
import { useDispatch, useSelector } from "react-redux";
import {
  getCompanyEditData,
  getCompanyViewMiddleWare,
  patchCompanyEditMiddleware,
  postAddCompanyMiddleware,
} from "../store/companyMiddleware";
import useMasterOptions from "../../../common/useMasterOptions";
import { phoneCountryCode } from "../../../../../utility/phoneFormat";
import { Dropdown } from "primereact/dropdown";
import { InputMask } from "primereact/inputmask";
import { InputSwitch } from "primereact/inputswitch";
import LabelWrapper from "../../../../../components/LabelWrapper";
import systemSettingsService from "../../../../../services/systemSettingsService";
import DetailHeader from "../../../../../components/DetailHeader";
import DetailSection from "../../../../../components/DetailSection";
import KeyValueGrid from "../../../../../components/KeyValueGrid";
import { RecordActivityLog } from "../../../../../components/ActivityLog";
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

  // Revenue District Offices (System Settings, bir.rdo_codes); a code missing from the list can still be typed
  const [rdoOptions, setRdoOptions] = useState([]);
  useEffect(() => {
    systemSettingsService.getConfiguration("bir")
      .then((rows) => {
        const value = (rows || []).find((r) => r.key === "bir.rdo_codes")?.value;
        const list = Array.isArray(value) ? value : typeof value === "string" ? JSON.parse(value || "[]") : [];
        setRdoOptions(list.map((r) => ({ value: r.code, label: `${r.code} ${r.name}` })));
      })
      .catch(() => setRdoOptions([]));
  }, []);

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
    RDOCode: "",
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
    Country: "Philippines",
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
    // the logo is kept as its file address; the signed link the API returns for display expires
    const body = { ...values, Logo: values.Logo ? String(values.Logo).split("?")[0] : "" };
    if (action === "add") saveAndReturn(postAddCompanyMiddleware, body);
    if (action === "edit") saveAndReturn(patchCompanyEditMiddleware, body, t("financeMasters.saveSuccessfully"));
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CompanyCode) {
      errors.CompanyCode = "This field is required";
    }
    if (!values.CompanyName) {
      errors.CompanyName = "This field is required";
    }
    // Licence, TIN, RDO code, e-mail, website, description, postal code, phone and fax are optional: what is filled in
    // is printed on the letterhead of documents and reports (primary company). The primary company's name, TIN, address
    // (registered address), postal code and RDO code are also the broker's details on BIR forms such as Form 2307.
    if (values.EmailID && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
      errors.EmailID = "Invalid email address";
    }
    if (values.Websitelink && !/^(https?:\/\/|www\.)\S+\.\S+$/i.test(values.Websitelink)) {
      errors.Websitelink = t("generalMasters.websiteInvalid", "Enter the address as https://www.example.com");
    }
    // BIR TIN: 9 digits and the branch code (000 or 00000 for the head office)
    if (values.TIN && !/^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/.test(values.TIN)) {
      errors.TIN = t("generalMasters.tinInvalid", "Enter the TIN as 000-000-000-00000");
    }
    if (values.RDOCode && !/^\d{3}[A-Z]?$/.test(values.RDOCode)) {
      errors.RDOCode = t("generalMasters.rdoInvalid", "Choose the RDO or enter its code, e.g. 047");
    }
    if (values.PinCode && !/^\d{4}$/.test(values.PinCode)) {
      errors.PinCode = t("validation.zipCodePhilippines");
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
    if (values.Fax && !/^\+?[\d\s()-]{7,20}$/.test(values.Fax)) {
      errors.Fax = t("generalMasters.faxInvalid", "Invalid fax number");
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
    if (action === "edit") {
      const updatedValues = {
        id: getcompanyEdit?.id,
        CompanyCode: getcompanyEdit?.CompanyCode,
        CompanyName: getcompanyEdit?.CompanyName,
        LicenseNumber: getcompanyEdit?.LicenseNumber,
        TIN: getcompanyEdit?.TIN || "",
        RDOCode: getcompanyEdit?.RDOCode || "",
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

  // Opened by address (bookmark, refresh): load the record of the route instead of relying on the list click
  const { id: routeId } = useParams();
  useEffect(() => {
    if (!routeId) return;
    if (action === "edit" && String(getcompanyEdit?.id) !== String(routeId)) dispatch(getCompanyEditData(routeId));
    if (action === "view" && String(companyView?.id) !== String(routeId)) dispatch(getCompanyViewMiddleWare(routeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, action]);

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
  const error = (name) => (formik.touched[name] && formik.errors[name] ? <small className="p-error block mt-1" role="alert">{formik.errors[name]}</small> : null);
  const text = (name, label, { required = false, length } = {}) => (
    <>
      <InputField
        required={required}
        classNames="field__container"
        label={label}
        placeholder={t("generalMasters.enter")}
        value={record[name] || ""}
        length={length}
        onChange={formik.handleChange(name)}
        disabled={view}
      />
      {error(name)}
    </>
  );
  const list = (name, label, options) => (
    <>
      <DropDowns
        required
        className="dropdown__container"
        label={label}
        value={record[name]}
        onChange={(e) => formik.setFieldValue(name, e.value)}
        options={options}
        optionLabel="label"
        placeholder={t("generalMasters.select")}
        dropdownIcon={<SvgDropdown color={"#000"} />}
        disabled={view}
      />
      {error(name)}
    </>
  );
  const phone = (name, label) => (
    <LabelWrapper label={label}>
      <div className="p-inputgroup flex-1">
        <span className="p-inputgroup-addon company__prefix">{phoneCountryCode()}</span>
        <InputText placeholder={t("generalMasters.enter")} value={record[name] || ""} keyfilter={/[\d\s()-]/} maxLength={20} onChange={formik.handleChange(name)} disabled={view} />
      </div>
      {error(name)}
    </LabelWrapper>
  );
  const section = (title, hint, children) => (
    <section className="company__section">
      <h3 className="company__section-title">{title}</h3>
      {hint ? <p className="company__section-hint">{hint}</p> : null}
      <div className="grid">{children}</div>
    </section>
  );

  // the company as a record: its facts (empty ones as a dash, the phone written once) and its history
  if (view) {
    const c = companyView || {};
    const address = [c.AddressLine1, c.AddressLine2, c.AddressLine3, [c.City, c.State, c.PinCode].filter(Boolean).join(", "), c.Country].filter(Boolean).join("\n");
    return (
      <div className="overall__addcompany__container">
        <div className="flex align-items-center gap-2">
          <button type="button" className="p-link" onClick={() => Navigate(-1)} aria-label={t("common.back")}><SvgBackicon /></button>
          <label className="label_header">{t("generalMasters.companyDetails")}</label>
        </div>
        <BreadCrumb model={items} home={home} className="breadcrumbs_container" separatorIcon={<SvgDot color="currentColor" />} />
        <Card style={{ marginTop: "20px" }}>
          <DetailHeader title={c.CompanyName || c.CompanyCode || ""} subtitle={c.CompanyCode}
            status={c.IsPrimary === true || c.IsPrimary === "true" ? { code: "active", label: t("generalMasters.primaryCompany") } : null}
            actions={(logoPreview || c.Logo) ? <img src={logoPreview || c.Logo} alt="" style={{ maxHeight: 40, maxWidth: 160 }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null} />
          <DetailSection title={t("generalMasters.companyDetails")}>
            <KeyValueGrid columns={3} items={[
              { label: t("generalMasters.licenseNumber"), value: c.LicenseNumber },
              { label: "TIN", value: c.TIN },
              { label: "RDO", value: c.RDOCode },
              { label: t("generalMasters.emailId"), value: c.EmailID },
              { label: t("generalMasters.phoneNumber"), value: c.PhoneNumber },
              { label: t("generalMasters.fax"), value: c.Fax },
              { label: t("generalMasters.websiteLink"), value: c.Websitelink },
              { label: t("generalMasters.address"), value: address, span: 2 },
              { label: t("generalMasters.description"), value: c.Description, span: "full", hidden: !c.Description },
            ]} />
          </DetailSection>
          {c.id ? (
            <DetailSection title={t("detailView.activity")}>
              <RecordActivityLog entity="master:company" recordId={c.id} />
            </DetailSection>
          ) : null}
        </Card>
      </div>
    );
  }

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
        {section(t("generalMasters.companySection.details", "Company details"), null, (
          <>
            <div className="col-12 md:col-6 lg:col-3">{text("CompanyCode", t("generalMasters.companyCode"), { required: true, length: 20 })}</div>
            <div className="col-12 md:col-6 lg:col-5">{text("CompanyName", t("generalMasters.companyName"), { required: true, length: 200 })}</div>
            <div className="col-12 md:col-6 lg:col-4">{text("LicenseNumber", t("generalMasters.licenseNumber"))}</div>
            <div className="col-12 md:col-6 lg:col-4">{text("EmailID", t("generalMasters.emailId"))}</div>
            <div className="col-12 md:col-6 lg:col-4">{text("Websitelink", t("generalMasters.websiteLink"), { length: 200 })}</div>
            <div className="col-12 lg:col-4">{text("Description", t("generalMasters.description"), { length: 500 })}</div>
          </>
        ))}

        {section(t("generalMasters.companySection.tax", "Tax registration"), t("generalMasters.companySection.taxHint", "Printed on the BIR forms (2307, alphalists) of the letterhead company"), (
          <>
            <div className="col-12 md:col-6 lg:col-4">
              <LabelWrapper label={t("generalMasters.tin", "TIN")}>
                <InputMask className="field__container company__masked" mask="999-999-999?-99999" slotChar="0" autoClear={false} placeholder="000-000-000-00000"
                  value={record.TIN || ""} onChange={(e) => formik.setFieldValue("TIN", (e.value || "").replace(/[-_]+$/, ""))} disabled={view} />
                {error("TIN")}
              </LabelWrapper>
            </div>
            <div className="col-12 md:col-6 lg:col-4">
              <LabelWrapper label={t("generalMasters.rdoCode", "RDO code")}>
                <Dropdown className="company__rdo" value={record.RDOCode || null} options={rdoOptions} filter showClear editable
                  placeholder={t("generalMasters.rdoPlaceholder", "Revenue District Office")} onChange={(e) => formik.setFieldValue("RDOCode", (e.value || "").toUpperCase())} disabled={view} />
                {error("RDOCode")}
              </LabelWrapper>
            </div>
            <div className="col-12 lg:col-4 company__switch">
              <InputSwitch inputId="company-is-primary" checked={record.IsPrimary === true || record.IsPrimary === "true"} onChange={(e) => formik.setFieldValue("IsPrimary", !!e.value)} disabled={view} />
              <label htmlFor="company-is-primary">
                {t("generalMasters.letterheadCompany", "Letterhead company")}
                <small>{t("generalMasters.letterheadHint", "Its name, address, TIN and logo head the documents, reports and BIR forms")}</small>
              </label>
            </div>
          </>
        ))}

        {section(t("generalMasters.companySection.address", "Registered address"), t("generalMasters.companySection.addressHint", "As registered with the BIR; printed on the letterhead and the BIR forms"), (
          <>
            <div className="col-12 md:col-6 lg:col-4">{text("AddressLine1", t("generalMasters.addressLine1"), { length: 200 })}</div>
            <div className="col-12 md:col-6 lg:col-4">{text("AddressLine2", t("generalMasters.addressLine2"), { length: 200 })}</div>
            <div className="col-12 md:col-6 lg:col-4">{text("AddressLine3", t("generalMasters.addressLine3"), { length: 200 })}</div>
            <div className="col-12 md:col-6 lg:col-3">{list("City", t("generalMasters.city"), City)}</div>
            <div className="col-12 md:col-6 lg:col-3">{list("State", t("generalMasters.state"), State)}</div>
            <div className="col-12 md:col-6 lg:col-3">{list("Country", t("generalMasters.country"), Country)}</div>
            <div className="col-12 md:col-6 lg:col-3">{text("PinCode", t("generalMasters.zipCode"), { length: 4 })}</div>
          </>
        ))}

        {section(t("generalMasters.companySection.contact", "Contact"), null, (
          <>
            <div className="col-12 md:col-6 lg:col-4">{phone("PhoneNumber", t("generalMasters.phoneNumber", "Phone number"))}</div>
            <div className="col-12 md:col-6 lg:col-4">{phone("Fax", t("generalMasters.fax", "Fax"))}</div>
          </>
        ))}

        {section(t("generalMasters.companySection.logo", "Logo"), t("generalMasters.companySection.logoHint", "PNG or JPEG, printed at the top of the documents of this company"), (
          <div className="col-12 company__logo">
            <div className="company__logo-preview">
              {logoPreview || record.Logo
                ? <img src={logoPreview || record.Logo} alt={t("generalMasters.companySection.logo", "Logo")} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : <span>{t("generalMasters.noLogo", "No logo")}</span>}
            </div>
            {!view && (
              <div className="company__logo-actions">
                <label className="p-button p-component p-button-outlined company__upload">
                  <i className="pi pi-upload" />
                  <span>{logoUploading ? t("generalMasters.uploading", "Uploading...") : record.Logo ? t("generalMasters.replaceLogo", "Replace logo") : t("generalMasters.uploadLogo", "Upload logo")}</span>
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={uploadLogo} disabled={logoUploading} />
                </label>
                {record.Logo ? (
                  <Button type="button" label={t("generalMasters.removeLogo", "Remove")} icon="pi pi-times" text severity="danger"
                    onClick={() => { formik.setFieldValue("Logo", ""); setLogoPreview(""); }} />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </Card>

      <div className="next_container">
        {action === "add" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.save")}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.update")}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

export default AddCompany;
