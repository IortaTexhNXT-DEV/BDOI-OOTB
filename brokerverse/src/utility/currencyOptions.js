export const DEFAULT_CURRENCY = "PHP";

export const SUPPORTED_CURRENCIES = [
  { label: "PHP", value: "PHP" },
  { label: "THB", value: "THB" },
  { label: "USD", value: "USD" },
];

/** Dropdown shape used by Receipts / Payment Voucher ({ name, code }) */
export const SUPPORTED_CURRENCIES_NAME_CODE = SUPPORTED_CURRENCIES.map((c) => ({
  name: c.label,
  code: c.value,
}));

/** Petty cash initiate shape ({ CurrencyType }) */
export const SUPPORTED_CURRENCIES_PETTY_CASH = SUPPORTED_CURRENCIES.map((c) => ({
  CurrencyType: c.value,
}));
