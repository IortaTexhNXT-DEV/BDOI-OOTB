/**
 * Mobile numbers from configuration (System Settings general.phone_country_code, general.mobile_pattern,
 * general.mobile_example). Accepted input: 09171234567, 9171234567, +63 917 123 4567, 63-917-123-4567.
 * Stored form: the national (trunk) form 0 + national number, e.g. 09171234567, which the lead API documents.
 */
const DEFAULTS = {
  countryCode: "+63",
  pattern: "^9\\d{9}$",
  example: "0917 123 4567 or +63 917 123 4567",
};

let config = { ...DEFAULTS };

/** Apply the mobile number settings from the system settings payload. */
export const setPhoneConfig = ({ phoneCountryCode, mobilePattern, mobileExample } = {}) => {
  let pattern = DEFAULTS.pattern;
  try {
    if (mobilePattern) {
      new RegExp(mobilePattern); // eslint-disable-line no-new
      pattern = mobilePattern;
    }
  } catch {
    pattern = DEFAULTS.pattern;
  }
  config = {
    countryCode: phoneCountryCode || DEFAULTS.countryCode,
    pattern,
    example: mobileExample || DEFAULTS.example,
  };
};

/** The configured dialling prefix (general.phone_country_code, e.g. "+63") shown in front of phone fields. */
export const phoneCountryCode = () => config.countryCode;

/** The hint shown under a mobile number field. */
export const mobileHint = () => config.example;

/** National number (no trunk 0, no country code) from what the user typed, or null when it cannot be read. */
const nationalNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/[^\d\s()+.-]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  const cc = config.countryCode.replace(/\D/g, "");
  if (raw.startsWith("+") || (cc && digits.startsWith(cc) && digits.length > cc.length + 8)) {
    return digits.startsWith(cc) ? digits.slice(cc.length) : null;
  }
  return digits.startsWith("0") ? digits.slice(1) : digits;
};

/** True when the value is a valid mobile number in any accepted form. */
export const isValidMobile = (value) => {
  const national = nationalNumber(value);
  return !!national && new RegExp(config.pattern).test(national);
};

/** The stored form (09171234567) of a valid mobile number; the value unchanged when it is not valid. */
export const normalizeMobile = (value) => {
  const national = nationalNumber(value);
  return national && new RegExp(config.pattern).test(national) ? `0${national}` : value;
};
