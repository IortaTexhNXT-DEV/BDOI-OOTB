import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { RadioButton } from "primereact/radiobutton";
import { InputNumber } from "primereact/inputnumber";
import InputTextField from "../../component/inputText";
import DropdownField from "../../component/DropdwonField";
import { Button } from "primereact/button";
import DatepickerField from "../../component/datePicker";
import CustomToast from "../../../components/Toast";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import SvgCountPlusIcon from "../../../assets/icons/SvgCountPlusIcon";
import SvgCountMinusIcon from "../../../assets/icons/SvgCountMinusIcon";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "../../quoteModule/quoteDetailView/index.scss";
import "./FireLeadCreationCard.scss";
import { useFormik } from "formik";
import addressService from "../../../services/addressService";
import { isThailand } from "../../../utility/addressHelpers";
import {
  postFireCreateleadMiddleware,
  getLeadByIdMiddleware,
} from "../Store/leadMiddleware";
import quotationService from "../../../services/quotationService";
import { numberLocale } from "../../../utility/currencyConverter";
import {
  CONSTRUCTION_TYPES,
  BUILDING_TYPES,
  LOCATION_CODE_OPTIONS,
  EARTHQUAKE_ZONES,
  OCCUPANCY_TYPES,
  FIRE_PROTECTION_OPTIONS,
  SMI_ENTRY_FIELDS,
  COVER_CONFIG,
  EARTHQUAKE_ZONE_LOADING_PCT,
  SPRINKLER_DISCOUNT_MAX,
  FIRE_EXTINGUISHER_DISCOUNT_MAX,
  DISCOUNT_STEP,
} from "./fireRiskConstants";

const personalDetailsInitialValue = {
  CompanyName: "",
  TaxNumber: "",
  FirstName: "",
  LastName: "",
  PreferredName: "",
  EmailID: "",
  ContactNumber: "",
  HouseNo: "",
  Barangay: "",
  Country: "",
  Province: "",
  City: "",
  ZIPCode: "",
  RoadThanon: "",
  SoiAlley: "",
  MooVillage: "",
  DateofBirth: "",
  category: "Retail",
  gender: "Male",
};

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;
const LATITUDE_MAX_LENGTH = 10;
const LONGITUDE_MAX_LENGTH = 12;
const COORD_DECIMAL_PLACES = 6;

const riskDetailsInitialValue = {
  RiskID: "",
  ConstructionType: "",
  BuildingType: "",
  LocationCodeDescription: "",
  LocationAddress: "",
  OccupancyType: "",
  NatureOfBusiness: "",
  EarthquakeZone: "",
  NoOfFloors: null,
  SectionType: "",
  FireProtection: "",
  Latitude: null,
  Longitude: null,
};

const validateLatitude = (t) => (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return t("fireLead.latitudeInvalid");
  if (num < LATITUDE_MIN || num > LATITUDE_MAX) {
    return t("fireLead.latitudeRange", { min: LATITUDE_MIN, max: LATITUDE_MAX });
  }
  return null;
};

const validateLongitude = (t) => (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return t("fireLead.longitudeInvalid");
  if (num < LONGITUDE_MIN || num > LONGITUDE_MAX) {
    return t("fireLead.longitudeRange", { min: LONGITUDE_MIN, max: LONGITUDE_MAX });
  }
  return null;
};

const siInitialValue = SMI_ENTRY_FIELDS.reduce((acc, f) => {
  acc[f.key] = null;
  return acc;
}, {});

const getSiForCover = (cover, vals) => {
  if (cover.smiGroupCode === "SMIGRP1") {
    const b = Number(vals.Building) || 0;
    const p = Number(vals.PlantAndMachinery) || 0;
    const o = Number(vals.OtherContents) || 0;
    return b + p + o;
  }
  if (cover.smiGroupCode === "SMIGRP2") return Number(vals.GrossProfit) || 0;
  if (cover.smiGroupCode === "SMIGRP3") return Number(vals.LossOfRent) || 0;
  return 0;
};

