import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import DropdownField from "../../component/DropdownField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import FieldError from "../../../components/FieldError";
import {
  postAdjusterSubmission,
  getClaimDetails,
} from "./store/adjusterSubmissionMiddleWare";
import addressService from "../../../services/addressService";
import {
  addressOptionsWithSaved,
  canonicalAddressValue,
  findAddressItem,
  isPhilippines,
  isValidPhilippineZip,
  normalizeCountryName,
} from "../../../utility/addressHelpers";
import ClaimJourneyLayout, { ClaimActions, ClaimSection, FIELD_COL } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import useClaimsConfig from "../shared/useClaimsConfig";
import {
  EDITABLE_STATUSES,
  claimLobOf,
  errorText,
  fromIsoDate,
  lobUses,
  toIsoDate,
} from "../shared/claimJourney";

const EMPTY_VALUES = {
  adjusterName: "",
  insuranceCompanyClaimNumber: "",
  dateOfReported: "",
  dateOfLoss: "",
  placeOfAccident: "",
  driversName: "",
  houseNumber: "",
  barangay: "",
  country: "",
  province: "",
  city: "",
  zipCode: "",
  name: "",
  contactNumber: "",
  plateNumber: "",
  unit: "",
  shop: "",
  insuranceCompanyName: "",
  file: null,
};

const text = (v) => String(v ?? "").trim();

/** Form values from the saved claim: what was entered at notification and any earlier adjuster report. */
const valuesFromClaim = (claim) => {
  const tp = claim?.thirdPartyDetails || {};
  const hasDriverAddress = ["driverHouseNo", "driverBarangay", "driverCountry", "driverProvince", "driverCity", "driverZipCode"].some((k) => text(claim?.[k]));
  // no driver address saved and the holder drove: the holder address of the claim
  const holderDrove = claim?.isPolicyHolderTheDriver === true || !text(claim?.driverName);
  const address = hasDriverAddress
    ? { houseNo: claim.driverHouseNo, barangay: claim.driverBarangay, country: claim.driverCountry, province: claim.driverProvince, city: claim.driverCity, zipCode: claim.driverZipCode }
    : holderDrove
    ? { houseNo: claim?.houseNo, barangay: claim?.barangay, country: claim?.country, province: claim?.province, city: claim?.city, zipCode: claim?.zipCode }
    : {};
  return {
    ...EMPTY_VALUES,
    adjusterName: text(claim?.adjusterName),
    insuranceCompanyClaimNumber: text(claim?.insuranceCompanyClaimNumber),
    dateOfReported: toIsoDate(claim?.reportedDate) || toIsoDate(new Date()),
    dateOfLoss: toIsoDate(claim?.dateOfIncident),
    placeOfAccident: text(claim?.addressOfIncident),
    driversName: text(claim?.driverName) || (holderDrove ? text(claim?.policyHolderName) : ""),
    houseNumber: text(address.houseNo),
    barangay: text(address.barangay),
    country: normalizeCountryName(text(address.country)),
    province: text(address.province),
    city: text(address.city),
    zipCode: text(address.zipCode),
    name: text(tp.thirdPartyName),
    contactNumber: text(tp.thirdPartyContactNumber),
    plateNumber: text(tp.thirdPartyPlateNumber),
    unit: text(tp.thirdPartyUnit),
    shop: text(tp.thirdPartyShop),
    insuranceCompanyName: text(tp.thirdPartyInsuranceCompanyName),
  };
};

