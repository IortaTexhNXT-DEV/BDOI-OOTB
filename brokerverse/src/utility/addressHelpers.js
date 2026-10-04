/** Map legacy stored values to address API country names */
export const normalizeCountryName = (country) => {
  if (!country) return "";
  const value = String(country).trim();
  if (value.toUpperCase() === "PHILIPPINES") return "Philippines";
  if (value.toUpperCase() === "INDIA") return "India";
  return value;
};

export const toAddressOptions = (items = []) =>
  items.map((item) => ({
    label: item.name || item.code || String(item.id),
    value: item.name || item.code || String(item.id),
  }));

export const addFallbackOption = (value, options = []) => {
  if (!value) return options;

  const hasOption = options.some(
    (option) =>
      typeof option === "string"
        ? option === value
        : option?.value === value || option?.label === value
  );

  if (hasOption) return options;

  if (!options.length) {
    return [{ label: value, value }];
  }

  return [{ label: value, value }, ...options];
};

const normAddressText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
// "MAKATI CITY" / "City of Makati" -> "makati" so saved free-text names still match the master
const looseAddressText = (value) =>
  normAddressText(value).replace(/^city of /, "").replace(/ city$/, "");

const rawAddressValue = (value) =>
  value && typeof value === "object"
    ? value.value ?? value.name ?? value.label ?? value.code
    : value;

/**
 * Find a master record ({ id, code?, name }) for a saved value: id, code or name, case-insensitive;
 * then ignoring a "City" suffix / "City of" prefix. Returns undefined when nothing matches.
 */
export const findAddressItem = (items = [], value) => {
  const raw = rawAddressValue(value);
  const v = normAddressText(raw);
  if (!v || !Array.isArray(items)) return undefined;
  const exact = items.find(
    (i) =>
      String(i?.id ?? "") === v ||
      (i?.code && normAddressText(i.code) === v) ||
      (i?.name && normAddressText(i.name) === v)
  );
  if (exact) return exact;
  const loose = looseAddressText(raw);
  if (!loose) return undefined;
  return items.find((i) => i?.name && looseAddressText(i.name) === loose);
};

/** Master name for a saved value, or the saved value itself when it is not in the master. */
export const canonicalAddressValue = (items = [], value) => {
  const raw = rawAddressValue(value);
  if (raw === null || raw === undefined || raw === "") return "";
  return findAddressItem(items, raw)?.name || String(raw);
};

/** Dropdown options from a master list, plus the saved value when the master does not have it. */
export const addressOptionsWithSaved = (items = [], savedValue) => {
  const options = toAddressOptions(items);
  const raw = rawAddressValue(savedValue);
  if (!raw || findAddressItem(items, raw)) return options;
  return addFallbackOption(String(raw), options);
};

export const isPhilippines = (country) => {
  const v = normAddressText(rawAddressValue(country));
  return v === "ph" || v === "philippines";
};

/** Philippine ZIP codes are 4 digits. */
export const isValidPhilippineZip = (zip) =>
  /^\d{4}$/.test(String(zip ?? "").trim());
