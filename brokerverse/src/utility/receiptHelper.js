/**
 * Receipt Helper Utility
 * Standardizes receipt data creation across all payment flows
 */

/**
 * Format a monetary value to a standardized string format
 * @param {string|number} value - The value to format
 * @returns {string} Formatted value as "0.00"
 */
const formatMonetaryValue = (value) => {
  if (!value || value === "" || value === null || value === undefined) {
    return "0.00";
  }

  // Handle string values that might have currency symbols or commas
  const numericValue =
    typeof value === "string"
      ? parseFloat(value.replace(/[^0-9.-]/g, ""))
      : parseFloat(value);

  // Return 0.00 if parsing failed or resulted in NaN
  if (isNaN(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
};

/**
 * Extract customer code from various data structures
 * @param {Object} policyData - Policy data object
 * @param {Object} clientData - Optional separate client data
 * @param {string} fallbackClientId - Fallback client ID
 * @returns {string} Customer code
 */
const extractCustomerCode = (policyData, clientData, fallbackClientId) => {
  console.log("receiptHelper: Client data:", clientData);
  console.log("receiptHelper: Policy data:", policyData);
  console.log("receiptHelper: Fallback client ID:", fallbackClientId);
  // Try client data first - prioritize generatedClientId
  if (clientData) {
    return clientData.generatedClientId || clientData.clientId || clientData.id;
  }

  // Try nested client in policy data - prioritize generatedClientId
  if (policyData?.client) {
    return (
      policyData.client.generatedClientId ||
      policyData.client.clientId ||
      policyData.client.id
    );
  }

  // Try direct clientId on policy (might be generatedClientId passed through)
  if (policyData?.clientId) {
    return policyData.clientId;
  }

  // Use fallback
  return fallbackClientId || "UNKNOWN";
};

/**
 * Build standardized receipt data for payment flows
 * @param {Object} policyData - The policy data object
 * @param {Object} options - Configuration options
 * @param {string} options.paymentStatus - "Pending" or "Completed"
 * @param {Object} options.clientData - Optional separate client data
 * @param {string} options.fallbackClientId - Fallback client ID
 * @param {string} options.fallbackGrossPremium - Fallback gross premium
 * @param {string} options.currentUserId - Current user ID for createdBy
 * @returns {Object} Standardized receipt data
 */
export const buildReceiptData = (policyData, options = {}) => {
  const {
    paymentStatus = "Pending",
    clientData = null,
    fallbackClientId = null,
    fallbackGrossPremium = null,
    currentUserId = "system",
  } = options;

  // Extract policy details with fallbacks
  const policyId = policyData?.policyId || policyData?.id;
  const policyNumber = policyData?.policyNumber || "N/A";

  // Validation - extract customer code early for validation
  const customerCode = extractCustomerCode(
    policyData,
    clientData,
    fallbackClientId
  );

  console.log("receiptHelper: Customer code:", customerCode);

  if (!policyNumber || policyNumber === "N/A") {
    console.error("[RECEIPT HELPER] Missing policy number:", policyData);
    throw new Error("Policy number is required to create receipt");
  }

  if (!customerCode || customerCode === "UNKNOWN") {
    console.error("[RECEIPT HELPER] Missing customer code:", {
      clientData,
      fallbackClientId,
    });
    throw new Error("Customer code is required to create receipt");
  }

  // Extract financial details
  const grossPremium = formatMonetaryValue(
    policyData?.grossPremium || fallbackGrossPremium
  );

  console.log("[RECEIPT HELPER] Building receipt:", {
    policyNumber,
    customerCode,
    grossPremium,
  });
  const netPremium = formatMonetaryValue(policyData?.netPremium);
  const discount = formatMonetaryValue(policyData?.discount);
  const documentaryStampTax = formatMonetaryValue(
    policyData?.documentaryStampTax
  );
  const localGovernmentTax = formatMonetaryValue(
    policyData?.localGovernmentTax
  );
  const valueAddedTax = formatMonetaryValue(policyData?.valueAddedTax);
  const accountPremiumOthers = formatMonetaryValue(
    policyData?.accountPremiumOthers
  );

  // Validate accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
  const netPremiumNum = parseFloat(netPremium) || 0;
  const grossPremiumNum = parseFloat(grossPremium) || 0;
  const vatNum = parseFloat(valueAddedTax) || 0;
  const dstNum = parseFloat(documentaryStampTax) || 0;
  const lgtNum = parseFloat(localGovernmentTax) || 0;
  const othersNum = parseFloat(accountPremiumOthers) || 0;
  const discountNum = parseFloat(discount) || 0;
  const commission = grossPremiumNum - netPremiumNum;
  const calculatedTotal =
    netPremiumNum + vatNum + dstNum + lgtNum + othersNum - discountNum;
  const difference = Math.abs(grossPremiumNum - calculatedTotal);
  
  if (difference > 0.01 && grossPremiumNum > 0) {
    console.warn("[RECEIPT HELPER] Accounting equation warning:", {
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
      policyNumber,
    });
  }

  console.log("[RECEIPT HELPER] Premium breakdown extracted:", {
    grossPremium,
    netPremium,
    valueAddedTax,
    documentaryStampTax,
    localGovernmentTax,
    accountPremiumOthers,
    discount,
    policyNumber,
  });

  // Determine paid/unpaid based on payment status
  const isPaid = paymentStatus === "Completed";
  const paid = isPaid ? grossPremium : "0.00";
  const unPaid = isPaid ? "0.00" : grossPremium;
  const itemStatus = isPaid ? "Paid" : "Pending";

  // Build receipt data object
  const receiptData = {
    receiptType: "Payment",
    receiptDate: new Date().toISOString(),
    customerCode: customerCode,
    currencyCode: "PHP",
    transactionCode: "PAYMENT",
    remarks: `Payment receipt for policy ${policyNumber}`,
    policyRefId: policyId,
    createdBy: currentUserId,
    receiptStatus: "Draft",
    receiptsList: [
      {
        policies: policyNumber,
        netPremium: netPremium,
        paid: paid,
        unPaid: unPaid,
        discounts: discount,
        dst: documentaryStampTax,
        lgt: localGovernmentTax,
        vat: valueAddedTax,
        ewt: "0.00",
        fcAmount: "0.00",
        lcAmount: grossPremium,
        other: accountPremiumOthers,
        status: itemStatus,
      },
    ],
  };

  return receiptData;
};

/**
 * Helper function for Pay Later flow
 * Creates receipt data for policies with pending payment
 */
export const buildPayLaterReceiptData = (policyData, options = {}) => {
  return buildReceiptData(policyData, {
    ...options,
    paymentStatus: "Pending",
  });
};

/**
 * Helper function for Payment Completed flow
 * Creates receipt data for policies with completed payment
 */
export const buildPaymentCompletedReceiptData = (policyData, options = {}) => {
  return buildReceiptData(policyData, {
    ...options,
    paymentStatus: "Completed",
  });
};
