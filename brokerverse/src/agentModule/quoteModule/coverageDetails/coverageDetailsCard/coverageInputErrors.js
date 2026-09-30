/** Number typed in a coverage field ("950,000" or 950000); NaN when it is not a number. */
const amount = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  return Number(String(value).replace(/,/g, "").trim());
};

/**
 * Checks of the motor coverage form before premiums are calculated or the quote moves on: the own damage sum
 * insured is a positive amount, and every rate that is included is a percentage from 0 to 100. Returns
 * { field: message } (empty when the values can be priced).
 */
const coverageInputErrors = (values = {}, { includeActsOfNature, includeRoadsideAssistance, includePersonalAccident } = {}) => {
  const errors = {};
  const sumInsured = amount(values.LossandDamagecoverage);
  if (Number.isNaN(sumInsured)) errors.LossandDamagecoverage = "Enter the own damage sum insured";
  else if (sumInsured <= 0) errors.LossandDamagecoverage = "The sum insured must be more than zero";

  const rates = [
    ["LossandDamagecoverageRate", true],
    ["ActsofNatureRate", includeActsOfNature],
    ["RoadsideAssistanceRate", includeRoadsideAssistance],
    ["PersonalAccidentCoverRate", includePersonalAccident],
  ];
  rates.forEach(([field, included]) => {
    if (!included) return;
    const rate = amount(values[field]);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) errors[field] = "Enter a rate from 0 to 100 (%)";
  });
  return errors;
};

export default coverageInputErrors;
