import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isValidMobile, mobileHint, normalizeMobile } from "../../../utility/phoneFormat";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { RadioButton } from "primereact/radiobutton";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import InputTextField from "../../component/inputText";
import DropdownField from "../../component/DropdwonField";
import DatepickerField from "../../component/datePicker";
import CustomToast from "../../../components/Toast";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import SvgCountPlusIcon from "../../../assets/icons/SvgCountPlusIcon";
import SvgCountMinusIcon from "../../../assets/icons/SvgCountMinusIcon";
import leadService from "../../../services/leadService";
import quotationService from "../../../services/quotationService";
import addressService from "../../../services/addressService";
import { isThailand } from "../../../utility/addressHelpers";
import { getLeadByIdMiddleware } from "../Store/leadMiddleware";
import CommissionReferralSection, {
  defaultCommissionDetails,
} from "../../quoteModule/orderSummary/CommissionReferralSection";
import { formatCurrency } from "../../../utility/currencyConverter";
import "../../quoteModule/quoteDetailView/index.scss";
import "../../quoteModule/orderSummary/index.scss";
import "./IarLeadCreationCard.scss";
import {
  IAR_PRODUCT_TYPE,
  IAR_PRODUCT_CODE,
  IAR_SECTION_CATALOG,
  IAR_SECTION_SUGGESTIONS,
  buildPremiumSectionsFromRisks,
  makeId,
  recalculateIarPremiumDetails,
} from "./iarConstants";
import { birthDateError, birthDateRange, toIsoDate, useAgeLimits } from "../../../utility/birthDate";
import useTaxRates from "../../quoteModule/utils/useTaxRates";

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

const getPersonalDetailsValidation = (t, ageLimits) => (values) => {
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
  } else if (!isValidMobile(values.ContactNumber)) {
    errors.ContactNumber = `${t("fireLead.invalidPhone")} (e.g. ${mobileHint()})`;
  }
  if (!values.HouseNo) errors.HouseNo = t("fireLead.fieldRequired");
  if (!values.Barangay) errors.Barangay = t("fireLead.fieldRequired");
  if (!values.Country) errors.Country = t("fireLead.fieldRequired");
  if (!values.Province) errors.Province = t("fireLead.fieldRequired");
  if (!values.City) errors.City = t("fireLead.fieldRequired");
  if (!values.ZIPCode) errors.ZIPCode = t("fireLead.fieldRequired");
  if (!values.DateofBirth) errors.DateofBirth = t("fireLead.fieldRequired");
  else if (birthDateError(values.DateofBirth, ageLimits)) errors.DateofBirth = birthDateError(values.DateofBirth, ageLimits);
  if (!values.category) errors.category = t("fireLead.fieldRequired");
  if (!values.gender) errors.gender = t("fireLead.fieldRequired");
  return errors;
};

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
      ? typeof lead.DOB === "string"
        ? new Date(lead.DOB)
        : lead.DOB
      : "",
    category: lead.leadCategory || lead.category || "Retail",
    gender: lead.gender || "Male",
  };
};

