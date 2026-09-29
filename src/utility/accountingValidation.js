/**
 * Accounting Validation Utility
 * Provides reusable functions for validating accounting equations across payment flows
 */

/**
 * Validate accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
 * 
 * @param {Object} params - Premium breakdown values
 * @param {number} params.grossPremium - Gross premium amount
 * @param {number} params.netPremium - Net premium amount
 * @param {number} params.valueAddedTax - Value Added Tax (VAT)
 * @param {number} params.documentaryStampTax - Documentary Stamp Tax (DST)
 * @param {number} params.localGovernmentTax - Local Government Tax (LGT)
 * @param {number} params.accountPremiumOthers - Other premium charges
 * @param {number} params.discount - Discount amount
 * @param {string} [context] - Optional context string for logging (e.g., "Quote Flow", "Endorsement")
 * @returns {Object} Validation result with isValid, difference, calculatedTotal, and commission
 */
export const validateAccountingEquation = (
  {
    grossPremium,
    netPremium,
    valueAddedTax = 0,
    documentaryStampTax = 0,
    localGovernmentTax = 0,
    accountPremiumOthers = 0,
    discount = 0,
  },
  context = ""
) => {
  // Ensure all values are numbers
  const gross = parseFloat(grossPremium) || 0;
  const net = parseFloat(netPremium) || 0;
  const vat = parseFloat(valueAddedTax) || 0;
  const dst = parseFloat(documentaryStampTax) || 0;
  const lgt = parseFloat(localGovernmentTax) || 0;
  const others = parseFloat(accountPremiumOthers) || 0;
  const disc = parseFloat(discount) || 0;

  // Calculate expected total using correct equation
  const calculatedTotal = net + vat + dst + lgt + others - disc;
  const difference = Math.abs(gross - calculatedTotal);
  const isValid = difference <= 0.01 || gross === 0;
  const commission = gross - net;

  // Log warning if equation doesn't balance (unless grossPremium is 0)
  if (!isValid && gross > 0) {
    const contextStr = context ? ` (${context})` : "";
    console.warn(`⚠️ Accounting equation warning${contextStr}:`, {
      grossPremium: gross,
      netPremium: net,
      valueAddedTax: vat,
      documentaryStampTax: dst,
      localGovernmentTax: lgt,
      accountPremiumOthers: others,
      discount: disc,
      commission,
      calculatedTotal,
      difference,
    });
  }

  return {
    isValid,
    difference,
    calculatedTotal,
    commission,
    breakdown: {
      grossPremium: gross,
      netPremium: net,
      valueAddedTax: vat,
      documentaryStampTax: dst,
      localGovernmentTax: lgt,
      accountPremiumOthers: others,
      discount: disc,
      commission,
    },
  };
};

/**
 * Parse and normalize monetary values from various formats (strings with commas, currency symbols, etc.)
 * 
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed numeric value
 */
export const parseMonetaryValue = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  // Remove commas, currency symbols, and parse
  const cleanValue = String(value).replace(/[^0-9.-]/g, "");
  return parseFloat(cleanValue) || 0;
};

/**
 * Format monetary value for display
 * 
 * @param {number} value - Value to format
 * @returns {string} Formatted value with 2 decimal places
 */
export const formatMonetaryValue = (value) => {
  const num = parseMonetaryValue(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

