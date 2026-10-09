import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { SelectButton } from "primereact/selectbutton";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import CustomToast from "../../../../components/Toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  patchLeadEditMiddleWare,
  postCreateleadMiddleware,
  getLeadByIdMiddleware,
} from "../../Store/leadMiddleware";
import { useFormik } from "formik";
import PhAddressFields from "../../../component/PhAddressFields";
import { FormField, FormSection } from "../../../component/FormSection";
import useMasterOptions from "../../../component/useMasterOptions";
import { patchClientEditMiddleWare } from "../../../quoteModule/clientListing/store/clientsMiddleware";
import leadService from "../../../../services/leadService";
import clientService from "../../../../services/clientService";
import { calendarDateFormat } from "../../../../utility/dateFormat";
import { isValidMobile, mobileHint, normalizeMobile } from "../../../../utility/phoneFormat";
import { birthDateError, birthDateRange, toIsoDate, useAgeLimits } from "../../../../utility/birthDate";
import DuplicateWarning from "../DuplicateWarning";
import "./index.scss";

const initialValue = {
  CompanyName: "",
  TaxNumber: "",
  FirstName: "",
  LastName: "",
  PreferredName: "",
  EmailID: "",
  ContactNumber: "",
  HouseNo: "",
  Barangay: "",
  Country: "Philippines",
  Province: "",
  City: "",
  ZIPCode: "",
  Street: "",
  Region: "",
  DateofBirth: "",
  category: "Retail",
  gender: "Male",
  Source: "",
  Quotes: "01",
  LeadID: "877",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A Philippine TIN: 9 digits, or 12 to 14 with the branch code (000-000-000-000). */
const TIN = /^\d{9}(\d{3,5})?$/;

/** The prospect form of an existing client: the client's details, linked to the client. */
export const formFromClient = (client) => ({
  ...initialValue,
  clientId: client.clientId || client.id,
  CompanyName: client.companyName || "",
  TaxNumber: client.taxNumber || "",
  FirstName: client.firstName || "",
  LastName: client.lastName || "",
  PreferredName: client.preferredName || client.firstName || "",
  EmailID: client.emailId || client.email || "",
  ContactNumber: client.contactNumber || client.phone || "",
  HouseNo: client.houseNo || "",
  Barangay: client.barangay || "",
  Country: client.country || initialValue.Country,
  Province: client.province || "",
  City: client.city || "",
  ZIPCode: client.zipCode || "",
  Street: client.street || client.roadThanon || "",
  Region: client.region || "",
  DateofBirth: client.DOB ? new Date(client.DOB) : "",
  category: String(client.clientType || "").toLowerCase() === "corporate" || client.leadCategory === "Corporate" ? "Corporate" : "Retail",
  gender: client.gender || initialValue.gender,
});

/**
 * The checks of the prospect form (messages from leadCreation.errors). A corporate prospect needs the company name and
 * TIN; its contact person's date of birth and gender are optional. A retail prospect needs the date of birth within the
 * configured age range. Every prospect needs a name, an e-mail, a mobile number and the address parts marked required.
 */
export const validateProspect = (values, { t, ageLimits }) => {
  const errors = {};
  const corporate = values.category === "Corporate";
  const required = (k) => {
    if (!String(values[k] ?? "").trim()) errors[k] = t("leadCreation.errors.required");
  };
  if (corporate) {
    required("CompanyName");
    if (!String(values.TaxNumber ?? "").trim()) errors.TaxNumber = t("leadCreation.errors.required");
    else if (!TIN.test(String(values.TaxNumber).replace(/[\s-]/g, ""))) errors.TaxNumber = t("leadCreation.errors.tin");
  }
  ["FirstName", "LastName", "PreferredName", "HouseNo", "Barangay", "Country", "Province", "City"].forEach(required);
  if (!String(values.EmailID ?? "").trim()) errors.EmailID = t("leadCreation.errors.required");
  else if (!EMAIL.test(String(values.EmailID).trim())) errors.EmailID = t("leadCreation.errors.email");
  if (!String(values.ContactNumber ?? "").trim()) errors.ContactNumber = t("leadCreation.errors.required");
  else if (!isValidMobile(values.ContactNumber)) errors.ContactNumber = t("leadCreation.errors.mobile", { example: mobileHint() });
  const zip = String(values.ZIPCode ?? "").trim();
  const ph = !values.Country || /^(philippines|ph)$/i.test(String(values.Country).trim());
  if (!zip) errors.ZIPCode = t("leadCreation.errors.required");
  else if (ph && !/^\d{4}$/.test(zip)) errors.ZIPCode = t("leadCreation.errors.zip");
  if (!values.DateofBirth) {
    if (!corporate) errors.DateofBirth = t("leadCreation.errors.required");
  } else {
    const dobError = birthDateError(values.DateofBirth, ageLimits);
    if (dobError) errors.DateofBirth = dobError;
  }
  if (!values.category) errors.category = t("leadCreation.errors.required");
  if (!corporate && !values.gender) errors.gender = t("leadCreation.errors.required");
  return errors;
};

/** The body of GET /leads/duplicates for the form values. */
const duplicateQuery = (values) => (values.clientId
  ? { clientId: values.clientId }
  : {
    firstName: values.FirstName, lastName: values.LastName, companyName: values.category === "Corporate" ? values.CompanyName : undefined,
    DOB: values.DateofBirth ? toIsoDate(values.DateofBirth) : undefined, emailId: values.EmailID, contactNumber: values.ContactNumber,
  });

/**
 * The prospect form (Create Prospect, retail or corporate, and Edit Prospect): Customer, Contact, Address and Source /
 * Product sections in the form layout of the newer screens. A prospect for an existing client starts from the client's
 * details and stays linked to it. Before a new prospect is saved, possible duplicates are shown (leads.duplicate_check).
 */
const LeadCreationCard = ({ flow, action }) => {
  const { t } = useTranslation();
  // Configured age range for the date of birth (System Settings leads.min_age_years / leads.max_age_years)
  const ageLimits = useAgeLimits();
  // where the prospect came from: Master > Insurance Management > Lead Sources (stored by name)
  const leadSources = useMasterOptions("lead-source", { value: (r) => r.name });
  const { leadId } = useParams();
  const { leadtabledata, currentLeadDetails } = useSelector(
    ({ leadReducers }) => {
      return {
        leadtabledata: leadReducers?.leadtabledata,
        currentLeadDetails: leadReducers?.currentLeadDetails,
      };
    }
  );
  const toastRef = useRef(null);
  const toastErrorRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [linkedClient, setLinkedClient] = useState(location.state?.existingClient || null);
  const [duplicates, setDuplicates] = useState(null); // { matches, values }
  const [saving, setSaving] = useState(false);
  // Create Prospect > Skip - tag product later: no product; a product chosen there tags the prospect; else motor
  const untagged = action === "post" && Boolean(location.state?.untagged);
  const chosenProduct = location.state?.product || null;
  const productTag = untagged ? { lob: null }
    : chosenProduct ? { lob: chosenProduct.lob, productId: chosenProduct.productId } : { lob: "MOTOR" };

  // Fetch lead data when in edit mode
  useEffect(() => {
    if (action === "edit" && leadId) {
      dispatch(getLeadByIdMiddleware(leadId));
    }
  }, [action, leadId, dispatch]);

  const extractErrorMessage = (result, fallbackMessage) => {
    if (!result) return fallbackMessage;
    const { payload, error } = result;
    if (typeof payload === "string" && payload.trim()) return payload;
    if (payload && typeof payload === "object") {
      if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    }
    const message = typeof error === "string" ? error : error?.message;
    if (typeof message === "string" && message.trim() && message.trim().toLowerCase() !== "rejected") return message;
    return fallbackMessage;
  };

  const defaultErrorMessage = action === "edit" ? t("leadCreation.failedToUpdate") : t("leadCreation.failedToCreate");

  const showErrorToast = (message) => {
    toastErrorRef.current?.showToast({ severity: "error", detail: message && typeof message === "string" ? message : defaultErrorMessage });
  };

  const handleclick = async (values) => {
    if (action === "post") {
      const valueWithId = { ...values, ...productTag, id: leadtabledata?.length + 1 };
      setSaving(true);
      try {
        const result = await dispatch(postCreateleadMiddleware(valueWithId));
        if (result.type.endsWith("/fulfilled")) {
          const createdLeadId = result.payload?.leadId || result.payload?.id;
          toastRef.current.showToast();
          setTimeout(() => {
            // a prospect without a product opens on its details, where its product is tagged later
            if (createdLeadId && untagged) {
              navigate(`/agent/leaddetail/${createdLeadId}`);
            } else if (createdLeadId) {
              navigate(`/agent/createquote/policydetails/createquote/${createdLeadId}`, { state: { lead: result.payload } });
            } else {
              showErrorToast(t("leadCreation.createdWithoutId"));
              setTimeout(() => navigate("/agent/leadlisting"), 2000);
            }
          }, 1500);
        } else if (result.type.endsWith("/rejected")) {
          showErrorToast(extractErrorMessage(result, defaultErrorMessage));
        }
      } catch (error) {
        showErrorToast(error?.response?.data?.error || error?.message || defaultErrorMessage);
      } finally {
        setSaving(false);
      }
    }
    if (action === "edit") {
      if (flow === "client") {
        dispatch(patchClientEditMiddleWare(values));
        toastRef.current.showToast();
        setTimeout(() => navigate(`/agent/clientlisting`), 2000);
      }
      if (flow === "lead") {
        try {
          const result = await dispatch(patchLeadEditMiddleWare({ leadId, payload: values }));
          if (result.type.endsWith("/fulfilled")) {
            // refresh the current lead details to keep Redux in sync
            await dispatch(getLeadByIdMiddleware(leadId));
            toastRef.current.showToast();
            setTimeout(() => navigate(`/agent/leadlisting`), 2000);
          } else if (result.type.endsWith("/rejected")) {
            showErrorToast(extractErrorMessage(result, defaultErrorMessage));
          }
        } catch (error) {
          showErrorToast(error?.response?.data?.error || error?.message || defaultErrorMessage);
        }
      }
    }
  };

  // Transform API data to form values (must be before formik)
  const getFormValues = () => {
    if (action === "edit" && currentLeadDetails && Object.keys(currentLeadDetails).length > 0) {
      return {
        id: currentLeadDetails.id || currentLeadDetails.leadId || "",
        CompanyName: currentLeadDetails.companyName || "",
        TaxNumber: currentLeadDetails.taxInformationNumber || "",
        FirstName: currentLeadDetails.firstName || "",
        LastName: currentLeadDetails.lastName || "",
        PreferredName: currentLeadDetails.preferredName || "",
        EmailID: currentLeadDetails.emailId || "",
        ContactNumber: currentLeadDetails.contactNumber || "",
        HouseNo: currentLeadDetails.houseNo || "",
        Barangay: currentLeadDetails.barangay || "",
        Country: currentLeadDetails.country || "",
        Province: currentLeadDetails.province || "",
        City: currentLeadDetails.city || "",
        ZIPCode: currentLeadDetails.zipCode || "",
        Street: currentLeadDetails.street || currentLeadDetails.roadThanon || "",
        Region: currentLeadDetails.region || "",
        DateofBirth: currentLeadDetails.DOB ? new Date(currentLeadDetails.DOB) : "",
        category: currentLeadDetails.leadCategory || "Retail",
        gender: currentLeadDetails.gender || "Male",
        Source: currentLeadDetails.source || "",
        Quotes: "01",
        LeadID: currentLeadDetails.generatedLeadId || currentLeadDetails.leadId || "",
      };
    }
    // a prospect for an existing customer starts from the client's details and stays linked to the client
    if (action !== "edit" && location.state?.existingClient) return formFromClient(location.state.existingClient);
    return initialValue;
  };

  const formik = useFormik({
    initialValues: getFormValues(),
    enableReinitialize: true,
    validate: (values) => validateProspect(values, { t, ageLimits }),
    onSubmit: async (values) => {
      const ready = { ...values, ContactNumber: normalizeMobile(values.ContactNumber) };
      if (action === "post") {
        const found = await leadService.possibleDuplicates(duplicateQuery(ready));
        if (found.success && found.data.length) {
          setDuplicates({ matches: found.data, values: ready });
          return;
        }
      }
      handleclick(ready);
    },
  });

  // "Use this client" on the duplicate warning: the prospect is linked to that client, with its details
  const linkClient = async (match) => {
    const r = await clientService.getClientById(match.id);
    const client = r?.data?.data || r?.data;
    if (!r?.success || !client) {
      showErrorToast(r?.error || t("prospectDuplicates.clientFailed"));
      return;
    }
    setDuplicates(null);
    setLinkedClient(client);
    formik.resetForm({ values: { ...formFromClient(client), Source: formik.values.Source } });
  };

  const v = formik.values;
  const corporate = v.category === "Corporate";
  const shown = (k) => (formik.touched[k] || formik.submitCount > 0) && formik.errors[k] ? formik.errors[k] : null;
  const invalid = (k) => (shown(k) ? "w-full p-invalid" : "w-full");
  const text = (k, label, { required = true, hint, ...extra } = {}) => (
    <FormField key={k} label={label} htmlFor={`prospect-${k}`} required={required} error={shown(k)} hint={hint}>
      <InputText id={`prospect-${k}`} name={k} value={v[k] || ""} onChange={formik.handleChange} onBlur={formik.handleBlur} className={invalid(k)}
        aria-invalid={shown(k) ? true : undefined} {...extra} />
    </FormField>
  );
  const categories = [{ value: "Retail", label: t("leadCreation.individual") }, { value: "Corporate", label: t("leadCreation.company") }];
  const genders = [{ value: "Male", label: t("leadCreation.male") }, { value: "Female", label: t("leadCreation.female") }];
  const sourceOptions = v.Source && !leadSources.some((o) => o.value === v.Source) ? [...leadSources, { label: v.Source, value: v.Source }] : leadSources;
  const title = action === "post" ? t("leadCreation.createLead") : flow === "client" ? t("leadCreation.editClient") : t("leadCreation.editLead");
  const productText = untagged ? t("productPicker.untagged") : chosenProduct?.name || (chosenProduct ? chosenProduct.lob : t("leadCreation.form.motor"));

  return (
    <div className="card_overall_container prospect-form mt-3">
      <CustomToast ref={toastRef} message={action === "edit" ? t("leadCreation.updated") : t("leadCreation.created")} />
      <CustomToast ref={toastErrorRef} message={defaultErrorMessage} messageType="error" />
      <form className="prospect-form__card" noValidate onSubmit={(e) => { e.preventDefault(); formik.handleSubmit(); }}>
        <h2 className="prospect-form__title">{title}</h2>
        {untagged && <Message severity="info" className="w-full justify-content-start mt-2" text={t("productPicker.skipHint")} />}
        {action === "post" && linkedClient && (
          <Message severity="success" className="w-full justify-content-start mt-2"
            text={t("prospectChooser.linkedTo", { name: linkedClient.displayName || linkedClient.fullName || [linkedClient.firstName, linkedClient.lastName].filter(Boolean).join(" "),
              code: linkedClient.generatedClientId || linkedClient.clientCode || "" })} />
        )}

        <FormSection title={t("leadCreation.form.customer")}>
          <FormField label={t("leadCreation.form.category")} htmlFor="prospect-category" required full>
            {action === "post" ? (
              <SelectButton id="prospect-category" value={v.category} options={categories} allowEmpty={false} onChange={(e) => formik.setFieldValue("category", e.value)} />
            ) : (
              <span id="prospect-category" className="prospect-form__readonly">{currentLeadDetails?.leadCategory || v.category || "Retail"}</span>
            )}
          </FormField>
          {corporate && text("CompanyName", t("leadCreation.form.companyName"))}
          {corporate && text("TaxNumber", t("leadCreation.form.tin"), { placeholder: "000-000-000-000", keyfilter: /[\d\s-]/ })}
          {corporate && <h4 className="prospect-form__subtitle fs-field--full">{t("leadCreation.form.contactPerson")}</h4>}
          {text("FirstName", t("leadCreation.form.firstName"))}
          {text("LastName", t("leadCreation.form.lastName"))}
          {text("PreferredName", t("leadCreation.form.preferredName"))}
          <FormField label={t("leadCreation.form.birthDate")} htmlFor="prospect-DateofBirth" required={!corporate} error={shown("DateofBirth")}>
            <Calendar inputId="prospect-DateofBirth" value={v.DateofBirth || null} onChange={(e) => formik.setFieldValue("DateofBirth", e.value || "")}
              onBlur={() => formik.setFieldTouched("DateofBirth", true)} dateFormat={calendarDateFormat()} showIcon {...birthDateRange(ageLimits)}
              className={invalid("DateofBirth")} viewDate={v.DateofBirth || birthDateRange(ageLimits).maxDate} />
          </FormField>
          <FormField label={t("leadCreation.form.gender")} htmlFor="prospect-gender" required={!corporate} error={shown("gender")}>
            <SelectButton id="prospect-gender" value={v.gender} options={genders} allowEmpty={corporate} onChange={(e) => formik.setFieldValue("gender", e.value || "")} />
          </FormField>
        </FormSection>

        <FormSection title={t("leadCreation.form.contact")}>
          {text("EmailID", t("leadCreation.form.email"), { type: "email", inputMode: "email" })}
          {text("ContactNumber", t("leadCreation.form.mobile"), { inputMode: "tel", hint: mobileHint(), keyfilter: /[\d\s()+.-]/ })}
        </FormSection>

        <FormSection title={t("leadCreation.form.address")}>
          {/* Philippine address: Region -> Province -> City / Municipality -> Barangay, ZIP code, House / Unit No., Street */}
          <PhAddressFields formik={formik} inGrid required={{ houseNo: true, barangay: true, city: true, province: true, zipCode: true, country: true }} />
        </FormSection>

        {flow !== "client" && (
          <FormSection title={t("leadCreation.form.sourceProduct")}>
            <FormField label={t("leadCreation.source")} htmlFor="lead-source">
              <Dropdown inputId="lead-source" value={v.Source || null} options={sourceOptions} onChange={(e) => formik.setFieldValue("Source", e.value || "")} filter showClear
                placeholder={t("leadCreation.form.chooseSource")} className="w-full" />
            </FormField>
            {action === "post" && (
              <FormField label={t("leadCreation.form.product")} htmlFor="prospect-product">
                <span id="prospect-product" className="prospect-form__readonly">{productText}</span>
              </FormField>
            )}
          </FormSection>
        )}

        <div className="prospect-form__actions">
          <Button type="button" label={t("leadCreation.form.cancel")} text onClick={() => navigate(flow === "client" ? "/agent/clientlisting" : "/agent/leadlisting")} />
          <Button type="submit" label={action === "post" ? t("leadCreation.saveAndContinue") : t("leadCreation.update")} icon="pi pi-check" loading={saving || formik.isSubmitting} />
        </div>
      </form>
      <DuplicateWarning
        matches={duplicates?.matches || null}
        forClient={Boolean(duplicates?.values?.clientId)}
        saving={saving}
        onHide={() => setDuplicates(null)}
        onUseClient={linkClient}
        onOpenProspect={(m) => navigate(`/agent/leaddetail/${m.id}`)}
        onSaveAnyway={() => {
          const values = duplicates.values;
          setDuplicates(null);
          handleclick(values);
        }}
      />
    </div>
  );
};

export default LeadCreationCard;
