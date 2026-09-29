/**
 * Asian + European currencies for System Settings display currency.
 * Keep in sync with brokerverse-be currency-allowlist.js
 */
export const SYSTEM_CURRENCIES = [
  // Asia
  { code: "PHP", name: "Philippine Peso", locale: "en-PH", region: "Asia" },
  { code: "THB", name: "Thai Baht", locale: "th-TH", region: "Asia" },
  { code: "JPY", name: "Japanese Yen", locale: "ja-JP", region: "Asia" },
  { code: "CNY", name: "Chinese Yuan", locale: "zh-CN", region: "Asia" },
  { code: "INR", name: "Indian Rupee", locale: "en-IN", region: "Asia" },
  { code: "KRW", name: "South Korean Won", locale: "ko-KR", region: "Asia" },
  { code: "SGD", name: "Singapore Dollar", locale: "en-SG", region: "Asia" },
  { code: "MYR", name: "Malaysian Ringgit", locale: "ms-MY", region: "Asia" },
  { code: "IDR", name: "Indonesian Rupiah", locale: "id-ID", region: "Asia" },
  { code: "VND", name: "Vietnamese Dong", locale: "vi-VN", region: "Asia" },
  { code: "HKD", name: "Hong Kong Dollar", locale: "zh-HK", region: "Asia" },
  { code: "TWD", name: "New Taiwan Dollar", locale: "zh-TW", region: "Asia" },
  { code: "PKR", name: "Pakistani Rupee", locale: "en-PK", region: "Asia" },
  { code: "BDT", name: "Bangladeshi Taka", locale: "bn-BD", region: "Asia" },
  { code: "LKR", name: "Sri Lankan Rupee", locale: "si-LK", region: "Asia" },
  { code: "NPR", name: "Nepalese Rupee", locale: "ne-NP", region: "Asia" },
  { code: "MMK", name: "Myanmar Kyat", locale: "my-MM", region: "Asia" },
  { code: "KHR", name: "Cambodian Riel", locale: "km-KH", region: "Asia" },
  { code: "LAK", name: "Lao Kip", locale: "lo-LA", region: "Asia" },
  { code: "BND", name: "Brunei Dollar", locale: "ms-BN", region: "Asia" },
  { code: "MOP", name: "Macanese Pataca", locale: "zh-MO", region: "Asia" },
  { code: "MVR", name: "Maldivian Rufiyaa", locale: "dv-MV", region: "Asia" },
  { code: "BTN", name: "Bhutanese Ngultrum", locale: "dz-BT", region: "Asia" },
  { code: "AFN", name: "Afghan Afghani", locale: "fa-AF", region: "Asia" },
  { code: "KZT", name: "Kazakhstani Tenge", locale: "kk-KZ", region: "Asia" },
  { code: "UZS", name: "Uzbekistani Som", locale: "uz-UZ", region: "Asia" },
  { code: "MNT", name: "Mongolian Tugrik", locale: "mn-MN", region: "Asia" },
  // Europe
  { code: "EUR", name: "Euro", locale: "de-DE", region: "Europe" },
  { code: "GBP", name: "British Pound", locale: "en-GB", region: "Europe" },
  { code: "CHF", name: "Swiss Franc", locale: "de-CH", region: "Europe" },
  { code: "NOK", name: "Norwegian Krone", locale: "nb-NO", region: "Europe" },
  { code: "SEK", name: "Swedish Krona", locale: "sv-SE", region: "Europe" },
  { code: "DKK", name: "Danish Krone", locale: "da-DK", region: "Europe" },
  { code: "PLN", name: "Polish Zloty", locale: "pl-PL", region: "Europe" },
  { code: "CZK", name: "Czech Koruna", locale: "cs-CZ", region: "Europe" },
  { code: "HUF", name: "Hungarian Forint", locale: "hu-HU", region: "Europe" },
  { code: "RON", name: "Romanian Leu", locale: "ro-RO", region: "Europe" },
  { code: "BGN", name: "Bulgarian Lev", locale: "bg-BG", region: "Europe" },
  { code: "ISK", name: "Icelandic Krona", locale: "is-IS", region: "Europe" },
  { code: "TRY", name: "Turkish Lira", locale: "tr-TR", region: "Europe" },
  { code: "UAH", name: "Ukrainian Hryvnia", locale: "uk-UA", region: "Europe" },
  { code: "RUB", name: "Russian Ruble", locale: "ru-RU", region: "Europe" },
  { code: "RSD", name: "Serbian Dinar", locale: "sr-RS", region: "Europe" },
  { code: "ALL", name: "Albanian Lek", locale: "sq-AL", region: "Europe" },
  { code: "MKD", name: "Macedonian Denar", locale: "mk-MK", region: "Europe" },
  { code: "BAM", name: "Bosnia-Herzegovina Convertible Mark", locale: "bs-BA", region: "Europe" },
  { code: "MDL", name: "Moldovan Leu", locale: "ro-MD", region: "Europe" },
  { code: "GEL", name: "Georgian Lari", locale: "ka-GE", region: "Europe" },
  { code: "AMD", name: "Armenian Dram", locale: "hy-AM", region: "Europe" },
  { code: "AZN", name: "Azerbaijani Manat", locale: "az-AZ", region: "Europe" },
  { code: "BYN", name: "Belarusian Ruble", locale: "be-BY", region: "Europe" },
];

export const CURRENCY_LOCALE_MAP = Object.fromEntries(
  SYSTEM_CURRENCIES.map((c) => [c.code, c.locale])
);

export const SYSTEM_CURRENCY_OPTIONS = SYSTEM_CURRENCIES.map((c) => ({
  label: `${c.code} — ${c.name}`,
  value: c.code,
  region: c.region,
}));

export const LOGO_PRESETS = [
  { label: "EastWest Bank", value: "/temp-logo/eastwestbank.png" },
  { label: "BDO", value: "/BDO_insure_logo.png.png" },
  { label: "China Bank", value: "/chinabank.png" },
  { label: "iorta", value: "/iorta.png" },
];

export const DEFAULT_SYSTEM_SETTINGS = {
  logoUrl: "/bdoi/iorta-technxt.png",
  displayCurrency: "PHP",
  primaryColor: "#0072d8",
  secondaryColor: "#004ea8",
  defaultLanguage: "en",
  faviconUrl: "/favicon.ico",
  appTitle: "BrokerVerse",
  systemName: "BrokerVerse",
  dateFormat: "DD/MM/YYYY",
};
