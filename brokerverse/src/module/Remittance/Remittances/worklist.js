/**
 * What the Remittances worklist derives from the register (GET /remittance/remittances?segment=): the segments, the
 * filter values, the coverage weeks, the columns the chooser can add, and the rows that can be submitted. R1 keeps the
 * status codes of today (draft, rejected = Returned, for-approval, approved, settled = voucher raised, cancelled).
 */
import { instantParts } from "../../../utility/dateFormat";
import { formatDate } from "../shared";

export const SEGMENTS = ["my-work", "drafts", "in-approval", "in-payment", "all"];
export const KPIS = ["to-submit", "awaiting-approval", "approved-not-paid", "overdue"];
export const PRODUCT_LINES = ["Motor", "Personal Accident", "Credit Life", "Marine"];
export const SOURCES = ["weekly-run", "run-now", "import"];
export const STATUSES = ["draft", "rejected", "for-approval", "approved", "settled", "cancelled"];
/** Columns the chooser adds to the table (the export always has them). */
export const HIDDEN_COLUMNS = ["basis", "source", "voucherNo", "paidOn", "bankRef", "submittedBy", "createdOn"];
export const PER_PAGE = 50;

/** My work for a user who prepares remittances, All for everyone else. */
export const defaultSegment = (canWrite) => (canWrite ? "my-work" : "all");

/** The segment of the address, or the default one; My work only for a user who prepares remittances. */
export const segmentOf = (value, canWrite) => {
  if (!SEGMENTS.includes(value)) return defaultSegment(canWrite);
  return value === "my-work" && !canWrite ? "all" : value;
};

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayDate = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Today in the business time zone (YYYY-MM-DD). */
export const businessToday = (now = new Date()) => instantParts(now)?.day || isoOf(now);

/** The Monday of the week of a day (YYYY-MM-DD). */
export const mondayOf = (iso) => {
  const d = dayDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
};

/** The Monday `weeks` weeks before or after the Monday of `iso`. */
const shiftWeeks = (iso, weeks) => {
  const d = dayDate(iso);
  d.setDate(d.getDate() + weeks * 7);
  return isoOf(d);
};

/** The coverage week of a Monday: { from: Monday, to: Friday }. */
export const weekOf = (monday) => {
  const d = dayDate(monday);
  d.setDate(d.getDate() + 4);
  return { from: monday, to: isoOf(d) };
};

/** "05/10–09/10/2026": the first date without its year when both fall in the same year. */
export const weekText = (week) => {
  if (!week?.from) return "";
  const from = formatDate(week.from);
  const to = formatDate(week.to);
  const sameYear = String(week.from).slice(0, 4) === String(week.to).slice(0, 4);
  return `${sameYear ? from.replace(/[/.-]\d{4}$/, "") : from}–${to}`;
};

/** The coverage weeks of the filter, newest first: the week of today and the `count` - 1 weeks before it. */
export const recentWeeks = (today, count = 13) => {
  const current = mondayOf(today);
  return Array.from({ length: count }, (_, i) => weekOf(shiftWeeks(current, -i)));
};

/**
 * The coverage week the list asks for: the one chosen, else the current week on All and every week on the other
 * segments; "all" asks for every week.
 */
export const weekParam = (chosen, segment, today) => {
  if (chosen === "all") return undefined;
  if (chosen) return chosen;
  return segment === "all" ? mondayOf(today) : undefined;
};

/** The submit action of a row when the user may submit it now. */
export const submitAction = (row) => (row?.actions || []).find((a) => a.code === "submit" && a.allowed) || null;

/** Rows the user may submit now (the only ones with a tick box). */
export const submittable = (rows) => (rows || []).filter((r) => !!submitAction(r));

/** "sort=-dueDate" as the DataTable reads it: { sortField, sortOrder }. */
export const sortOf = (sort) => {
  if (!sort) return { sortField: null, sortOrder: null };
  return { sortField: String(sort).replace(/^-/, ""), sortOrder: String(sort).startsWith("-") ? -1 : 1 };
};

/** The sort parameter of a DataTable sort event; null when the sort is cleared. */
export const sortParam = (field, order) => (field && order ? `${order === -1 ? "-" : ""}${field}` : null);

/** The results of a submission by remittance id, for the line under each row. */
export const resultsById = (results) => new Map((results || []).map((r) => [r.id, r]));

const STORAGE_KEY = "bv.remittances.columns";

/** The extra columns this viewer chose earlier (kept in the browser only). */
export const savedColumns = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((c) => HIDDEN_COLUMNS.includes(c)) : [];
  } catch {
    return [];
  }
};

export const saveColumns = (columns) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // the choice is a convenience: without storage it lasts for the visit
  }
};
