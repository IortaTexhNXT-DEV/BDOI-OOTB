/**
 * Access Reviews: the rules of the screen, without React. The data is GET /access-control/reviews (the list) and
 * /reviews/:id (every line with its outcome, removal state and what this user may do).
 */

export const OUTCOMES = ["keep", "remove-roles", "deactivate"];
export const OUTCOME_WORDS = { pending: "To review", keep: "Keep access", "remove-roles": "Remove roles", deactivate: "Deactivate account" };
export const STATUS_WORDS = { open: "Open", "awaiting-signoff": "Waiting for sign-off", closed: "Closed" };
export const OTHER = "~other";

/** Lines in the order of the departments of the directory (no department last), then by name. */
export const sortItems = (items = [], departments = []) => {
  const order = new Map(departments.map((d, i) => [d.name, i]));
  const rank = (i) => (order.has(i.department) ? order.get(i.department) : departments.length);
  return [...items].map((i) => ({ ...i, group: order.has(i.department) ? i.department : OTHER }))
    .sort((a, b) => rank(a) - rank(b) || String(a.displayName).localeCompare(String(b.displayName)));
};

/** Lines the filters keep: search, department (OTHER for none), outcome, only the lines still to review. */
export const filterItems = (items = [], { search = "", department = null, outcome = null, toReview = false } = {}) => {
  const q = String(search || "").trim().toLowerCase();
  return items.filter((i) => (!q || [i.displayName, i.username, i.designation].some((v) => String(v || "").toLowerCase().includes(q)))
    && (!department || (department === OTHER ? !i.department : i.department === department))
    && (!outcome || i.decision === outcome) && (!toReview || i.decision === "pending"));
};

/** Lines a bulk Keep may decide now: decidable and not needing a note (a note is asked for them one by one). */
export const keepable = (items = []) => items.filter((i) => i.canDecide && !i.needsNote);

/**
 * What is missing in a decision: { outcome, removeRoles, reason, note }. A removal needs a reason; Keep needs a note
 * for a dormant user or one with an open conflict; Remove roles needs at least one role.
 */
export const decisionProblems = (form, item, { reasonMissing = false } = {}) => {
  const out = {};
  if (!OUTCOMES.includes(form.outcome)) out.outcome = "required";
  if (form.outcome === "remove-roles" && !form.removeRoles?.length) out.removeRoles = "required";
  if ((form.outcome === "remove-roles" || form.outcome === "deactivate") && reasonMissing) out.reason = "required";
  if (form.outcome === "keep" && item?.needsNote && !String(form.note || "").trim()) out.note = "required";
  return out;
};

/** Removing every role held is deactivating the account. */
export const effectiveOutcome = (form, item) => (form.outcome === "remove-roles" && item && item.rolesNow.length
  && item.rolesNow.every((r) => form.removeRoles.includes(r)) ? "deactivate" : form.outcome);

/** The next line still to review after `id` (wrapping round), for Save and next. */
export const nextToReview = (items = [], id = null) => {
  const open = items.filter((i) => i.decision === "pending" && i.canDecide);
  if (!open.length) return null;
  const at = items.findIndex((i) => i.id === id);
  return items.slice(at + 1).find((i) => i.decision === "pending" && i.canDecide) || open.find((i) => i.id !== id) || null;
};