const AdjusterSubmission = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const config = useClaimsConfig();
  const fileUploadRef = useRef(null);
  const [initializedFor, setInitializedFor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const claimId = params.id || params.claimId || location.state?.claimId || location.state?.id;

  const { claimDetails, claimDetailsLoading, claimDetailsError } = useSelector(
    ({ adjusterSubmissionReducers }) => ({
      claimDetails: adjusterSubmissionReducers?.claimDetails,
      claimDetailsLoading: adjusterSubmissionReducers?.claimDetailsLoading || false,
      claimDetailsError: adjusterSubmissionReducers?.claimDetailsError || "",
    })
  );
  const loaded = claimDetails?.data || null;
  // the store may still hold another claim while this one loads
  const claim = loaded && [loaded.id, loaded.claimNumber].includes(claimId) ? loaded : null;

  const lob = claimLobOf(claim?.lob, claim?.policy?.lob, claim?.productType, location.state?.lob);
  const usesDriver = lobUses(config, lob, "driver");
  const usesVehicle = lobUses(config, lob, "vehicle");
  const editable = !claim || EDITABLE_STATUSES.includes(claim.lifecycleStatus);

  useEffect(() => {
    if (claimId) dispatch(getClaimDetails(claimId));
  }, [dispatch, claimId]);

  const labels = {
    adjusterName: t("claimJourney.adjusterName"),
    insuranceCompanyClaimNumber: t("claimJourney.insurerClaimNumber"),
    dateOfReported: t("claimJourney.dateReported"),
    dateOfLoss: t("claimJourney.dateOfLoss"),
    placeOfAccident: usesDriver ? t("claimJourney.placeOfAccident") : t("claimJourney.placeOfLoss"),
    driversName: t("claimJourney.driverName"),
    zipCode: t("claimJourney.zipCode"),
    file: t("claimJourney.proofOfDocuments"),
  };

  const validate = (values) => {
    const errors = {};
    if (!editable) return errors; // nothing is saved once the claim has moved on
    const required = t("claimJourney.required");
    if (!text(values.adjusterName)) errors.adjusterName = required;
    if (!values.dateOfReported) errors.dateOfReported = required;
    if (!values.dateOfLoss) errors.dateOfLoss = required;
    if (!text(values.placeOfAccident)) errors.placeOfAccident = required;
    const today = toIsoDate(new Date());
    if (values.dateOfLoss && values.dateOfLoss > today) errors.dateOfLoss = t("claimJourney.lossInFuture");
    if (values.dateOfReported && values.dateOfReported > today) errors.dateOfReported = t("claimJourney.reportedInFuture");
    if (values.dateOfLoss && values.dateOfReported && values.dateOfReported < values.dateOfLoss) {
      errors.dateOfReported = t("claimJourney.reportedBeforeLoss");
    }
    if (usesDriver) {
      if (!text(values.driversName)) errors.driversName = required;
      if (text(values.zipCode) && isPhilippines(values.country) && !isValidPhilippineZip(values.zipCode)) {
        errors.zipCode = t("validation.zipCodePhilippines", "ZIP code must be 4 digits");
      }
    }
    return errors;
  };

  const goNext = () =>
    navigate(`/agent/claimrequest/settlementapproval/${claim?.id || claimId}`, {
      state: { claimId: claim?.id || claimId, clientId: location.state?.clientId || claim?.clientId },
    });

  const handleSubmit = async (values) => {
    setServerError("");
    if (!editable) {
      goNext();
      return;
    }
    setIsSubmitting(true);
    const adjusterData = {
      insuranceCompanyClaimNumber: text(values.insuranceCompanyClaimNumber),
      reportedDate: values.dateOfReported,
      dateOfIncident: values.dateOfLoss,
      addressOfIncident: text(values.placeOfAccident),
      adjusterName: text(values.adjusterName),
      adjusterStatus: claim?.adjusterStatus || "Assigned",
      thirdPartyName: text(values.name),
      thirdPartyContactNumber: text(values.contactNumber),
      thirdPartyInsuranceCompanyName: text(values.insuranceCompanyName),
      file: values.file || null,
      ...(usesDriver
        ? {
            driverName: text(values.driversName),
            driverDetails: {
              driverName: text(values.driversName),
              driverHouseNo: text(values.houseNumber),
              driverBarangay: text(values.barangay),
              driverCountry: text(values.country),
              driverProvince: text(values.province),
              driverCity: text(values.city),
              driverZipCode: text(values.zipCode),
            },
          }
        : {}),
      ...(usesVehicle
        ? {
            thirdPartyPlateNumber: text(values.plateNumber),
            thirdPartyUnit: text(values.unit),
            thirdPartyShop: text(values.shop),
          }
        : {}),
    };
    const result = await dispatch(postAdjusterSubmission({ claimId: claim?.id || claimId, adjusterData }));
    setIsSubmitting(false);
    if (result.type.endsWith("/fulfilled")) {
      goNext();
    } else {
      setServerError(errorText(result.payload, t("claimJourney.saveFailed")));
    }
  };

  const formik = useFormik({ initialValues: EMPTY_VALUES, validate, onSubmit: handleSubmit });

  useEffect(() => {
    if (claim && initializedFor !== claim.id) {
      formik.resetForm({ values: valuesFromClaim(claim) });
      setInitializedFor(claim.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim, initializedFor]);

  // Address master: Country -> Province -> City
  const [countryList, setCountryList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);

  useEffect(() => {
    if (!usesDriver) return undefined;
    let cancelled = false;
    addressService.getCountries().then((res) => {
      if (!cancelled && res.success && Array.isArray(res.data)) setCountryList(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [usesDriver]);

  const countryKey = findAddressItem(countryList, formik.values.country)?.id ?? (formik.values.country || "");
  const provinceKey = findAddressItem(provinceList, formik.values.province)?.id ?? (formik.values.province || "");

  useEffect(() => {
    if (!countryKey || !usesDriver) {
      setProvinceList([]);
      return undefined;
    }
    let cancelled = false;
    addressService.getProvincesByCountry(countryKey).then((res) => {
      if (!cancelled) setProvinceList(res.success && Array.isArray(res.data) ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [countryKey, usesDriver]);

  useEffect(() => {
    if (!provinceKey || !usesDriver) {
      setCityList([]);
      return undefined;
    }
    let cancelled = false;
    addressService.getCitiesByProvince(provinceKey).then((res) => {
      if (!cancelled) setCityList(res.success && Array.isArray(res.data) ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [provinceKey, usesDriver]);

  // saved values that match the master by code or another spelling take the master name
  useEffect(() => {
    [
      ["country", countryList],
      ["province", provinceList],
      ["city", cityList],
    ].forEach(([field, list]) => {
      const current = formik.values[field];
      if (!current || !list.length) return;
      const canonical = canonicalAddressValue(list, current);
      if (canonical !== current) formik.setFieldValue(field, canonical, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryList, provinceList, cityList, formik.values.country, formik.values.province, formik.values.city]);

  const countryOptions = useMemo(() => addressOptionsWithSaved(countryList, formik.values.country), [countryList, formik.values.country]);
  const provinceOptions = useMemo(() => addressOptionsWithSaved(provinceList, formik.values.province), [provinceList, formik.values.province]);
  const cityOptions = useMemo(() => addressOptionsWithSaved(cityList, formik.values.city), [cityList, formik.values.city]);

  const coInsuranceRows = (claim?.participatingInsurers || []).map((p) => ({
    id: String(p.insurerId),
    insurer: p.insuranceCompanyName,
    role: p.isLead ? t("claimJourney.leadInsurer") : t("claimJourney.coInsurer"),
    share: `${Number(p.sharePercentage) || 0}%`,
  }));

  const showErrors = formik.submitCount > 0;
  const fieldError = (name) => (showErrors || formik.touched[name] ? formik.errors[name] : undefined);
  const req = (label) => (
    <>
      {label}
      <span className="required-mark">*</span>
    </>
  );
  const input = (name, label, props = {}) => (
    <div className={FIELD_COL}>
      <InputTextField
        label={label}
        value={formik.values[name]}
        onChange={formik.handleChange(name)}
        onBlur={() => formik.setFieldTouched(name, true, false)}
        disabled={!editable}
        {...props}
      />
      <FieldError error={fieldError(name)} />
    </div>
  );
  const dateField = (name, label) => (
    <div className={FIELD_COL}>
      <DatepickerField
        label={label}
        value={fromIsoDate(formik.values[name])}
        onChange={(e) => formik.setFieldValue(name, toIsoDate(e.value))}
        maxDate={new Date()}
        disabled={!editable}
      />
      <FieldError error={fieldError(name)} />
    </div>
  );

  const backToReview = () =>
    navigate(`/agent/claimrequest/requestapproval/${claim?.id || claimId}`, {
      state: { claimId: claim?.id || claimId, clientId: location.state?.clientId || claim?.clientId },
    });

  return (
    <ClaimJourneyLayout
      claim={claim}
      step="adjuster"
      holderName={claim?.policyHolderName}
      reference={claim?.claimNumber ? t("claimJourney.claimRef", { number: claim.claimNumber }) : ""}
      status={claim?.claimStatus}
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={t("claimJourney.adjusterTitle")}
    >
      {claimDetailsLoading && !claim && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {claimDetailsError && !claim && (
        <FormErrorSummary serverError={claimDetailsError} />
      )}
      {claim && (
        <>
          <ClaimSection title={t("claimJourney.adjusterReport")}>
            <div className="grid">
              {input("adjusterName", req(labels.adjusterName))}
              {input("insuranceCompanyClaimNumber", labels.insuranceCompanyClaimNumber)}
              {dateField("dateOfLoss", req(labels.dateOfLoss))}
              {dateField("dateOfReported", req(labels.dateOfReported))}
              {input("placeOfAccident", req(labels.placeOfAccident))}
            </div>
          </ClaimSection>

          {usesDriver && (
            <ClaimSection title={t("claimJourney.driverSection")}>
              <div className="grid">
                {input("driversName", req(labels.driversName))}
                {input("houseNumber", t("claimJourney.houseNo"))}
                {input("barangay", t("claimJourney.barangay"))}
                <div className={FIELD_COL}>
                  <DropdownField
                    label={t("claimJourney.country")}
                    value={formik.values.country}
                    onChange={(e) => {
                      formik.setFieldValue("country", e.value || "");
                      formik.setFieldValue("province", "");
                      formik.setFieldValue("city", "");
                    }}
                    options={countryOptions}
                    optionLabel="label"
                    optionValue="value"
                    disabled={!editable}
                  />
                </div>
                <div className={FIELD_COL}>
                  <DropdownField
                    label={t("claimJourney.province")}
                    value={formik.values.province}
                    onChange={(e) => {
                      formik.setFieldValue("province", e.value || "");
                      formik.setFieldValue("city", "");
                    }}
                    options={provinceOptions}
                    optionLabel="label"
                    optionValue="value"
                    disabled={!editable || !formik.values.country}
                  />
                </div>
                <div className={FIELD_COL}>
                  <DropdownField
                    label={t("claimJourney.city")}
                    value={formik.values.city}
                    onChange={(e) => formik.setFieldValue("city", e.value || "")}
                    options={cityOptions}
                    optionLabel="label"
                    optionValue="value"
                    disabled={!editable || !formik.values.province}
                  />
                </div>
                {input("zipCode", labels.zipCode, { maxLength: isPhilippines(formik.values.country) ? 4 : undefined })}
              </div>
            </ClaimSection>
          )}

          {coInsuranceRows.length > 0 && (
            <ClaimSection title={t("claimJourney.coInsurance")}>
              <DataTable value={coInsuranceRows} size="small" dataKey="id">
                <Column field="insurer" header={t("claimJourney.insurer")} />
                <Column field="role" header={t("claimJourney.role")} />
                <Column field="share" header={t("claimJourney.share")} alignHeader="right" bodyStyle={{ textAlign: "right" }} />
              </DataTable>
            </ClaimSection>
          )}

          <ClaimSection
            title={usesDriver ? t("claimJourney.thirdParty") : t("claimJourney.thirdPartyWitness")}
            hint={t("claimJourney.ifApplicable")}
          >
            <div className="grid">
              {input("name", t("claimJourney.name"))}
              {input("contactNumber", t("claimJourney.contactNumber"))}
              {usesVehicle && input("plateNumber", t("claimJourney.plateNumber"))}
              {usesVehicle && input("unit", t("claimJourney.unit"))}
              {usesVehicle && input("shop", t("claimJourney.shop"))}
              {input("insuranceCompanyName", t("claimJourney.thirdPartyInsurer"))}
            </div>
          </ClaimSection>

          <ClaimSection title={t("claimJourney.proofOfDocuments")} hint={t("claimJourney.optional")}>
            <div className="claim-journey__upload">
              {formik.values.file ? (
                <span className="claim-journey__file">
                  <i className="pi pi-file" aria-hidden="true" />
                  {formik.values.file.name}
                  <Button
                    type="button"
                    icon="pi pi-times"
                    text
                    rounded
                    aria-label={t("claimJourney.removeFile")}
                    onClick={() => {
                      formik.setFieldValue("file", null);
                      fileUploadRef.current?.clear();
                    }} tooltip={t("claimJourney.removeFile")} tooltipOptions={{ position: "top" }}
                  />
                </span>
              ) : (
                <FileUpload
                  ref={fileUploadRef}
                  mode="basic"
                  auto
                  customUpload
                  name="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  maxFileSize={2000000}
                  chooseLabel={t("claimJourney.chooseFile")}
                  disabled={!editable}
                  invalidFileSizeMessageSummary={t("claimJourney.fileTooLarge")}
                  invalidFileSizeMessageDetail=""
                  uploadHandler={(e) => {
                    formik.setFieldValue("file", e.files[0]);
                    e.options.clear();
                  }}
                />
              )}
              <small>{t("claimJourney.fileRule")}</small>
            </div>
            {(claim.documents || []).length > 0 && (
              <p className="claim-journey__hint mt-2">
                {t("claimJourney.documentsOnFile", { names: claim.documents.map((d) => d.documentName).join(", ") })}
              </p>
            )}
          </ClaimSection>

          <FormErrorSummary errors={formik.errors} labels={labels} show={showErrors} serverError={serverError} />
        </>
      )}
      <ClaimActions next={claim && !editable ? t("claimJourney.adjusterLocked", { status: claim.claimStatus }) : t("claimFlow.next.adjuster")}>
        <Button type="button" label={t("claimJourney.back")} outlined onClick={backToReview} disabled={isSubmitting} />
        <Button
          type="button"
          label={editable ? t("claimJourney.saveAndContinue") : t("claimJourney.next")}
          onClick={formik.handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !claim}
        />
      </ClaimActions>
    </ClaimJourneyLayout>
  );
};

export default AdjusterSubmission;
