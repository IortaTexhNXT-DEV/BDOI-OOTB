import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useFormik } from "formik";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import PhAddressFields from "../../component/PhAddressFields";
import amlService, { errorMessage, fieldErrors } from "../../../services/amlService";
import { AmlTag, PageHeader } from "../../../module/Compliance/common";
import KycDocuments from "../../../module/Compliance/KycDocuments";
import "../../../module/Administration/index.scss";
import "../../../module/AccessControl/index.scss";
import "../../../module/Compliance/index.scss";

/** Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX) and TIN (000-000-000 with an optional branch code). */
export const PH_MOBILE = /^(\+639|09)\d{9}$/;
export const PH_TIN = /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/;

const EMPTY = {
  clientType: "individual", firstName: "", middleName: "", lastName: "", suffix: "", companyName: "", tradeName: "", customerType: "INDIVIDUAL",
  DOB: "", placeOfBirth: "", gender: "", civilStatus: "", nationality: "Filipino", occupation: "", employerName: "", sourceOfFunds: "",
  idType: "", idNumber: "", idExpiry: "", registrationAuthority: "", registrationNumber: "", registrationDate: "", businessNature: "", incorporationCountry: "Philippines",
  contactNumber: "", emailId: "", taxNumber: "", isPep: false, pepDetails: "", expectedLines: [], expectedPaymentMode: "", expectedAnnualPremium: null,
  Country: "Philippines", Region: "", Province: "", City: "", Barangay: "", HouseNo: "", Street: "", ZIPCode: "",
};

/** Client-side check of the onboarding form (the server checks the same rules). */
export const validateOnboarding = (v, t) => {
  const e = {};
  const need = (k, msg) => { if (!String(v[k] ?? "").trim()) e[k] = msg; };
  const phone = String(v.contactNumber || "").replace(/[\s-]/g, "");
  if (!PH_MOBILE.test(phone)) e.contactNumber = t("onboarding.errMobile");
  if (v.taxNumber && !PH_TIN.test(String(v.taxNumber).trim())) e.taxNumber = t("onboarding.errTin");
  if (v.clientType === "corporate") {
    need("companyName", t("onboarding.errRequired"));
    need("registrationAuthority", t("onboarding.errRequired"));
    need("registrationNumber", t("onboarding.errRequired"));
    need("taxNumber", t("onboarding.errRequired"));
  } else {
    ["firstName", "lastName", "DOB", "nationality", "idType", "idNumber"].forEach((k) => need(k, t("onboarding.errRequired")));
  }
  if (!String(v.City || v.Province || "").trim()) e.City = t("onboarding.errAddress");
  return e;
};

const toBody = (v) => ({
  clientType: v.clientType, customerType: v.customerType || null, firstName: v.firstName || null, middleName: v.middleName || null, lastName: v.lastName || null,
  suffix: v.suffix || null, companyName: v.companyName || null, tradeName: v.tradeName || null, DOB: v.DOB || null, placeOfBirth: v.placeOfBirth || null, gender: v.gender || null,
  civilStatus: v.civilStatus || null, nationality: v.nationality || null, occupation: v.occupation || null, employerName: v.employerName || null, sourceOfFunds: v.sourceOfFunds || null,
  idType: v.idType || null, idNumber: v.idNumber || null, idExpiry: v.idExpiry || null, registrationAuthority: v.registrationAuthority || null,
  registrationNumber: v.registrationNumber || null, registrationDate: v.registrationDate || null, businessNature: v.businessNature || null, incorporationCountry: v.incorporationCountry || null,
  contactNumber: String(v.contactNumber || "").replace(/[\s-]/g, ""), emailId: v.emailId || null, taxNumber: v.taxNumber || null, isPep: !!v.isPep, pepDetails: v.pepDetails || null,
  expectedLines: v.expectedLines || [], expectedPaymentMode: v.expectedPaymentMode || null, expectedAnnualPremium: v.expectedAnnualPremium ?? null,
  country: v.Country || null, region: v.Region || null, province: v.Province || null, city: v.City || null, barangay: v.Barangay || null, houseNo: v.HouseNo || null,
  street: v.Street || null, zipCode: v.ZIPCode || null,
  leadCategory: v.clientType === "corporate" ? "Corporate" : "Retail",
});

