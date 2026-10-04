/**
 * My Profile form rules, shared by the screen and its tests. The API applies the same rules (backend
 * src/modules/auth/profile.js); these give the message next to the field before saving.
 */
import { toDate, toIsoDate } from "../../utility/dateFormat";

export const DEFAULT_COUNTRY = "Philippines";

/** Philippine contact numbers: mobile 09XX XXX XXXX / +63 9XX XXX XXXX, or a landline with its area code. */
export const PH_PHONE = /^(?:\+63|0)(?:9\d{9}|[2-8]\d{7,9})$/;
export const normalisePhone = (v) => String(v || "").replace(/[\s\-.()]/g, "");
export const isPhilippines = (country) => !country || /^(philippines|ph)$/i.test(String(country).trim());

/** 09171234567 -> "0917 123 4567"; +639171234567 -> "+63 917 123 4567"; landlines grouped after the area code. */
export const formatPhone = (value) => {
  const v = normalisePhone(value);
  let m = /^0(9\d{2})(\d{3})(\d{4})$/.exec(v);
  if (m) return `0${m[1]} ${m[2]} ${m[3]}`;
  m = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(v);
  if (m) return `+63 ${m[1]} ${m[2]} ${m[3]}`;
  m = /^\+632(\d{4})(\d{4})$/.exec(v);
  if (m) return `+63 2 ${m[1]} ${m[2]}`;
  m = /^02(\d{4})(\d{4})$/.exec(v);
  if (m) return `(02) ${m[1]} ${m[2]}`;
  return value || "";
};

export const GENDERS = ["male", "female", "other", "undisclosed"];

export const FIELDS = [
  "firstName", "lastName", "displayName", "dateOfBirth", "gender", "email", "phone",
  "addressLine", "barangay", "city", "province", "region", "zipCode", "country",
];

/** API profile -> form values (strings; the date as a Date for the calendar). */
export const toFormValues = (profile = {}) => ({
  firstName: profile.firstName || "",
  lastName: profile.lastName || "",
  displayName: profile.displayName || "",
  dateOfBirth: toDate(profile.dateOfBirth),
  gender: profile.gender || null,
  email: profile.email || "",
  phone: formatPhone(profile.phone || ""),
  addressLine: profile.addressLine || "",
  barangay: profile.barangay || "",
  city: profile.city || "",
  province: profile.province || "",
  region: profile.region || "",
  zipCode: profile.zipCode || "",
  country: profile.country || DEFAULT_COUNTRY,
});

/** Form values -> PUT /auth/profile body (the e-mail only when the user may change it). */
export const toPayload = (values, { emailEditable = false } = {}) => {
  const body = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    displayName: values.displayName.trim(),
    dateOfBirth: values.dateOfBirth ? toIsoDate(values.dateOfBirth) : "",
    gender: values.gender || "",
    phone: normalisePhone(values.phone),
    addressLine: values.addressLine.trim(),
    barangay: values.barangay.trim(),
    city: values.city.trim(),
    province: values.province.trim(),
    region: (values.region || "").trim(),
    zipCode: values.zipCode.trim(),
    country: values.country.trim(),
  };
  if (emailEditable) body.email = values.email.trim();
  return body;
};

/** Field errors as message keys (myProfile.errors.<key>). */
export const validateProfile = (values, { emailEditable = false, today = new Date() } = {}) => {
  const errors = {};
  if (!values.displayName.trim()) errors.displayName = "displayNameRequired";
  if (!values.firstName.trim()) errors.firstName = "firstNameRequired";
  if (emailEditable && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "emailInvalid";
  const phone = normalisePhone(values.phone);
  if (phone && !PH_PHONE.test(phone)) errors.phone = "phoneInvalid";
  if (values.dateOfBirth) {
    const d = toDate(values.dateOfBirth);
    if (!d || d >= today || d.getFullYear() < 1900) errors.dateOfBirth = "dateOfBirthInvalid";
  }
  if (values.zipCode.trim() && isPhilippines(values.country) && !/^\d{4}$/.test(values.zipCode.trim())) errors.zipCode = "zipInvalid";
  return errors;
};
