import StepErrors from "../../../components/StepErrors";
import React, { useRef, useState, useEffect } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import SvgCountPlusIcon from "../../../assets/icons/SvgCountPlusIcon";
import SvgCountMinusIcon from "../../../assets/icons/SvgCountMinusIcon";
import CalculaitionTextInputs from "../../component/calculaitionTextInputs";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdownField";
import CustomToast from "../../../components/Toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useFormik } from "formik";
import useSignatoryOptions, { NoSignatoryHint } from "../utils/useSignatoryOptions";
import { useDispatch, useSelector } from "react-redux";
import {
  createQuotationMiddleware,
  updateQuotationMiddleware,
} from "../Store/quotationMiddleware";
import {
  setQuoteOrderSummary,
  clearCurrentQuoteCreation,
} from "../Store/quotationReducer";
import { calculatePremiumBreakdown } from "../utils/premiumCalculations";
import useTaxRates from "../utils/useTaxRates";
import quotationService from "../../../services/quotationService";
import { transformToBackendFormat } from "../utils/quotationDataTransform";
import policyRenewalService from "../../../services/policyRenewalService";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";
import leadService from "../../../services/leadService";
// The referral / commission split is internal: it is kept on the quotation but not shown on the order summary
import { defaultCommissionDetails } from "./CommissionReferralSection";
import { notifyError } from "../../../utility/dialogs";
import logger from "../../../utility/logger";

