/**
 * Endorsement categories by Line of Business (LOB).
 * Motor uses numeric type IDs (1-5); Fire uses string keys (fire_regular, fire_cancel).
 */

/** Motor endorsement categories (type IDs 1-5) */
export const MOTOR_CATEGORIES = [
  { name: "Personal Details Change", key: "personaldetail", typeId: "1", translationKey: "policyDetail.endorsementTypePersonalDetails" },
  { name: "Motor Details Change", key: "motordetail", typeId: "2", translationKey: "policyDetail.endorsementTypeMotorDetails" },
  { name: "Coverage Change", key: "coveragechange", typeId: "3", translationKey: "policyDetail.endorsementTypeCoverageChange" },
  { name: "Policy Extend", key: "ploicyextend", typeId: "4", translationKey: "policyDetail.endorsementTypePolicyExtend" },
  { name: "Policy Cancel", key: "policycancel", typeId: "5", translationKey: "policyDetail.endorsementTypePolicyCancel" },
];

/** Fire and Allied Perils endorsement categories */
export const FIRE_CATEGORIES = [
  {
    name: "Regular / Premium Change",
    key: "fire_regular",
    typeId: "fire_regular",
    description: "Changes to risk, coverage, or premium (e.g. sum insured, address, VAT)",
    translationKey: "policyDetail.endorsementTypeFireRegular",
  },
  {
    name: "Policy Cancellation",
    key: "fire_cancel",
    typeId: "fire_cancel",
    description: "Cancel the Fire policy",
    translationKey: "policyDetail.endorsementTypeFireCancel",
  },
];

/** Fire cancellation types supported by API */
export const FIRE_CANCELLATION_TYPES = [
  { label: "Full Cancellation", value: "FULL" },
  { label: "Partial Cancellation", value: "PARTIAL" },
  { label: "Pro-rata Refund", value: "PRO_RATA" },
  { label: "Pro-rata Partial Refund", value: "PRO_RATA_PARTIAL" },
];

/**
 * Get endorsement categories for a given LOB.
 * @param {string} lob - Line of business: "MOTOR", "Motor", "FIRE", "Fire", "Fire and Allied Perils"
 * @returns {Array} Categories for the LOB
 */
export function getCategoriesForLob(lob) {
  if (!lob) return MOTOR_CATEGORIES;
  const upper = String(lob).toUpperCase();
  if (
    upper.includes("FIRE") ||
    upper === "FIREANDALLIEDPERILS" ||
    upper === "FIRE AND ALLIED PERILS"
  ) {
    return FIRE_CATEGORIES;
  }
  return MOTOR_CATEGORIES;
}

/**
 * Check if policy is Fire LOB.
 * @param {string} lob - productType, lob, or ProductDescription
 * @returns {boolean}
 */
export function isFireLob(lob) {
  if (!lob) return false;
  const upper = String(lob).toUpperCase();
  return (
    upper.includes("FIRE") ||
    upper === "FIREANDALLIEDPERILS" ||
    upper === "FIRE AND ALLIED PERILS"
  );
}
