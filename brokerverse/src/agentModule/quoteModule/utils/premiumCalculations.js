/**
 * Premium calculation utilities for quotation module
 */

import { parseNumericValue, calculatePremium } from "./quotationDataTransform";
import logger from "../../../utility/logger";

/**
 * Compute all premium values based on coverage details
 * @param {Object} values - Form values from coverage details
 * @returns {Object} - Updated values with calculated premiums
 */
export const computeAllPremiums = (values) => {
  // Loss & Damage Premium - camelCase only
  const ldCoverage = parseNumericValue(values.lossAndDamageCoverage);
  const ldRate = parseNumericValue(values.lossAndDamageCoverageRate);
  const ldPremium = calculatePremium(ldCoverage, ldRate);

  // Acts of Nature Premium (based on Loss & Damage coverage)
  const aonRate = parseNumericValue(values.actsOfNatureRate);
  const aonPremium = calculatePremium(ldCoverage, aonRate);

  // CTPL: the fixed Insurance Commission tariff premium of the vehicle class (motor tariff), not sum insured x rate.
  const ctplPremium = parseNumericValue(values.ctplCoverageRate || 0).toFixed(2);

  // Roadside Assistance Premium (also based on Loss & Damage coverage)
  const raRate = parseNumericValue(values.roadsideAssistanceRate);
  const raPremium = calculatePremium(ldCoverage, raRate);

  // Personal Accident Cover Premium (also based on Loss & Damage coverage)
  const pacRate = parseNumericValue(values.personalAccidentCoverRate);
  const pacPremium = calculatePremium(ldCoverage, pacRate);

  // Bodily Injury Premium
  const biCoverage = parseNumericValue(values.bodilyInjury);
  const biRate = parseNumericValue(values.bodilyInjuryRate) || 1.0; // Default 1% if not specified
  const biPremium = calculatePremium(biCoverage, biRate);

  // Property Damage Premium
  const pdCoverage = parseNumericValue(values.propertyDamage);
  const pdRate = parseNumericValue(values.propertyDamageRate) || 1.0; // Default 1% if not specified
  const pdPremium = calculatePremium(pdCoverage, pdRate);

  // Auto Passenger Personal Accident: limit per person x seats (driver and passengers) x tariff rate.
  const appaPerPerson = parseNumericValue(values.autoPassengerPersonalAccident);
  const appaSeats = parseNumericValue(values.appaSeats);
  const appaCoverage = appaPerPerson * appaSeats;
  const appaPremium = calculatePremium(appaCoverage, parseNumericValue(values.appaRatePercent));

  // Total Sum Insured
  const totalSumInsured = ldCoverage + biCoverage + pdCoverage + appaCoverage;

  return {
    ...values,
    lossAndDamageCoveragePremium: ldPremium,
    actsOfNaturePremium: aonPremium,
    ctplCoveragePremium: ctplPremium,
    roadsideAssistancePremium: raPremium,
    personalAccidentCoverPremium: pacPremium,
    bodilyInjuryCoveragePremium: biPremium,
    propertyDamageCoveragePremium: pdPremium,
    APPAtotalCoverage: appaCoverage.toFixed(2),
    APPAcoveragePremium: appaPremium,
    totalSumInsured: totalSumInsured.toFixed(2),
  };
};

/**
 * Calculate order summary values (taxes, discounts, gross premium)
 * @param {Object} coverageDetails - Coverage details with premiums
 * @param {Object} accessories - Accessories values
 * @param {number} discountPercent - Discount percentage (0-100)
 * @param {number} ncdPercent - No Claim Discount percentage (0-100)
 * @param {Object} productConfigurator - Product configuration object (optional, defaults to standard rates)
 * @returns {Object} - Order summary with all calculations
 */