// Helper function to transform Redux currentQuoteCreation to component format
const transformReduxToComponentFormat = (currentQuoteCreation) => {
  if (!currentQuoteCreation) return null;

  // Map Redux structure to flat component structure - USING ONLY camelCase
  const transformed = {
    // From policyDetails
    insurancePolicyType:
      currentQuoteCreation.policyDetails?.insurancePolicyType,
    insuranceCompanyName:
      currentQuoteCreation.policyDetails?.insuranceCompanyName,
    accountCode: currentQuoteCreation.policyDetails?.accountCode,
    paymentType: currentQuoteCreation.policyDetails?.paymentType,
    installmentType: currentQuoteCreation.policyDetails?.installmentType,
    vehicleBrand: currentQuoteCreation.policyDetails?.vehicleBrand,
    modelYear: currentQuoteCreation.policyDetails?.modelYear,
    vehicleModel: currentQuoteCreation.policyDetails?.vehicleModel,
    modelVariant: currentQuoteCreation.policyDetails?.modelVariant,
    vehicleColor: currentQuoteCreation.policyDetails?.vehicleColor,
    seatingCapacity: currentQuoteCreation.policyDetails?.seatingCapacity,
    vehicleType: currentQuoteCreation.policyDetails?.vehicleType,
    coInsurance: currentQuoteCreation.policyDetails?.isCoInsurance,

    // From coverageDetails - camelCase only
    lossAndDamageCoverage:
      currentQuoteCreation.coverageDetails?.lossAndDamageCoverage,
    lossAndDamageCoverageRate:
      currentQuoteCreation.coverageDetails?.lossAndDamageCoverageRate,
    lossAndDamageCoveragePremium:
      currentQuoteCreation.coverageDetails?.lossAndDamageCoveragePremium,
    actsOfNatureRate: currentQuoteCreation.coverageDetails?.actsOfNatureRate,
    actsOfNaturePremium:
      currentQuoteCreation.coverageDetails?.actsOfNaturePremium,
    // CTPL (fixed tariff), roadside assistance and personal accident cover as chosen on Coverage Details
    includeCTPL: currentQuoteCreation.coverageDetails?.includeCTPL,
    ctplTermYears: currentQuoteCreation.coverageDetails?.ctplTermYears,
    ctplCoverageRate: currentQuoteCreation.coverageDetails?.ctplCoverageRate,
    ctplCoveragePremium: currentQuoteCreation.coverageDetails?.ctplCoveragePremium,
    roadsideAssistanceRate: currentQuoteCreation.coverageDetails?.roadsideAssistanceRate,
    roadsideAssistancePremium: currentQuoteCreation.coverageDetails?.roadsideAssistancePremium,
    personalAccidentCoverRate: currentQuoteCreation.coverageDetails?.personalAccidentCoverRate,
    personalAccidentCoverPremium: currentQuoteCreation.coverageDetails?.personalAccidentCoverPremium,
    appaSeats: currentQuoteCreation.coverageDetails?.appaSeats,
    bodilyInjury: currentQuoteCreation.coverageDetails?.bodilyInjury,
    bodilyInjuryCoveragePremium:
      currentQuoteCreation.coverageDetails?.bodilyInjuryCoveragePremium,
    propertyDamage: currentQuoteCreation.coverageDetails?.propertyDamage,
    propertyDamageCoveragePremium:
      currentQuoteCreation.coverageDetails?.propertyDamageCoveragePremium,
    autoPassengerPersonalAccident:
      currentQuoteCreation.coverageDetails?.autoPassengerPersonalAccident,
    APPAtotalCoverage: currentQuoteCreation.coverageDetails?.APPAtotalCoverage,
    APPAcoveragePremium:
      currentQuoteCreation.coverageDetails?.APPAcoveragePremium,
    totalSumInsured: currentQuoteCreation.coverageDetails?.totalSumInsured,

    // Premium breakdown from coverageDetails (calculated values)
    netPremium: currentQuoteCreation.coverageDetails?.netPremium,
    documentaryStampTax:
      currentQuoteCreation.coverageDetails?.documentaryStampTax,
    valueAddedTax: currentQuoteCreation.coverageDetails?.valueAddedTax,
    localGovernmentTax:
      currentQuoteCreation.coverageDetails?.localGovernmentTax,
    accountPremiumOthers:
      currentQuoteCreation.coverageDetails?.accountPremiumOthers,
    grossPremium: currentQuoteCreation.coverageDetails?.grossPremium,

    // From accessories - camelCase only
    aircon: currentQuoteCreation.accessories?.aircon,
    stereo: currentQuoteCreation.accessories?.stereo,
    magWheels: currentQuoteCreation.accessories?.magWheels,
    others: currentQuoteCreation.accessories?.others,
    deductible: currentQuoteCreation.accessories?.deductible,
    towing: currentQuoteCreation.accessories?.towing,
    repairLimit: currentQuoteCreation.accessories?.repairLimit,

    // From orderSummary (if exists) - fallback to coverageDetails for discount
    discount:
      currentQuoteCreation.orderSummary?.discount ||
      currentQuoteCreation.coverageDetails?.discount,
    authorizedSignature: currentQuoteCreation.orderSummary?.authorizedSignature,
    commissionDetails:
      currentQuoteCreation.orderSummary?.commissionDetails ||
      currentQuoteCreation.commissionDetails,

    // Lead reference
    leadRefId: currentQuoteCreation.leadRefId,
  };
  return transformed;
};
// Renewal: the wizard data saved on the renewal (coverage, accessories) or, when the
// earlier steps saved nothing, the expiring policy's own data. Premiums are priced by the server.
const transformRenewalPrefillToQuotationFormat = (prefill) => {
  if (!prefill) {
    return null;
  }
  const order = prefill.orderSummary || {};
  return {
    ...(prefill.coverageDetails || {}),
    ...(prefill.accessories || {}),
    productType: prefill.productType,
    lob: prefill.lob,
    insuranceCompanyId: prefill.insuranceCompanyId,
    insuranceCompanyName: prefill.insuranceCompanyName,
    discount: order.discount || "0.00",
    accountPremiumOthers: order.accountPremiumOthers || "",
    authorizedSignature: order.authorizedSignature || "",
    commissionDetails: order.commissionDetails || prefill.commissionDetails || undefined,
  };
};

// Helper function to get form values from quotation data
/** Premium fields of the server breakdown (POST /quotations/calculate-premium) in the form's string format. */
const toPremiumFields = (breakdown) => {
  const fixed = (value) => Number(value || 0).toFixed(2);
  return {
    netPremium: fixed(breakdown.netPremium),
    valueAddedTax: fixed(breakdown.valueAddedTax),
    documentaryStampTax: fixed(breakdown.documentaryStampTax),
    localGovernmentTax: fixed(breakdown.localGovernmentTax),
    accountPremiumOthers: fixed(breakdown.accountPremiumOthers),
    NCD: fixed(breakdown.NCD),
    grossPremium: fixed(breakdown.grossPremium),
    totalSumInsured: fixed(breakdown.totalSumInsured),
  };
};