const IarLeadCreationCard = ({ step, onStepChange }) => {
  const { t } = useTranslation();
  // VAT from Master > Configuration > Taxes (tax.vat_rate), the rate the server prices the quotation with
  const taxRates = useTaxRates();
  const vatPercentConfigured = Number(((Number(taxRates.valueAddedTax) || 0) * 100).toFixed(4));
  const ageLimits = useAgeLimits();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const toastErrorRef = useRef(null);
  const setStep = onStepChange;
  const currentStep = step;

  const existingLeadFromState = location.state?.lead;
  const existingLeadRefId =
    location.state?.leadRefId ||
    location.state?.leadId ||
    existingLeadFromState?.id;

  const currentLeadDetails = useSelector(
    (state) => state.leadReducers?.currentLeadDetails
  );

  const [createdLeadId, setCreatedLeadId] = useState(null);
  const [createdQuotationId, setCreatedQuotationId] = useState(null);
  const [quotationStatus, setQuotationStatus] = useState("Draft");
  const [show, setShow] = useState(
    (existingLeadFromState?.leadCategory || existingLeadFromState?.category) ===
      "Corporate"
  );
  const [iarSections, setIarSections] = useState([]);
  const [selectedSectionCode, setSelectedSectionCode] = useState(
    IAR_SECTION_CATALOG[0]?.sectionCode || "MOTOR"
  );
  const [premiumDetails, setPremiumDetails] = useState({
    sections: [],
    vatPercent: vatPercentConfigured,
    discount: 0,
    discountPercent: 0,
  });
  // The configured rate arrives after the first render: re-price with it
  useEffect(() => {
    setPremiumDetails((prev) => (prev.vatPercent === vatPercentConfigured ? prev : recalculateIarPremiumDetails({ ...prev, vatPercent: vatPercentConfigured })));
  }, [vatPercentConfigured]);
  const [discountPct, setDiscountPct] = useState(0);
  const [commissionDetails, setCommissionDetails] = useState(
    defaultCommissionDetails()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [countryList, setCountryList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [districtList, setDistrictList] = useState([]);
  const [postalLookupLoading, setPostalLookupLoading] = useState(false);

  useEffect(() => {
    if (existingLeadRefId && !existingLeadFromState) {
      dispatch(getLeadByIdMiddleware(existingLeadRefId));
    }
  }, [dispatch, existingLeadRefId, existingLeadFromState]);

  const personalFormik = useFormik({
    initialValues: existingLeadFromState
      ? leadToPersonalFormValues(existingLeadFromState)
      : personalDetailsInitialValue,
    enableReinitialize: true,
    validate: getPersonalDetailsValidation(t, ageLimits),
    onSubmit: async (values) => {
      if (existingLeadRefId) {
        setCreatedLeadId(existingLeadRefId);
        setStep(2);
        return;
      }
      setIsSaving(true);
      try {
        const payload = {
          lob: "IAR",
          companyName: values.CompanyName || null,
          taxInformationNumber: values.TaxNumber || null,
          firstName: values.FirstName,
          lastName: values.LastName,
          preferredName: values.PreferredName,
          emailId: values.EmailID,
          contactNumber: normalizeMobile(values.ContactNumber),
          houseNo: values.HouseNo,
          barangay: values.Barangay,
          country:
            typeof values.Country === "object"
              ? values.Country?.label
              : values.Country,
          province:
            typeof values.Province === "object"
              ? values.Province?.label
              : values.Province,
          city:
            typeof values.City === "object" ? values.City?.label : values.City,
          zipCode: values.ZIPCode,
          roadThanon: values.RoadThanon || undefined,
          soiAlley: values.SoiAlley || undefined,
          mooVillage: values.MooVillage || undefined,
          DOB: values.DateofBirth
            ? typeof values.DateofBirth === "string"
              ? values.DateofBirth
              : toIsoDate(values.DateofBirth)
            : "",
          leadCategory: values.category || "Retail",
          gender: values.gender || "Male",
        };
        const result = await leadService.createIarLead(payload);
        if (!result.success) {
          throw new Error(
            result.error || t("iarLead.failedCreateLead", "Failed to create lead")
          );
        }
        const lead =
          result.data?.data?.lead ||
          result.data?.lead ||
          result.data?.data ||
          result.data;
        const leadId = lead?.id || lead?.leadId || result.data?.id;
        if (!leadId) {
          throw new Error(t("iarLead.leadNoId", "Lead created but no ID returned"));
        }
        setCreatedLeadId(leadId);
        toastRef.current?.showToast({
          detail: t("iarLead.leadCreated", "IAR lead created"),
        });
        setStep(2);
      } catch (error) {
        toastErrorRef.current?.showToast({
          severity: "error",
          detail: error.message,
        });
      } finally {
        setIsSaving(false);
      }
    },
  });

  useEffect(() => {
    if (existingLeadRefId && currentLeadDetails && !existingLeadFromState) {
      const leadId =
        currentLeadDetails.generatedLeadId ||
        currentLeadDetails.leadId ||
        currentLeadDetails.id;
      if (String(leadId) === String(existingLeadRefId)) {
        personalFormik.setValues(leadToPersonalFormValues(currentLeadDetails));
        if (
          (currentLeadDetails.leadCategory || currentLeadDetails.category) ===
          "Corporate"
        ) {
          setShow(true);
        }
      }
    }
  }, [existingLeadRefId, currentLeadDetails, existingLeadFromState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await addressService.getCountries();
      if (!cancelled && res.success && res.data) {
        setCountryList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCountryId = countryList.find(
    (c) =>
      (c.name || c.code) === personalFormik.values.Country ||
      c.id === personalFormik.values.Country
  )?.id;
  const selectedProvinceId = provinceList.find(
    (p) =>
      (p.name || p.code) === personalFormik.values.Province ||
      p.id === personalFormik.values.Province
  )?.id;
  const selectedCityId = cityList.find(
    (c) =>
      (c.name || c.code) === personalFormik.values.City ||
      c.id === personalFormik.values.City
  )?.id;

  useEffect(() => {
    if (!selectedCountryId) {
      setProvinceList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getProvincesByCountry(selectedCountryId);
      if (!cancelled && res.success && res.data) {
        setProvinceList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId]);

  useEffect(() => {
    if (!selectedProvinceId) {
      setCityList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getCitiesByProvince(selectedProvinceId);
      if (!cancelled && res.success && res.data) {
        setCityList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProvinceId]);

  useEffect(() => {
    if (!selectedCityId || !isThailand(personalFormik.values.Country)) {
      setDistrictList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getDistrictsByCity(selectedCityId);
      if (!cancelled && res.success && res.data) {
        setDistrictList(Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      const res = await addressService.getPostalCodeLookup(
        countryCode || "TH",
        zip
      );
      if (res.success && res.data && res.data.length > 0) {
        const first = res.data[0];
        personalFormik.setFieldValue(
          "Province",
          first.province ?? first.Province ?? ""
        );
        personalFormik.setFieldValue("City", first.city ?? first.City ?? "");
        personalFormik.setFieldValue(
          "Barangay",
          first.district ?? first.District ?? ""
        );
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

  const policyFormik = useFormik({
    initialValues: {
      isCoInsurance: false,
      insuranceCompanyName: "",
      accountCode: "",
      paymentType: "Cash",
    },
    onSubmit: () => {},
  });

  const sectionOptions = useMemo(
    () =>
      IAR_SECTION_CATALOG.map((s) => ({
        label: s.sectionLabel,
        value: s.sectionCode,
      })),
    []
  );

  const calculatedPremium = useMemo(
    () => recalculateIarPremiumDetails(premiumDetails),
    [premiumDetails]
  );

  const addSection = () => {
    const catalog = IAR_SECTION_CATALOG.find(
      (s) => s.sectionCode === selectedSectionCode
    );
    if (!catalog) return;
    setIarSections((prev) => [
      ...prev,
      {
        id: makeId(),
        sectionCode: catalog.sectionCode,
        sectionLabel: catalog.sectionLabel,
        riskLocation: "",
        remarks: "",
      },
    ]);
  };

  const removeSection = (id) => {
    setIarSections((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSectionField = (id, field, value) => {
    setIarSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const goToSiStep = () => {
    if (!iarSections.length) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: t("iarLead.addOneSection", "Add at least one section"),
      });
      return;
    }
    setPremiumDetails((prev) =>
      recalculateIarPremiumDetails({
        ...prev,
        vatPercent: vatPercentConfigured,
        sections: buildPremiumSectionsFromRisks(iarSections),
      })
    );
    setStep(3);
  };

  const updateSectionRate = (sectionId, ratePercent) => {
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) =>
        s.sectionId === sectionId ? { ...s, ratePercent } : s
      );
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const addItem = (sectionId, name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) => {
        if (s.sectionId !== sectionId) return s;
        return {
          ...s,
          items: [
            ...(s.items || []),
            { id: makeId(), name: trimmed, itemSumInsured: 0, perils: [] },
          ],
        };
      });
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const removeItem = (sectionId, itemId) => {
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) => {
        if (s.sectionId !== sectionId) return s;
        return {
          ...s,
          items: (s.items || []).filter((i) => i.id !== itemId),
        };
      });
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const addPeril = (sectionId, itemId, name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) => {
        if (s.sectionId !== sectionId) return s;
        return {
          ...s,
          items: (s.items || []).map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              perils: [
                ...(item.perils || []),
                { id: makeId(), name: trimmed, sumInsured: 0 },
              ],
            };
          }),
        };
      });
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const updatePerilSi = (sectionId, itemId, perilId, sumInsured) => {
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) => {
        if (s.sectionId !== sectionId) return s;
        return {
          ...s,
          items: (s.items || []).map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              perils: (item.perils || []).map((p) =>
                p.id === perilId
                  ? { ...p, sumInsured: Number(sumInsured) || 0 }
                  : p
              ),
            };
          }),
        };
      });
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const removePeril = (sectionId, itemId, perilId) => {
    setPremiumDetails((prev) => {
      const sections = (prev.sections || []).map((s) => {
        if (s.sectionId !== sectionId) return s;
        return {
          ...s,
          items: (s.items || []).map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              perils: (item.perils || []).filter((p) => p.id !== perilId),
            };
          }),
        };
      });
      return recalculateIarPremiumDetails({ ...prev, sections });
    });
  };

  const validatePremiumBeforeCreate = () => {
    const sections = calculatedPremium.sections || [];
    if (!sections.length) return false;
    for (const sec of sections) {
      if (!sec.items?.length) {
        toastErrorRef.current?.showToast({
          severity: "error",
          detail: t(
            "iarLead.sectionNeedsItem",
            `${sec.sectionLabel} needs at least one item`
          ),
        });
        return false;
      }
      for (const item of sec.items) {
        if (!item.perils?.length) {
          toastErrorRef.current?.showToast({
            severity: "error",
            detail: t(
              "iarLead.itemNeedsPeril",
              `${item.name} needs at least one peril`
            ),
          });
          return false;
        }
      }
    }
    return true;
  };

  const handleCreateQuotation = async () => {
    if (!createdLeadId || !validatePremiumBeforeCreate()) return;
    setIsSaving(true);
    try {
      const premium = recalculateIarPremiumDetails({
        ...calculatedPremium,
        vatPercent: vatPercentConfigured,
        discount: 0,
        discountPercent: 0,
      });
      const result = await quotationService.createIarQuotation({
        leadRefId: createdLeadId,
        productType: IAR_PRODUCT_TYPE,
        insurancePolicyType: IAR_PRODUCT_CODE,
        quotationStatus: "Draft",
        iarSections,
        iarPremiumDetails: premium,
        totalSumInsured: String(premium.totalSumInsured),
        netPremium: String(premium.totalPremiumPreLevy),
        valueAddedTax: String(premium.valueAddedTax),
        discount: String(premium.discount),
        grossPremium: String(premium.totalPremiumLevyInclusive),
      });
      if (!result.success) {
        throw new Error(result.error || t("iarLead.failedCreateQuote", "Failed to create quotation"));
      }
      const quotation =
        result.data?.data?.quotation ||
        result.data?.quotation ||
        result.data?.data ||
        result.data;
      const qid = quotation?.id || quotation?.quotationId;
      if (!qid) throw new Error(t("iarLead.quoteNoId", "Quotation created but no ID returned"));
      setCreatedQuotationId(qid);
      setPremiumDetails(premium);
      setQuotationStatus("Draft");
      toastRef.current?.showToast({
        detail: t("iarLead.quoteCreated", "IAR quotation created"),
      });
      setStep(4);
    } catch (error) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyDiscountPercent = (pct) => {
    const capped = Math.max(0, Math.min(30, pct));
    setDiscountPct(capped);
    const base = calculatedPremium.totalPremiumPreLevy || 0;
    const discountAmount = Number(((base * capped) / 100).toFixed(2));
    setPremiumDetails((prev) =>
      recalculateIarPremiumDetails({
        ...prev,
        discountPercent: capped,
        discount: discountAmount,
        vatPercent: vatPercentConfigured,
      })
    );
  };

  const persistScheduleAndCommercial = async () => {
    if (!createdQuotationId) {
      throw new Error(t("iarLead.quotationNotCreated", "Quotation not created yet"));
    }
    const premium = recalculateIarPremiumDetails({
      ...calculatedPremium,
      vatPercent: vatPercentConfigured,
    });
    const values = policyFormik.values;
    const result = await quotationService.updateIarQuotation(createdQuotationId, {
      iarSections,
      iarPremiumDetails: premium,
      insurancePolicyType: IAR_PRODUCT_CODE,
      isCoInsurance: values.isCoInsurance,
      accountCode: values.accountCode || undefined,
      paymentType: values.paymentType || undefined,
      commissionDetails,
      totalSumInsured: String(premium.totalSumInsured),
      netPremium: String(premium.totalPremiumPreLevy),
      valueAddedTax: String(premium.valueAddedTax),
      discount: String(premium.discount),
      grossPremium: String(premium.totalPremiumLevyInclusive),
      participantDetails: values.insuranceCompanyName
        ? [
            {
              insuranceCompanyName: values.insuranceCompanyName,
              participantName: values.insuranceCompanyName,
              sharePercentage: "100",
            },
          ]
        : undefined,
    });
    if (!result.success) {
      throw new Error(result.error || t("iarLead.failedUpdateQuote", "Failed to update quotation"));
    }
    setPremiumDetails(premium);
    return premium;
  };

  const handleLeadNavigation = () => {
    if (createdLeadId || existingLeadRefId) {
      const leadId = createdLeadId || existingLeadRefId;
      navigate(`/agent/quotelisting?leadRefId=${leadId}`);
    } else {
      navigate("/agent/leadlisting");
    }
  };

  const handleSendToCustomer = async () => {
    setIsSending(true);
    try {
      await persistScheduleAndCommercial();
      const result = await quotationService.sendQuotationForApproval(
        createdQuotationId
      );
      if (result.success) {
        setQuotationStatus("PendingCustomer");
        toastRef.current?.showToast({
          detail: t("iarLead.quoteSentToCustomer", "Quote sent to customer for approval"),
        });
      } else if (result.error?.includes?.("PendingCustomer")) {
        setQuotationStatus("PendingCustomer");
        toastRef.current?.showToast({
          detail: t("iarLead.quoteAlreadySentWaiting", "Quote already sent — waiting for customer"),
        });
      } else {
        throw new Error(result.error || t("iarLead.failedToSendQuote", "Failed to send quote"));
      }
    } catch (error) {
      toastErrorRef.current?.showToast({
        severity: "error",
        detail: error.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const fetchQuotationStatus = useCallback(async () => {
    if (!createdQuotationId) return;
    try {
      const result = await quotationService.getQuotationById(createdQuotationId);
      if (result.success && result.data) {
        const status =
          result.data?.quotationStatus || result.data?.data?.quotationStatus;
        if (status) setQuotationStatus(status);
      }
    } catch (err) {
      console.warn("Failed to fetch quotation status:", err);
    }
  }, [createdQuotationId]);

  useEffect(() => {
    if (currentStep === 4 && createdQuotationId) fetchQuotationStatus();
  }, [currentStep, createdQuotationId, fetchQuotationStatus]);

  const formatMoney = (v) => formatCurrency(v);

  const renderStep1 = () => (
    <>
      <div className="subheadinglabel_txt mt-3">{t("fireLead.selectCategory")}</div>
      <div className="flex flex-wrap gap-3 mt-3">
        <div className="flex align-items-center">
          <RadioButton
            inputId="iar-individual"
            name="category"
            value="Retail"
            onChange={() => {
              personalFormik.setFieldValue("category", "Retail");
              setShow(false);
            }}
            checked={personalFormik.values.category === "Retail"}
          />
          <label htmlFor="iar-individual" className="labeltxt_container">
            {t("fireLead.individual")}
          </label>
        </div>
        <div className="flex align-items-center">
          <RadioButton
            inputId="iar-company"
            name="category"
            value="Corporate"
            onChange={() => {
              personalFormik.setFieldValue("category", "Corporate");
              setShow(true);
            }}
            checked={personalFormik.values.category === "Corporate"}
          />
          <label htmlFor="iar-company" className="labeltxt_container">
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
            {...birthDateRange(ageLimits)}
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
            inputId="iar-male"
            name="gender"
            value="Male"
            onChange={() => personalFormik.setFieldValue("gender", "Male")}
            checked={personalFormik.values.gender === "Male"}
          />
          <label htmlFor="iar-male" className="labeltxt_container">
            {t("fireLead.male")}
          </label>
        </div>
        <div className="flex align-items-center gap-2 checkbox_container">
          <RadioButton
            inputId="iar-female"
            name="gender"
            value="Female"
            onChange={() => personalFormik.setFieldValue("gender", "Female")}
            checked={personalFormik.values.gender === "Female"}
          />
          <label htmlFor="iar-female" className="labeltxt_container">
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
            inputMode="tel"
            hint={mobileHint()}
          />
          {personalFormik.touched.ContactNumber &&
            personalFormik.errors.ContactNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {personalFormik.errors.ContactNumber}
              </div>
            )}
        </div>
      </div>

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
            label={
              isThailand(personalFormik.values.Country)
                ? t("fireLead.postalCode")
                : t("fireLead.zipCode")
            }
            value={personalFormik.values.ZIPCode}
            onChange={personalFormik.handleChange("ZIPCode")}
            onBlur={handlePostalCodeLookup}
          />
          {postalLookupLoading && (
            <div style={{ fontSize: 12, color: "#666" }} className="mt-1">
              {t("fireLead.lookupInProgress")}
            </div>
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
            label={
              isThailand(personalFormik.values.Country)
                ? t("fireLead.provinceChangwat")
                : t("fireLead.province")
            }
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
            label={
              isThailand(personalFormik.values.Country)
                ? t("fireLead.districtAmphoe")
                : t("fireLead.city")
            }
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
          {isThailand(personalFormik.values.Country) &&
          districtList.length > 0 ? (
            <DropdownField
              label={t("fireLead.subDistrictTambon")}
              value={personalFormik.values.Barangay}
              options={availableDistricts}
              onChange={(e) =>
                personalFormik.setFieldValue("Barangay", e.value)
              }
              disabled={!personalFormik.values.City}
            />
          ) : (
            <InputTextField
              label={
                isThailand(personalFormik.values.Country)
                  ? t("fireLead.subDistrictTambon")
                  : t("fireLead.barangay")
              }
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
            loading={isSaving}
          />
        </div>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="subheadinglabel_txt mt-3">
        {t("iarLead.risksTitle", "RISKS — SECTIONS COVERED BY THIS POLICY")}
      </div>
      <p className="iar-help-text">
        {t(
          "iarLead.risksHelp",
          "One policy, many independent sections. Add any section — more than once if the same risk sits at more than one location."
        )}
      </p>
      <div className="flex align-items-end gap-2 mt-3 flex-wrap">
        <div style={{ minWidth: 260 }}>
          <label className="labeltxt_container">{t("iarLead.addSection", "Add section")}</label>
          <Dropdown
            className="w-full"
            value={selectedSectionCode}
            options={sectionOptions}
            onChange={(e) => setSelectedSectionCode(e.value)}
          />
        </div>
        <Button
          label={t("iarLead.addSectionBtn", "+ Add section")}
          onClick={addSection}
        />
      </div>
      <div className="mt-3">
        <DataTable value={iarSections} emptyMessage={t("iarLead.noSections", "No sections yet — add one above.")}>
          <Column
            header="#"
            body={(_, opts) => opts.rowIndex + 1}
            style={{ width: 48 }}
          />
          <Column field="sectionLabel" header={t("iarLead.section", "SECTION")} />
          <Column
            header={t("iarLead.riskLocation", "Risk Details")}
            body={(row) => (
              <InputText
                className="w-full"
                value={row.riskLocation}
                placeholder={t("iarLead.riskLocationPh", "e.g. Plant 1")}
                onChange={(e) =>
                  updateSectionField(row.id, "riskLocation", e.target.value)
                }
              />
            )}
          />
          <Column
            header={t("iarLead.remarks", "REMARKS")}
            body={(row) => (
              <InputText
                className="w-full"
                value={row.remarks}
                placeholder={t("iarLead.remarksPh", "Optional note")}
                onChange={(e) =>
                  updateSectionField(row.id, "remarks", e.target.value)
                }
              />
            )}
          />
          <Column
            header=""
            body={(row) => (
              <Button
                link
                className="p-button-danger p-0"
                label={t("common.delete", "Delete")}
                onClick={() => removeSection(row.id)}
              />
            )}
          />
        </DataTable>
        <div className="mt-2 labeltxt_container">
          {t("iarLead.sectionsCount", "{{count}} sections on this policy.", {
            count: iarSections.length,
          })}
        </div>
      </div>
      <div className="flex justify-content-between gap-2 mt-4">
        <Button
          label={t("common.back", "Back")}
          outlined
          onClick={() => setStep(1)}
        />
        <Button label={t("common.continue", "Continue")} onClick={goToSiStep} />
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="subheadinglabel_txt mt-3">
        {t("iarLead.sumInsuredPremium", "SUMS INSURED & PREMIUM")}
      </div>
      <p className="iar-help-text">
        {t(
          "iarLead.siHelp",
          "Each section covers one or more items, and each item is covered against perils that carry the sums insured. Section premium = sum insured × rate (mock rating)."
        )}
      </p>
      {(calculatedPremium.sections || []).map((section) => {
        const suggestions =
          IAR_SECTION_SUGGESTIONS[section.sectionCode] || { items: [], perils: [] };
        return (
          <Card key={section.sectionId} className="mt-3 iar-section-card">
            <div className="policy_text mb-2">{section.sectionLabel}</div>
            <div className="grid">
              <div className="col-12 md:col-4">
                <label className="insurance_text">
                  {t("iarLead.sectionSumInsured", "Section sum insured")}
                </label>
                <div className="alpha_text">{formatMoney(section.sectionSumInsured)}</div>
              </div>
              <div className="col-12 md:col-4">
                <label className="insurance_text">
                  {t("iarLead.ratePercent", "Rate (%)")}
                </label>
                <InputNumber
                  className="w-full"
                  value={section.ratePercent}
                  min={0}
                  maxFractionDigits={4}
                  onValueChange={(e) =>
                    updateSectionRate(section.sectionId, e.value ?? 0)
                  }
                />
                <small className="iar-help-text">
                  {t("iarLead.mockRating", "mock rating")}
                </small>
              </div>
              <div className="col-12 md:col-4">
                <label className="insurance_text">
                  {t("iarLead.sectionPremium", "Section premium")}
                </label>
                <div className="alpha_text">{formatMoney(section.sectionPremium)}</div>
              </div>
            </div>
            {(section.items || []).map((item) => (
              <div key={item.id} className="iar-item-block mt-3">
                <div className="flex justify-content-between align-items-center">
                  <div>
                    <span className="iar-item-tag">{t("iarLead.item", "ITEM")}</span>{" "}
                    <span className="policy_text">{item.name}</span>
                  </div>
                  <div className="flex align-items-center gap-2">
                    <span className="insurance_text">
                      {t("iarLead.itemSumInsured", "Item sum insured")}{" "}
                      {formatMoney(item.itemSumInsured)}
                    </span>
                    <Button
                      icon="pi pi-times"
                      text
                      rounded
                      severity="danger"
                      onClick={() => removeItem(section.sectionId, item.id)}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="insurance_text">
                    {t("iarLead.perilsCovered", "Perils covered")}
                  </label>
                  {(item.perils || []).map((peril) => (
                    <div
                      key={peril.id}
                      className="flex align-items-center gap-2 mt-2 flex-wrap"
                    >
                      <span className="alpha_text" style={{ minWidth: 180 }}>
                        {peril.name}
                      </span>
                      <InputNumber
                        value={peril.sumInsured}
                        min={0}
                        mode="decimal"
                        onValueChange={(e) =>
                          updatePerilSi(
                            section.sectionId,
                            item.id,
                            peril.id,
                            e.value
                          )
                        }
                        placeholder={t("iarLead.sumInsured", "Sum insured")}
                      />
                      <Button
                        icon="pi pi-times"
                        text
                        rounded
                        severity="danger"
                        onClick={() =>
                          removePeril(section.sectionId, item.id, peril.id)
                        }
                      />
                    </div>
                  ))}
                  <PerilAdder
                    suggestions={suggestions.perils}
                    onAdd={(name) => addPeril(section.sectionId, item.id, name)}
                    t={t}
                  />
                </div>
              </div>
            ))}
            <ItemAdder
              suggestions={suggestions.items}
              onAdd={(name) => addItem(section.sectionId, name)}
              t={t}
            />
          </Card>
        );
      })}
      <div className="iar-totals-bar mt-3">
        <div>
          {t("iarLead.totalSumInsuredAll", "Total sum insured (all sections)")}:{" "}
          <strong>{formatMoney(calculatedPremium.totalSumInsured)}</strong>
        </div>
        <div>
          {t("iarLead.totalPremiumPreLevy", "Total premium (pre-levy)")}:{" "}
          <strong>{formatMoney(calculatedPremium.totalPremiumPreLevy)}</strong>
        </div>
      </div>
      <div className="flex justify-content-between gap-2 mt-4">
        <Button label={t("common.back", "Back")} outlined onClick={() => setStep(2)} />
        <Button
          label={t("common.continue", "Continue")}
          loading={isSaving}
          onClick={handleCreateQuotation}
        />
      </div>
    </>
  );

  const renderStep4 = () => {
    const premium = calculatedPremium;
    return (
      <div className="overall__quotedetails__view__container">
        <div className="header_title">{t("agent.leads", "Leads")}</div>
        <div
          onClick={handleLeadNavigation}
          className="left_arrow mt-3 cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="left_arrow_text">
            {t("fireLead.leadIdColon", "Lead ID:")}{" "}
            {createdLeadId || existingLeadRefId || t("policyDetail.nA", "N/A")}
          </div>
        </div>

        <div className="grid mt-3">
          <div className="col-12 lg:col-7">
            <Card className="mt-2">
              <div className="table_header">
                {t("quoteDetailView.quoteDetails", "Quote Details")}
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("iarLead.productCode", "Product Code")}
                </label>
                <label className="alpha_text">{IAR_PRODUCT_CODE}</label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("quoteDetailView.insurancePolicyType", "Insurance Policy Type")}
                </label>
                <label className="alpha_text">{IAR_PRODUCT_TYPE}</label>
              </div>

              <div className="sub_title mt-3">
                <label className="policy_text">
                  {t("iarLead.scheduleOfCover", "Schedule of Cover")}
                </label>
              </div>
              <table className="iar-schedule-table w-full">
                <thead>
                  <tr>
                    <th>
                      {t("iarLead.sectionItemPerils", "SECTION / ITEM / PERILS")}
                    </th>
                    <th>{t("iarLead.sumInsured", "SUM INSURED")}</th>
                    <th>{t("iarLead.premium", "PREMIUM")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(premium.sections || []).map((section) => (
                    <React.Fragment key={section.sectionId}>
                      <tr className="iar-section-row">
                        <td>
                          <strong>{section.sectionLabel}</strong>
                          <div className="iar-help-text">
                            {t("iarLead.rate", "rate")} {section.ratePercent}%
                          </div>
                        </td>
                        <td>{formatMoney(section.sectionSumInsured)}</td>
                        <td>{formatMoney(section.sectionPremium)}</td>
                      </tr>
                      {(section.items || []).map((item) => (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={{ paddingLeft: 16 }}>
                              Item: {item.name}
                            </td>
                            <td>{formatMoney(item.itemSumInsured)}</td>
                            <td />
                          </tr>
                          {(item.perils || []).map((p) => (
                            <tr key={p.id}>
                              <td style={{ paddingLeft: 28 }}>{p.name}</td>
                              <td>{formatMoney(p.sumInsured)}</td>
                              <td />
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr>
                    <td>
                      <strong>{t("common.total", "Total")}</strong>
                    </td>
                    <td>
                      <strong>{formatMoney(premium.totalSumInsured)}</strong>
                    </td>
                    <td>
                      <strong>
                        {formatMoney(premium.totalPremiumPreLevy)}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="sub_title mt-3">
                <label className="policy_text">
                  {t("iarLead.coverageAndPremium", "Coverage & Premium")}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("iarLead.totalPremiumPreLevy", "Total premium (pre-levy)")}
                </label>
                <label className="alpha_text">
                  {formatMoney(premium.totalPremiumPreLevy)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("agent.valueAddedTax", "Value Added Tax")} ({vatPercentConfigured}
                  %)
                </label>
                <label className="alpha_text">
                  {formatMoney(premium.valueAddedTax)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("agent.discount", "Discount")}
                </label>
                <label className="alpha_text">
                  {formatMoney(premium.discount)}
                </label>
              </div>
              <div className="quote_details">
                <label className="insurance_text">
                  {t("iarLead.totalSumInsured", "Total Sum Insured")}
                </label>
                <label className="alpha_text">
                  {formatMoney(premium.totalSumInsured)}
                </label>
              </div>
              <div className="quote_details">
                <label className="gross_text">
                  {t(
                    "iarLead.totalPremiumLevyInclusive",
                    "Total Premium (levy-inclusive)"
                  )}
                </label>
                <label className="gross_count">
                  {formatMoney(premium.totalPremiumLevyInclusive)}
                </label>
              </div>
            </Card>
          </div>

          <div className="col-12 lg:col-5">
            <div className="order__summary__container mt-2">
              <div className="discount__dynamic__card">
                <div className="discount__dynamic__card__title">
                  {t("agent.discountOptional", "Discount (optional)")}
                </div>
                <div className="discount__dynamic__card__subtitle">
                  {t(
                    "agent.enterDiscountForCustomer",
                    "Enter discount for the customer"
                  )}
                </div>
                <div className="discount__dynamic__card__bottom">
                  <div
                    className="cursor-pointer"
                    onClick={() => applyDiscountPercent(discountPct - 5)}
                  >
                    <SvgCountMinusIcon />
                  </div>
                  <div className="discount__reflection__text">
                    {`${discountPct}%`}
                  </div>
                  <div
                    className="cursor-pointer"
                    onClick={() => applyDiscountPercent(discountPct + 5)}
                  >
                    <SvgCountPlusIcon />
                  </div>
                </div>
              </div>
              <div
                className="discount__action__container"
                style={{ color: "green" }}
              >
                <div className="discount__action__text">
                  {t("agent.minPercent", "Min 0%")}
                </div>
                <div className="discount__action__text">
                  {t("agent.maxPercent", "Max 30%")}
                </div>
              </div>
              <div className="mt-2">
                <CommissionReferralSection
                  value={commissionDetails}
                  onChange={setCommissionDetails}
                  netPremium={premium.totalPremiumPreLevy}
                  discount={premium.discount}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="button_component fire-quote-preview-actions mt-4">
          <Button
            label={t("agent.back", "Back")}
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
              <i className="pi pi-clock" style={{ marginRight: "8px" }} />
              {t(
                "quoteDetailView.waitingForCustomerApproval",
                "Waiting for customer approval"
              )}
            </div>
          ) : (
            <Button
              label={t(
                "quoteDetailView.sendForCustomerApproval",
                "Send for Customer Approval"
              )}
              icon="pi pi-send"
              className="p-button-success fire-preview-btn"
              loading={isSending}
              disabled={quotationStatus !== "Draft" || !createdQuotationId}
              onClick={handleSendToCustomer}
            />
          )}
          {quotationStatus !== "CustomerAccepted" &&
            quotationStatus !== "Approved" && (
              <Button
                label={t("fireLead.refreshStatus", "Refresh status")}
                icon="pi pi-refresh"
                className="p-button-text p-button-sm"
                onClick={fetchQuotationStatus}
              />
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3">
      <CustomToast ref={toastRef} position="top-right" />
      <CustomToast ref={toastErrorRef} position="top-right" />
      {currentStep === 4 ? (
        renderStep4()
      ) : (
        <Card>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </Card>
      )}
    </div>
  );
};

const ItemAdder = ({ suggestions, onAdd, t }) => {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2 mt-3 flex-wrap align-items-center">
      <Dropdown
        className="iar-adder-dd"
        value={value}
        options={(suggestions || []).map((s) => ({ label: s, value: s }))}
        editable
        placeholder={t(
          "iarLead.chooseItem",
          "Choose or type an item — e.g. Building"
        )}
        onChange={(e) => setValue(e.value)}
      />
      <Button
        label={t("iarLead.addItem", "+ Add item")}
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
      />
    </div>
  );
};

const PerilAdder = ({ suggestions, onAdd, t }) => {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2 mt-2 flex-wrap align-items-center">
      <Dropdown
        className="iar-adder-dd"
        value={value}
        options={(suggestions || []).map((s) => ({ label: s, value: s }))}
        editable
        placeholder={t(
          "iarLead.choosePeril",
          "Choose a peril or type your own"
        )}
        onChange={(e) => setValue(e.value)}
      />
      <Button
        label={t("iarLead.addPeril", "+ Add peril")}
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
      />
    </div>
  );
};

export default IarLeadCreationCard;
