/**
 * Required-field checks for forms that keep their values in plain state (not formik) (D105).
 *
 *   const errors = requiredErrors(form, [["name", "Campaign name"], ["startDate", "Start date"]]);
 *   if (hasErrors(errors)) { setErrors(errors); notifyWarn(errorSummary(errors)); return; }
 *
 * A rule is [field, label] (the field must not be blank) or [field, label, isValid(values) => boolean, message?].
 * The field may be a dotted path ("commission.rate").
 */

/** True for null / undefined, blank text, an empty array or an invalid date. */
export const isBlank = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isNaN(value);
  return false;
};

const read = (values, path) => String(path).split(".").reduce((v, k) => (v === null || v === undefined ? v : v[k]), values);

/**
 * @param {object} values form values
 * @param {Array<[string, string, ((values: object) => boolean)?, string?]>} rules
 * @returns {Record<string, string>} message per failing field ("<label> is required" unless the rule gives one)
 */
export const requiredErrors = (values, rules) => {
  const errors = {};
  for (const [field, label, isValid, message] of rules) {
    const ok = isValid ? isValid(values || {}) : !isBlank(read(values || {}, field));
    if (!ok) errors[field] = message || `${label} is required`;
  }
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

/** One line for a toast: "Please complete: Campaign name, Start date". */
export const errorSummary = (errors) => {
  const list = Object.values(errors || {});
  if (!list.length) return "";
  const required = list.filter((m) => / is required$/.test(m)).map((m) => m.replace(/ is required$/, ""));
  const other = list.filter((m) => !/ is required$/.test(m));
  return [required.length ? `Please complete: ${required.join(", ")}` : "", ...other].filter(Boolean).join(". ");
};
