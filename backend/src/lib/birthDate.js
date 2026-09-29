import { badRequest } from './errors.js';
import { getSetting } from './settings.js';

/**
 * Date-of-birth plausibility rule for leads and clients (D68): the age on today's date must be between the configured
 * minimum and maximum (app_settings leads.min_age_years / leads.max_age_years, editable in System Settings).
 */
export async function birthDateLimits() {
  const min = Number(await getSetting('leads.min_age_years', 18));
  const max = Number(await getSetting('leads.max_age_years', 100));
  return { min: Number.isFinite(min) ? min : 18, max: Number.isFinite(max) ? max : 100 };
}

/** Whole years between a YYYY-MM-DD birth date and `today` (a Date, compared by calendar date). */
export function ageOn(birth, today = new Date()) {
  const [y, m, d] = String(birth).slice(0, 10).split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

/**
 * Throws 400 when `birthDate` (YYYY-MM-DD, as stored) gives an age outside the configured range.
 * An empty value is accepted (corporate records and partial updates carry no date of birth).
 */
export async function assertBirthDate(birthDate, field = 'DOB') {
  if (!birthDate) return;
  const { min, max } = await birthDateLimits();
  const age = ageOn(birthDate);
  if (age < min || age > max) {
    const message = age < 0 ? 'Date of birth cannot be in the future'
      : `Date of birth gives an age of ${age}; the age must be between ${min} and ${max} years`;
    throw badRequest(message, [{ path: field, message }]);
  }
}
