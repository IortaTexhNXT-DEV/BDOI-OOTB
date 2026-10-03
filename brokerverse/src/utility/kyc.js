/**
 * Customer KYC and vehicle identifiers required to issue a policy.
 *
 * Mirrors the backend check (backend/src/modules/policies/kyc.js): the required items per line of business come from
 * app_settings `policy.kyc_required_fields` and the accepted ID documents from `policy.kyc_id_types`; the defaults below
 * apply when the settings cannot be read. The server refuses issuance (400) when anything is missing, so this is the
 * early, friendlier copy of the same rule.
 */
import systemSettingsService from "../services/systemSettingsService";

export const KYC_DEFAULT_REQUIRED = {
  MOTOR: ["idType", "idNumber", "idImage", "chassisNumber", "motorNumber", "plateOrMvFile"],
  "*": [],
};
export const KYC_DEFAULT_ID_TYPES = [
  "PhilSys ID",
  "UMID",
  "Passport",
  "Driver's License",
  "PRC ID",
  "SSS ID",
  "GSIS ID",
  "TIN ID",
  "Postal ID",
  "Voter's ID",
  "Senior Citizen ID",
];

/** { required: {LOB: [...]}, idTypes: [...] } from the policy settings group (defaults on failure). */
export const loadKycConfig = async () => {
  try {
    const rows = await systemSettingsService.getConfiguration("policy");
    const byKey = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
    return {
      required: byKey["policy.kyc_required_fields"] || KYC_DEFAULT_REQUIRED,
      idTypes: byKey["policy.kyc_id_types"] || KYC_DEFAULT_ID_TYPES,
    };
  } catch {
    return { required: KYC_DEFAULT_REQUIRED, idTypes: KYC_DEFAULT_ID_TYPES };
  }
};

export const requiredKycFor = (config, lob) => {
  const cfg = config?.required || KYC_DEFAULT_REQUIRED;
  const list = cfg[String(lob || "").toUpperCase()] ?? cfg["*"] ?? [];
  return Array.isArray(list) ? list : [];
};

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

/**
 * Formik errors for the Convert Policy customer information form.
 * values: { IdType, IdCardNumber, IdCardImage, ChassisNumber, MotorNumber, PlateNumber, MVFileNumber }
 */
export const kycErrors = (values, required, idTypes = []) => {
  const errors = {};
  const need = new Set(required || []);
  if (need.has("idType")) {
    if (!filled(values.IdType)) errors.IdType = "Select the ID type";
    else if (idTypes.length && !idTypes.includes(values.IdType)) errors.IdType = "This ID is not accepted";
  }
  if (need.has("idNumber") && !filled(values.IdCardNumber)) errors.IdCardNumber = "ID number is required";
  if (need.has("idImage") && !filled(values.IdCardImage)) errors.IdCardImage = "Upload a photo of the ID card";
  if (need.has("chassisNumber") && !filled(values.ChassisNumber)) errors.ChassisNumber = "Chassis number is required";
  if (need.has("motorNumber") && !filled(values.MotorNumber)) errors.MotorNumber = "Motor / engine number is required";
  if (need.has("plateNumber") && !filled(values.PlateNumber)) errors.PlateNumber = "Plate number is required";
  if (need.has("mvFileNumber") && !filled(values.MVFileNumber)) errors.MVFileNumber = "MV file number is required";
  if (need.has("plateOrMvFile") && !filled(values.PlateNumber) && !filled(values.MVFileNumber)) {
    const msg = "Enter the plate number, or the MV file number for a new vehicle without plates";
    errors.PlateNumber = msg;
    errors.MVFileNumber = msg;
  }
  return errors;
};
