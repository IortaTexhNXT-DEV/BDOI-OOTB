import { SUPPORTED_CURRENCIES } from "../../../utility/currencyOptions";

// Policy types, account codes, vehicle brands / models / variants, model years and colours come from the
// masters and configuration (see policyDetailsCard/useQuoteOptions.js), not from this file.

export const InsuranceCompanyOptions = [
  { label: "SecureGuard Insurance", value: "SecureGuard Insurance" },
  { label: "Apex Assurance", value: "Apex Assurance" },
  { label: "Liberty Shield Insurance", value: "Liberty Shield Insurance" },
  { label: "Sentinel Underwriters", value: "Sentinel Underwriters" },
  { label: "Golden Horizon Assurance", value: "Golden Horizon Assurance" },
  { label: "Integrity Insurance Co.", value: "Integrity Insurance Co." },
  { label: "EverSafe Insure", value: "EverSafe Insure" },
];

export const InsurancePolicycontainer = [
  { label: "Apex Assurance", value: "Apex Assurance", sumInsured: "65000" },
  {
    label: "Liberty Shield Insurance",
    value: "Liberty Shield Insurance",
    sumInsured: "97500",
  },
  {
    label: "Sentinel Underwriters ",
    value: "Sentinel Underwriters",
    sumInsured: "32500",
  },
];

export const pesoTypes = SUPPORTED_CURRENCIES;

export const PremiumCurrency = SUPPORTED_CURRENCIES;
export const InstallmentType = [
  { label: "Monthly", value: "Monthly" },
  { label: "Quarterly", value: "Quarterly" },
  { label: "Half yearly", value: "Half yearly" },
  { label: "yearly", value: "yearly" },
];

export const PolicyTypes = [
  { label: "Cash", value: "Cash" },
  { label: "Credit", value: "Credit" },
];