const getFormValues = (quotationData, productConfigurator, settingsTaxRates) => {
  if (quotationData) {
    // ALWAYS use passed premium values if available (from Coverage Details)
    // This ensures consistency between Coverage Details and Order Summary
    if (quotationData.netPremium && quotationData.grossPremium) {
      return {
        netPremium: quotationData.netPremium,
        valueAddedTax: quotationData.valueAddedTax,
        others: quotationData.accountPremiumOthers || "0.00",
        authorizedSignature: quotationData.authorizedSignature || "",
        documentaryStampTax: quotationData.documentaryStampTax,
        localGovtTax: quotationData.localGovernmentTax,
        discount: quotationData.discount || "0.00",
        ncd: quotationData.NCD || quotationData.ncd || "0.00",
        grossPremium: quotationData.grossPremium,
        totalSumInsured: quotationData.totalSumInsured || "0.00",
        commissionDetails:
          quotationData.commissionDetails || defaultCommissionDetails(),
      };
    }

    // Fallback: Calculate only if no premium data passed
    const premiumValues = calculatePremiumBreakdown(
      quotationData,
      productConfigurator,
      settingsTaxRates
    );

    return {
      netPremium: premiumValues.netPremium,
      valueAddedTax: premiumValues.valueAddedTax,
      others: premiumValues.accountPremiumOthers,
      authorizedSignature: quotationData.authorizedSignature || "",
      documentaryStampTax: premiumValues.documentaryStampTax,
      localGovtTax: premiumValues.localGovernmentTax,
      discount: quotationData.discount || "0.00",
      ncd: quotationData.NCD || quotationData.ncd || "0.00",
      grossPremium: premiumValues.grossPremium,
      totalSumInsured: quotationData.totalSumInsured || "0.00",
      commissionDetails:
        quotationData.commissionDetails || defaultCommissionDetails(),
    };
  }

  // Return empty defaults
  return {
    netPremium: "0.00",
    valueAddedTax: "0.00",
    others: "0.00",
    authorizedSignature: "",
    documentaryStampTax: "0.00",
    localGovtTax: "0.00",
    discount: "0.00",
    ncd: "0.00",
    grossPremium: "0.00",
    totalSumInsured: "0.00",
    commissionDetails: defaultCommissionDetails(),
  };
};

