/**
 * Formatting for printed documents: amounts with thousand separators, dates in general.date_format, date-times in the
 * business time zone, labels from field keys, and amounts in words (cheques, vouchers). Synchronous: the settings
 * they need are read once per document (see printContext in ./index.js).
 */

export const DEFAULT_FORMAT = Object.freeze({ dateFormat: 'DD/MM/YYYY', decimals: 2, currency: 'PHP', timeZone: 'Asia/Manila' });

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A number with thousand separators and fixed decimals ("1,234,567.80"); '' for empty / non-numeric input. */
export function formatAmount(v, decimals = 2) {
  if (v === null || v === undefined || v === '') return '';
  const x = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(x)) return String(v);
  const r = Math.round(Math.abs(x) * 10 ** decimals + 1e-7) / 10 ** decimals;
  const s = r.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return x < 0 && r !== 0 ? `-${s}` : s;
}

/** The calendar date (YYYY-MM-DD) of a date-like value, null when it is not a date. Date objects use the time zone. */
export function isoDateOf(v, timeZone = DEFAULT_FORMAT.timeZone) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(v); } catch { return v.toISOString().slice(0, 10); }
  }
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(s);
  if (m && s.length <= 10) return `${m[1]}-${m[2]}-${m[3]}`;
  if (m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? `${m[1]}-${m[2]}-${m[3]}` : isoDateOf(d, timeZone);
  }
  // JS Date.toString() output ("Sun Sep 20 2026 08:00:00 GMT+0800") and other parseable text
  if (/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return isoDateOf(d, timeZone);
  }
  return null;
}

/** Format YYYY-MM-DD with a pattern of DD, D, MM, M, MMM, MMMM, YYYY, YY ("DD/MM/YYYY" -> "29/09/2026"). */
export function applyDatePattern(iso, pattern = DEFAULT_FORMAT.dateFormat) {
  const [y, mo, d] = iso.split('-').map(Number);
  const tokens = { YYYY: String(y), YY: String(y).slice(-2), MMMM: MONTHS[mo - 1], MMM: MONTHS[mo - 1].slice(0, 3), MM: String(mo).padStart(2, '0'), M: String(mo), DD: String(d).padStart(2, '0'), D: String(d) };
  return String(pattern || DEFAULT_FORMAT.dateFormat).replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, (t) => tokens[t]);
}

/** A date in the configured format; a value that is not a date is returned as text ('' for empty). */
export function formatDate(v, fmt = DEFAULT_FORMAT) {
  const iso = isoDateOf(v, fmt.timeZone);
  if (!iso) return v === null || v === undefined ? '' : String(v);
  return applyDatePattern(iso, fmt.dateFormat);
}

/** "29/09/2026 18:03" in the business time zone (never UTC / ISO). */
export function formatDateTime(v = new Date(), fmt = DEFAULT_FORMAT) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v ?? '');
  let time;
  try { time = new Intl.DateTimeFormat('en-GB', { timeZone: fmt.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); } catch { time = d.toISOString().slice(11, 16); }
  return `${formatDate(d, fmt)} ${time}`;
}

/** "OtherContents" / "other_contents" / "other-contents" -> "Other contents"; short acronyms (CTPL, VAT, IAR) stay upper case. */
export function humanize(key) {
  const s = String(key ?? '').trim();
  if (!s) return '';
  if (/\s/.test(s) && /[a-z]/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  const words = s.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    if (/^[A-Z0-9]{2,5}$/.test(w)) return w;
    const lower = w.toLowerCase();
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function below1000(nn) {
  const h = Math.floor(nn / 100);
  const r = nn % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r >= 20) parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ''));
  else if (r) parts.push(ONES[r]);
  return parts.join(' ');
}

/** Whole number in English words ("One Thousand Two Hundred Five"). */
export function numberToWords(value) {
  let x = Math.floor(Math.abs(Number(value) || 0));
  if (x === 0) return 'Zero';
  const groups = [];
  let scale = 0;
  while (x > 0 && scale < SCALES.length) {
    const g = x % 1000;
    if (g) groups.unshift(`${below1000(g)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    x = Math.floor(x / 1000);
    scale += 1;
  }
  return groups.join(' ');
}

/**
 * An amount in words as written on vouchers and cheques: "One Thousand Two Hundred Pesos and 50/100 Only" style,
 * here "One Thousand Two Hundred Pesos and Fifty Centavos Only". Unit names come from the currency code.
 */
export function amountInWords(amount, currency = 'PHP') {
  const units = { PHP: ['Peso', 'Pesos', 'Centavo', 'Centavos'], USD: ['Dollar', 'Dollars', 'Cent', 'Cents'], EUR: ['Euro', 'Euros', 'Cent', 'Cents'] }[String(currency).toUpperCase()]
    || [String(currency).toUpperCase(), String(currency).toUpperCase(), 'Cent', 'Cents'];
  const v = Math.round(Math.abs(Number(amount) || 0) * 100);
  const whole = Math.floor(v / 100);
  const cents = v % 100;
  const neg = Number(amount) < 0 ? 'Minus ' : '';
  const main = `${numberToWords(whole)} ${whole === 1 ? units[0] : units[1]}`;
  return `${neg}${main}${cents ? ` and ${numberToWords(cents)} ${cents === 1 ? units[2] : units[3]}` : ''} Only`;
}
