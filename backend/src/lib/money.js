/**
 * Money helpers used everywhere (ledger, documents, claims, masters, notification texts).
 */
import { getSetting } from './settings.js';

/**
 * Rounding to cents, half away from zero, the same rule as PostgreSQL round(numeric, 2). Binary floating point is
 * corrected first, so 1.005 -> 1.01 and -1.005 -> -1.01 (Math.round alone gives 1.00 and -1.00).
 */
export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return 0;
  const cents = Math.round(Number((Math.abs(x) * 100).toPrecision(15)));
  const r = cents / 100;
  return x < 0 && r ? -r : r;
}

/**
 * An amount as people read it in texts the server writes (notifications, e-mails): the currency symbol, the grouping
 * and the decimals of the configured currency (currency.default, its locale from currency.allowed,
 * currency.decimals), e.g. "₱85,000.00". `currency` overrides the code (a foreign-currency record).
 */
export async function formatMoney(amount, currency) {
  const defaultCode = String((await getSetting('currency.default')) || '').toUpperCase();
  const code = String(currency || defaultCode).toUpperCase();
  const allowed = (await getSetting('currency.allowed', [])) || [];
  const localeOf = (c) => allowed.find((x) => x?.code === c)?.locale;
  // A foreign amount keeps the grouping of the configured (home) currency
  const locale = localeOf(defaultCode) || localeOf(code) || 'en';
  const configured = Number(await getSetting('currency.decimals'));
  const decimals = Number.isInteger(configured) && configured >= 0 && configured <= 4 ? configured : 2;
  const value = round2(amount);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`.trim();
  }
}