const OrderSummary = ({ action, flow }) => {
  const { t } = useTranslation();
  // why the renewal step could not be saved, shown on the step
  const [stepError, setStepError] = useState(null);
  const params = useParams();
  const { quotationId, leadRefId, id: policyId } = params;

  // Extract quotationId from URL path if it's the last parameter
  // Only treat it as quotationId if we're in an edit flow
  const currentPath = window.location.pathname;
  const isEditFlow = currentPath.includes("/editquote/");
  const urlQuotationId = isEditFlow
    ? Object.values(params).find(
        (param) => param && param.length > 10 && param.startsWith("cmg")
      )
    : null;
  const [discount, setDiscount] = useState(0);
  const [toastMessage, setToastMessage] = useState(
    "Quote Created Successfully"
  );
  const [quotationData, setQuotationData] = useState(null);
  const [, setIsLoadingRenewalData] = useState(false);
  const [leadData, setLeadData] = useState(null);
  const [clientData, setClientData] = useState(null);
  const dispatch = useDispatch();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const { state } = useLocation();

  // Get current quote creation state from Redux
  const { currentQuoteCreation, productConfigurator } = useSelector(
    ({ quotationReducers, productConfiguratorReducer }) => ({
      currentQuoteCreation: quotationReducers?.currentQuoteCreation,
      isEditMode: quotationReducers?.currentQuoteCreation?.isEditMode || false,
      productConfigurator: productConfiguratorReducer?.template,
    })
  );
  useEffect(() => {
    dispatch(
      fetchProductTemplateByIdMiddleware({
        templateCode: "MOT-003-2025",
      })
    );
  }, [dispatch]);

  // Fetch lead data for normal flow (not renewal)
  useEffect(() => {
    const fetchLeadData = async () => {
      if (flow !== "renewal" && leadRefId) {
        try {
          const response = await leadService.getLeadById(leadRefId);
          if (response.success) {
            setLeadData(response.data);
          } else {
            logger.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          logger.error("Error fetching lead data:", error);
        }
      }
    };

    fetchLeadData();
  }, [flow, leadRefId]);

  // Fetch and set quotation data based on flow
  useEffect(() => {
    const loadQuotationData = async () => {
      // RENEWAL FLOW: Fetch policy and transform to quotation format
      if (flow === "renewal" && policyId) {
        setIsLoadingRenewalData(true);
        const response = await policyRenewalService.getRenewalPrefill(policyId);
        setIsLoadingRenewalData(false);
        if (!response.success || !response.data) {
          notifyError(`Failed to load the renewal: ${response.error || "unknown error"}`);
          return;
        }
        setClientData({
          name: response.data.clientName,
          code: response.data.clientCode,
        });
        setQuotationData(transformRenewalPrefillToQuotationFormat(response.data));
      }
      // NORMAL/EDIT FLOW: Use Redux or navigation state
      else if (currentQuoteCreation && currentQuoteCreation.leadRefId) {
        setQuotationData(transformReduxToComponentFormat(currentQuoteCreation));
      } else if (state?.quotationData) {
        setQuotationData(state.quotationData);
      } else {
        setQuotationData(null);
      }
    };

    loadQuotationData();
  }, [flow, policyId, state, currentQuoteCreation]);

  // Use useMemo to recalculate initial values when quotationData changes
  // The server computes the premium (and recomputes it on save); show its breakdown
  const settingsTaxRates = useTaxRates();
  const [serverPremium, setServerPremium] = useState(null);
  useEffect(() => {
    if (!quotationData) return undefined;
    let active = true;
    quotationService
      .calculatePremium(quotationData)
      .then((breakdown) => active && setServerPremium(toPremiumFields(breakdown)))
      .catch(() => active && setServerPremium(null));
    return () => {
      active = false;
    };
  }, [quotationData]);

  const initialValue = React.useMemo(() => {
    const pricedQuotation = quotationData && serverPremium ? { ...quotationData, ...serverPremium } : quotationData;
    const values = getFormValues(pricedQuotation, productConfigurator, settingsTaxRates);
    return values;
  }, [quotationData, serverPremium, productConfigurator, settingsTaxRates]);

  // Update toast message based on quotationId
  useEffect(() => {
    const existingQuotationId = isEditFlow
      ? quotationId || urlQuotationId || quotationData?.quotationId
      : null;
    setToastMessage(
      existingQuotationId
        ? "Quote Updated Successfully"
        : "Quote Created Successfully"
    );
  }, [quotationId, urlQuotationId, quotationData?.quotationId, isEditFlow]);
  const handleclick = async (values) => {
    // Renewal: save the order summary on the renewal and create (or update) the renewal
    // quotation linked to the expiring policy. It then follows the normal quotation workflow
    // (send for customer approval, convert to policy = the new policy term).
    if (flow === "renewal" && policyId) {
      const response = await policyRenewalService.createRenewalQuotation(policyId, {
        orderSummary: {
          netPremium: values.netPremium,
          valueAddedTax: values.valueAddedTax,
          accountPremiumOthers: values.others,
          documentaryStampTax: values.documentaryStampTax,
          localGovernmentTax: values.localGovtTax,
          NCD: values.ncd,
          discount: values.discount,
          grossPremium: values.grossPremium,
          authorizedSignature: values.authorizedSignature,
          commissionDetails: values.commissionDetails,
        },
      });
      if (!response.success || !response.data?.quotationId) {
        setStepError({ message: response.error || t("stepErrors.quotationFailed"), errors: response.errors });
        return;
      }
      setToastMessage(
        `Renewal quotation ${response.data.quotationNumber} saved`
      );
      toastRef.current?.showToast();
      setTimeout(() => {
        navigate(`/agent/quotedetailview/${response.data.quotationId}`);
      }, 1500);
      return;
    }

    try {
      // Helper function to safely get string value
      const safeGetString = (value) => {
        if (value === null || value === undefined || value === "") {
          return "0";
        }
        const stringValue = String(value);
        const cleanedValue = stringValue.replace(/,/g, "");
        return cleanedValue || "0";
      };

      // Get user info for createdBy/updatedBy
      const getUserInfo = () => {
        try {
          const userData = JSON.parse(localStorage.getItem("user") || "{}");
          return (
            userData?.username ||
            userData?.name ||
            userData?.employeeCode ||
            "admin"
          );
        } catch (error) {
          logger.warn("Error getting user data from localStorage:", error);
          return "admin";
        }
      };

      // Save order summary to Redux first
      const orderSummaryData = {
        netPremium: safeGetString(values.netPremium),
        valueAddedTax: safeGetString(values.valueAddedTax),
        accountPremiumOthers: safeGetString(values.others),
        documentaryStampTax: safeGetString(values.documentaryStampTax),
        localGovernmentTax: safeGetString(values.localGovtTax),
        NCD: safeGetString(values.ncd),
        discount: safeGetString(values.discount),
        grossPremium: safeGetString(values.grossPremium),
        authorizedSignature: values.authorizedSignature,
        commissionDetails:
          values.commissionDetails || defaultCommissionDetails(),
      };

      dispatch(setQuoteOrderSummary(orderSummaryData));


      // Determine the correct lead ID
      const correctLeadId =
        currentQuoteCreation?.leadRefId ||
        quotationData?.leadRefId ||
        quotationData?.lead?.id ||
        leadRefId;

      // Build final quotation data
      let finalQuotationData;

      if (currentQuoteCreation && currentQuoteCreation.leadRefId) {
        const updatedQuoteCreation = {
          ...currentQuoteCreation,
          leadRefId: correctLeadId,
          orderSummary: {
            ...currentQuoteCreation.orderSummary,
            ...orderSummaryData,
          },
        };

        finalQuotationData = transformToBackendFormat(
          updatedQuoteCreation,
          getUserInfo()
        );
      } else if (quotationData) {
        finalQuotationData = {
          leadRefId: correctLeadId,
          productType: quotationData.productType || "Motor",
          quotationStatus: "Draft",

          // Policy Details
          isCoInsurance: quotationData.coInsurance || false,
          insurancePolicyType:
            quotationData.InsurancePolicyType ||
            quotationData.insurancePolicyType,
          accountCode: quotationData.AccountCode || quotationData.accountCode,
          paymentType: quotationData.PaymentType || quotationData.paymentType,
          installmentType:
            quotationData.InstallmentType || quotationData.installmentType,
          // Coverage Details
          lossAndDamageCoverage:
            quotationData.LossandDamagecoverage ||
            quotationData.lossAndDamageCoverage,
          lossAndDamageCoverageRate:
            quotationData.LossandDamagecoverageRate ||
            quotationData.lossAndDamageCoverageRate,
          lossAndDamageCoveragePremium:
            quotationData.LossandDamagecoveragepremium ||
            quotationData.lossAndDamageCoveragePremium,
          actsOfNatureRate:
            quotationData.ActsofNatureRate || quotationData.actsOfNatureRate,
          actsOfNaturePremium:
            quotationData.ActsofNaturepremium ||
            quotationData.actsOfNaturePremium,
          // CTPL is priced by the server from the vehicle class tariff
          includeCTPL: quotationData.includeCTPL,
          ctplTermYears: quotationData.ctplTermYears,
          ctplCoverageRate: quotationData.ctplCoverageRate,
          ctplCoveragePremium: quotationData.ctplCoveragePremium,
          roadsideAssistanceRate: quotationData.roadsideAssistanceRate,
          roadsideAssistancePremium: quotationData.roadsideAssistancePremium,
          personalAccidentCoverRate: quotationData.personalAccidentCoverRate,
          personalAccidentCoverPremium: quotationData.personalAccidentCoverPremium,
          appaSeats: quotationData.appaSeats,
          bodilyInjury:
            quotationData.BodilyInjury || quotationData.bodilyInjury,
          bodilyInjuryCoveragePremium:
            quotationData.BodilyInjuryCoveragePremium ||
            quotationData.bodilyInjuryCoveragePremium,
          propertyDamage:
            quotationData.PropertyDamage || quotationData.propertyDamage,
          propertyDamageCoveragePremium:
            quotationData.PropertyDamageCoveragePremium ||
            quotationData.propertyDamageCoveragePremium,
          autoPassengerPersonalAccident:
            quotationData.AutopassengerpersonalAccident ||
            quotationData.autoPassengerPersonalAccident,
          APPAtotalCoverage:
            quotationData.APPATotalCoverage || quotationData.APPAtotalCoverage,
          APPAcoveragePremium:
            quotationData.APPACoveragePremium ||
            quotationData.APPAcoveragePremium,
          totalSumInsured:
            quotationData.TotalSumInsured || quotationData.totalSumInsured,
          vehicleType: quotationData.vehicleType || quotationData.VehicleType,

          // Accessories
          aircon: quotationData.Aircon || quotationData.aircon,
          stereo: quotationData.Stereo || quotationData.stereo,
          magWheels: quotationData.Magwheels || quotationData.magWheels,
          others: quotationData.Others || quotationData.others,
          deductible: quotationData.Deductible || quotationData.deductible,
          towing: quotationData.Towing || quotationData.towing,
          repairLimit: quotationData.RepairLimit || quotationData.repairLimit,

          // Order Summary (from form)
          discount: safeGetString(values.discount),
          authorizedSignature: values.authorizedSignature,
          netPremium: safeGetString(values.netPremium),
          valueAddedTax: safeGetString(values.valueAddedTax),
          accountPremiumOthers: safeGetString(values.others),
          documentaryStampTax: safeGetString(values.documentaryStampTax),
          localGovernmentTax: safeGetString(values.localGovtTax),
          NCD: safeGetString(values.ncd),
          grossPremium: safeGetString(values.grossPremium),
          commissionDetails:
            values.commissionDetails || defaultCommissionDetails(),

          // User info
          updatedBy: getUserInfo(),
          createdBy: getUserInfo(),

          // Vehicle Details
          insuranceVehicleDetails:
            quotationData.insuranceVehicleDetails ||
            (quotationData.vehicleType || quotationData.VehicleType
              ? [
                  {
                    vehicleType:
                      quotationData.vehicleType || quotationData.VehicleType,
                    vehicleBrand: quotationData.vehicleBrand || quotationData.VehicleBrand,
                    modelYear: quotationData.modelYear || quotationData.ModelYear,
                    vehicleModel: quotationData.vehicleModel || quotationData.VehicleModel,
                    modelVariant: quotationData.modelVariant || quotationData.ModelVariant,
                    vehicleColor: quotationData.vehicleColor || quotationData.VehicleColor,
                    seatingCapacity: quotationData.seatingCapacity || quotationData.SeatingCapacity,
                  },
                ]
              : []),

          // Insurance Company Details
          participantDetails:
            quotationData.participantDetails ||
            (quotationData.InsuranceCompanyName
              ? [
                  {
                    insuranceCompanyName: quotationData.InsuranceCompanyName,
                  },
                ]
              : []),
        };
      } else {
        notifyError(
          "Error: No quote data available. Please go back and fill in the required information."
        );
        return;
      }

      let result;

      // Check if we have a quotationId from URL params or from quotation data
      // Only consider it an existing quotation if we're in an edit flow
      const existingQuotationId = isEditFlow
        ? quotationId || urlQuotationId || quotationData?.quotationId
        : null;

      if (existingQuotationId) {
        // Update existing quotation

        result = await dispatch(
          updateQuotationMiddleware({
            quotationId: existingQuotationId,
            quotationData: finalQuotationData,
          })
        );
      } else {
        result = await dispatch(createQuotationMiddleware(finalQuotationData));
      }

      if (result.type.endsWith("/fulfilled")) {
        // Update toast message based on the actual operation
        const successMessage = existingQuotationId
          ? "Quote Updated Successfully"
          : "Quote Created Successfully";
        setToastMessage(successMessage);

        // Clear Redux quote creation state since we're done
        dispatch(clearCurrentQuoteCreation());

        // Show the toast
        toastRef.current.showToast();

        setTimeout(() => {
          // Navigate to quote detail view with the complete quotation data
          const quotationIdToUse =
            result.payload?.quotationId || existingQuotationId;

          navigate("/agent/quotedetailview", {
            state: {
              quotationData: result.payload,
              quotationId: quotationIdToUse,
            },
          });
        }, 2000);
      } else if (result.type.endsWith("/rejected")) {
        notifyError(
          `Failed to ${existingQuotationId ? "update" : "create"} quotation: ` +
            (result.payload || "Unknown error")
        );
      }
    } catch (error) {
      notifyError("An unexpected error occurred while processing the quotation");
    }
  };
  const handleBackNavigation = () => {
    // a renewal goes back to its accessories step; history may not hold it (opened from a link or after a reload)
    if (flow === "renewal" && policyId) {
      navigate(`/agent/renewalquote/accessories/accessorirsdetails/${policyId}`, { state: { policyId } });
      return;
    }
    customHistory.back();
  };

  const validateForm = (values) => {
    const errors = {};

    // Validate accounting equation before submit
    const netPremiumNum = parseFloat(values.netPremium) || 0;
    const grossPremiumNum = parseFloat(values.grossPremium) || 0;
    const vatNum = parseFloat(values.valueAddedTax) || 0;
    const dstNum = parseFloat(values.documentaryStampTax) || 0;
    const lgtNum = parseFloat(values.localGovtTax) || 0;
    const othersNum = parseFloat(values.others) || 0;
    const discountNum = parseFloat(values.discount) || 0;

    const calculatedTotal =
      netPremiumNum + vatNum + dstNum + lgtNum + othersNum + ctplAmount - discountNum;
    const difference = Math.abs(grossPremiumNum - calculatedTotal);

    if (difference > 0.01 && grossPremiumNum > 0) {
      const commission = grossPremiumNum - netPremiumNum;
      logger.warn("[ORDER SUMMARY VALIDATION] Accounting equation mismatch:", {
        grossPremium: grossPremiumNum,
        netPremium: netPremiumNum,
        valueAddedTax: vatNum,
        documentaryStampTax: dstNum,
        localGovernmentTax: lgtNum,
        accountPremiumOthers: othersNum,
        discount: discountNum,
        commission,
        calculatedTotal,
        difference,
      });
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    enableReinitialize: true, // Allow form to reinitialize when quotation data changes
    validate: validateForm,
    onSubmit: (values) => {
      handleclick(values);
    },
  });

  // Authorised signatories from the Signatories master; the configured default is proposed when none is chosen yet
  const signatoryOptions = useSignatoryOptions(formik.values.authorizedSignature);
  useEffect(() => {
    if (!formik.values.authorizedSignature && signatoryOptions.defaultValue) {
      formik.setFieldValue("authorizedSignature", signatoryOptions.defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatoryOptions, formik.values.authorizedSignature]);

  const parseAmount = (val) => {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (val == null || val === "") return 0;
    const parsed = parseFloat(String(val).replace(/[,%]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // CTPL: Insurance Commission tariff amount inclusive of taxes and fees, added to the gross and never discounted
  const ctplAmount = parseAmount(serverPremium?.ctplCoveragePremium ?? quotationData?.ctplCoveragePremium);

  // Pre-discount base: net + taxes + others (customer discount comes out of broker)
  const getPremiumBase = (values = formik.values) =>
    parseAmount(values.netPremium) +
    parseAmount(values.valueAddedTax) +
    parseAmount(values.documentaryStampTax) +
    parseAmount(values.localGovtTax) +
    parseAmount(values.others);

  const applyDiscountPercent = (discountPercent) => {
    const base = getPremiumBase();
    const discountAmount = Number(((base * discountPercent) / 100).toFixed(2));
    const grossPremium = Math.max(0, Number((base - discountAmount + ctplAmount).toFixed(2)));
    formik.setFieldValue("discount", discountAmount.toFixed(2));
    formik.setFieldValue("grossPremium", grossPremium.toFixed(2));
  };

  const handleDiscountChange = (amount) => {
    const newDiscount = Math.max(0, Math.min(discount + amount, 30));
    setDiscount(newDiscount);
    applyDiscountPercent(newDiscount);
  };

  // Sync % card from the loaded discount amount when quote data initializes
  useEffect(() => {
    const base = getPremiumBase(initialValue);
    const discountAmt = parseAmount(initialValue?.discount);
    if (base > 0 && discountAmt > 0) {
      const pct = Math.round((discountAmt / base) * 100);
      setDiscount(Math.max(0, Math.min(pct, 30)));
    } else if (discountAmt <= 0) {
      setDiscount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialValue?.discount,
    initialValue?.netPremium,
    initialValue?.grossPremium,
  ]);

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  return (
    <div className="order__summary__container">
      <CustomToast ref={toastRef} message={toastMessage} />
      <div className="order__summary__main__title">
        {flow === "renewal" ? t("agent.client") : t("agent.leads")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="order__summary__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="order__summary__back__btn__title">
          {flow === "renewal"
            ? clientData
              ? [clientData.name, clientData.code && `${t("agent.clientIdLabel")} ${clientData.code}`]
                  .filter(Boolean)
                  .join(" / ")
              : t("agent.loadingClientData")
            : leadData
            ? `${leadData.firstName || ""} ${
                leadData.lastName || ""
              } / ${t("agent.leadIdLabel")} ${leadData.generatedLeadId || ""}`
            : leadRefId
            ? `${t("agent.leadIdLabel")} ${leadRefId}`
            : t("agent.loadingLeadData")}
        </div>
      </div>
      {/* <form> */}
      <Card className="mt-4">
        <div className="order__summary__title">
          {flow === "renewal" ? t("agent.renewalDetails") : t("agent.createQuote")}
        </div>
        <div className="order__summary__subtitle mb-2 mt-2">{t("agent.orderSummary")}</div>
        <div class="grid mt-2 nested-grid">
          {/* Left column: premiums / taxes / totals */}
          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div class="grid">
              <div class="col-12 mt-0">
                <CalculaitionTextInputs
                  label={t("agent.netPremium")}
                  value={formik.values.netPremium}
                  onChange={formik.handleChange("netPremium")}
                  error={formik.touched.netPremium && formik.errors.netPremium}
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.valueAddedTax")}
                  value={formik.values.valueAddedTax}
                  onChange={formik.handleChange("valueAddedTax")}
                  error={
                    formik.touched.valueAddedTax && formik.errors.valueAddedTax
                  }
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.othersAccPremium")}
                  value={formik.values.others}
                  onChange={formik.handleChange("others")}
                  error={formik.touched.others && formik.errors.others}
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.documentaryStampTax")}
                  value={formik.values.documentaryStampTax}
                  onChange={formik.handleChange("documentaryStampTax")}
                  error={
                    formik.touched.documentaryStampTax &&
                    formik.errors.documentaryStampTax
                  }
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label="Local Gov't Tax"
                  value={formik.values.localGovtTax}
                  onChange={formik.handleChange("localGovtTax")}
                  error={
                    formik.touched.localGovtTax && formik.errors.localGovtTax
                  }
                />
              </div>
              {ctplAmount > 0 && (
                <div class="col-12 mt-2">
                  <CalculaitionTextInputs
                    label={t("coverageDetailsCard.ctplTariffPremium")}
                    value={ctplAmount.toFixed(2)}
                  />
                </div>
              )}
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.discount")}
                  value={formik.values.discount}
                  onChange={formik.handleChange("discount")}
                  error={formik.touched.discount && formik.errors.discount}
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.totalSumInsured")}
                  value={formik.values.totalSumInsured || "0.00"}
                  onChange={() => {}}
                  disabled={true}
                />
              </div>
              <div class="col-12 mt-2">
                <CalculaitionTextInputs
                  label={t("agent.totalPremiumGrossPremium")}
                  value={formik.values.grossPremium}
                  onChange={formik.handleChange("grossPremium")}
                  error={
                    formik.touched.grossPremium && formik.errors.grossPremium
                  }
                />
              </div>
            </div>
          </div>

          {/* Right column: discount and authorised signature */}
          <div class="col-12 md:col-6 lg:col-6 xl:col-6">
            <div className="discount__dynamic__card">
              <div className="discount__dynamic__card__title">
                {t("agent.discountOptional")}
              </div>
              <div className="discount__dynamic__card__subtitle">
                {t("agent.enterDiscountForCustomer")}
              </div>
              <div className="discount__dynamic__card__bottom">
                <div
                  className="cursor-pointer"
                  onClick={() => handleDiscountChange(-1)}
                >
                  <SvgCountMinusIcon />
                </div>
                <div className="discount__reflection__text">{`${discount}%`}</div>
                <div
                  className="cursor-pointer"
                  onClick={() => handleDiscountChange(1)}
                >
                  <SvgCountPlusIcon />
                </div>
              </div>
            </div>
            <div
              className="discount__action__container"
              style={{ color: "green" }}
            >
              <div className="discount__action__text">{t("agent.minPercent")}</div>
              <div className="discount__action__text">{t("agent.maxPercent")}</div>
            </div>
            <div className="mt-2">
              <DropdownField
                label={t("agent.authorizedSignature")}
                value={formik.values.authorizedSignature}
                options={signatoryOptions}
                onChange={(e) => {
                  formik.setFieldValue("authorizedSignature", e.value);
                }}
                optionLabel="label"
                error={
                  formik.touched.authorizedSignature &&
                  formik.errors.authorizedSignature
                }
              />
              <NoSignatoryHint options={signatoryOptions} />
            </div>
          </div>
        </div>
        <div class="grid m-0">
          <div className="col-12 p-0">
            {flow === "renewal" && stepError && <div className="col-12"><StepErrors error={stepError} /></div>}
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button
                  className="back__btn"
                  onClick={handleBackNavigation}
                >
                  {t("agent.back")}
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  className="next__btn"
                  onClick={() => {
                    formik.handleSubmit();
                  }}
                >
                  {t("agent.completedQuote")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      {/* </form> */}
    </div>
  );
};

export default OrderSummary;
