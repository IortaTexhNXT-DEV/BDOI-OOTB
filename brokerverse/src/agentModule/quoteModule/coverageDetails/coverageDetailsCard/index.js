import { formatNumber } from "../../../../utility/currencyConverter";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import InputTextField from "../../../component/inputText";
import CalculaitionTextInputs from "../../../component/calculaitionTextInputs";
import DropdownField from "../../../component/DropdwonField";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import customHistory from "../../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  AutopassengerpersonalAccidentOptions,
  BodilyInjuryOptions,
  PropertyDamageOptions,
} from "./mock";
import {
  postcoverageDetailsMiddleware,
} from "../store/coverageDetailsMiddleware";
import { setQuoteCoverageDetails } from "../../Store/quotationReducer";
import {
  computeAllPremiums,
  calculatePremiumBreakdown,
} from "../../utils/premiumCalculations";
import { APPATotalCoverageOptions } from "../../../endorsementModule/personalDetails/mock";
import policyService from "../../../../services/policyService";
import policyRenewalService from "../../../../services/policyRenewalService";
import useTaxRates from "../../utils/useTaxRates";
import { fetchProductTemplateByIdMiddleware } from "../../../../module/ProductConfigurator/store/productConfiguratorMiddleware";

const CoverageDetailsCard = ({
  action,
  flow,
  policyId,
  coInsurance,
  installmentType,
}) => {
  const { t } = useTranslation();
  const normalizeDropdownValue = (value, options) => {
    if (value === undefined || value === null || value === "") {
      return value;
    }

    const valueStr = `${value}`;
    const directMatch = options?.find(
      (option) => `${option.value}` === valueStr
    );

    if (directMatch) {
      return directMatch.value;
    }

    const normalizedValue = valueStr.replace(/,/g, "");
    const numericValue = Number(normalizedValue);

    if (!Number.isNaN(numericValue)) {
      const numericMatch = options?.find((option) => {
        const optionNumeric = Number(`${option.value}`.replace(/,/g, ""));
        return !Number.isNaN(optionNumeric) && optionNumeric === numericValue;
      });

      if (numericMatch) {
        return numericMatch.value;
      }

      return formatNumber(numericValue);
    }

    return valueStr;
  };

  const keepOrFallback = (primary, fallback, defaultValue) => {
    if (primary !== undefined && primary !== null && primary !== "") {
      return primary;
    }

    if (fallback !== undefined && fallback !== null && fallback !== "") {
      return fallback;
    }

    return defaultValue;
  };

  const buildSanitizedCoverageValues = (
    rawValues = {},
    includeAON = true,
    includeRA = true,
    includePAC = true,
    includeCTPL = true
  ) => {
    const normalizedBodilyInjury = normalizeDropdownValue(
      keepOrFallback(
        rawValues?.BodilyInjury,
        renewalCoverageData?.BodilyInjury,
        BodilyInjuryOptions?.[0]?.value
      ),
      BodilyInjuryOptions
    );

    const normalizedPropertyDamage = normalizeDropdownValue(
      keepOrFallback(
        rawValues?.PropertyDamage,
        renewalCoverageData?.PropertyDamage,
        PropertyDamageOptions?.[0]?.value
      ),
      PropertyDamageOptions
    );

    const normalizedAutopassengerAccident = normalizeDropdownValue(
      keepOrFallback(
        rawValues?.AutopassengerpersonalAccident,
        renewalCoverageData?.AutopassengerpersonalAccident,
        AutopassengerpersonalAccidentOptions?.[0]?.value
      ),
      AutopassengerpersonalAccidentOptions
    );

    const normalizedAPPATotalCoverage = normalizeDropdownValue(
      keepOrFallback(
        rawValues?.APPATotalCoverage,
        renewalCoverageData?.APPATotalCoverage,
        APPATotalCoverageOptions?.[0]?.value
      ),
      APPATotalCoverageOptions
    );

    const sanitizedCTPLRate = includeCTPL
      ? keepOrFallback(
          rawValues?.CtplCoverageRate,
          renewalCoverageData?.CtplCoverageRate,
          productConfigurator?.configuration?.ctplSetting?.[vehicleType] || ""
        )
      : "";

    const sanitizedCTPLPremium = includeCTPL
      ? keepOrFallback(
          rawValues?.CtplCoverageRate,
          renewalCoverageData?.CtplCoverageRate,
          ""
        )
      : "";

    const sanitizedActOfNatureRate = includeAON
      ? keepOrFallback(
          rawValues?.ActsofNatureRate,
          renewalCoverageData?.ActsofNatureRate,
          "0.5%"
        )
      : "";

    const sanitizedActOfNaturePremium = includeAON
      ? keepOrFallback(
          rawValues?.ActsofNaturepremium,
          renewalCoverageData?.ActsofNaturepremium,
          ""
        )
      : "";

    const sanitizedRoadsideRate = includeRA
      ? keepOrFallback(
          rawValues?.RoadsideAssistanceRate,
          renewalCoverageData?.RoadsideAssistanceRate,
          productConfigurator?.configuration?.premiumRates
            ?.roadside_assistance || ""
        )
      : "";

    const sanitizedRoadsidePremium = includeRA
      ? keepOrFallback(
          rawValues?.RoadsideAssistancepremium,
          renewalCoverageData?.RoadsideAssistancepremium,
          ""
        )
      : "";

    const sanitizedPersonalAccidentRate = includePAC
      ? keepOrFallback(
          rawValues?.PersonalAccidentCoverRate,
          renewalCoverageData?.PersonalAccidentCoverRate,
          productConfigurator?.configuration?.premiumRates
            ?.personal_accident_cover || ""
        )
      : "";

    const sanitizedPersonalAccidentPremium = includePAC
      ? keepOrFallback(
          rawValues?.PersonalAccidentCoverpremium,
          renewalCoverageData?.PersonalAccidentCoverpremium,
          ""
        )
      : "";

    return {
      ...rawValues,
      LossandDamagecoverage: keepOrFallback(
        rawValues?.LossandDamagecoverage,
        renewalCoverageData?.LossandDamagecoverage,
        formatNumber(100000, { minimumFractionDigits: 2 })
      ),
      LossandDamagecoverageRate: keepOrFallback(
        rawValues?.LossandDamagecoverageRate,
        renewalCoverageData?.LossandDamagecoverageRate,
        "0.8%"
      ),
      CtplCoverageRate: sanitizedCTPLRate,
      ActsofNatureRate: sanitizedActOfNatureRate,
      ActsofNaturepremium: sanitizedActOfNaturePremium,
      RoadsideAssistanceRate: sanitizedRoadsideRate,
      RoadsideAssistancepremium: sanitizedRoadsidePremium,
      PersonalAccidentCoverRate: sanitizedPersonalAccidentRate,
      PersonalAccidentCoverpremium: sanitizedPersonalAccidentPremium,
      BodilyInjury: normalizedBodilyInjury,
      PropertyDamage: normalizedPropertyDamage,
      AutopassengerpersonalAccident: normalizedAutopassengerAccident,
      APPATotalCoverage: normalizedAPPATotalCoverage,
    };
  };

  const {
    currentQuoteCreation,
    loading,
    renewalCoverageData,
    productConfigurator,
  } = useSelector(
    ({
      quotationReducers,
      agentCoverageDetailsReducers,
      productConfiguratorReducer,
    }) => {
      return {
        currentQuoteCreation: quotationReducers?.currentQuoteCreation,
        loading: agentCoverageDetailsReducers?.loading,
        CoverageDetails: agentCoverageDetailsReducers?.CoverageDetails,
        renewalCoverage: agentCoverageDetailsReducers?.renewalCoverage,
        renewalCoverageData:
          agentCoverageDetailsReducers?.renewalCoverage?.data || {},
        renewalLoading:
          agentCoverageDetailsReducers?.renewalCoverage?.loading || false,
        productConfigurator: productConfiguratorReducer?.template,
      };
    }
  );

  useEffect(() => {
    dispatch(
      fetchProductTemplateByIdMiddleware({
        templateCode: "MOT-003-2025",
      })
    );
  }, [flow]);

  const vehicleType =
    currentQuoteCreation?.policyDetails?.vehicleType || "ac_and_tourist_cars";

  const isEditMode = currentQuoteCreation?.isEditMode || false;
  const existingCoverageDetails = currentQuoteCreation?.coverageDetails;

  const initialFormikValues = useMemo(() => {
    if (isEditMode && existingCoverageDetails) {
      return {
        LossandDamagecoverage:
          existingCoverageDetails.lossAndDamageCoverage || "",
        LossandDamagecoverageRate:
          existingCoverageDetails.lossAndDamageCoverageRate ||
          productConfigurator?.configuration?.premiumRates?.[vehicleType] ||
          "",
        LossandDamagecoveragepremium:
          existingCoverageDetails.lossAndDamageCoveragePremium || "",
        ActsofNatureRate:
          existingCoverageDetails.actsOfNatureRate ||
          productConfigurator?.configuration?.premiumRates?.acts_of_nature ||
          "",
        RoadsideAssistanceRate:
          existingCoverageDetails.roadsideAssistanceRate ||
          productConfigurator?.configuration?.premiumRates
            ?.roadside_assistance ||
          "",
        RoadsideAssistancepremium:
          existingCoverageDetails.roadsideAssistancePremium || "",
        PersonalAccidentCoverRate:
          existingCoverageDetails.personalAccidentCoverRate ||
          productConfigurator?.configuration?.premiumRates
            ?.personal_accident_cover ||
          "",
        PersonalAccidentCoverpremium:
          existingCoverageDetails.personalAccidentCoverPremium || "",
        CtplCoverageRate:
          productConfigurator?.configuration?.ctplSetting?.[vehicleType] || "",
        ActsofNaturepremium: existingCoverageDetails.actsOfNaturePremium || "",
        BodilyInjury: existingCoverageDetails.bodilyInjury || "",
        BodilyInjuryCoveragePremium:
          existingCoverageDetails.bodilyInjuryCoveragePremium || "",
        PropertyDamage: existingCoverageDetails.propertyDamage || "",
        PropertyDamageCoveragePremium:
          existingCoverageDetails.propertyDamageCoveragePremium || "",
        AutopassengerpersonalAccident:
          existingCoverageDetails.autoPassengerPersonalAccident || "",
        APPATotalCoverage: existingCoverageDetails.APPAtotalCoverage || "",
        APPACoveragePremium: existingCoverageDetails.APPAcoveragePremium || "",
        TotalSumInsured: existingCoverageDetails.totalSumInsured || "",
      };
    }

    return {
      LossandDamagecoverage: "",
      LossandDamagecoverageRate:
        productConfigurator?.configuration?.premiumRates?.[vehicleType] || "",
      LossandDamagecoveragepremium: "",
      ActsofNatureRate: "",
      ActsofNaturepremium: "",
      RoadsideAssistanceRate: "",
      RoadsideAssistancepremium: "",
      PersonalAccidentCoverRate: "",
      PersonalAccidentCoverpremium: "",
      CtplCoverageRate:
        productConfigurator?.configuration?.ctplSetting?.[vehicleType] || "",
      BodilyInjury: "",
      BodilyInjuryCoveragePremium: "",
      PropertyDamage: "",
      PropertyDamageCoveragePremium: "",
      AutopassengerpersonalAccident: "",
      APPATotalCoverage: "",
      APPACoveragePremium: "",
      TotalSumInsured: "",
    };
  }, [isEditMode, existingCoverageDetails, productConfigurator, vehicleType]);

  // Configured tax rates (app settings) so the gross shown here matches the order summary.
  const settingsTaxRates = useTaxRates();
  // Renewal prefill kept as the form's initial values so a later re-initialisation
  // (enableReinitialize, e.g. when the product template loads) does not wipe it.
  const [renewalValues, setRenewalValues] = useState(null);
  const [show, setshow] = useState(true);
  const [isOverRide, setOverRide] = useState(false);
  const [includeActsOfNature, setIncludeActsOfNature] = useState(
    () => isEditMode && Boolean(existingCoverageDetails?.actsOfNatureRate)
  );
  const [includeRoadsideAssistance, setIncludeRoadsideAssistance] = useState(
    () => isEditMode && Boolean(existingCoverageDetails?.roadsideAssistanceRate)
  );
  const [includePersonalAccident, setIncludePersonalAccident] = useState(
    () =>
      isEditMode && Boolean(existingCoverageDetails?.personalAccidentCoverRate)
  );
  const [includeCTPL, setIncludeCTPL] = useState(() =>
    Boolean(initialFormikValues?.CtplCoverageRate)
  );
  useEffect(() => {
    // The renewal flow sets these from the renewal prefill.
    if (flow === "renewal") return;
    setIncludeActsOfNature(
      isEditMode && Boolean(existingCoverageDetails?.actsOfNatureRate)
    );
    setIncludeRoadsideAssistance(
      isEditMode && Boolean(existingCoverageDetails?.roadsideAssistanceRate)
    );
    setIncludePersonalAccident(
      isEditMode && Boolean(existingCoverageDetails?.personalAccidentCoverRate)
    );
    setIncludeCTPL(Boolean(initialFormikValues?.CtplCoverageRate));
  }, [
    isEditMode,
    existingCoverageDetails?.actsOfNatureRate,
    existingCoverageDetails?.roadsideAssistanceRate,
    existingCoverageDetails?.personalAccidentCoverRate,
    initialFormikValues?.CtplCoverageRate,
    flow,
  ]);
  // Initialize renewalDataLoaded to true if it's a renewal flow to prevent auto-calculate
  const [renewalDataLoaded, setRenewalDataLoaded] = useState(
    flow === "renewal"
  );
  // State for premium breakdown display
  const [premiumBreakdown, setPremiumBreakdown] = useState(null);

  const { state } = useLocation();
  const { id: leadRefId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleclick = (values) => {
    // Prepare coverage details data in proper format
    const coverageDetailsData = {
      lossAndDamageCoverage: values.LossandDamagecoverage,
      lossAndDamageCoverageRate: values.LossandDamagecoverageRate,
      lossAndDamageCoveragePremium: values.LossandDamagecoveragepremium,
      actsOfNatureRate: includeActsOfNature ? values.ActsofNatureRate : "",
      actsOfNaturePremium: includeActsOfNature
        ? values.ActsofNaturepremium
        : "",
      ctplCoverageRate: includeCTPL ? values.CtplCoverageRate : "",
      roadsideAssistanceRate: includeRoadsideAssistance
        ? values.RoadsideAssistanceRate
        : "",
      roadsideAssistancePremium: includeRoadsideAssistance
        ? values.RoadsideAssistancepremium
        : "",
      personalAccidentCoverRate: includePersonalAccident
        ? values.PersonalAccidentCoverRate
        : "",
      personalAccidentCoverPremium: includePersonalAccident
        ? values.PersonalAccidentCoverpremium
        : "",
      bodilyInjury: values.BodilyInjury,
      bodilyInjuryCoveragePremium: values.BodilyInjuryCoveragePremium,
      propertyDamage: values.PropertyDamage,
      propertyDamageCoveragePremium: values.PropertyDamageCoveragePremium,
      autoPassengerPersonalAccident: values.AutopassengerpersonalAccident,
      APPAtotalCoverage: values.APPATotalCoverage,
      APPAcoveragePremium: values.APPACoveragePremium,
      totalSumInsured: values.TotalSumInsured,
      // Include premium breakdown if calculated
      ...(premiumBreakdown && {
        netPremium: premiumBreakdown.netPremium,
        documentaryStampTax: premiumBreakdown.documentaryStampTax,
        valueAddedTax: premiumBreakdown.valueAddedTax,
        localGovernmentTax: premiumBreakdown.localGovernmentTax,
        discount: premiumBreakdown.discount,
        grossPremium: premiumBreakdown.grossPremium,
      }),
    };

    if (flow === "renewal") {
      // Save exactly what is on screen on the policy's open renewal (created when there is none).
      return policyRenewalService
        .saveRenewalWizard(policyId, { coverageDetails: coverageDetailsData })
        .then((response) => {
          if (!response.success) {
            alert(`Could not save the renewal: ${response.error}`);
            return;
          }
          navigate(
            `/agent/renewalquote/accessories/accessorirsdetails/${policyId}`,
            {
              state: {
                policyId,
                policyData: state?.policy,
                coInsurance,
                installmentType,
              },
            }
          );
        });
    }

    // Save to Redux state
    dispatch(setQuoteCoverageDetails(coverageDetailsData));

    // Also dispatch to old middleware for backward compatibility
    dispatch(postcoverageDetailsMiddleware(values));

    // Determine navigation path
    const currentPath = window.location.pathname;
    const isEditFlow = currentPath.includes("/editquote/");
    const idParam = isEditMode ? currentQuoteCreation.quotationId : leadRefId;

    // Navigate to accessories step
    if (flow === "renewal") {
      navigate(
        `/agent/renewalquote/accessories/accessorirsdetails/${policyId}`,
        {
          state: {
            policyId,
            policyData: state?.policy, // Pass policy data along the chain
            coInsurance,
            installmentType,
          },
        }
      );
    } else if (action === "coveragedetail") {
      const basePath = isEditFlow ? "/agent/editquote" : "/agent/createquote";
      navigate(`${basePath}/accessories/accessorirsdetails/${idParam}`, {
        state: {
          coInsurance,
          installmentType,
        },
      });
    } else {
      const basePath = isEditFlow ? "/agent/editquote" : "/agent/createquote";
      navigate(`${basePath}/accessories/accessoriescreate/${idParam}`, {
        state: {
          coInsurance,
          installmentType,
        },
      });
    }
  };

  const hadlecalculation = () => {
    // Calculate all premiums based on coverage, rates, and sum insured
    // Map PascalCase form fields to camelCase for computeAllPremiums
    const computed = computeAllPremiums({
      lossAndDamageCoverage: formik.values.LossandDamagecoverage,
      lossAndDamageCoverageRate: formik.values.LossandDamagecoverageRate,
      actsOfNatureRate: includeActsOfNature
        ? formik.values.ActsofNatureRate
        : "0",
      ctplCoverageRate: includeCTPL ? formik.values.CtplCoverageRate : "0",
      roadsideAssistanceRate: includeRoadsideAssistance
        ? formik.values.RoadsideAssistanceRate
        : "0",
      personalAccidentCoverRate: includePersonalAccident
        ? formik.values.PersonalAccidentCoverRate
        : "0",
      bodilyInjury: formik.values.BodilyInjury,
      propertyDamage: formik.values.PropertyDamage,
      APPAtotalCoverage: formik.values.APPATotalCoverage,
      autoPassengerPersonalAccident:
        formik.values.AutopassengerpersonalAccident,
    });

    // Calculate full premium breakdown including taxes and gross premium
    const breakdown = calculatePremiumBreakdown(
      {
        ...computed,
        discount: formik.values.Discount || "0",
      },
      productConfigurator,
      settingsTaxRates
    );

    // Validate gross premium vs sum insured
    const sumInsuredNum = parseFloat(computed.totalSumInsured) || 0;
    const grossPremiumNum = parseFloat(breakdown.grossPremium) || 0;
    if (sumInsuredNum > 0 && grossPremiumNum > 0) {
      const premiumRatio = (grossPremiumNum / sumInsuredNum) * 100;
      if (premiumRatio > 10) {
        console.warn(
          `⚠️ [Coverage Details] Gross Premium (${
            breakdown.grossPremium
          }) is ${premiumRatio.toFixed(2)}% of Sum Insured (${
            computed.totalSumInsured
          }). This seems unusually high (>10%). Expected range: 1-5%.`
        );
      } else {
        console.log(
          `[Coverage Details] Premium ratio: ${premiumRatio.toFixed(
            2
          )}% (within expected range)`
        );
      }
    }

    // Store breakdown for display
    setPremiumBreakdown(breakdown);

    // Map computed camelCase results back to PascalCase for the form
    const sanitizedValues = buildSanitizedCoverageValues(
      {
        ...formik.values,
        LossandDamagecoveragepremium: computed.lossAndDamageCoveragePremium,
        ActsofNaturepremium: includeActsOfNature
          ? computed.actsOfNaturePremium
          : "",
        CtplCoverageRate: includeCTPL ? computed.ctplCoverageRate : "",
        RoadsideAssistancepremium: includeRoadsideAssistance
          ? computed.roadsideAssistancePremium
          : "",
        PersonalAccidentCoverpremium: includePersonalAccident
          ? computed.personalAccidentCoverPremium
          : "",
        BodilyInjuryCoveragePremium: computed.bodilyInjuryCoveragePremium,
        PropertyDamageCoveragePremium: computed.propertyDamageCoveragePremium,
        APPACoveragePremium: computed.APPAcoveragePremium,
        TotalSumInsured: computed.totalSumInsured,
        // Add tax and gross premium values to form
        DocumentaryStampTax: breakdown.documentaryStampTax,
        ValueAddedTax: breakdown.valueAddedTax,
        LocalGovernmentTax: breakdown.localGovernmentTax,
        GrossPremium: breakdown.grossPremium,
      },
      includeActsOfNature,
      includeRoadsideAssistance,
      includePersonalAccident,
      includeCTPL
    );

    formik.setValues(sanitizedValues);
    formik.setTouched({});
    setTimeout(() => setshow(false), 0);
  };
  const handleOverride = () => {
    setOverRide(!isOverRide);
  };

  const handleActsOfNatureToggle = (checked) => {
    setIncludeActsOfNature(checked);

    if (!checked) {
      formik.setFieldValue("ActsofNatureRate", "");
      formik.setFieldValue("ActsofNaturepremium", "");
    } else {
      const defaultRate =
        existingCoverageDetails?.actsOfNatureRate ||
        productConfigurator?.configuration?.premiumRates?.acts_of_nature ||
        "";

      const sanitizedValues = buildSanitizedCoverageValues(
        {
          ...formik.values,
          ActsofNatureRate: defaultRate,
        },
        true,
        includeRoadsideAssistance,
        includePersonalAccident
      );

      formik.setValues(sanitizedValues);
    }
  };

  const handleRoadsideAssistanceToggle = (checked) => {
    setIncludeRoadsideAssistance(checked);

    if (!checked) {
      formik.setFieldValue("RoadsideAssistanceRate", "");
      formik.setFieldValue("RoadsideAssistancepremium", "");
    } else {
      const defaultRate =
        existingCoverageDetails?.roadsideAssistanceRate ||
        productConfigurator?.configuration?.premiumRates?.roadside_assistance ||
        "";

      const sanitizedValues = buildSanitizedCoverageValues(
        {
          ...formik.values,
          RoadsideAssistanceRate: defaultRate,
        },
        includeActsOfNature,
        true,
        includePersonalAccident,
        includeCTPL
      );

      formik.setValues(sanitizedValues);
    }
  };

  const handlePersonalAccidentToggle = (checked) => {
    setIncludePersonalAccident(checked);

    if (!checked) {
      formik.setFieldValue("PersonalAccidentCoverRate", "");
      formik.setFieldValue("PersonalAccidentCoverpremium", "");
    } else {
      const defaultRate =
        existingCoverageDetails?.personalAccidentCoverRate ||
        productConfigurator?.configuration?.premiumRates
          ?.personal_accident_cover ||
        "";

      const sanitizedValues = buildSanitizedCoverageValues(
        {
          ...formik.values,
          PersonalAccidentCoverRate: defaultRate,
        },
        includeActsOfNature,
        includeRoadsideAssistance,
        true,
        includeCTPL
      );

      formik.setValues(sanitizedValues);
    }
  };

  //   return errors
  // }
  // Helper function to get form values from Redux state or empty
  const getFormValues = () => {
    if (flow === "renewal" && renewalValues) {
      return renewalValues;
    }
    // Use existing coverage details from Redux if in edit mode
    if (isEditMode && existingCoverageDetails) {
      return {
        LossandDamagecoverage:
          existingCoverageDetails.lossAndDamageCoverage || "",
        LossandDamagecoverageRate:
          existingCoverageDetails.lossAndDamageCoverageRate ||
          productConfigurator?.configuration?.premiumRates?.[vehicleType] ||
          "",
        LossandDamagecoveragepremium:
          existingCoverageDetails.lossAndDamageCoveragePremium || "",
        ActsofNatureRate:
          existingCoverageDetails.actsOfNatureRate ||
          productConfigurator?.configuration?.premiumRates?.acts_of_nature ||
          "",
        CtplCoverageRate:
          productConfigurator?.configuration?.ctplSetting?.[vehicleType] || "",
        ActsofNaturepremium: existingCoverageDetails.actsOfNaturePremium || "",
        BodilyInjury: existingCoverageDetails.bodilyInjury || "",
        BodilyInjuryCoveragePremium:
          existingCoverageDetails.bodilyInjuryCoveragePremium || "",
        PropertyDamage: existingCoverageDetails.propertyDamage || "",
        PropertyDamageCoveragePremium:
          existingCoverageDetails.propertyDamageCoveragePremium || "",
        AutopassengerpersonalAccident:
          existingCoverageDetails.autoPassengerPersonalAccident || "",
        APPATotalCoverage: existingCoverageDetails.APPAtotalCoverage || "",
        APPACoveragePremium: existingCoverageDetails.APPAcoveragePremium || "",
        TotalSumInsured: existingCoverageDetails.totalSumInsured || "",
      };
    }
    // Empty values for create mode
    return {
      LossandDamagecoverage: "",
      LossandDamagecoverageRate:
        productConfigurator?.configuration?.premiumRates?.[vehicleType] || "",
      LossandDamagecoveragepremium: "",
      ActsofNatureRate: "",
      CtplCoverageRate:
        productConfigurator?.configuration?.ctplSetting?.[vehicleType] || "",
      ActsofNaturepremium: "",
      RoadsideAssistanceRate: "",
      RoadsideAssistancepremium: "",
      PersonalAccidentCoverRate: "",
      PersonalAccidentCoverpremium: "",
      BodilyInjury: "",
      BodilyInjuryCoveragePremium: "",
      PropertyDamage: "",
      PropertyDamageCoveragePremium: "",
      AutopassengerpersonalAccident: "",
      APPATotalCoverage: "",
      APPACoveragePremium: "",
      TotalSumInsured: "",
    };
  };

  const initialValue = getFormValues();
  console.log("initialValue", initialValue);

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const formik = useFormik({
    initialValues: initialValue,
    enableReinitialize: true, // Allow form to reinitialize when quotation data changes
    // validate:customValidation,
    onSubmit: (values) => {
      handleclick(values);
    },
  });

  // Auto-calculate premiums when coverage values change or when form loads
  useEffect(() => {
    // CRITICAL: Skip auto-calculate completely for renewal flow
    if (flow === "renewal") {
      console.log(
        "Skipping auto-calculate - this is a renewal flow, waiting for policy data"
      );
      return;
    }

    // Skip auto-calculate if renewal data was already loaded
    if (renewalDataLoaded) {
      console.log("Skipping auto-calculate - renewal data already loaded");
      return;
    }

    // Only auto-calculate if we have coverage values but no premiums
    const hasCoverageData =
      formik.values.LossandDamagecoverage ||
      formik.values.BodilyInjury ||
      formik.values.PropertyDamage;
    const hasPremiumData =
      formik.values.LossandDamagecoveragepremium ||
      formik.values.BodilyInjuryCoveragePremium;

    if (hasCoverageData && !hasPremiumData && !loading) {
      console.log("Auto-calculating premiums on form load");
      hadlecalculation();
    }
  }, [
    formik.values.LossandDamagecoverage,
    formik.values.BodilyInjury,
    formik.values.PropertyDamage,
    renewalDataLoaded,
    flow,
  ]);

  // Fetch policy data for renewal and pre-populate form
  useEffect(() => {
    const fetchPolicyDataForRenewal = async () => {
      // Only process if this is a renewal flow
      if (flow !== "renewal") {
        console.log("Skipping renewal fetch - not a renewal flow");
        return;
      }

      if (!policyId) {
        console.error("No policy ID available for renewal");
        return;
      }

      // Prefill from this renewal's saved wizard data or, failing that, the expiring
      // policy itself (its quotation, else sum insured / insurer / product of the policy row).
      const response = await policyRenewalService.getRenewalPrefill(policyId);
      if (!response.success || !response.data) {
        console.error("Failed to load renewal prefill:", response.error);
        return;
      }
      const coverage = response.data.coverageDetails || {};
      const mapped = policyService.transformRenewalCoverage(coverage);
      const formatAmount = (value) =>
        value === "" || value === undefined || value === null
          ? ""
          : formatNumber(Number(String(value).replace(/,/g, "")), {
              minimumFractionDigits: 2,
            });
      const coverageForRenewal = {
        ...mapped,
        LossandDamagecoverage: formatAmount(mapped.LossandDamagecoverage),
        TotalSumInsured: formatAmount(mapped.TotalSumInsured),
        LossandDamagecoverageRate:
          mapped.LossandDamagecoverageRate ||
          productConfigurator?.configuration?.premiumRates?.[vehicleType] ||
          "",
        CtplCoverageRate:
          mapped.CtplCoverageRate ||
          productConfigurator?.configuration?.ctplSetting?.[vehicleType] ||
          "",
        BodilyInjury: mapped.BodilyInjury
          ? normalizeDropdownValue(mapped.BodilyInjury, BodilyInjuryOptions)
          : "",
        PropertyDamage: mapped.PropertyDamage
          ? normalizeDropdownValue(mapped.PropertyDamage, PropertyDamageOptions)
          : "",
        AutopassengerpersonalAccident: mapped.AutopassengerpersonalAccident
          ? normalizeDropdownValue(
              mapped.AutopassengerpersonalAccident,
              AutopassengerpersonalAccidentOptions
            )
          : "",
      };

      setRenewalValues(coverageForRenewal);
      formik.setValues(coverageForRenewal);
      setIncludeActsOfNature(Boolean(coverage.actsOfNatureRate));
      setIncludeRoadsideAssistance(Boolean(coverage.roadsideAssistanceRate));
      setIncludePersonalAccident(Boolean(coverage.personalAccidentCoverRate));
      setIncludeCTPL(Boolean(coverageForRenewal.CtplCoverageRate));
      // Premiums priced on the expiring term can be carried on; otherwise Calculate first.
      setshow(!coverage.lossAndDamageCoveragePremium);
      setRenewalDataLoaded(true);
    };

    fetchPolicyDataForRenewal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, policyId, state]); // Run when flow, policyId, or state changes

  return (
    <div className="coverage__details__card__container mt-4">
      <Card>
        <div className="coverage__details__card__container__title">
          {flow === "renewal" ? t("coverageDetailsCard.renewalDetails") : t("coverageDetailsCard.createQuote")}
        </div>
        <div className="coverage__details__card__container__sub__title mt-2 mb-2">
          {t("coverageDetailsCard.coveragesDetails")}
        </div>
        <div className="grid m-0">
          <div className="col-12 md:col-12 lg:col-12">
            <InputTextField
              label={t("coverageDetailsCard.ownDamageCoverage")}
              value={formik.values.LossandDamagecoverage}
              onChange={formik.handleChange("LossandDamagecoverage")}
            />
            {formik.touched.LossandDamagecoverage &&
              formik.errors.LossandDamagecoverage && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.LossandDamagecoverage}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsCard.ownDamageCoverageRate")}
              value={formik.values.LossandDamagecoverageRate}
              onChange={formik.handleChange("LossandDamagecoverageRate")}
            />
            {formik.touched.LossandDamagecoverageRate &&
              formik.errors.LossandDamagecoverageRate && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.LossandDamagecoverageRate}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? (
              <InputTextField
                label={t("coverageDetailsCard.ownDamageCoveragePremium")}
                value={formik.values.LossandDamagecoveragepremium}
                onChange={formik.handleChange("LossandDamagecoveragepremium")}
              />
            ) : (
              <CalculaitionTextInputs
                label={t("coverageDetailsCard.ownDamageCoveragePremium")}
                value={formik.values.LossandDamagecoveragepremium}
                onChange={formik.handleChange("LossandDamagecoveragepremium")}
              />
            )}

            {formik.touched.LossandDamagecoveragepremium &&
              formik.errors.LossandDamagecoveragepremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.LossandDamagecoveragepremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsCard.ctplCoverageRate")}
              value={formik.values.CtplCoverageRate}
              onChange={formik.handleChange("CtplCoverageRate")}
            />
            {formik.touched.CtplCoverageRate &&
              formik.errors.CtplCoverageRate && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.CtplCoverageRate}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div className="flex align-items-center gap-2 mt-3">
              <Checkbox
                inputId="include-acts-of-nature"
                checked={includeActsOfNature}
                onChange={(e) => handleActsOfNatureToggle(e.checked)}
              />
              <label htmlFor="include-acts-of-nature" className="m-0">
                {t("coverageDetailsCard.includeActsOfNatureCoverage")}
              </label>
            </div>
            <div className="flex align-items-center gap-2 mt-3"></div>
          </div>
        </div>
        {includeActsOfNature && (
          <div className="grid m-0 mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("coverageDetailsCard.actsOfNatureRate")}
                value={formik.values.ActsofNatureRate}
                onChange={formik.handleChange("ActsofNatureRate")}
              />
              {formik.touched.ActsofNatureRate &&
                formik.errors.ActsofNatureRate && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.ActsofNatureRate}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              {isOverRide ? (
                <InputTextField
                  label={t("coverageDetailsCard.actsOfNaturePremium")}
                  value={formik.values.ActsofNaturepremium}
                  onChange={formik.handleChange("ActsofNaturepremium")}
                />
              ) : (
                <CalculaitionTextInputs
                  label={t("coverageDetailsCard.actsOfNaturePremium")}
                  value={formik.values.ActsofNaturepremium}
                  onChange={formik.handleChange("ActsofNaturepremium")}
                />
              )}
              {formik.touched.ActsofNaturepremium &&
                formik.errors.ActsofNaturepremium && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.ActsofNaturepremium}
                  </div>
                )}
            </div>
          </div>
        )}

        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div className="flex align-items-center gap-2 mt-3">
              <Checkbox
                inputId="include-roadside-assistance"
                checked={includeRoadsideAssistance}
                onChange={(e) => handleRoadsideAssistanceToggle(e.checked)}
              />
              <label htmlFor="include-roadside-assistance" className="m-0">
                {t("coverageDetailsCard.includeRoadsideAssistance")}
              </label>
            </div>
          </div>
        </div>
        {includeRoadsideAssistance && (
          <div className="grid m-0 mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("coverageDetailsCard.roadsideAssistanceRate")}
                value={formik.values.RoadsideAssistanceRate}
                onChange={formik.handleChange("RoadsideAssistanceRate")}
              />
              {formik.touched.RoadsideAssistanceRate &&
                formik.errors.RoadsideAssistanceRate && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.RoadsideAssistanceRate}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              {isOverRide ? (
                <InputTextField
                  label={t("coverageDetailsCard.roadsideAssistancePremium")}
                  value={formik.values.RoadsideAssistancepremium}
                  onChange={formik.handleChange("RoadsideAssistancepremium")}
                />
              ) : (
                <CalculaitionTextInputs
                  label={t("coverageDetailsCard.roadsideAssistancePremium")}
                  value={formik.values.RoadsideAssistancepremium}
                  onChange={formik.handleChange("RoadsideAssistancepremium")}
                />
              )}
              {formik.touched.RoadsideAssistancepremium &&
                formik.errors.RoadsideAssistancepremium && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.RoadsideAssistancepremium}
                  </div>
                )}
            </div>
          </div>
        )}
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <div className="flex align-items-center gap-2 mt-3">
              <Checkbox
                inputId="include-personal-accident"
                checked={includePersonalAccident}
                onChange={(e) => handlePersonalAccidentToggle(e.checked)}
              />
              <label htmlFor="include-personal-accident" className="m-0">
                {t("coverageDetailsCard.includePersonalAccidentCover")}
              </label>
            </div>
          </div>
        </div>
        {includePersonalAccident && (
          <div className="grid m-0 mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("coverageDetailsCard.personalAccidentCoverRate")}
                value={formik.values.PersonalAccidentCoverRate}
                onChange={formik.handleChange("PersonalAccidentCoverRate")}
              />
              {formik.touched.PersonalAccidentCoverRate &&
                formik.errors.PersonalAccidentCoverRate && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.PersonalAccidentCoverRate}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              {isOverRide ? (
                <InputTextField
                  label={t("coverageDetailsCard.personalAccidentCoverPremium")}
                  value={formik.values.PersonalAccidentCoverpremium}
                  onChange={formik.handleChange("PersonalAccidentCoverpremium")}
                />
              ) : (
                <CalculaitionTextInputs
                  label={t("coverageDetailsCard.personalAccidentCoverPremium")}
                  value={formik.values.PersonalAccidentCoverpremium}
                  onChange={formik.handleChange("PersonalAccidentCoverpremium")}
                />
              )}
              {formik.touched.PersonalAccidentCoverpremium &&
                formik.errors.PersonalAccidentCoverpremium && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.PersonalAccidentCoverpremium}
                  </div>
                )}
            </div>
          </div>
        )}
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("coverageDetailsCard.bodilyInjury")}
              value={formik.values.BodilyInjury}
              options={BodilyInjuryOptions}
              onChange={(e) => {
                formik.setFieldValue("BodilyInjury", e.value);
              }}
              optionLabel="label"
              optionValue="value"
            />
            {formik.touched.BodilyInjury && formik.errors.BodilyInjury && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.BodilyInjury}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? (
              <InputTextField
                label={t("coverageDetailsCard.bodilyInjuryCoveragePremium")}
                value={formik.values.BodilyInjuryCoveragePremium}
                onChange={formik.handleChange("BodilyInjuryCoveragePremium")}
              />
            ) : (
              <CalculaitionTextInputs
                label={t("coverageDetailsCard.bodilyInjuryCoveragePremium")}
                value={formik.values.BodilyInjuryCoveragePremium}
                onChange={formik.handleChange("BodilyInjuryCoveragePremium")}
              />
            )}{" "}
            {formik.touched.BodilyInjuryCoveragePremium &&
              formik.errors.BodilyInjuryCoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.BodilyInjuryCoveragePremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("coverageDetailsCard.propertyDamage")}
              value={formik.values.PropertyDamage}
              options={PropertyDamageOptions}
              onChange={(e) => {
                formik.setFieldValue("PropertyDamage", e.value);
              }}
              optionLabel="label"
              optionValue="value"
            />
            {formik.touched.PropertyDamage && formik.errors.PropertyDamage && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.PropertyDamage}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? (
              <InputTextField
                label={t("coverageDetailsCard.propertyDamageCoveragePremium")}
                value={formik.values.PropertyDamageCoveragePremium}
                onChange={formik.handleChange("PropertyDamageCoveragePremium")}
              />
            ) : (
              <CalculaitionTextInputs
                label={t("coverageDetailsCard.propertyDamageCoveragePremium")}
                value={formik.values.PropertyDamageCoveragePremium}
                onChange={formik.handleChange("PropertyDamageCoveragePremium")}
              />
            )}
            {formik.touched.PropertyDamageCoveragePremium &&
              formik.errors.PropertyDamageCoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.PropertyDamageCoveragePremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              label={t("coverageDetailsCard.autoPassengerPersonalAccident")}
              value={formik.values.AutopassengerpersonalAccident}
              options={AutopassengerpersonalAccidentOptions}
              onChange={(e) => {
                formik.setFieldValue("AutopassengerpersonalAccident", e.value);
              }}
              optionLabel="label"
              optionValue="value"
            />
            {formik.touched.AutopassengerpersonalAccident &&
              formik.errors.AutopassengerpersonalAccident && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.AutopassengerpersonalAccident}
                </div>
              )}
          </div>
        </div>

        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("coverageDetailsCard.appaTotalCoverage")}
              value={formik.values.APPATotalCoverage}
              onChange={formik.handleChange("APPATotalCoverage")}
            />
            {formik.touched.APPATotalCoverage &&
              formik.errors.APPATotalCoverage && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.APPATotalCoverage}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            {isOverRide ? (
              <InputTextField
                label={t("coverageDetailsCard.appaCoveragePremium")}
                value={formik.values.APPACoveragePremium}
                onChange={formik.handleChange("APPACoveragePremium")}
              />
            ) : (
              <CalculaitionTextInputs
                label={t("coverageDetailsCard.appaCoveragePremium")}
                value={formik.values.APPACoveragePremium}
                onChange={formik.handleChange("APPACoveragePremium")}
              />
            )}
            {formik.touched.APPACoveragePremium &&
              formik.errors.APPACoveragePremium && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.APPACoveragePremium}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            {isOverRide ? (
              <InputTextField
                label={t("coverageDetailsCard.totalSumInsured")}
                value={formik.values.TotalSumInsured}
                onChange={formik.handleChange("TotalSumInsured")}
              />
            ) : (
              <CalculaitionTextInputs
                label={t("coverageDetailsCard.totalSumInsured")}
                value={formik.values.TotalSumInsured}
                onChange={formik.handleChange("TotalSumInsured")}
              />
            )}
            {formik.touched.TotalSumInsured &&
              formik.errors.TotalSumInsured && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.TotalSumInsured}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div className="col-12 md:col-12 lg:col-12 total-gross-premium-field">
            <CalculaitionTextInputs
              label={t("coverageDetailsCard.totalGrossPremium")}
              value={
                premiumBreakdown?.grossPremium ||
                formik.values.GrossPremium ||
                "0.00"
              }
              onChange={() => {}}
              disabled={true}
            />
          </div>
        </div>
        <div className="grid m-0 mt-2">
          <div
            className="col-12 md:col-6 lg:col-6 "
            style={{
              display: "flex",
            }}
          >
            <div className="calculation__btn__container">
              <Button
                label={t("coverageDetailsCard.calculate")}
                className="calculation__btn"
                onClick={hadlecalculation}
              />
            </div>
            <div
              className="calculation__btn__container"
              style={{
                marginLeft: "20px",
              }}
            >
              <Button
                label={isOverRide ? t("coverageDetailsCard.save") : t("coverageDetailsCard.override")}
                className="calculation__btn"
                onClick={handleOverride}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 back__next__btn__container ">
            {flow === "normal" && (
              <div className="back__btn__container">
                <Button className="back__btn" onClick={handleBackNavigation}>
                  {t("coverageDetailsCard.back")}
                </Button>
              </div>
            )}
            <div className="next__btn__container">
              <Button
                className="next__btn"
                onClick={formik.handleSubmit}
                disabled={show === true ? true : false}
              >
                {t("coverageDetailsCard.next")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CoverageDetailsCard;