export const calculateOrderSummary = (
  coverageDetails,
  accessories = {},
  discountPercent = 0,
  ncdPercent = 0,
  productConfigurator = {},
  settingsRates = {}
) => {
  // Calculate NET Premium (sum of all coverage premiums)
  const ldPremium = parseNumericValue(
    coverageDetails.lossAndDamageCoveragePremium
  );
  const aonPremium = parseNumericValue(coverageDetails.actsOfNaturePremium);
  const ctplPremium = parseNumericValue(coverageDetails.ctplCoveragePremium);
  const raPremium = parseNumericValue(
    coverageDetails.roadsideAssistancePremium
  );
  const pacPremium = parseNumericValue(
    coverageDetails.personalAccidentCoverPremium
  );
  const biPremium = parseNumericValue(
    coverageDetails.bodilyInjuryCoveragePremium
  );
  const pdPremium = parseNumericValue(
    coverageDetails.propertyDamageCoveragePremium
  );
  const appaPremium = parseNumericValue(coverageDetails.APPAcoveragePremium);

  // Add accessories values to premium
  const airconValue = parseNumericValue(
    accessories.aircon || accessories.Aircon
  );
  const stereoValue = parseNumericValue(
    accessories.stereo || accessories.Stereo
  );
  const magWheelsValue = parseNumericValue(
    accessories.magWheels || accessories.Magwheels
  );
  const othersValue = parseNumericValue(
    accessories.others || accessories.Others
  );

  const accessoriesTotal =
    airconValue + stereoValue + magWheelsValue + othersValue;

  // CTPL is the tariff amount inclusive of taxes and fees: outside the taxed net premium, added to the gross.
  let netPremium =
    ldPremium +
    aonPremium +
    raPremium +
    pacPremium +
    biPremium +
    pdPremium +
    appaPremium +
    accessoriesTotal;

  // Apply NCD (No Claim Discount) if any
  const ncdAmount = (netPremium * ncdPercent) / 100;
  netPremium = netPremium - ncdAmount;

  // Use centralized tax rates from product configurator (consistent with calculatePremiumBreakdown)
  const taxRates = getTaxRates(productConfigurator, settingsRates);

  // Tax rates are already decimals (e.g., 0.12 for 12%), so multiply directly
  const valueAddedTax = netPremium * taxRates.valueAddedTax;
  const documentaryStampTax = netPremium * taxRates.documentaryStampTax;
  const localGovernmentTax = netPremium * taxRates.localGovernmentTax;

  // Calculate gross before discount
  let grossBeforeDiscount =
    netPremium + valueAddedTax + documentaryStampTax + localGovernmentTax + ctplPremium;

  // Apply discount
  const discountAmount = (grossBeforeDiscount * discountPercent) / 100;
  const grossPremium = grossBeforeDiscount - discountAmount;

  // Get sum insured for validation (if available)
  const sumInsured = parseNumericValue(coverageDetails.totalSumInsured || 0);

  // Validate and log calculation
  validatePremiumCalculation({
    netPremium,
    grossPremium,
    valueAddedTax,
    documentaryStampTax,
    localGovernmentTax,
    others: ctplPremium, // CTPL (inclusive of taxes) is added to the gross like other charges
    discount: discountAmount,
    sumInsured,
    taxRates,
    ctplPremium, // Validate CTPL premium is reasonable (flat rate)
    context: "calculateOrderSummary",
  });

  const result = {
    netPremium: netPremium.toFixed(2),
    valueAddedTax: valueAddedTax.toFixed(2),
    documentaryStampTax: documentaryStampTax.toFixed(2),
    localGovernmentTax: localGovernmentTax.toFixed(2),
    NCD: ncdAmount.toFixed(2),
    discount: discountAmount.toFixed(2),
    grossPremium: grossPremium.toFixed(2),
    accountPremiumOthers: "0.00", // Can be set separately if needed
  };

  return result;
};

/**
 * Validate if all required premium calculations are present
 * @param {Object} values - Coverage details values
 * @returns {boolean} - True if all premiums are calculated
 */
export const arePremiumsCalculated = (values) => {
  const requiredFields = [
    "lossAndDamageCoveragePremium",
    "actsOfNaturePremium",
    "bodilyInjuryCoveragePremium",
    "propertyDamageCoveragePremium",
    "APPAcoveragePremium",
  ];

  return requiredFields.every((field) => {
    const value = parseNumericValue(values[field]);
    return value > 0 || value === 0; // Allow 0 but not undefined/null
  });
};

