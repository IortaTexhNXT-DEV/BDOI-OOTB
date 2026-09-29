/**
 * Date-of-birth plausibility rule for leads and clients (D68). Mirrors the server check (backend/src/lib/birthDate.js):
 * the age must be between app_settings leads.min_age_years and leads.max_age_years (System Settings, group "leads");
 * the defaults below apply when the settings cannot be read. The server refuses anything else with a 400.
 */
import { useEffect, useState } from "react";
import systemSettingsService from "../services/systemSettingsService";
import { toDate } from "./dateFormat";

export const DEFAULT_AGE_LIMITS = { min: 18, max: 100 };

let cached = null;

/** { min, max } ages from the leads settings group (cached; defaults on failure). */
export const loadAgeLimits = async () => {
  if (cached) return cached;
  try {
    const rows = await systemSettingsService.getConfiguration("leads");
    const byKey = Object.fromEntries((rows || []).map((r) => [r.key, Number(r.value)]));
    const min = byKey["leads.min_age_years"];
    const max = byKey["leads.max_age_years"];
    cached = {
      min: Number.isFinite(min) ? min : DEFAULT_AGE_LIMITS.min,
      max: Number.isFinite(max) ? max : DEFAULT_AGE_LIMITS.max,
    };
    return cached;
  } catch {
    return DEFAULT_AGE_LIMITS;
  }
};

/** React hook: the configured age limits (defaults until loaded). */
export const useAgeLimits = () => {
  const [limits, setLimits] = useState(cached || DEFAULT_AGE_LIMITS);
  useEffect(() => {
    let alive = true;
    loadAgeLimits().then((l) => alive && setLimits(l));
    return () => {
      alive = false;
    };
  }, []);
  return limits;
};

/** Whole years between a birth date and today (calendar dates). */
export const ageOn = (birth, today = new Date()) => {
  const b = toDate(birth);
  if (!b) return null;
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age -= 1;
  return age;
};

/** Calendar minDate / maxDate so only birth dates within the configured age range can be picked. */
export const birthDateRange = (limits = DEFAULT_AGE_LIMITS, today = new Date()) => {
  const maxDate = new Date(today.getFullYear() - limits.min, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - limits.max - 1, today.getMonth(), today.getDate() + 1);
  return { minDate, maxDate };
};

/** The validation message for a birth date outside the configured age range, or null when it is fine (or empty). */
export const birthDateError = (value, limits = DEFAULT_AGE_LIMITS) => {
  if (value === null || value === undefined || value === "") return null;
  const age = ageOn(value);
  if (age === null) return "Enter a valid date of birth";
  if (age < 0) return "Date of birth cannot be in the future";
  if (age < limits.min || age > limits.max) {
    return `Age must be between ${limits.min} and ${limits.max} years (this date gives ${age})`;
  }
  return null;
};

/** A picked date as YYYY-MM-DD in local time (toISOString would shift it a day back east of UTC). */
export const toIsoDate = (value) => {
  if (typeof value === "string") return value;
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
