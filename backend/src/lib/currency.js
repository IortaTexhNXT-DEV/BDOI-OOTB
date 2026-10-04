/**
 * Currencies: one source for each question.
 *
 *   Base (ledger) currency   the Currency master row flagged is_base (exactly one, locked once journals exist,
 *                            migration 0235). Journal lines, receivables, receipts, remittances and FX revaluation are
 *                            in this currency.
 *   Display currency         currency.default (System Settings > Display currency): only how amounts are labelled
 *                            on screens and documents. It never decides what the ledger is kept in.
 *   Currency choices         the active currencies of the Currency master; currency.allowed only supplies the locale /
 *                            region of a code (and the list itself when the master is empty).
 *   Exchange rates           the dated Exchange Rate master (master_records type exchange-rate): the rate in force on a
 *                            date (EffectiveFrom on or before it, EffectiveTo empty or on or after it), latest first.
 *                            currencies.exchange_rate is history only and is not read.
 */
import { query } from '../db/pool.js';
import { badRequest, conflict } from './errors.js';
import { getSetting } from './settings.js';

const run = (db) => db || { query };

/** Default locale of a currency code when currency.allowed does not name one. */
const LOCALES = { PHP: 'en-PH', USD: 'en-US', EUR: 'de-DE', SGD: 'en-SG', JPY: 'ja-JP', GBP: 'en-GB', HKD: 'zh-HK', AUD: 'en-AU', CNY: 'zh-CN' };

/**
 * The accounting base currency (Currency master, is_base). Throws when the master has none, so a ledger entry is
 * never written in a currency nobody chose.
 */
export async function baseCurrency(db = null) {
  const r = (await run(db).query("SELECT code FROM currencies WHERE is_base AND status = 'active' ORDER BY id LIMIT 1")).rows[0];
  if (!r) throw conflict('No base currency is set in Master > Finance > Currency: mark the accounting base currency first');
  return String(r.code).toUpperCase();
}

/** The display currency (System Settings): labels only. */
export async function displayCurrency() {
  return String((await getSetting('currency.default', 'PHP')) || 'PHP').toUpperCase();
}

/** Do posted or pending journals exist (the base currency is then locked)? */
export async function journalsExist(db = null) {
  return Boolean((await run(db).query('SELECT 1 FROM journal_vouchers LIMIT 1')).rowCount);
}

/**
 * Currency choices for the display currency and currency pickers: active Currency master rows, with the locale and
 * region of currency.allowed (fallback). [{ code, name, symbol, decimals, isBase, locale, region }]
 */
export async function currencyChoices(db = null) {
  const allowed = (await getSetting('currency.allowed', [])) || [];
  const extra = new Map((Array.isArray(allowed) ? allowed : []).filter((c) => c && c.code).map((c) => [String(c.code).toUpperCase(), c]));
  const rows = (await run(db).query("SELECT code, name, symbol, decimals, is_base FROM currencies WHERE status = 'active' ORDER BY is_base DESC, code")).rows;
  if (!rows.length) return [...extra.values()];
  return rows.map((r) => {
    const code = String(r.code).toUpperCase();
    const e = extra.get(code) || {};
    return { code, name: r.name, symbol: r.symbol || null, decimals: r.decimals, isBase: r.is_base, locale: e.locale || LOCALES[code] || 'en', region: e.region || null };
  });
}

/**
 * Rate of `from` into `to` on a date from the dated Exchange Rate master (a direct record, else the inverse of the
 * opposite record); null when none is in force. 1 when the currencies are the same.
 */
export async function exchangeRateOn(db, from, to, date) {
  const a = String(from || '').toUpperCase();
  const b = String(to || '').toUpperCase();
  if (!a || !b || a === b) return 1;
  const sql = `SELECT (data->>'ExchangeRate')::numeric AS rate FROM master_records
     WHERE type_code = 'exchange-rate' AND status NOT IN ('deleted','inactive') AND upper(data->>'CurrencyCode') = $1 AND upper(data->>'ToCurrencyCode') = $2
       AND (data->>'EffectiveFrom')::date <= $3::date AND COALESCE(NULLIF(data->>'EffectiveTo', ''), '9999-12-31')::date >= $3::date
       AND (data->>'ExchangeRate')::numeric > 0
     ORDER BY (data->>'EffectiveFrom')::date DESC, id DESC LIMIT 1`;
  const direct = (await run(db).query(sql, [a, b, date])).rows[0];
  if (direct) return Number(direct.rate);
  const inverse = (await run(db).query(sql, [b, a, date])).rows[0];
  return inverse ? 1 / Number(inverse.rate) : null;
}

/**
 * Rate of a currency into the base currency on a date (amount in base = foreign amount x rate). Throws 400 with a
 * clear message when the Exchange Rate master has no rate in force for that date.
 */
export async function rateToBase(db, currency, date, base = null) {
  const b = base || (await baseCurrency(db));
  const c = String(currency || b).toUpperCase();
  if (c === b) return 1;
  const known = (await run(db).query("SELECT 1 FROM currencies WHERE upper(code) = $1 AND status = 'active'", [c])).rowCount;
  if (!known) throw badRequest(`Unknown or inactive currency ${c} (Master > Finance > Currency)`);
  const rate = await exchangeRateOn(db, c, b, date);
  if (!rate) throw badRequest(`No exchange rate from ${c} to ${b} in force on ${date}: add one in Master > Finance > Exchange Rate`);
  return rate;
}
