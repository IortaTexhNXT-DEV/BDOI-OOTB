/**
 * Utility functions to transform quotation data between frontend form format and backend API schema
 */

import { getDisplayCurrencyConfig } from "../../../utility/currencyConverter";

/** Default currency of a new quote line: the display currency from System Settings. */
const defaultCurrency = () => getDisplayCurrencyConfig().currency;

/**
 * Transform form data from multi-step creation to backend API format
 * @param {Object} quoteCreationState - The currentQuoteCreation state from Redux
 * @param {string} createdBy - Username of the creator
 * @returns {Object} - Data formatted for backend API
 */
export const transformToBackendFormat = (
  quoteCreationState,
  createdBy = "agent"
) => {
  const {
    leadRefId,
    policyDetails,
    coverageDetails,
    accessories,
    orderSummary,
  } = quoteCreationState;

  // Build the main quotation object
  const quotationData = {
    leadRefId,
    isCoInsurance: policyDetails?.isCoInsurance || false,
    insurancePolicyType: policyDetails?.insurancePolicyType || null,
    accountCode: policyDetails?.accountCode || null,
    paymentType: policyDetails?.paymentType || null,
    productType: "Motor", // Default for now, can be dynamic
    quotationStatus: "Draft",

    // Coverage details
    lossAndDamageCoverage: coverageDetails?.lossAndDamageCoverage || null,
    lossAndDamageCoverageRate:
      coverageDetails?.lossAndDamageCoverageRate || null,
    lossAndDamageCoveragePremium:
      coverageDetails?.lossAndDamageCoveragePremium || null,
    actsOfNatureRate: coverageDetails?.actsOfNatureRate || null,
    actsOfNaturePremium: coverageDetails?.actsOfNaturePremium || null,
    // CTPL: the server prices it at the vehicle class tariff when included
    includeCTPL: Boolean(coverageDetails?.includeCTPL),
    ctplTermYears: coverageDetails?.ctplTermYears || 1,
    ctplCoverageRate: coverageDetails?.ctplCoverageRate || null,
    ctplCoveragePremium: coverageDetails?.ctplCoveragePremium || null,
    appaSeats: coverageDetails?.appaSeats || null,
    roadsideAssistanceRate: coverageDetails?.roadsideAssistanceRate || null,
    roadsideAssistancePremium:
      coverageDetails?.roadsideAssistancePremium || null,
    personalAccidentCoverRate:
      coverageDetails?.personalAccidentCoverRate || null,
    personalAccidentCoverPremium:
      coverageDetails?.personalAccidentCoverPremium || null,
    bodilyInjury: coverageDetails?.bodilyInjury || null,
    bodilyInjuryCoveragePremium:
      coverageDetails?.bodilyInjuryCoveragePremium || null,
    propertyDamage: coverageDetails?.propertyDamage || null,
    propertyDamageCoveragePremium:
      coverageDetails?.propertyDamageCoveragePremium || null,
    autoPassengerPersonalAccident:
      coverageDetails?.autoPassengerPersonalAccident || null,
    APPAtotalCoverage: coverageDetails?.APPAtotalCoverage || null,
    APPAcoveragePremium: coverageDetails?.APPAcoveragePremium || null,
    totalSumInsured: coverageDetails?.totalSumInsured || null,

    // Accessories
    aircon: accessories?.aircon || null,
    stereo: accessories?.stereo || null,
    magWheels: accessories?.magWheels || null,
    others: accessories?.others || null,
    deductible: accessories?.deductible || null,
    towing: accessories?.towing || null,
    repairLimit: accessories?.repairLimit || null,

    // Order summary
    discount: orderSummary?.discount || null,
    authorizedSignature: orderSummary?.authorizedSignature || null,
    customerAccepted: null, // Can be set later
    netPremium: orderSummary?.netPremium || null,
    valueAddedTax: orderSummary?.valueAddedTax || null,
    accountPremiumOthers: orderSummary?.accountPremiumOthers || null,
    documentaryStampTax: orderSummary?.documentaryStampTax || null,
    localGovernmentTax: orderSummary?.localGovernmentTax || null,
    NCD: orderSummary?.NCD || null,
    grossPremium: orderSummary?.grossPremium || null,
    commissionDetails: orderSummary?.commissionDetails || null,

    createdBy,
  };

  // Add vehicle details if available
  if (
    policyDetails?.vehicleType ||
    policyDetails?.vehicleBrand ||
    policyDetails?.vehicleModel
  ) {
    quotationData.insuranceVehicleDetails = [
      {
        vehicleType: policyDetails.vehicleType || null,
        vehicleBrand: policyDetails.vehicleBrand || null,
        modelYear: policyDetails.modelYear || null,
        vehicleModel: policyDetails.vehicleModel || null,
        modelVariant: policyDetails.modelVariant || null,
        vehicleColor: policyDetails.vehicleColor || null,
        seatingCapacity: policyDetails.seatingCapacity || null,
      },
    ];
  }

  // Add participant details - handle both single insurer and co-insurance scenarios

  if (policyDetails?.isCoInsurance) {
    // Build participant array with PRIMARY insurer first
    const participants = [];

    // Add primary insurer from form field
    if (policyDetails.insuranceCompanyName) {
      const primaryShare = policyDetails.primarySharePercentage || "50";

      participants.push({
        insuranceCompanyName: policyDetails.insuranceCompanyName,
        participantName: policyDetails.insuranceCompanyName,
        sumInsuredCurrency: defaultCurrency(),
        premiumCurrency: defaultCurrency(),
        sharePercentage: primaryShare,
        isLead: true, // the primary insurer is the lead of the co-insurance (validated on the server)
      });
    }

    // Add co-insurers from participant table
    if (policyDetails.participantDetails?.length > 0) {
      const coInsurers = policyDetails.participantDetails.map((p, index) => {
        const coInsurer = {
          insuranceCompanyName:
            p.insuranceCompanyName ||
            p.InsuranceCompanyName ||
            p.participantName ||
            p.ParticipantName,
          participantName: p.participantName || p.ParticipantName || null,
          sumInsuredCurrency:
            p.sumInsuredCurrency || p.SumInsuredcurrency || defaultCurrency(),
          premiumCurrency: p.premiumCurrency || p.Premiumcurrencys || defaultCurrency(),
          sharePercentage: p.sharePercentage || p.Sharepercentage || null,
        };
        return coInsurer;
      });

      participants.push(...coInsurers);
    }

    quotationData.participantDetails = participants;
  } else {
    // Single insurer (no co-insurance)
    if (policyDetails?.insuranceCompanyName) {
      quotationData.participantDetails = [
        {
          insuranceCompanyName: policyDetails.insuranceCompanyName,
          participantName: policyDetails.insuranceCompanyName,
          sumInsuredCurrency: defaultCurrency(),
          premiumCurrency: defaultCurrency(),
          sharePercentage: "100",
          isLead: true,
        },
      ];
    }
  }

  return quotationData;
};