/**
 * Validate premium calculations and log warnings if issues detected
 * @param {Object} params - Calculation parameters
 * @param {number} params.netPremium - Net premium amount
 * @param {number} params.grossPremium - Gross premium amount
 * @param {number} params.valueAddedTax - VAT amount
 * @param {number} params.documentaryStampTax - DST amount
 * @param {number} params.localGovernmentTax - LGT amount
 * @param {number} params.others - Others amount
 * @param {number} params.discount - Discount amount
 * @param {number} params.sumInsured - Total sum insured (optional, for validation)
 * @param {Object} params.taxRates - Tax rates used
 * @param {number} params.ctplPremium - CTPL premium (optional, for validation)
 * @param {string} params.context - Context for logging (e.g., "calculatePremiumBreakdown")
 */
const validatePremiumCalculation = ({
  netPremium,
  grossPremium,
  valueAddedTax,
  documentaryStampTax,
  localGovernmentTax,
  others,
  discount,
  sumInsured,
  taxRates,
  ctplPremium,
  context = "Premium Calculation",
}) => {
  // Validate accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
  const calculatedTotal =
    netPremium +
    valueAddedTax +
    documentaryStampTax +
    localGovernmentTax +
    others -
    discount;
  const difference = Math.abs(grossPremium - calculatedTotal);

  if (difference > 0.01 && grossPremium > 0) {
    logger.warn(`[${context}] Accounting equation mismatch:`, {
      grossPremium,
      netPremium,
      valueAddedTax,
      documentaryStampTax,
      localGovernmentTax,
      others,
      discount,
      calculatedTotal,
      difference,
    });
  }

  // Validate tax rates are decimals, not percentages
  if (taxRates) {
    const rateIssues = [];
    if (taxRates.valueAddedTax > 1) {
      rateIssues.push(`VAT rate seems like percentage (${taxRates.valueAddedTax}), should be decimal`);
    }
    if (taxRates.documentaryStampTax > 1) {
      rateIssues.push(`DST rate seems like percentage (${taxRates.documentaryStampTax}), should be decimal`);
    }
    if (taxRates.localGovernmentTax > 1) {
      rateIssues.push(`LGT rate seems like percentage (${taxRates.localGovernmentTax}), should be decimal`);
    }
    if (rateIssues.length > 0) {
      logger.warn(`[${context}] Tax rate validation issues:`, rateIssues);
    }
  }

  // Validate gross premium is reasonable compared to sum insured
  if (sumInsured && sumInsured > 0) {
    const premiumRatio = (grossPremium / sumInsured) * 100;
    if (premiumRatio > 10) {
      logger.warn(
        `[${context}] Gross Premium (${grossPremium}) is ${premiumRatio.toFixed(2)}% of Sum Insured (${sumInsured}). This seems unusually high (>10%). Expected range: 1-5%.`
      );
    }
  }

  // Validate CTPL premium if provided (should be flat rate, not calculated as percentage)
  if (ctplPremium !== undefined && ctplPremium !== null) {
    const ctplNum = typeof ctplPremium === 'string' ? parseFloat(ctplPremium) : ctplPremium;
    if (ctplNum > 10000) {
      logger.warn(
        `[${context}] CTPL Premium (${ctplPremium}) seems unusually high (>10,000). ` +
        `CTPL should be a flat rate (typically 200-2000 THB). ` +
        `This may indicate CTPL was incorrectly calculated as a percentage of coverage.`
      );
    }
  }
};

/**
 * Tax rates used on screen: the configured tax.* rates (GET /settings?group=tax, see useTaxRates), the same rates the
 * server prices with. Values kept in an old product template ("Taxes and fees") are ignored: one source of truth.
 * @param {Object} _productConfigurator - kept for the callers' signature; template taxes are not used
 * @param {Object} settingsRates - decimal rates from useTaxRates
 * @returns {Object} Tax rates as decimals (e.g., 0.12 for 12%)
 */