const fromClient = (c) => ({
  ...EMPTY, clientType: c.clientType || "individual", firstName: c.firstName || "", middleName: c.middleName || "", lastName: c.lastName || "", suffix: c.suffix || "",
  companyName: c.companyName || "", tradeName: c.tradeName || "", customerType: c.customerType || "", DOB: c.DOB || "", placeOfBirth: c.placeOfBirth || "", gender: c.gender || "",
  civilStatus: c.civilStatus || "", nationality: c.nationality || "", occupation: c.occupation || "", employerName: c.employerName || "", sourceOfFunds: c.sourceOfFunds || "",
  idType: c.idType || "", idNumber: c.idNumber || "", idExpiry: c.idExpiry || "", registrationAuthority: c.registrationAuthority || "", registrationNumber: c.registrationNumber || "",
  registrationDate: c.registrationDate || "", businessNature: c.businessNature || "", incorporationCountry: c.incorporationCountry || "", contactNumber: c.contactNumber || "",
  emailId: c.emailId || "", taxNumber: c.taxNumber || "", isPep: !!c.isPep, pepDetails: c.pepDetails || "", expectedLines: c.expectedLines || [],
  expectedPaymentMode: c.expectedPaymentMode || "", expectedAnnualPremium: c.expectedAnnualPremium ?? null, Country: c.country || "Philippines", Region: c.region || "",
  Province: c.province || "", City: c.city || "", Barangay: c.barangay || "", HouseNo: c.houseNo || "", Street: c.street || "", ZIPCode: c.zipCode || "",
});

const EMPTY_SIGNATORY = { fullName: "", position: "", nationality: "", birthDate: "", idType: "", idNumber: "", authorityDocument: "board-resolution", authorityReference: "", authorityDate: "" };
const EMPTY_OWNER = { fullName: "", ownershipPercent: null, controlType: "ownership", nationality: "", birthDate: "", idType: "", idNumber: "", address: "", isPep: false, pepDetails: "" };
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v]));

/**
 * Operations > Clients > Onboard client: the client record created before its first policy, with the identification
 * customer due diligence needs. Individual: name, birth date and place, nationality, civil status, occupation and source
 * of funds, the government ID presented, mobile number, TIN and the Philippine address. Juridical: registered and trade
 * name, SEC / DTI / CDA registration, TIN, nature of business, its authorised signatories with the board resolution or
 * secretary's certificate, and its beneficial owners. On saving the client is rated and screened; the result shows here.
 * With an id the screen edits the identification of an existing client (also of a client created at policy issue).
 */
const ClientOnboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useRef(null);
  const [options, setOptions] = useState({ nationality: [], idTypes: [], civil: [], customerTypes: [], paymentModes: [], lines: [], genders: [] });
  const [signatories, setSignatories] = useState([]);
  const [owners, setOwners] = useState([]);
  const [profile, setProfile] = useState(null);
  const [result, setResult] = useState(null);
  const [party, setParty] = useState(null);
  const [saving, setSaving] = useState(false);

  const formik = useFormik({
    initialValues: EMPTY,
    validate: (v) => validateOnboarding(v, t),
    onSubmit: async (v, helpers) => {
      setSaving(true);
      try {
        if (id) {
          const r = await amlService.updateKyc(id, toBody(v));
          toast.current?.show({ severity: "success", summary: r.message });
          setResult({ client: r.data.client, assessment: r.data.assessment });
          loadProfile(id);
        } else {
          const body = { ...toBody(v), ...(v.clientType === "corporate" ? { signatories: signatories.map(clean), beneficialOwners: owners.map(clean) } : {}) };
          const r = await amlService.onboard(body);
          toast.current?.show({ severity: r.data.aml?.screening?.openHits ? "warn" : "success", summary: r.message });
          setResult({ client: r.data.client, assessment: r.data.aml.assessment, screening: r.data.aml.screening });
          navigate(`/agent/client-onboarding/${r.data.client.id}`, { replace: true });
        }
      } catch (e) {
        const errs = fieldErrors(e);
        if (Object.keys(errs).length) helpers.setErrors(errs);
        toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.saveFailed")) });
      } finally {
        setSaving(false);
      }
    },
  });

  const loadProfile = useCallback(async (clientId) => {
    try {
      const p = await amlService.profile(clientId);
      setProfile(p);
      setSignatories(p.signatories);
      setOwners(p.beneficialOwners);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      amlService.options("nationality"), amlService.options("government-id-type"), amlService.options("civil-status"), amlService.options("customer-type", "code"),
      amlService.options("payment-mode", "code"), amlService.options("product", "code"), amlService.options("gender"),
    ]).then(([nationality, idTypes, civil, customerTypes, paymentModes, lines, genders]) => setOptions({ nationality, idTypes, civil, customerTypes, paymentModes, lines, genders }));
  }, []);
  useEffect(() => {
    if (!id) return;
    amlService.client(id).then((c) => formik.resetForm({ values: fromClient(c) })).catch((e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.loadFailed")) }));
    loadProfile(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const v = formik.values;
  const corporate = v.clientType === "corporate";
  const err = (k) => (formik.submitCount || formik.touched[k]) && formik.errors[k] ? <small className="aml__error">{formik.errors[k]}</small> : null;
  const text = (k, label, extra = {}) => (
    <div className="admin__field" key={k}>
      <label htmlFor={`ob-${k}`}>{t(label)}</label>
      <InputText id={`ob-${k}`} name={k} value={v[k] || ""} onChange={formik.handleChange} onBlur={formik.handleBlur} invalid={!!err(k)} {...extra} />
      {err(k)}
    </div>
  );
  const list = (k, label, opts, extra = {}) => (
    <div className="admin__field" key={k}>
      <label htmlFor={`ob-${k}`}>{t(label)}</label>
      <Dropdown inputId={`ob-${k}`} value={v[k] || null} options={opts} optionLabel="label" optionValue="value" filter={opts.length > 10} showClear
        onChange={(e) => formik.setFieldValue(k, e.value || "")} {...extra} />
      {err(k)}
    </div>
  );
  const date = (k, label) => (
    <div className="admin__field" key={k}>
      <label htmlFor={`ob-${k}`}>{t(label)}</label>
      <InputText id={`ob-${k}`} type="date" value={v[k] || ""} onChange={(e) => formik.setFieldValue(k, e.target.value)} />
      {err(k)}
    </div>
  );
  const types = useMemo(() => [{ value: "individual", label: t("onboarding.individual") }, { value: "corporate", label: t("onboarding.juridical") }], [t]);
  const authorityDocs = ["board-resolution", "secretary-certificate", "partnership-resolution", "special-power-of-attorney", "other"].map((value) => ({ value, label: t(`aml.authority.${value}`) }));
  const controls = ["ownership", "control", "senior-management"].map((value) => ({ value, label: t(`aml.control.${value}`) }));

  const saveParty = async () => {
    const body = clean(party.row);
    if (!id) {
      const set = party.kind === "signatory" ? setSignatories : setOwners;
      set((rows) => (party.index === undefined ? [...rows, body] : rows.map((r, i) => (i === party.index ? body : r))));
      setParty(null);
      return;
    }
    setSaving(true);
    try {
      const { id: rowId, clientId: _c, updatedAt: _u, status: _s, ...rest } = body;
      const r = party.kind === "signatory"
        ? (rowId ? await amlService.saveSignatory(id, rowId, rest) : await amlService.addSignatory(id, rest))
        : (rowId ? await amlService.saveOwner(id, rowId, rest) : await amlService.addOwner(id, rest));
      toast.current?.show({ severity: "success", summary: r.message });
      setParty(null);
      loadProfile(id);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const removeParty = async (kind, row, index) => {
    if (!id) {
      (kind === "signatory" ? setSignatories : setOwners)((rows) => rows.filter((_, i) => i !== index));
      return;
    }
    try {
      const r = kind === "signatory" ? await amlService.saveSignatory(id, row.id, { status: "revoked" }) : await amlService.saveOwner(id, row.id, { status: "removed" });
      toast.current?.show({ severity: "success", summary: r.message });
      loadProfile(id);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("onboarding.saveFailed")) });
    }
  };
  const partyField = (k, label, input) => (
    <div className="admin__field" key={k}><label htmlFor={`pt-${k}`}>{t(label)}</label>{input}</div>
  );
  const setRow = (k, val) => setParty((p) => ({ ...p, row: { ...p.row, [k]: val } }));
  const c = profile?.client;

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={id ? t("onboarding.editTitle") : t("onboarding.title")} intro={t("onboarding.intro")} home={t("sidebar.Operations")}
        actions={<>
          <Button icon="pi pi-arrow-left" text label={t("onboarding.backToClients")} onClick={() => navigate("/agent/clientlisting")} />
          {id ? <Button icon="pi pi-eye" outlined label={t("onboarding.viewClient")} onClick={() => navigate(`/agent/clientview/${id}`)} /> : null}
        </>} />

      {c ? (
        <div className="aml__summary">
          <div><label>{t("aml.colClient")}</label>{c.displayName} ({c.clientCode})</div>
          <div><label>{t("aml.colRating")}</label><AmlTag value={c.riskRating} group="rating" /></div>
          <div><label>{t("aml.colKycStatus")}</label><AmlTag value={c.kycStatus} group="kycStatus" /></div>
          <div><label>{t("aml.colNextReview")}</label>{c.kycNextReviewOn || "-"}</div>
        </div>
      ) : null}
      {result?.screening?.openHits ? <Message severity="warn" className="w-full mb-2" text={t("onboarding.screeningHit", { count: result.screening.openHits })} /> : null}
      {profile?.missing?.length ? <Message severity="warn" className="w-full mb-2" text={`${t("aml.missing")}: ${profile.missing.join(", ")}`} /> : null}
      {profile?.ownerWarnings?.map((w) => <Message key={w} severity="warn" className="w-full mb-2" text={w} />)}

      <form onSubmit={formik.handleSubmit} noValidate>
        <div className="admin__field mb-3">
          <label htmlFor="ob-type">{t("onboarding.clientType")}</label>
          <SelectButton id="ob-type" value={v.clientType} options={types} allowEmpty={false} disabled={!!id}
            onChange={(e) => { formik.setFieldValue("clientType", e.value); formik.setFieldValue("customerType", e.value === "corporate" ? "CORPORATION" : "INDIVIDUAL"); }} />
        </div>

        <h3 className="aml__section">{t(corporate ? "onboarding.secEntity" : "onboarding.secIdentity")}</h3>
        <div className="aml__settings-grid">
          {corporate ? [
            text("companyName", "onboarding.registeredName"), text("tradeName", "onboarding.tradeName"), list("customerType", "onboarding.customerType", options.customerTypes),
            list("registrationAuthority", "onboarding.registrationAuthority", ["SEC", "DTI", "CDA", "Other"].map((x) => ({ value: x, label: t(`onboarding.authority.${x}`) }))),
            text("registrationNumber", "onboarding.registrationNumber"), date("registrationDate", "onboarding.registrationDate"), text("businessNature", "onboarding.businessNature"),
            text("incorporationCountry", "onboarding.incorporationCountry"),
          ] : [
            text("firstName", "onboarding.firstName"), text("middleName", "onboarding.middleName"), text("lastName", "onboarding.lastName"), text("suffix", "onboarding.suffix"),
            date("DOB", "onboarding.birthDate"), text("placeOfBirth", "onboarding.placeOfBirth"), list("gender", "onboarding.gender", options.genders),
            list("civilStatus", "onboarding.civilStatus", options.civil), list("nationality", "onboarding.nationality", options.nationality, { editable: true }),
            text("occupation", "onboarding.occupation"), text("employerName", "onboarding.employerName"), text("sourceOfFunds", "onboarding.sourceOfFunds"),
          ]}
          {text("taxNumber", "onboarding.tin", { placeholder: "000-000-000-000" })}
        </div>

        {!corporate ? (
          <>
            <h3 className="aml__section">{t("onboarding.secId")}</h3>
            <div className="aml__settings-grid">
              {list("idType", "onboarding.idType", options.idTypes)}
              {text("idNumber", "onboarding.idNumber")}
              {date("idExpiry", "onboarding.idExpiry")}
            </div>
          </>
        ) : null}

        <h3 className="aml__section">{t("onboarding.secContact")}</h3>
        <div className="aml__settings-grid">
          {text("contactNumber", "onboarding.mobile", { placeholder: "09XXXXXXXXX", keyfilter: /[0-9+\s-]/ })}
          {text("emailId", "onboarding.email", { type: "email" })}
        </div>
        <PhAddressFields formik={formik} required={{ city: true }} />
        {err("City")}

        <h3 className="aml__section">{t("onboarding.secProfile")}</h3>
        <div className="aml__settings-grid">
          <div className="admin__field">
            <label htmlFor="ob-lines">{t("onboarding.expectedLines")}</label>
            <MultiSelect inputId="ob-lines" value={v.expectedLines} options={options.lines} optionLabel="label" optionValue="value" display="chip" filter
              onChange={(e) => formik.setFieldValue("expectedLines", e.value)} />
          </div>
          {list("expectedPaymentMode", "onboarding.expectedPaymentMode", options.paymentModes)}
          <div className="admin__field">
            <label htmlFor="ob-premium">{t("onboarding.expectedPremium")}</label>
            <InputNumber inputId="ob-premium" value={v.expectedAnnualPremium} mode="decimal" minFractionDigits={2} onValueChange={(e) => formik.setFieldValue("expectedAnnualPremium", e.value)} />
          </div>
          <div className="admin__field">
            <label htmlFor="ob-pep">{t("onboarding.isPep")}</label>
            <InputSwitch inputId="ob-pep" checked={v.isPep} onChange={(e) => formik.setFieldValue("isPep", e.value)} />
          </div>
          {v.isPep ? text("pepDetails", "onboarding.pepDetails") : null}
        </div>

        {corporate ? (
          <>
            <h3 className="aml__section">{t("onboarding.secSignatories")}</h3>
            <DataTable value={signatories.filter((s) => (s.status || "active") === "active")} size="small" className="access__table mb-2" emptyMessage={t("onboarding.noSignatories")}>
              <Column field="fullName" header={t("aml.colName")} />
              <Column field="position" header={t("aml.colPosition")} />
              <Column header={t("aml.colAuthority")} body={(s) => `${t(`aml.authority.${s.authorityDocument}`)} ${s.authorityReference || ""} ${s.authorityDate || ""}`} />
              <Column header="" body={(s, o) => (
                <div className="aml__row-actions">
                  <Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label={t("aml.edit")} onClick={() => setParty({ kind: "signatory", index: o.rowIndex, row: { ...EMPTY_SIGNATORY, ...s } })} />
                  <Button type="button" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("aml.remove")} onClick={() => removeParty("signatory", s, o.rowIndex)} />
                </div>
              )} />
            </DataTable>
            <Button type="button" icon="pi pi-plus" outlined label={t("onboarding.addSignatory")} onClick={() => setParty({ kind: "signatory", row: { ...EMPTY_SIGNATORY } })} />

            <h3 className="aml__section">{t("onboarding.secOwners", { threshold: profile?.beneficialOwnerThreshold ?? 25 })}</h3>
            <DataTable value={owners.filter((o) => (o.status || "active") === "active")} size="small" className="access__table mb-2" emptyMessage={t("onboarding.noOwners")}>
              <Column field="fullName" header={t("aml.colName")} />
              <Column header={t("aml.colOwnership")} body={(o) => (o.ownershipPercent === null || o.ownershipPercent === undefined ? "" : `${o.ownershipPercent}%`)} />
              <Column header={t("aml.colControl")} body={(o) => t(`aml.control.${o.controlType}`)} />
              <Column field="nationality" header={t("aml.colNationality")} />
              <Column header={t("aml.colPep")} body={(o) => (o.isPep ? t("aml.yes") : "")} />
              <Column header="" body={(o, x) => (
                <div className="aml__row-actions">
                  <Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label={t("aml.edit")} onClick={() => setParty({ kind: "owner", index: x.rowIndex, row: { ...EMPTY_OWNER, ...o } })} />
                  <Button type="button" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("aml.remove")} onClick={() => removeParty("owner", o, x.rowIndex)} />
                </div>
              )} />
            </DataTable>
            <Button type="button" icon="pi pi-plus" outlined label={t("onboarding.addOwner")} onClick={() => setParty({ kind: "owner", row: { ...EMPTY_OWNER } })} />
          </>
        ) : null}

        <div className="admin__actions mt-4">
          <Button type="button" label={t("aml.cancel")} text onClick={() => navigate("/agent/clientlisting")} />
          <Button type="submit" icon="pi pi-check" label={id ? t("onboarding.saveChanges") : t("onboarding.onboard")} loading={saving} />
        </div>
      </form>

      {id ? (
        <>
          <h3 className="aml__section">{t("onboarding.secDocuments")}</h3>
          <KycDocuments clientId={id} documents={profile?.documents || []} signatories={signatories} owners={owners} onUploaded={() => loadProfile(id)} />
        </>
      ) : <p className="access__muted mt-3">{t("onboarding.documentsAfterSave")}</p>}

      <Dialog header={party?.kind === "signatory" ? t("onboarding.signatory") : t("onboarding.owner")} visible={!!party} style={{ width: "36rem" }} modal onHide={() => setParty(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setParty(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} disabled={(party?.row.fullName || "").trim().length < 2} onClick={saveParty} />
        </>}>
        {party ? (
          <div className="admin__grid admin__grid--single">
            {partyField("fullName", "aml.colName", <InputText id="pt-fullName" value={party.row.fullName} onChange={(e) => setRow("fullName", e.target.value)} />)}
            {party.kind === "signatory" ? (
              <>
                {partyField("position", "aml.colPosition", <InputText id="pt-position" value={party.row.position || ""} onChange={(e) => setRow("position", e.target.value)} />)}
                {partyField("authorityDocument", "aml.colAuthority", <Dropdown inputId="pt-authorityDocument" value={party.row.authorityDocument} options={authorityDocs} onChange={(e) => setRow("authorityDocument", e.value)} />)}
                {partyField("authorityReference", "onboarding.authorityReference", <InputText id="pt-authorityReference" value={party.row.authorityReference || ""} onChange={(e) => setRow("authorityReference", e.target.value)} />)}
                {partyField("authorityDate", "onboarding.authorityDate", <InputText id="pt-authorityDate" type="date" value={party.row.authorityDate || ""} onChange={(e) => setRow("authorityDate", e.target.value)} />)}
              </>
            ) : (
              <>
                {partyField("ownershipPercent", "aml.colOwnership", <InputNumber inputId="pt-ownershipPercent" value={party.row.ownershipPercent} suffix="%" min={0} max={100} maxFractionDigits={4} onValueChange={(e) => setRow("ownershipPercent", e.value)} />)}
                {partyField("controlType", "aml.colControl", <Dropdown inputId="pt-controlType" value={party.row.controlType} options={controls} onChange={(e) => setRow("controlType", e.value)} />)}
                {partyField("address", "onboarding.address", <InputText id="pt-address" value={party.row.address || ""} onChange={(e) => setRow("address", e.target.value)} />)}
                <div className="access__toggle"><InputSwitch inputId="pt-pep" checked={!!party.row.isPep} onChange={(e) => setRow("isPep", e.value)} /><label htmlFor="pt-pep">{t("onboarding.isPep")}</label></div>
                {party.row.isPep ? partyField("pepDetails", "onboarding.pepDetails", <InputText id="pt-pepDetails" value={party.row.pepDetails || ""} onChange={(e) => setRow("pepDetails", e.target.value)} />) : null}
              </>
            )}
            {partyField("nationality", "onboarding.nationality", <Dropdown inputId="pt-nationality" value={party.row.nationality || null} options={options.nationality} editable showClear onChange={(e) => setRow("nationality", e.value || "")} />)}
            {partyField("birthDate", "onboarding.birthDate", <InputText id="pt-birthDate" type="date" value={party.row.birthDate || ""} onChange={(e) => setRow("birthDate", e.target.value)} />)}
            {partyField("idType", "onboarding.idType", <Dropdown inputId="pt-idType" value={party.row.idType || null} options={options.idTypes} showClear onChange={(e) => setRow("idType", e.value || "")} />)}
            {partyField("idNumber", "onboarding.idNumber", <InputText id="pt-idNumber" value={party.row.idNumber || ""} onChange={(e) => setRow("idNumber", e.target.value)} />)}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default ClientOnboarding;