/**
 * Transform backend quotation data to frontend form format
 * @param {Object} quotation - Quotation data from backend
 * @returns {Object} - Data formatted for frontend forms
 */
export const transformToFrontendFormat = (quotation) => {
  // If co-insurance, extract primary share from first participant, and co-insurers from rest
  const isCoInsurance = quotation.isCoInsurance || false;
  let primarySharePercentage = "50";
  let coInsurerParticipants = [];

  if (isCoInsurance && quotation.participantDetails?.length > 0) {
    // First participant is primary insurer
    primarySharePercentage =
      quotation.participantDetails[0]?.sharePercentage || "50";
    // Rest are co-insurers
    coInsurerParticipants = quotation.participantDetails.slice(1);
  }

  return {
    leadRefId: quotation.leadRefId,
    quotationId: quotation.quotationId,
    policyDetails: {
      insuranceCompanyName:
        quotation.participantDetails?.[0]?.insuranceCompanyName || "",
      insurancePolicyType: quotation.insurancePolicyType || "",
      accountCode: quotation.accountCode || "",
      vehicleBrand: quotation.insuranceVehicleDetails?.[0]?.vehicleBrand || "",
      modelYear: quotation.insuranceVehicleDetails?.[0]?.modelYear || "",
      vehicleModel: quotation.insuranceVehicleDetails?.[0]?.vehicleModel || "",
      modelVariant: quotation.insuranceVehicleDetails?.[0]?.modelVariant || "",
      vehicleColor: quotation.insuranceVehicleDetails?.[0]?.vehicleColor || "",
      seatingCapacity:
        quotation.insuranceVehicleDetails?.[0]?.seatingCapacity || "",
      paymentType: quotation.paymentType || "",
      installmentType: quotation.installmentType || "",
      isCoInsurance: isCoInsurance,
      primarySharePercentage: primarySharePercentage,
      participantDetails: coInsurerParticipants, // Only co-insurers, not primary
    },
    coverageDetails: {
      lossAndDamageCoverage: quotation.lossAndDamageCoverage || "",
      lossAndDamageCoverageRate: quotation.lossAndDamageCoverageRate || "",
      lossAndDamageCoveragePremium:
        quotation.lossAndDamageCoveragePremium || "",
      actsOfNatureRate: quotation.actsOfNatureRate || "",
      actsOfNaturePremium: quotation.actsOfNaturePremium || "",
      roadsideAssistanceRate: quotation.roadsideAssistanceRate || "",
      roadsideAssistancePremium: quotation.roadsideAssistancePremium || "",
      personalAccidentCoverRate: quotation.personalAccidentCoverRate || "",
      personalAccidentCoverPremium:
        quotation.personalAccidentCoverPremium || "",
      bodilyInjury: quotation.bodilyInjury || "",
      bodilyInjuryCoveragePremium: quotation.bodilyInjuryCoveragePremium || "",
      propertyDamage: quotation.propertyDamage || "",
      propertyDamageCoveragePremium:
        quotation.propertyDamageCoveragePremium || "",
      autoPassengerPersonalAccident:
        quotation.autoPassengerPersonalAccident || "",
      APPAtotalCoverage: quotation.APPAtotalCoverage || "",
      APPAcoveragePremium: quotation.APPAcoveragePremium || "",
      totalSumInsured: quotation.totalSumInsured || "",
    },
    accessories: {
      aircon: quotation.aircon || "",
      stereo: quotation.stereo || "",
      magWheels: quotation.magWheels || "",
      others: quotation.others || "",
      deductible: quotation.deductible || "",
      towing: quotation.towing || "",
      repairLimit: quotation.repairLimit || "",
    },
    orderSummary: {
      netPremium: quotation.netPremium || "",
      valueAddedTax: quotation.valueAddedTax || "",
      accountPremiumOthers: quotation.accountPremiumOthers || "",
      documentaryStampTax: quotation.documentaryStampTax || "",
      localGovernmentTax: quotation.localGovernmentTax || "",
      NCD: quotation.NCD || "",
      discount: quotation.discount || "",
      grossPremium: quotation.grossPremium || "",
      authorizedSignature: quotation.authorizedSignature || "",
      commissionDetails: quotation.commissionDetails || null,
    },
  };
};

/**
 * Parse numeric value from string (handles commas, percentages, etc.)
 * @param {string} value - Value to parse
 * @returns {number} - Parsed numeric value
 */
export const parseNumericValue = (value) => {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const cleanValue = String(value).replace(/[,%]/g, "");
  const parsed = parseFloat(cleanValue);

  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format number with commas for display
 * @param {number|string} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted string
 */
export const formatCurrency = (value, decimals = 2) => {
  const num = parseNumericValue(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Calculate premium based on coverage and rate
 * @param {string|number} coverage - Coverage amount
 * @param {string|number} rate - Rate (as percentage or decimal)
 * @returns {string} - Calculated premium
 */
export const calculatePremium = (coverage, rate) => {
  const coverageValue = parseNumericValue(coverage);
  const rateValue = parseNumericValue(rate);

  const premium = (coverageValue * rateValue) / 100;
  return premium.toFixed(2);
};