const getPersonalDetailsValidation = (t) => (values) => {
  const errors = {};
  if (values.category === "Corporate") {
    if (!values.CompanyName) errors.CompanyName = t("fireLead.fieldRequired");
    if (!values.TaxNumber) errors.TaxNumber = t("fireLead.fieldRequired");
  }
  if (!values.FirstName) errors.FirstName = t("fireLead.fieldRequired");
  if (!values.PreferredName) errors.PreferredName = t("fireLead.fieldRequired");
  if (!values.LastName) errors.LastName = t("fireLead.fieldRequired");
  if (!values.EmailID) {
    errors.EmailID = t("fireLead.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
    errors.EmailID = t("fireLead.invalidEmail");
  }
  if (!values.ContactNumber) {
    errors.ContactNumber = t("fireLead.phoneRequired");
  } else if (!/^\d{10}$/.test(values.ContactNumber)) {
    errors.ContactNumber = t("fireLead.invalidPhone");
  }
  if (!values.HouseNo) errors.HouseNo = t("fireLead.fieldRequired");
  if (!values.Barangay) errors.Barangay = t("fireLead.fieldRequired");
  if (!values.Country) errors.Country = t("fireLead.fieldRequired");
  if (!values.Province) errors.Province = t("fireLead.fieldRequired");
  if (!values.City) errors.City = t("fireLead.fieldRequired");
  if (!values.ZIPCode) errors.ZIPCode = t("fireLead.fieldRequired");
  if (!values.DateofBirth) errors.DateofBirth = t("fireLead.fieldRequired");
  if (!values.category) errors.category = t("fireLead.fieldRequired");
  if (!values.gender) errors.gender = t("fireLead.fieldRequired");
  return errors;
};

// Map lead API response to personal details form values (for pre-populating existing lead)
const leadToPersonalFormValues = (lead) => {
  if (!lead || typeof lead !== "object") return personalDetailsInitialValue;
  return {
    ...personalDetailsInitialValue,
    CompanyName: lead.companyName || "",
    TaxNumber: lead.taxInformationNumber || "",
    FirstName: lead.firstName || "",
    LastName: lead.lastName || "",
    PreferredName: lead.preferredName || "",
    EmailID: lead.emailId || "",
    ContactNumber: lead.contactNumber || "",
    HouseNo: lead.houseNo || "",
    Barangay: lead.barangay || "",
    Country: lead.country || "",
    Province: lead.province || "",
    City: lead.city || "",
    ZIPCode: lead.zipCode || "",
    RoadThanon: lead.roadThanon || "",
    SoiAlley: lead.soiAlley || "",
    MooVillage: lead.mooVillage || "",
    DateofBirth: lead.DOB
      ? (typeof lead.DOB === "string" ? new Date(lead.DOB) : lead.DOB)
      : "",
    category: lead.leadCategory || "Retail",
    gender: lead.gender || "Male",
  };
};

const FireLeadCreationCard = ({ step, onStepChange }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const location = useLocation();
  const { state: locationState } = location;
  const existingLeadRefId = locationState?.leadRefId || locationState?.leadId;
  const existingLeadFromState = locationState?.lead;

  const currentLeadDetails = useSelector(
    (state) => state.leadReducers?.currentLeadDetails
  );

  const [internalStep, setInternalStep] = useState(1);
  const currentStep = step !== undefined ? step : internalStep;
  const setStep = onStepChange || setInternalStep;
  const [personalDetails, setPersonalDetails] = useState(personalDetailsInitialValue);
  const [riskDetails, setRiskDetails] = useState(riskDetailsInitialValue);
  const [createdLeadId, setCreatedLeadId] = useState(null);
  const [createdQuotationId, setCreatedQuotationId] = useState(null);
  const [quotationStatus, setQuotationStatus] = useState(null);
  const [show, setShow] = useState(false);
  const [siValues, setSiValues] = useState(siInitialValue);
  const [sprinklerDiscount, setSprinklerDiscount] = useState(0);
  const [fireExtinguisherDiscount, setFireExtinguisherDiscount] = useState(0);
  const [siErrors, setSiErrors] = useState({});
  const [noOfFloorsFocused, setNoOfFloorsFocused] = useState(false);
  const [latitudeFocused, setLatitudeFocused] = useState(false);
  const [longitudeFocused, setLongitudeFocused] = useState(false);
  const [focusedSiField, setFocusedSiField] = useState(null);
  const toastRef = useRef(null);
  const toastErrorRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // When adding quote for existing lead: fetch lead if not passed in state
  useEffect(() => {
    if (existingLeadRefId && !existingLeadFromState) {
      dispatch(getLeadByIdMiddleware(existingLeadRefId));
    }
  }, [dispatch, existingLeadRefId, existingLeadFromState]);


  const getTranslatedOptionLabel = useCallback(
    (value, options) => {
      if (value == null || value === "") return t("policyDetail.nA");
      const opt = Array.isArray(options) ? options.find((o) => o.value === value) : null;
      return opt?.labelKey ? t(opt.labelKey) : value;
    },
    [t]
  );

  const [countryList, setCountryList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [districtList, setDistrictList] = useState([]);
  const [postalLookupLoading, setPostalLookupLoading] = useState(false);

  const personalFormik = useFormik({
    initialValues: existingLeadFromState
      ? leadToPersonalFormValues(existingLeadFromState)
      : personalDetailsInitialValue,
    enableReinitialize: true,
    validate: getPersonalDetailsValidation(t),
    onSubmit: async (values) => {
      setPersonalDetails(values);
      // When adding quote for existing lead, skip create-lead API and go to step 2
      if (existingLeadRefId) {
        setCreatedLeadId(existingLeadRefId);
        setStep(2);
        return;
      }
      // Step 1 = Lead only: Create Lead API with personal details
      const leadPayload = {
        lob: "FIRE",
        companyName: values.CompanyName || null,
        taxInformationNumber: values.TaxNumber || null,
        firstName: values.FirstName,
        lastName: values.LastName,
        preferredName: values.PreferredName,
        emailId: values.EmailID,
        contactNumber: values.ContactNumber,
        houseNo: values.HouseNo,
        barangay: values.Barangay,
        country: typeof values.Country === "object" ? values.Country?.label : values.Country,
        province: typeof values.Province === "object" ? values.Province?.label : values.Province,
        city: typeof values.City === "object" ? values.City?.label : values.City,
        zipCode: values.ZIPCode,
        roadThanon: values.RoadThanon || undefined,
        soiAlley: values.SoiAlley || undefined,
        mooVillage: values.MooVillage || undefined,
        DOB: values.DateofBirth
          ? (typeof values.DateofBirth === "string"
              ? values.DateofBirth
              : values.DateofBirth.toISOString?.().split("T")[0])
          : "",
        leadCategory: values.category || "Retail",
        gender: values.gender || "Male",
      };
      try {
        const result = await dispatch(postFireCreateleadMiddleware(leadPayload));
        if (result.type.endsWith("/fulfilled")) {
          const leadId = result.payload?.leadId || result.payload?.id || result.payload?.data?.leadId;
          setCreatedLeadId(leadId);
          toastRef.current?.showToast();
          setStep(2);
        } else if (result.type.endsWith("/rejected")) {
          toastErrorRef.current?.showToast({
            severity: "error",
            detail: extractErrorMessage(result, t("fireLead.failedToCreateFireLead")),
          });
        }
      } catch (error) {
        toastErrorRef.current?.showToast({
          severity: "error",
          detail: error?.message || t("fireLead.unexpectedError"),
        });
      }
    },
  });

  // Pre-populate form when lead is fetched by id (e.g. navigated with leadRefId but no state.lead)
  useEffect(() => {
    if (
      existingLeadRefId &&
      currentLeadDetails &&
      !existingLeadFromState
    ) {
      const leadId = currentLeadDetails.generatedLeadId || currentLeadDetails.leadId || currentLeadDetails.id;
      if (String(leadId) === String(existingLeadRefId)) {
        personalFormik.setValues(leadToPersonalFormValues(currentLeadDetails));
      }
    }
  }, [existingLeadRefId, currentLeadDetails, existingLeadFromState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await addressService.getCountries();
      if (!cancelled && res.success && res.data) setCountryList(Array.isArray(res.data) ? res.data : []);
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCountryId = countryList.find(
    (c) => (c.name || c.code) === personalFormik.values.Country || c.id === personalFormik.values.Country
  )?.id;
  const selectedProvinceId = provinceList.find(
    (p) => (p.name || p.code) === personalFormik.values.Province || p.id === personalFormik.values.Province
  )?.id;
  const selectedCityId = cityList.find(
    (c) => (c.name || c.code) === personalFormik.values.City || c.id === personalFormik.values.City
  )?.id;

  useEffect(() => {
    if (!selectedCountryId) {
      setProvinceList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getProvincesByCountry(selectedCountryId);
      if (!cancelled && res.success && res.data) setProvinceList(Array.isArray(res.data) ? res.data : []);
    })();
    return () => { cancelled = true; };
  }, [selectedCountryId]);

  useEffect(() => {
    if (!selectedProvinceId) {
      setCityList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getCitiesByProvince(selectedProvinceId);
      if (!cancelled && res.success && res.data) setCityList(Array.isArray(res.data) ? res.data : []);
    })();
    return () => { cancelled = true; };
  }, [selectedProvinceId]);

  useEffect(() => {
    if (!selectedCityId || !isThailand(personalFormik.values.Country)) {
      setDistrictList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getDistrictsByCity(selectedCityId);
      if (!cancelled && res.success && res.data) setDistrictList(Array.isArray(res.data) ? res.data : []);
    })();
    return () => { cancelled = true; };
  }, [selectedCityId, personalFormik.values.Country]);

  const handlePostalCodeLookup = useCallback(async () => {
    const country = personalFormik.values.Country;
    const zip = personalFormik.values.ZIPCode?.trim();
    if (!isThailand(country) || !zip) return;
    setPostalLookupLoading(true);
    try {
      const countryCode =
        (typeof country === "object" && country?.code) ||
        countryList.find((c) => (c.name || c.code) === country)?.code ||
        "TH";
      const res = await addressService.getPostalCodeLookup(countryCode || "TH", zip);
      if (res.success && res.data && res.data.length > 0) {
        const first = res.data[0];
        personalFormik.setFieldValue("Province", first.province ?? first.Province ?? "");
        personalFormik.setFieldValue("City", first.city ?? first.City ?? "");
        personalFormik.setFieldValue("Barangay", first.district ?? first.District ?? "");
      }
    } finally {
      setPostalLookupLoading(false);
    }
  }, [personalFormik.values.Country, personalFormik.values.ZIPCode, countryList]);

  const countryOptions = useMemo(
    () =>
      countryList.map((c) => ({
        label: c.name || c.code || String(c.id),
        value: c.name || c.code || String(c.id),
      })),
    [countryList]
  );
  const availableProvinces = useMemo(
    () =>
      provinceList.map((p) => ({
        label: p.name || p.code || String(p.id),
        value: p.name || p.code || String(p.id),
      })),
    [provinceList]
  );
  const availableCities = useMemo(
    () =>
      cityList.map((c) => ({
        label: c.name || c.code || String(c.id),
        value: c.name || c.code || String(c.id),
      })),
    [cityList]
  );
  const availableDistricts = useMemo(
    () =>
      districtList.map((d) => ({
        label: d.name || d.code || String(d.id),
        value: d.name || d.code || String(d.id),
      })),
    [districtList]
  );

  const riskFormik = useFormik({
    initialValues: riskDetailsInitialValue,
    validate: (values) => {
      const errors = {};
      const latError = validateLatitude(t)(values.Latitude);
      if (latError) errors.Latitude = latError;
      const lngError = validateLongitude(t)(values.Longitude);
      if (lngError) errors.Longitude = lngError;
      return errors;
    },
    onSubmit: (values) => {
      setRiskDetails(values);
      setStep(3);
    },
  });


  // Fetch quotation status when on preview screen to check if customer has approved
  const fetchQuotationStatus = useCallback(async () => {
    if (!createdQuotationId) return;
    try {
      const result = await quotationService.getQuotationById(createdQuotationId);
      if (result.success && result.data) {
        const status = result.data?.quotationStatus || result.data?.data?.quotationStatus;
        if (status) setQuotationStatus(status);
      }
    } catch (err) {
      console.warn("Failed to fetch quotation status:", err);
    }
  }, [createdQuotationId]);

  useEffect(() => {
    if (currentStep === 4 && createdQuotationId) {
      fetchQuotationStatus();
    }
  }, [currentStep, createdQuotationId, fetchQuotationStatus]);

  const extractErrorMessage = (result, fallback) => {
    if (!result) return fallback;
    const { payload } = result;
    if (payload && typeof payload === "string") return payload;
    if (payload?.error) return payload.error;
    if (payload?.message) return payload.message;
    return fallback;
  };

  // Create Quotation API (Step 3 - called when Continue to Preview)
  const handleCreateQuotation = async () => {
    if (!createdLeadId || !validateSiAndDiscounts()) return;
    const pm = buildPayloadForSubmit();
    const fireRiskDetails = {
      constructionType: riskDetails.ConstructionType,
      buildingType: riskDetails.BuildingType,
      locationCodeDescription: riskDetails.LocationCodeDescription,
      locationAddress: riskDetails.LocationAddress,
      occupancyType: riskDetails.OccupancyType,
      natureOfBusiness: riskDetails.NatureOfBusiness,
      earthquakeZone: riskDetails.EarthquakeZone,
      noOfFloors: riskDetails.NoOfFloors ?? undefined,
      sectionType: riskDetails.SectionType,
      fireProtection: riskDetails.FireProtection,
      latitude: riskDetails.Latitude ?? undefined,
      longitude: riskDetails.Longitude ?? undefined,
    };
    const sumInsured = {
      Building: Number(siValues.Building) || 0,
      PlantAndMachinery: Number(siValues.PlantAndMachinery) || 0,
      OtherContents: Number(siValues.OtherContents) || 0,
      GrossProfit: Number(siValues.GrossProfit) || 0,
      Wages: Number(siValues.Wages) || 0,
      LossOfRent: Number(siValues.LossOfRent) || 0,
    };
    const coverBreakup = pm.page3_sumInsuredAndPremium.coverBreakup.map((r) => ({
      coverDesc: r.coverDesc,
      si: r.si,
      rate: r.rate,
      premium: r.premium,
    }));
    const firePremiumDetails = {
      sumInsured,
      sprinklerDiscount: showSprinklerDiscount ? sprinklerDiscount : null,
      fireExtinguisherDiscount: showFireExtinguisherDiscount ? fireExtinguisherDiscount : null,
      coverBreakup,
      earthquakeZone: riskDetails.EarthquakeZone,
      earthquakeZoneLoading,
      totalCoverPremium,
      totalDiscount,
      totalPremium,
    };
    const quotationPayload = {
      leadRefId: createdLeadId,
      productType: "Fire and Allied Perils",
      fireRiskDetails,
      firePremiumDetails,
    };
    const isUpdate = !!createdQuotationId;
    try {
      const result = isUpdate
        ? await quotationService.updateQuotation(createdQuotationId, quotationPayload)
        : await quotationService.createFireQuotation(quotationPayload);
      if (result.success) {
        const qId = result.data?.quotationId || result.data?.id || result.data?.data?.quotationId;
        if (qId) setCreatedQuotationId(qId);
        const status = result.data?.quotationStatus || result.data?.data?.quotationStatus;
        if (status) setQuotationStatus(status);
        toastRef.current?.showToast({
          detail: isUpdate ? t("fireLead.quotationUpdatedSuccess") : t("fireLead.quotationCreatedSuccess"),
        });
        setStep(4);
      } else {
        toastErrorRef.current?.showToast({
          severity: "error",
          detail: result.error || (isUpdate ? t("fireLead.quotationUpdateFailed") : t("fireLead.quotationCreateFailed")),
        });
      }
    } catch (error) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: error?.message || (isUpdate ? t("fireLead.quotationUpdateFailed") : t("fireLead.quotationCreateFailed")),
      });
    }
  };

  const renderPersonalDetails = () => (
    <>
      <div className="subheadinglabel_txt mt-3">{t("fireLead.selectCategory")}</div>
      <div className="flex flex-wrap gap-3 mt-3">
        <div className="flex align-items-center">
          <RadioButton
            inputId="individual"
            name="category"
            value="Retail"
            onChange={() => {
              personalFormik.setFieldValue("category", "Retail");
              setShow(false);
            }}
            checked={personalFormik.values.category === "Retail"}
          />
          <label htmlFor="individual" className="labeltxt_container">
            {t("fireLead.individual")}
          </label>
        </div>
        <div className="flex align-items-center">
          <RadioButton
            inputId="company"
            name="category"
            value="Corporate"
            onChange={() => {
              personalFormik.setFieldValue("category", "Corporate");
              setShow(true);
            }}
            checked={personalFormik.values.category === "Corporate"}
          />
          <label htmlFor="company" className="labeltxt_container">
            {t("fireLead.company")}
          </label>
        </div>
      </div>

      {(show || personalFormik.values.category === "Corporate") && (
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("fireLead.companyName") + "*"}
              value={personalFormik.values.CompanyName}
              onChange={personalFormik.handleChange("CompanyName")}
            />
            {personalFormik.touched.CompanyName &&
              personalFormik.errors.CompanyName && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {personalFormik.errors.CompanyName}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("fireLead.taxInfoNumber") + "*"}
              value={personalFormik.values.TaxNumber}
              onChange={personalFormik.handleChange("TaxNumber")}
            />
            {personalFormik.touched.TaxNumber &&
              personalFormik.errors.TaxNumber && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {personalFormik.errors.TaxNumber}
                </div>
              )}
          </div>
        </div>
      )}

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.firstName")}
            value={personalFormik.values.FirstName}
            onChange={personalFormik.handleChange("FirstName")}
          />
          {personalFormik.touched.FirstName &&
            personalFormik.errors.FirstName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.FirstName}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.lastName")}
            value={personalFormik.values.LastName}
            onChange={personalFormik.handleChange("LastName")}
          />
          {personalFormik.touched.LastName &&
            personalFormik.errors.LastName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.LastName}
              </div>
            )}
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.preferredName") + "*"}
            value={personalFormik.values.PreferredName}
            onChange={personalFormik.handleChange("PreferredName")}
          />
          {personalFormik.touched.PreferredName &&
            personalFormik.errors.PreferredName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.PreferredName}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <DatepickerField
            label={t("fireLead.dateOfBirth") + "*"}
            value={personalFormik.values.DateofBirth}
            onChange={(date) =>
              personalFormik.setFieldValue("DateofBirth", date.target.value)
            }
          />
          {personalFormik.touched.DateofBirth &&
            personalFormik.errors.DateofBirth && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.DateofBirth}
              </div>
            )}
        </div>
      </div>

      <div className="subheadinglabel_txt mt-3">{t("fireLead.selectGender")}</div>
      <div className="flex flex-wrap gap-3 mt-3">
        <div className="flex align-items-center gap-2 checkbox_container">
          <RadioButton
            inputId="male"
            name="gender"
            value="Male"
            onChange={() => personalFormik.setFieldValue("gender", "Male")}
            checked={personalFormik.values.gender === "Male"}
          />
          <label htmlFor="male" className="labeltxt_container">
            {t("fireLead.male")}
          </label>
        </div>
        <div className="flex align-items-center gap-2 checkbox_container">
          <RadioButton
            inputId="female"
            name="gender"
            value="Female"
            onChange={() => personalFormik.setFieldValue("gender", "Female")}
            checked={personalFormik.values.gender === "Female"}
          />
          <label htmlFor="female" className="labeltxt_container">
            {t("fireLead.female")}
          </label>
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.emailId") + "*"}
            value={personalFormik.values.EmailID}
            onChange={personalFormik.handleChange("EmailID")}
          />
          {personalFormik.touched.EmailID &&
            personalFormik.errors.EmailID && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.EmailID}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.contactNumber") + "*"}
            value={personalFormik.values.ContactNumber}
            onChange={personalFormik.handleChange("ContactNumber")}
          />
          {personalFormik.touched.ContactNumber &&
            personalFormik.errors.ContactNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.ContactNumber}
              </div>
            )}
        </div>
      </div>

      {/* Address: Country first, then Postal Code / ZIP, then Province, City, Barangay/District, then House No and Thailand fields */}
      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.country")}
            value={personalFormik.values.Country}
            options={countryOptions}
            onChange={(e) => {
              personalFormik.setFieldValue("Country", e.value);
              personalFormik.setFieldValue("Province", "");
              personalFormik.setFieldValue("City", "");
              personalFormik.setFieldValue("Barangay", "");
              personalFormik.setFieldValue("ZIPCode", "");
            }}
          />
          {personalFormik.touched.Country &&
            personalFormik.errors.Country && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.Country}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={isThailand(personalFormik.values.Country) ? t("fireLead.postalCode") : t("fireLead.zipCode")}
            value={personalFormik.values.ZIPCode}
            onChange={personalFormik.handleChange("ZIPCode")}
            onBlur={handlePostalCodeLookup}
          />
          {postalLookupLoading && (
            <div style={{ fontSize: 12, color: "#666" }} className="mt-1">{t("fireLead.lookupInProgress")}</div>
          )}
          {personalFormik.touched.ZIPCode &&
            personalFormik.errors.ZIPCode && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.ZIPCode}
              </div>
            )}
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={isThailand(personalFormik.values.Country) ? t("fireLead.provinceChangwat") : t("fireLead.province")}
            value={personalFormik.values.Province}
            options={availableProvinces}
            onChange={(e) => {
              personalFormik.setFieldValue("Province", e.value);
              personalFormik.setFieldValue("City", "");
              personalFormik.setFieldValue("Barangay", "");
            }}
            disabled={!personalFormik.values.Country}
          />
          {personalFormik.touched.Province &&
            personalFormik.errors.Province && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.Province}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={isThailand(personalFormik.values.Country) ? t("fireLead.districtAmphoe") : t("fireLead.city")}
            value={personalFormik.values.City}
            options={availableCities}
            onChange={(e) => {
              personalFormik.setFieldValue("City", e.value);
              personalFormik.setFieldValue("Barangay", "");
            }}
            disabled={!personalFormik.values.Province}
          />
          {personalFormik.touched.City && personalFormik.errors.City && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
              {personalFormik.errors.City}
            </div>
          )}
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          {isThailand(personalFormik.values.Country) && districtList.length > 0 ? (
            <DropdownField
              label={t("fireLead.subDistrictTambon")}
              value={personalFormik.values.Barangay}
              options={availableDistricts}
              onChange={(e) => personalFormik.setFieldValue("Barangay", e.value)}
              disabled={!personalFormik.values.City}
            />
          ) : (
            <InputTextField
              label={isThailand(personalFormik.values.Country) ? t("fireLead.subDistrictTambon") : t("fireLead.barangay")}
              value={personalFormik.values.Barangay}
              onChange={personalFormik.handleChange("Barangay")}
            />
          )}
          {personalFormik.touched.Barangay &&
            personalFormik.errors.Barangay && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.Barangay}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.houseNoStreet")}
            value={personalFormik.values.HouseNo}
            onChange={personalFormik.handleChange("HouseNo")}
          />
          {personalFormik.touched.HouseNo &&
            personalFormik.errors.HouseNo && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.HouseNo}
              </div>
            )}
        </div>
      </div>

      {isThailand(personalFormik.values.Country) && (
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("fireLead.roadThanon")}
              value={personalFormik.values.RoadThanon}
              onChange={personalFormik.handleChange("RoadThanon")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("fireLead.soiAlley")}
              value={personalFormik.values.SoiAlley}
              onChange={personalFormik.handleChange("SoiAlley")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("fireLead.mooVillage")}
              value={personalFormik.values.MooVillage}
              onChange={personalFormik.handleChange("MooVillage")}
            />
          </div>
        </div>
      )}

      <div className="save_continue_conatiner">
        <div className="btn_lable_save_container flex justify-content-end mt-2">
          <Button
            onClick={() => personalFormik.handleSubmit()}
            label={t("fireLead.next")}
          />
        </div>
      </div>
    </>
  );

  const renderRiskDetails = () => (
    <>
      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.riskId")}
            value={t("policyDetail.nA")}
            onChange={() => {}}
            disabled
          />
          <small className="text-color-secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
            {t("fireLead.generatedWithQuotation")}
          </small>
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.constructionType")}
            value={riskFormik.values.ConstructionType}
            options={CONSTRUCTION_TYPES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            onChange={(e) =>
              riskFormik.setFieldValue("ConstructionType", e.value)
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.buildingType")}
            value={riskFormik.values.BuildingType}
            options={BUILDING_TYPES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            onChange={(e) =>
              riskFormik.setFieldValue("BuildingType", e.value)
            }
          />
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.locationCodeDescription")}
            value={riskFormik.values.LocationCodeDescription}
            options={LOCATION_CODE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            onChange={(e) =>
              riskFormik.setFieldValue("LocationCodeDescription", e.value)
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.locationAddress")}
            value={riskFormik.values.LocationAddress}
            onChange={riskFormik.handleChange("LocationAddress")}
          />
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.occupancyType")}
            value={riskFormik.values.OccupancyType}
            options={OCCUPANCY_TYPES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            onChange={(e) =>
              riskFormik.setFieldValue("OccupancyType", e.value)
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.natureOfBusiness")}
            value={riskFormik.values.NatureOfBusiness}
            onChange={riskFormik.handleChange("NatureOfBusiness")}
          />
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <DropdownField
            label={t("fireLead.earthquakeZone")}
            value={riskFormik.values.EarthquakeZone}
            options={EARTHQUAKE_ZONES.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
            onChange={(e) =>
              riskFormik.setFieldValue("EarthquakeZone", e.value)
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className={`dropdown__container ${noOfFloorsFocused ? "dropdown__container__changed" : ""}`}>
            <InputNumber
              inputId="noOfFloors"
              value={riskFormik.values.NoOfFloors}
              onValueChange={(e) =>
                riskFormik.setFieldValue("NoOfFloors", e.value)
              }
              onFocus={() => setNoOfFloorsFocused(true)}
              onBlur={() => setNoOfFloorsFocused(false)}
              className="w-full dropdown__field"
            />
            <label
              htmlFor="noOfFloors"
              className={`label ${noOfFloorsFocused || (riskFormik.values.NoOfFloors !== null && riskFormik.values.NoOfFloors !== undefined) ? "focused" : ""}`}
            >
              {t("fireLead.noOfFloors")}
            </label>
          </div>
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <InputTextField
            label={t("fireLead.sectionType")}
            value={riskFormik.values.SectionType}
            onChange={riskFormik.handleChange("SectionType")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="subheadinglabel_txt mt-2">
            {t("fireLead.fireProtectionLabel")}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {FIRE_PROTECTION_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex align-items-center gap-2">
                <RadioButton
                  inputId={`fire-${opt.value}`}
                  name="FireProtection"
                  value={opt.value}
                  onChange={() =>
                    riskFormik.setFieldValue("FireProtection", opt.value)
                  }
                  checked={riskFormik.values.FireProtection === opt.value}
                />
                <label
                  htmlFor={`fire-${opt.value}`}
                  className="labeltxt_container"
                >
                  {t(opt.labelKey)}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <div className={`dropdown__container ${latitudeFocused ? "dropdown__container__changed" : ""} ${riskFormik.errors.Latitude ? "p-invalid" : ""}`}>
            <InputNumber
              inputId="latitude"
              value={riskFormik.values.Latitude}
              onValueChange={(e) => {
                riskFormik.setFieldValue("Latitude", e.value);
                riskFormik.setFieldTouched("Latitude", true);
              }}
              onFocus={() => setLatitudeFocused(true)}
              onBlur={() => {
                setLatitudeFocused(false);
                riskFormik.setFieldTouched("Latitude", true);
              }}
              className="w-full dropdown__field"
              mode="decimal"
              min={LATITUDE_MIN}
              max={LATITUDE_MAX}
              minFractionDigits={0}
              maxFractionDigits={COORD_DECIMAL_PLACES}
              useGrouping={false}
              pt={{
                input: {
                  maxLength: LATITUDE_MAX_LENGTH,
                  placeholder: t("fireLead.latitudePlaceholder"),
                },
              }}
            />
            <label
              htmlFor="latitude"
              className={`label ${latitudeFocused || (riskFormik.values.Latitude !== null && riskFormik.values.Latitude !== undefined) ? "focused" : ""}`}
            >
              {t("fireLead.latitudeLabel")}
            </label>
          </div>
          {riskFormik.touched.Latitude && riskFormik.errors.Latitude && (
            <small className="p-error block mt-1">{riskFormik.errors.Latitude}</small>
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className={`dropdown__container ${longitudeFocused ? "dropdown__container__changed" : ""} ${riskFormik.errors.Longitude ? "p-invalid" : ""}`}>
            <InputNumber
              inputId="longitude"
              value={riskFormik.values.Longitude}
              onValueChange={(e) => {
                riskFormik.setFieldValue("Longitude", e.value);
                riskFormik.setFieldTouched("Longitude", true);
              }}
              onFocus={() => setLongitudeFocused(true)}
              onBlur={() => {
                setLongitudeFocused(false);
                riskFormik.setFieldTouched("Longitude", true);
              }}
              className="w-full dropdown__field"
              mode="decimal"
              min={LONGITUDE_MIN}
              max={LONGITUDE_MAX}
              minFractionDigits={0}
              maxFractionDigits={COORD_DECIMAL_PLACES}
              useGrouping={false}
              pt={{
                input: {
                  maxLength: LONGITUDE_MAX_LENGTH,
                  placeholder: t("fireLead.longitudePlaceholder"),
                },
              }}
            />
            <label
              htmlFor="longitude"
              className={`label ${longitudeFocused || (riskFormik.values.Longitude !== null && riskFormik.values.Longitude !== undefined) ? "focused" : ""}`}
            >
              {t("fireLead.longitudeLabel")}
            </label>
          </div>
          {riskFormik.touched.Longitude && riskFormik.errors.Longitude && (
            <small className="p-error block mt-1">{riskFormik.errors.Longitude}</small>
          )}
        </div>
      </div>

      <div className="save_continue_conatiner">
        <div className="btn_lable_save_container flex justify-content-end gap-2 mt-2">
          <Button
            label={t("fireLead.back")}
            className="p-button-outlined"
            onClick={() => setStep(1)}
          />
          <Button
            onClick={() => riskFormik.handleSubmit()}
            label={t("fireLead.saveAndContinue")}
          />
        </div>
      </div>
    </>
  );

  // --- Step 3: SI & Premium ---
  const showSprinklerDiscount = riskDetails.FireProtection === "Sprinkler";
  const showFireExtinguisherDiscount = riskDetails.FireProtection === "Fire Extinguisher";

  const hasAtLeastOneSi = useMemo(() => {
    return SMI_ENTRY_FIELDS.some(
      (f) => siValues[f.key] != null && Number(siValues[f.key]) > 0
    );
  }, [siValues]);

  const activeSmiGroups = useMemo(() => {
    const groups = new Set();
    SMI_ENTRY_FIELDS.forEach((f) => {
      if (f.smiGroupCode && siValues[f.key] != null && Number(siValues[f.key]) > 0) {
        groups.add(f.smiGroupCode);
      }
    });
    const b = Number(siValues.Building) || 0;
    const p = Number(siValues.PlantAndMachinery) || 0;
    const o = Number(siValues.OtherContents) || 0;
    if (b + p + o > 0) groups.add("SMIGRP1");
    return groups;
  }, [siValues]);

  const coverRows = useMemo(() => {
    return COVER_CONFIG.map((c) => {
      const siForCover = c.smiGroupCode ? getSiForCover(c, siValues) : 0;
      const showCover = c.mandatory || (c.smiGroupCode && activeSmiGroups.has(c.smiGroupCode));
      const siToUse = c.smiGroupCode ? siForCover : (c.basisCover ? (Number(siValues.Building) || 0) : 0);
      const premium = showCover ? (siToUse * (c.rate / 100)) : 0;
      return { ...c, si: siToUse, premium, showCover };
    });
  }, [siValues, activeSmiGroups]);

  const smigrp1Premium = useMemo(() => {
    const row = coverRows.find((r) => r.coverDesc === "Fire And Allied Peril");
    return row?.premium || 0;
  }, [coverRows]);

  const eqZonePct = EARTHQUAKE_ZONE_LOADING_PCT[riskDetails.EarthquakeZone] ?? 0;
  const earthquakeZoneLoading = (smigrp1Premium * eqZonePct) / 100;

  const totalCoverPremium = coverRows.reduce((sum, r) => sum + (r.showCover ? r.premium : 0), 0);
  const subtotalBeforeDiscount = totalCoverPremium + earthquakeZoneLoading;

  const sprinklerDiscAmount = showSprinklerDiscount && sprinklerDiscount != null && Number(sprinklerDiscount) > 0
    ? (subtotalBeforeDiscount * Number(sprinklerDiscount)) / 100
    : 0;
  const fireExtDiscAmount = showFireExtinguisherDiscount && fireExtinguisherDiscount != null && Number(fireExtinguisherDiscount) > 0
    ? (subtotalBeforeDiscount * Number(fireExtinguisherDiscount)) / 100
    : 0;
  const totalDiscount = sprinklerDiscAmount + fireExtDiscAmount;
  const totalPremium = Math.max(0, subtotalBeforeDiscount - totalDiscount);

  const handleSumInsuredInput = useCallback((fieldKey, raw) => {
    if (raw === "" || raw == null) {
      setSiValues((prev) => ({ ...prev, [fieldKey]: null }));
      return;
    }
    const cleaned = String(raw).replace(/,/g, "");
    const num = Number.parseFloat(cleaned, 10);
    if (!Number.isNaN(num) && num >= 0) {
      setSiValues((prev) => ({ ...prev, [fieldKey]: num }));
    }
  }, []);

  const validateSiAndDiscounts = () => {
    const errs = {};
    if (!hasAtLeastOneSi) {
      errs.atLeastOneSi = t("fireLead.atLeastOneSiValidation");
    }
    if (showSprinklerDiscount && sprinklerDiscount != null) {
      const v = Number(sprinklerDiscount);
      if (v < 0 || v > SPRINKLER_DISCOUNT_MAX) {
        errs.sprinklerDiscount = t("fireLead.sprinklerDiscountRangeError", { max: SPRINKLER_DISCOUNT_MAX });
      }
    }
    if (showFireExtinguisherDiscount && fireExtinguisherDiscount != null) {
      const v = Number(fireExtinguisherDiscount);
      if (v < 0 || v > FIRE_EXTINGUISHER_DISCOUNT_MAX) {
        errs.fireExtinguisherDiscount = t("fireLead.fireExtinguisherDiscountRangeError", { max: FIRE_EXTINGUISHER_DISCOUNT_MAX });
      }
    }
    setSiErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayloadForSubmit = () => ({
    page1_personalDetails: personalDetails,
    page2_riskDetails: riskDetails,
    page3_sumInsuredAndPremium: {
      sumInsured: siValues,
      sprinklerDiscount: showSprinklerDiscount ? sprinklerDiscount : null,
      fireExtinguisherDiscount: showFireExtinguisherDiscount ? fireExtinguisherDiscount : null,
      coverBreakup: coverRows.filter((r) => r.showCover).map((r) => ({
        coverDesc: r.coverDesc,
        si: r.si,
        rate: `${r.rate}%`,
        premium: r.premium,
      })),
      earthquakeZone: riskDetails.EarthquakeZone,
      earthquakeZoneLoading,
      totalCoverPremium,
      totalDiscount,
      totalPremium,
    },
  });

  const [isProceedingToUploadPolicy, setIsProceedingToUploadPolicy] = useState(false);

  const handleProceedToPayment = async () => {
    if (!createdQuotationId) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: t("fireLead.quotationNotCreated"),
      });
      return;
    }
    const insuredName = [personalDetails.FirstName, personalDetails.LastName].filter(Boolean).join(" ") || personalDetails.PreferredName || t("fireLead.individual");
    const inceptionDate = new Date().toISOString().split("T")[0];
    const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    setIsProceedingToUploadPolicy(true);
    toastRef.current?.showToast({
      detail: t("fireLead.creatingPolicyAndUpload"),
      life: 2000,
    });

    try {
      const additionalPolicyData = {
        insuredName,
        paymentStatus: "Pending",
        inception: inceptionDate,
        expiry: expiryDate,
      };
      const result = await quotationService.convertQuotationToPolicy(
        createdQuotationId,
        additionalPolicyData,
        "agent",
        "FIRE"
      );

      if (!result.success) {
        throw new Error(result.error || t("fireLead.failedToCreatePolicy"));
      }

      const policyData = result.data?.data?.policy || result.data?.policy;
      const createdPolicyId = policyData?.id || policyData?.policyId;
      if (!createdPolicyId) {
        throw new Error(t("fireLead.policyCreatedNoId"));
      }

      let quotationDetailsForUpload = null;
      try {
        quotationDetailsForUpload = await quotationService.getQuotationById(createdQuotationId);
      } catch (e) {
        console.warn("Could not fetch quotation for upload step:", e);
      }

      toastRef.current?.showToast({
        detail: t("fireLead.proceedingToUploadPolicy"),
        life: 1000,
      });

      navigate(`/agent/convertpolicy/uploadpolicy/${createdQuotationId}`, {
        state: {
          quotationId: createdQuotationId,
          quotation: quotationDetailsForUpload,
          policyId: createdPolicyId,
          policyData: policyData || { policyId: createdPolicyId, id: createdPolicyId },
          lob: "FIRE",
          customerInfo: { insuredName, InsuredName: insuredName },
          insuredName,
          inception: inceptionDate,
          expiry: expiryDate,
          production: inceptionDate,
          issuedDate: inceptionDate,
        },
      });
    } catch (error) {
      console.error("Failed to create policy for upload step:", error);
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: error?.message || t("fireLead.failedToCreatePolicy"),
      });
    } finally {
      setIsProceedingToUploadPolicy(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (!createdQuotationId) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: t("fireLead.quotationNotCreated"),
      });
      return;
    }
    try {
      const result = await quotationService.sendQuotationForApproval(createdQuotationId);
      if (result.success) {
        await fetchQuotationStatus();
        toastRef.current?.showToast({ detail: t("fireLead.quoteSentToCustomer") });
      } else {
        if (result.error?.includes?.("PendingCustomer")) {
          await fetchQuotationStatus();
          toastRef.current?.showToast({
            detail: t("fireLead.quoteAlreadySentWaiting"),
          });
        } else {
          toastErrorRef.current?.showToast({
            severity: "error",
            detail: result.error || t("fireLead.failedToSendQuote"),
          });
        }
      }
    } catch (error) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: error?.message || t("fireLead.failedToSendQuote"),
      });
    }
  };

  const renderSumInsuredAndPremium = () => (
    <>
      <div className="subheadinglabel_txt mt-3">{t("fireLead.sumInsuredSi")}</div>
      <div className="grid mt-2">
        {SMI_ENTRY_FIELDS.map((f) => (
          <div key={f.key} className="col-12 md:col-6 lg:col-4">
            <div className={`dropdown__container ${focusedSiField === f.key ? "dropdown__container__changed" : ""}`}>
              <InputNumber
                inputId={f.key}
                value={siValues[f.key]}
                onValueChange={(e) => setSiValues((prev) => ({ ...prev, [f.key]: e.value }))}
                onFocus={() => setFocusedSiField(f.key)}
                onBlur={() => setFocusedSiField(null)}
                className="w-full dropdown__field"
                min={0}
                mode="decimal"
                pt={{
                  input: {
                    onKeyUp: (e) => handleSumInsuredInput(f.key, e.target?.value),
                    onInput: (e) => handleSumInsuredInput(f.key, e.target?.value),
                  },
                }}
              />
              <label
                htmlFor={f.key}
                className={`label ${focusedSiField === f.key || (siValues[f.key] != null && siValues[f.key] !== "") ? "focused" : ""}`}
              >
                {t(f.labelKey)}
              </label>
            </div>
          </div>
        ))}
      </div>

      {!hasAtLeastOneSi && (
        <div className="mt-3" style={{ padding: "12px", backgroundColor: "#fef3c7", borderRadius: "6px", color: "#92400e", fontSize: 14 }}>
          {t("fireLead.atLeastOneSiRequired")}
        </div>
      )}
      {siErrors.atLeastOneSi && (
        <div className="mt-2" style={{ fontSize: 12, color: "red" }}>{siErrors.atLeastOneSi}</div>
      )}

      {hasAtLeastOneSi && (
        <>
      <div className="subheadinglabel_txt mt-4">{t("fireLead.coverAndPremium")}</div>
      <div className="grid mt-2">
        <div className="col-12 overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", fontFamily: "Nunito, Arial, sans-serif", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>{t("fireLead.cover")}</th>
                <th style={{ padding: "10px", textAlign: "right" }}>{t("fireLead.premium")}</th>
              </tr>
            </thead>
            <tbody>
              {coverRows.filter((r) => r.showCover).map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px" }}>{r.coverDescKey ? t(r.coverDescKey) : r.coverDesc}</td>
                  <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(r.premium ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(showSprinklerDiscount || showFireExtinguisherDiscount) && (
        <div className="fire-lead-discounts">
          <div className="subheadinglabel_txt mt-4">{t("fireLead.discounts")}</div>
          <div className="grid mt-2">
            {showSprinklerDiscount && (
              <div className="col-12 md:col-6">
                <div className="discount__dynamic__card">
                  <div className="discount__dynamic__card__title">
                    {t("fireLead.sprinklerDiscountOptional")}
                  </div>
                  <div className="discount__dynamic__card__subtitle">
                    {t("fireLead.sprinklerDiscountRange")}
                  </div>
                  <div className="discount__dynamic__card__bottom">
                    <div
                      className="discount__btn cursor-pointer"
                      onClick={() =>
                        setSprinklerDiscount((v) => {
                          const current = v ?? 0;
                          const next = Math.max(0, current - DISCOUNT_STEP);
                          return next;
                        })
                      }
                    >
                      <SvgCountMinusIcon />
                    </div>
                    <div className="discount__reflection__text">{`${sprinklerDiscount ?? 0}%`}</div>
                    <div
                      className="discount__btn cursor-pointer"
                      onClick={() =>
                        setSprinklerDiscount((v) => {
                          const current = v ?? 0;
                          const next = Math.min(SPRINKLER_DISCOUNT_MAX, current + DISCOUNT_STEP);
                          return next;
                        })
                      }
                    >
                      <SvgCountPlusIcon />
                    </div>
                  </div>
                </div>
                <div className="discount__action__container" style={{ color: "green" }}>
                  <div className="discount__action__text">{t("fireLead.min0Max15")}</div>
                  <div className="discount__action__text">{t("fireLead.max15")}</div>
                </div>
                {siErrors.sprinklerDiscount && (
                  <small style={{ fontSize: 12, color: "red" }}>{siErrors.sprinklerDiscount}</small>
                )}
              </div>
            )}
            {showFireExtinguisherDiscount && (
              <div className="col-12 md:col-6">
                <div className="discount__dynamic__card">
                  <div className="discount__dynamic__card__title">
                    {t("fireLead.fireExtinguisherDiscountOptional")}
                  </div>
                  <div className="discount__dynamic__card__subtitle">
                    {t("fireLead.fireExtinguisher05")}
                  </div>
                  <div className="discount__dynamic__card__bottom">
                    <div
                      className="discount__btn cursor-pointer"
                      onClick={() =>
                        setFireExtinguisherDiscount((v) => {
                          const current = v ?? 0;
                          const next = Math.max(0, current - DISCOUNT_STEP);
                          return next;
                        })
                      }
                    >
                      <SvgCountMinusIcon />
                    </div>
                    <div className="discount__reflection__text">{`${fireExtinguisherDiscount ?? 0}%`}</div>
                    <div
                      className="discount__btn cursor-pointer"
                      onClick={() =>
                        setFireExtinguisherDiscount((v) => {
                          const current = v ?? 0;
                          const next = Math.min(FIRE_EXTINGUISHER_DISCOUNT_MAX, current + DISCOUNT_STEP);
                          return next;
                        })
                      }
                    >
                      <SvgCountPlusIcon />
                    </div>
                  </div>
                </div>
                <div className="discount__action__container" style={{ color: "green" }}>
                  <div className="discount__action__text">{t("fireLead.min0Max15")}</div>
                  <div className="discount__action__text">{t("fireLead.min0Max5")}</div>
                </div>
                {siErrors.fireExtinguisherDiscount && (
                  <small style={{ fontSize: 12, color: "red" }}>{siErrors.fireExtinguisherDiscount}</small>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="subheadinglabel_txt mt-4">{t("fireLead.premiumBreakup")}</div>
      <div className="grid mt-2">
        <div className="col-12 md:col-6">
          <div className="flex justify-content-between mt-2" style={{ fontSize: 14 }}>
            <span className="labeltxt_container">{t("fireLead.totalCoverPremium")}</span>
            <span>{totalCoverPremium.toFixed(2)}</span>
          </div>
          <div className="flex justify-content-between mt-2" style={{ fontSize: 14 }}>
            <span className="labeltxt_container">{t("fireLead.earthquakeZoneLoading")}</span>
            <span>{earthquakeZoneLoading.toFixed(2)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-content-between mt-2" style={{ fontSize: 14 }}>
              <span className="labeltxt_container">{t("fireLead.totalDiscount")}</span>
              <span>-{totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-content-between mt-3" style={{ fontSize: 16, fontWeight: 600, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
            <span className="labeltxt_container">{t("fireLead.totalPremium")}</span>
            <span>{totalPremium.toFixed(2)}</span>
          </div>
        </div>
      </div>
        </>
      )}

      <div className="save_continue_conatiner mt-4">
        <div className="btn_lable_save_container flex justify-content-end gap-2 mt-2">
          <Button
            label={t("fireLead.back")}
            className="p-button-outlined"
            onClick={() => setStep(2)}
          />
          <Button
            label={t("fireLead.continueToPreview")}
            disabled={!hasAtLeastOneSi}
            onClick={() => {
              if (!validateSiAndDiscounts()) return;
              handleCreateQuotation();
            }}
          />
        </div>
      </div>
    </>
  );

  const handleLeadNavigation = () => navigate("/agent/leadlisting");

  const isCustomerApproved =
    quotationStatus === "CustomerAccepted" || quotationStatus === "Approved";

  const renderPreviewPage = () => (
    <div className="overall__quotedetails__view__container">
      <div className="header_title">{t("fireLead.leads")}</div>
      <div onClick={handleLeadNavigation} className="left_arrow mt-3 cursor-pointer">
        <SvgLeftArrow />
        <div className="left_arrow_text">
          {t("fireLead.leadIdColon")} {createdLeadId || riskDetails.RiskID || t("policyDetail.nA")}
        </div>
      </div>
      <Card className="mt-4">
        <div className="table_header">{t("fireLead.quoteDetails")}</div>
        <div className="quote_details">
          <label>{t("fireLead.checkQuoteDetails")}</label>
        </div>

        <div className="sub_title">
          <label className="policy_text">{t("fireLead.personalDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.category")}</label>
            <label className="alpha_text">
              {personalDetails.category === "Retail"
                ? t("fireLead.individual")
                : personalDetails.category === "Corporate"
                ? t("fireLead.company")
                : (personalDetails.category || t("policyDetail.nA"))}
            </label>
          </div>
          {(personalDetails.category === "Corporate") && (
            <>
              <div className="quote_details">
                <label className="insurance_text">{t("fireLead.companyName")}</label>
                <label className="alpha_text">{personalDetails.CompanyName || t("policyDetail.nA")}</label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("fireLead.taxInfoNumber")}</label>
                <label className="alpha_text">{personalDetails.TaxNumber || t("policyDetail.nA")}</label>
              </div>
            </>
          )}
          <div className="quote_details">
            <label className="insurance_text">{t("common.name")}</label>
            <label className="alpha_text">
              {[personalDetails.FirstName, personalDetails.LastName].filter(Boolean).join(" ") || t("policyDetail.nA")}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.preferredName")}</label>
            <label className="alpha_text">{personalDetails.PreferredName || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.dateOfBirth")}</label>
            <label className="alpha_text">
              {personalDetails.DateofBirth
                ? (typeof personalDetails.DateofBirth === "string"
                    ? personalDetails.DateofBirth
                    : personalDetails.DateofBirth?.toISOString?.()?.split("T")[0])
                : t("policyDetail.nA")}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.gender")}</label>
            <label className="alpha_text">
              {personalDetails.gender === "Male"
                ? t("fireLead.male")
                : personalDetails.gender === "Female"
                ? t("fireLead.female")
                : (personalDetails.gender || t("policyDetail.nA"))}
            </label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.emailId")}</label>
            <label className="alpha_text">{personalDetails.EmailID || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.contactNumber")}</label>
            <label className="alpha_text">{personalDetails.ContactNumber || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.address")}</label>
            <label className="alpha_text">
              {[
                personalDetails.HouseNo,
                personalDetails.Barangay,
                typeof personalDetails.City === "object" ? personalDetails.City?.label : personalDetails.City,
                typeof personalDetails.Province === "object" ? personalDetails.Province?.label : personalDetails.Province,
                typeof personalDetails.Country === "object" ? personalDetails.Country?.label : personalDetails.Country,
                personalDetails.ZIPCode,
              ]
                .filter(Boolean)
                .join(", ") || t("policyDetail.nA")}
            </label>
          </div>
        </div>

        <div className="sub_title">
          <label className="policy_text">{t("fireLead.riskDetails")}</label>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.riskId")}</label>
            <label className="alpha_text">{riskDetails.RiskID || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.constructionType")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.ConstructionType, CONSTRUCTION_TYPES)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.buildingType")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.BuildingType, BUILDING_TYPES)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.locationCode")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.LocationCodeDescription, LOCATION_CODE_OPTIONS)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.locationAddress")}</label>
            <label className="alpha_text">{riskDetails.LocationAddress || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.occupancyType")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.OccupancyType, OCCUPANCY_TYPES)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.natureOfBusiness")}</label>
            <label className="alpha_text">{riskDetails.NatureOfBusiness || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.earthquakeZone")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.EarthquakeZone, EARTHQUAKE_ZONES)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.noOfFloors")}</label>
            <label className="alpha_text">{riskDetails.NoOfFloors ?? t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.sectionType")}</label>
            <label className="alpha_text">{riskDetails.SectionType || t("policyDetail.nA")}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.fireProtection")}</label>
            <label className="alpha_text">{getTranslatedOptionLabel(riskDetails.FireProtection, FIRE_PROTECTION_OPTIONS)}</label>
          </div>
        </div>

        <div className="sub_title">
          <label className="policy_text">{t("fireLead.sumInsured")}</label>
          {SMI_ENTRY_FIELDS.map((f) => (
            <div key={f.key} className="quote_details">
              <label className="insurance_text">{t(f.labelKey)}</label>
              <label className="alpha_text">
                {siValues[f.key] != null && siValues[f.key] !== ""
                  ? Number(siValues[f.key]).toLocaleString(numberLocale())
                  : "0"}
              </label>
            </div>
          ))}
        </div>

        <div className="sub_title">
          <label className="policy_text">{t("fireLead.coverageAndPremium")}</label>
          {coverRows.filter((r) => r.showCover).map((r, i) => (
            <div key={i} className="quote_details">
              <label className="insurance_text">{r.coverDescKey ? t(r.coverDescKey) : r.coverDesc}</label>
              <label className="alpha_text">
                {formatCurrency(r.premium ?? 0)}
              </label>
            </div>
          ))}
          {(showSprinklerDiscount || showFireExtinguisherDiscount) && (
            <>
              <div className="quote_details">
                <label className="insurance_text">{t("fireLead.sprinklerDiscount")}</label>
                <label className="alpha_text">
                  {showSprinklerDiscount && sprinklerDiscount != null ? `${sprinklerDiscount}%` : t("policyDetail.nA")}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">{t("fireLead.fireExtinguisherDiscount")}</label>
                <label className="alpha_text">
                  {showFireExtinguisherDiscount && fireExtinguisherDiscount != null ? `${fireExtinguisherDiscount}%` : t("policyDetail.nA")}
                </label>
              </div>
            </>
          )}
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.earthquakeZoneLoading")}</label>
            <label className="alpha_text">{earthquakeZoneLoading.toFixed(2)}</label>
          </div>
          <div className="quote_details">
            <label className="insurance_text">{t("fireLead.totalCoverPremium")}</label>
            <label className="alpha_text">{totalCoverPremium.toFixed(2)}</label>
          </div>
          {totalDiscount > 0 && (
            <div className="quote_details">
              <label className="insurance_text">{t("fireLead.totalDiscount")}</label>
              <label className="alpha_text">-{totalDiscount.toFixed(2)}</label>
            </div>
          )}
          <div className="quote_details">
            <label className="gross_text">{t("fireLead.totalPremium")}</label>
            <label className="gross_count">{formatCurrency(totalPremium)}</label>
          </div>
        </div>
      </Card>

      <div className="button_component fire-quote-preview-actions">
        <Button
          label={t("fireLead.back")}
          className="p-button-outlined fire-preview-btn"
          onClick={() => setStep(3)}
        />
        {quotationStatus === "PendingCustomer" ? (
          <div
            className="waiting-notice"
            style={{
              padding: "8px 16px",
              backgroundColor: "#fef3c7",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              fontSize: 14,
            }}
          >
            <i className="pi pi-clock" style={{ marginRight: "8px" }}></i>
            {t("fireLead.waitingForCustomerApproval")}
          </div>
        ) : (
          <Button
            label={t("fireLead.sendToCustomer")}
            icon="pi pi-send"
            className="p-button-outlined fire-preview-btn"
            onClick={handleSendToCustomer}
          />
        )}
        <span
          title={!isCustomerApproved ? t("fireLead.nextUploadPolicyTooltip") : t("fireLead.nextUploadPolicyAvailable")}
          className="fire-preview-btn-wrapper"
        >
          <Button
            label={t("fireLead.next")}
            className="p-button-success fire-preview-btn"
            onClick={handleProceedToPayment}
            disabled={!isCustomerApproved || isProceedingToUploadPolicy}
            loading={isProceedingToUploadPolicy}
          />
        </span>
        {!isCustomerApproved && (
          <Button
            label={t("fireLead.refreshStatus")}
            icon="pi pi-refresh"
            className="p-button-text p-button-sm"
            onClick={fetchQuotationStatus}
          />
        )}
      </div>
    </div>
  );

  if (currentStep === 4) {
    return (
      <>
        <CustomToast ref={toastRef} message={t("fireLead.quotationCreatedSuccess")} />
        <CustomToast
          ref={toastErrorRef}
          message={t("fireLead.quotationCreateFailed")}
          messageType="error"
        />
        {renderPreviewPage()}
      </>
    );
  }

  return (
    <div className="card_overall_container mt-4">
      <CustomToast ref={toastRef} message={t("fireLead.leadCreatedSuccess")} />
      <CustomToast
        ref={toastErrorRef}
        message={t("fireLead.failedToCreateLead")}
        messageType="error"
      />
      <Card title={currentStep === 1 ? t("fireLead.createLeadPersonalDetails") : currentStep === 2 ? t("fireLead.createLeadRiskDetails") : t("fireLead.createQuoteSumInsuredPremium")}>
        {currentStep === 1 && renderPersonalDetails()}
        {currentStep === 2 && renderRiskDetails()}
        {currentStep === 3 && renderSumInsuredAndPremium()}
      </Card>
    </div>
  );
};

export default FireLeadCreationCard;
