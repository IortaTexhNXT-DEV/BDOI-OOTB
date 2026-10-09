/**
 * Claim journey helpers shared by the claim screens: the steps shown at the top of every screen, the line of
 * business of a claim and the sections that apply to it (claims.lob_fields), and date / error formatting.
 */

/** Steps of a claim, in order. Labels come from claimJourney.steps.* */
export const CLAIM_STEPS = [
  "notification",
  "insurerAdvice",
  "review",
  "adjuster",
  "assessment",
  "settlement",
  "approval",
  "payment",
];

export const stepIndex = (key) => Math.max(0, CLAIM_STEPS.indexOf(key));

/** Step a claim has reached, from its lifecycle status (used where a screen shows a claim that is further on). */
export const stepForStatus = (status) => {
  switch (status) {
    case "registered":
      return "review";
    case "in-review":
      return "adjuster";
    case "pending-approval":
    case "approved":
      return "approval";
    case "settled":
    case "closed":
    case "rejected":
      return "payment";
    default:
      return "notification";
  }
};

/** Statuses in which the claim details and the adjuster report can still be changed (server: updateClaim). */
export const EDITABLE_STATUSES = ["registered", "in-review"];

const KNOWN_LINES = ["MOTOR", "FIRE", "IAR", "MARINE", "ACCIDENT", "LIFE", "CASUALTY", "ENGINEERING", "HEALTH", "EB", "BOND", "AVIATION"];

/**
 * Line of business code (MOTOR, FIRE, MARINE, LIFE ...) from the first candidate that names one: a code, a product line
 * or a product name such as "Fire and Allied Perils", "Credit Life - Voluntary" or "Private Car Comprehensive".
 */
export const claimLobOf = (...candidates) => {
  for (const raw of candidates) {
    if (!raw) continue;
    const upper = String(raw).trim().toUpperCase();
    if (KNOWN_LINES.includes(upper)) return upper;
    if (/INDUSTRIAL ALL RISK|\bIAR\b/.test(upper)) return "IAR";
    if (/FIRE/.test(upper)) return "FIRE";
    if (/MARINE|CARGO|HULL/.test(upper)) return "MARINE";
    if (/ACCIDENT|\bPA\b/.test(upper)) return "ACCIDENT";
    if (/\bLIFE\b/.test(upper)) return "LIFE";
    if (/MOTOR|CAR|VEHICLE|CTPL/.test(upper)) return "MOTOR";
    if (/ENGINEERING|CONTRACTOR/.test(upper)) return "ENGINEERING";
    if (/LIABILITY|CASUALTY/.test(upper)) return "CASUALTY";
  }
  return "";
};

/** True when a claim section (driver, vehicle) applies to the line of business, per claims.lob_fields. */
export const lobUses = (config, lob, section) => {
  const fields = config?.lobFields || {};
  const list = fields[lob] || fields.default || [];
  return Array.isArray(list) && list.includes(section);
};

/** Causes of loss offered for the line of business (claims.loss_causes), as dropdown options. */
export const lossCauseOptions = (config, lob) => {
  const causes = config?.lossCauses || {};
  const list = causes[lob] || causes.default || [];
  return list.map((c) => (typeof c === "string" ? { label: c, value: c } : { label: c.label || c.value, value: c.value }));
};

/** yyyy-mm-dd of a date as the user sees it (a picked date is local midnight; toISOString would give the day before). */
export const toIsoDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Date object for a yyyy-mm-dd value (local midnight), or null. */
export const fromIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Text of a rejected thunk / service result for an inline message. */
export const errorText = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.message || value.error || fallback;
};