export const getTaxRates = (_productConfigurator, settingsRates = {}) => ({
  documentaryStampTax: Number(settingsRates.documentaryStampTax) || 0,
  valueAddedTax: Number(settingsRates.valueAddedTax) || 0,
  localGovernmentTax: Number(settingsRates.localGovernmentTax) || 0,
});

/**
 * Calculate all premium components based on coverage details
 * This is the correct implementation for Order Summary premium breakdown
 * @param {Object} coverageValues - Coverage details from form
 * @returns {Object} Calculated premium breakdown
 */
export const calculatePremiumBreakdown = (
  coverageValues,
  productConfigurator = {},
  settingsRates = {}
) => {
  // Helper to parse string values
  const parseValue = (val) => {
    if (!val) return 0;
    const str = String(val).replace(/,/g, "");
    return parseFloat(str) || 0;
  };

  // Sum all coverage premiums to get NET Premium - USING ONLY camelCase
  const lossAndDamagePremium = parseValue(
    coverageValues.lossAndDamageCoveragePremium
  );
  const actsOfNaturePremium = parseValue(coverageValues.actsOfNaturePremium);
  const ctplPremium = parseValue(coverageValues.ctplCoveragePremium);
  const roadsideAssistancePremium = parseValue(
    coverageValues.roadsideAssistancePremium
  );
  const personalAccidentCoverPremium = parseValue(
    coverageValues.personalAccidentCoverPremium
  );
  const bodilyInjuryPremium = parseValue(
    coverageValues.bodilyInjuryCoveragePremium
  );
  const propertyDamagePremium = parseValue(
    coverageValues.propertyDamageCoveragePremium
  );
  const appaPremium = parseValue(coverageValues.APPAcoveragePremium);

  // CTPL is the tariff amount inclusive of taxes and fees: outside the taxed net premium, added to the gross.
  const netPremium =
    lossAndDamagePremium +
    actsOfNaturePremium +
    roadsideAssistancePremium +
    personalAccidentCoverPremium +
    bodilyInjuryPremium +
    propertyDamagePremium +
    appaPremium;

  // Use centralized tax rates
  const taxRates = getTaxRates(productConfigurator, settingsRates);
  
  // Each tax is rounded to the centavo before the gross is added up, as the server does
  // (backend quotations/premium.js), so the gross shown here equals the order summary's.
  const toCentavo = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const documentaryStampTax = toCentavo(netPremium * taxRates.documentaryStampTax);
  const valueAddedTax = toCentavo(netPremium * taxRates.valueAddedTax);
  const localGovernmentTax = toCentavo(netPremium * taxRates.localGovernmentTax);

  // Get discount
  const discount = parseValue(coverageValues.discount || 0);

  // Get others/additional charges
  const others = parseValue(coverageValues.accountPremiumOthers || 0);

  // Calculate gross premium
  const grossPremium =
    netPremium +
    documentaryStampTax +
    valueAddedTax +
    localGovernmentTax +
    ctplPremium +
    others -
    discount;

  // Get sum insured for validation (if available)
  const sumInsured = parseValue(coverageValues.totalSumInsured || 0);

  // Validate and log calculation
  validatePremiumCalculation({
    netPremium,
    grossPremium,
    valueAddedTax,
    documentaryStampTax,
    localGovernmentTax,
    others: others + ctplPremium, // CTPL (inclusive of taxes) is added to the gross like other charges
    discount,
    sumInsured,
    taxRates,
    ctplPremium, // Validate CTPL premium is reasonable (flat rate)
    context: "calculatePremiumBreakdown",
  });

  const result = {
    netPremium: netPremium.toFixed(2),
    documentaryStampTax: documentaryStampTax.toFixed(2),
    valueAddedTax: valueAddedTax.toFixed(2),
    localGovernmentTax: localGovernmentTax.toFixed(2),
    accountPremiumOthers: others.toFixed(2),
    discount: discount.toFixed(2),
    grossPremium: Math.max(0, grossPremium).toFixed(2),
  };

  return result;
};
