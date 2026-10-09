/**
 * Endorsement categories by Line of Business (LOB).
 * Motor uses numeric type IDs (1-5); Fire uses string keys (fire_regular, fire_cancel). The other lines (Personal
 * Accident, Credit Life, Travel, Parcel ...) have no vehicle and no motor tariff: personal details, extension and
 * cancellation only.
 */

/** Motor endorsement categories (type IDs 1-5) */
export const MOTOR_CATEGORIES = [
  { name: "Personal Details Change", key: "personaldetail", typeId: "1", translationKey: "policyDetail.endorsementTypePersonalDetails" },
  { name: "Motor Details Change", key: "motordetail", typeId: "2", translationKey: "policyDetail.endorsementTypeMotorDetails" },
  { name: "Coverage Change", key: "coveragechange", typeId: "3", translationKey: "policyDetail.endorsementTypeCoverageChange" },
  { name: "Policy Extend", key: "ploicyextend", typeId: "4", translationKey: "policyDetail.endorsementTypePolicyExtend" },
  { name: "Policy Cancel", key: "policycancel", typeId: "5", translationKey: "policyDetail.endorsementTypePolicyCancel" },
];

/** Endorsement categories of a line that is neither motor nor fire */
export const GENERAL_CATEGORIES = MOTOR_CATEGORIES.filter((c) => ["1", "4", "5"].includes(c.typeId));

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
  if (isIarLob(lob)) return MOTOR_CATEGORIES; // IAR endorsements not in v1
  const upper = String(lob).toUpperCase();
  if (
    upper.includes("FIRE") ||
    upper === "FIREANDALLIEDPERILS" ||
    upper === "FIRE AND ALLIED PERILS"
  ) {
    return FIRE_CATEGORIES;
  }
  return isOtherLob(lob) ? GENERAL_CATEGORIES : MOTOR_CATEGORIES;
}

/**
 * Check if policy is a motor LOB (Motor or CTPL): the only lines with a vehicle, vehicle photos and identifiers.
 * Credit Life, Personal Accident, Group PA, Travel, Parcel and the other lines are not.
 * @param {string} lob - lob code, productType or ProductDescription
 * @returns {boolean}
 */
export function isMotorLob(lob) {
  if (!lob) return false;
  const upper = String(lob).toUpperCase();
  if (upper.includes("CTPL") || upper.includes("COMPULSORY THIRD PARTY")) return true;
  if (upper.includes("GENERAL LIABILITY") || upper.includes("PERSONAL ACCIDENT")) return false;
  return upper.includes("MOTOR") || upper.includes("PRIVATE CAR") || upper.includes("COMPREHENSIVE") || upper.includes("VEHICLE");
}

const OTHER_LINES = /ACCIDENT|\bPA\b|\bGPA\b|LIFE|\bCL-|TRAVEL|PARCEL|COURIER|MARINE|CARGO|HULL|CASUALTY|LIABILITY|BOND|ENGINEERING|HEALTH|MICRO|EMPLOYEE|\bEB\b/;

/**
 * Check if policy is of a line that is neither motor nor fire / IAR (Personal Accident, Credit Life, Travel, Parcel,
 * Marine ...): no vehicle sections, no motor endorsements. An unknown value is not counted (the screens keep their
 * motor default for older records without a line).
 * @param {string} lob - lob code, productType or ProductDescription
 * @returns {boolean}
 */
export function isOtherLob(lob) {
  if (!lob || isMotorLob(lob) || isFireLob(lob) || isIarLob(lob)) return false;
  return OTHER_LINES.test(String(lob).toUpperCase());
}

/**
 * Check if policy is Industrial All Risks LOB.
 * @param {string} lob - productType, lob, or ProductDescription
 * @returns {boolean}
 */
export function isIarLob(lob) {
  if (!lob) return false;
  const upper = String(lob).toUpperCase();
  return (
    upper === "IAR" ||
    upper.includes("INDUSTRIAL ALL RISK") ||
    upper.includes("INDUSTRIAL_ALL_RISK")
  );
}

/**
 * Check if policy is Fire LOB.
 * @param {string} lob - productType, lob, or ProductDescription
 * @returns {boolean}
 */
export function isFireLob(lob) {
  if (!lob || isIarLob(lob)) return false;
  const upper = String(lob).toUpperCase();
  return (
    upper.includes("FIRE") ||
    upper === "FIREANDALLIEDPERILS" ||
    upper === "FIRE AND ALLIED PERILS"
  );
}
