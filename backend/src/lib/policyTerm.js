/**
 * Policy term and date rules (TIS-BRD-PROD-05; settings in seeds/settings.json, group policies).
 *
 *   policies.min_term_months        the shortest period of insurance a quotation or a policy may carry (6 months): the
 *                                   expiry date is at least that many calendar months after the inception date
 *   policies.min_term_exempt_lobs   lines of business the minimum does not apply to (none delivered; for example
 *                                   MOTOR when short-term Motor cover is allowed)
 *   policies.cover_start_time       the time of day cover starts on the inception date (12:00, noon)
 *   policies.cover_end_time         the time of day cover ends on the expiry date (23:59, 11:59 PM)
 *
 * The times are shown with the dates of the period of insurance on the policy schedule and the policy screens; the
 * policy itself keeps dates only. Migrated and uploaded legacy policies are recorded as they were issued: the minimum
 * term is checked on new quotations and new or changed policies.
 */
import { badRequest } from './errors.js';
import { getSetting } from './settings.js';
import { addCalendarMonths, isoDate } from './dates.js';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "12:00" -> "12:00 noon", "23:59" -> "11:59 PM", "00:00" -> "12:00 midnight", "09:30" -> "9:30 AM". */
export function timeLabel(hhmm) {
  const m = HHMM.exec(String(hhmm || ''));
  if (!m) return '';
  const h = Number(m[1]);
  if (h === 12 && m[2] === '00') return '12:00 noon';
  if (h === 0 && m[2] === '00') return '12:00 midnight';
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The cover times of the period of insurance: { start: '12:00', end: '23:59', startLabel, endLabel }. */
export async function coverTimes() {
  const start = String(await getSetting('policies.cover_start_time', '12:00'));
  const end = String(await getSetting('policies.cover_end_time', '23:59'));
  const s = HHMM.test(start) ? start : '12:00';
  const e = HHMM.test(end) ? end : '23:59';
  return { start: s, end: e, startLabel: timeLabel(s), endLabel: timeLabel(e) };
}

/** Minimum term in months and the exempt lines of business. */
export async function minimumTerm() {
  const months = Number(await getSetting('policies.min_term_months', 6));
  const exempt = await getSetting('policies.min_term_exempt_lobs', []);
  return { months: Number.isFinite(months) && months > 0 ? months : 0, exempt: (Array.isArray(exempt) ? exempt : []).map((x) => String(x).toUpperCase()) };
}

/**
 * The error of a period shorter than the minimum term, or null when the period is fine (or incomplete: a period
 * without both dates is not checked here). An expiry before the inception is always an error.
 */
export async function termError({ inception, expiry, lob = null, path = 'expiryDate' }) {
  const from = isoDate(inception);
  const to = isoDate(expiry);
  if (!from || !to) return null;
  if (to < from) return { path, message: 'The expiry date cannot be before the inception date' };
  const { months, exempt } = await minimumTerm();
  if (!months || (lob && exempt.includes(String(lob).toUpperCase()))) return null;
  const earliest = addCalendarMonths(from, months);
  if (to < earliest) return { path, message: `The period of insurance must be at least ${months} months: with inception ${from} the expiry date is ${earliest} or later`, code: 'MIN_POLICY_TERM' };
  return null;
}

/** Refuse (400) a period of insurance shorter than policies.min_term_months. */
export async function assertMinimumTerm(args) {
  const e = await termError(args);
  if (e) throw badRequest('Validation failed', [e]);
}
