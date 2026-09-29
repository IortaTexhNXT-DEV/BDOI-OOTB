const THAILAND_COUNTRY_CODES = ["TH", "Thailand", "THAILAND"];

export const isThailand = (country) =>
  !country
    ? false
    : typeof country === "string"
      ? THAILAND_COUNTRY_CODES.some((c) => c === country)
      : THAILAND_COUNTRY_CODES.some(
          (c) => c === country?.label || c === country?.name || c === country?.code
        );

/** Map legacy stored values to address API country names */
export const normalizeCountryName = (country) => {
  if (!country) return "";
  const value = String(country).trim();
  if (value.toUpperCase() === "PHILIPPINES") return "Philippines";
  if (value.toUpperCase() === "THAILAND") return "Thailand";
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
