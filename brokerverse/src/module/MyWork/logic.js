/**
 * Screen logic of Operations > My Work that does not depend on React: due-date buckets, priority and category
 * presentation, the agenda weeks and the query sent for a list. Kept here so it is unit tested (logic.test.js).
 */

export const TABS = ["items", "team", "tasks", "calendar"];
export const PRIORITIES = ["urgent", "high", "normal", "low"];
export const DUE_FILTERS = ["overdue", "today", "soon", "later", "none"];

/** Icons of the categories (the server sends them too; this is the fallback). */
export const CATEGORY_ICONS = {
  quotes: "pi pi-file-edit",
  rfq: "pi pi-send",
  placements: "pi pi-briefcase",
  renewals: "pi pi-refresh",
  receivables: "pi pi-wallet",
  collections: "pi pi-phone",
  endorsements: "pi pi-pencil",
  claims: "pi pi-shield",
  approvals: "pi pi-check-square",
  documents: "pi pi-id-card",
  tasks: "pi pi-calendar",
};

/** Priority: icon, Tag severity and sort rank. */
export const PRIORITY_META = {
  urgent: { icon: "pi pi-angle-double-up", severity: "danger", rank: 4 },
  high: { icon: "pi pi-angle-up", severity: "warning", rank: 3 },
  normal: { icon: "pi pi-minus", severity: "info", rank: 2 },
  low: { icon: "pi pi-angle-down", severity: "secondary", rank: 1 },
};
export const priorityMeta = (p) => PRIORITY_META[p] || PRIORITY_META.normal;

/** Reminder choices of a task, in minutes before the due time (null: no reminder). */
export const REMINDER_OPTIONS = [null, 0, 15, 30, 60, 120, 1440];

const pad = (n) => String(n).padStart(2, "0");

/** A Date as YYYY-MM-DD in local time. */
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today's date in local time (YYYY-MM-DD). */
export const isoToday = (now = new Date()) => isoOf(now);

/** A YYYY-MM-DD date moved by n days (calendar arithmetic, no time-zone shift). */
export const shiftDate = (iso, n) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + Number(n)));
};

/** Whole days from `from` to `to` (YYYY-MM-DD), negative when `to` is earlier. */
export const daysBetween = (from, to) => {
  const a = String(from).split("-").map(Number);
  const b = String(to).split("-").map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
};

/**
 * Where a due date stands against today: bucket overdue / today / soon (within `soonDays`) / later / none, the number
 * of days (negative when overdue) and the severity of its tag.
 */
export const dueInfo = (dueDate, today, soonDays = 7) => {
  if (!dueDate) return { bucket: "none", days: null, severity: "secondary" };
  const days = daysBetween(today, String(dueDate).slice(0, 10));
  if (days < 0) return { bucket: "overdue", days, severity: "danger" };
  if (days === 0) return { bucket: "today", days, severity: "warning" };
  if (days <= soonDays) return { bucket: "soon", days, severity: "info" };
  return { bucket: "later", days, severity: "secondary" };
};

/** Short wording of a due date relative to today, through the translation function. */
export const dueText = (info, t) => {
  switch (info.bucket) {
    case "overdue":
      return t("myWork.due.overdueBy", { count: -info.days, defaultValue: "{{count}} d overdue" });
    case "today":
      return t("myWork.due.today", "Today");
    case "soon":
    case "later":
      return info.days === 1 ? t("myWork.due.tomorrow", "Tomorrow") : t("myWork.due.inDays", { count: info.days, defaultValue: "In {{count}} d" });
    default:
      return t("myWork.due.none", "No due date");
  }
};

/** The dates shown by the agenda: one day, or seven days from the anchor (a rolling week that starts on the chosen day). */
export const agendaDays = (anchor, view) => (view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => shiftDate(anchor, i)));

/** "HH:MM" -> minutes since midnight (tasks without a time sort first in a day, as all-day entries). */
const minutesOf = (time) => {
  if (!time) return -1;
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + m;
};

/**
 * Entries of the agenda per day: tasks (by time, then priority) and the open items due that day (by priority).
 * Days outside `days` are dropped; overdue entries stay on their own day.
 */
export const groupAgenda = (tasks, items, days) => {
  const out = Object.fromEntries(days.map((d) => [d, { tasks: [], items: [] }]));
  for (const task of tasks || []) {
    const key = String(task.dueDate || "").slice(0, 10);
    if (out[key]) out[key].tasks.push(task);
  }
  for (const item of items || []) {
    const key = String(item.dueDate || "").slice(0, 10);
    if (out[key]) out[key].items.push(item);
  }
  for (const d of days) {
    out[d].tasks.sort((a, b) => minutesOf(a.dueTime) - minutesOf(b.dueTime) || priorityMeta(b.priority).rank - priorityMeta(a.priority).rank);
    out[d].items.sort((a, b) => priorityMeta(b.priority).rank - priorityMeta(a.priority).rank);
  }
  return out;
};

/** Query parameters of the items list (empty values left out). */
export const itemsQuery = ({ scope = "me", category = "", due = "", priority = "", search = "", assignee = "", sort = "due", order = "" } = {}, { page, pageSize }) => {
  const params = { scope, category, due, priority, search: String(search || "").trim(), assignee, sort, order, page, pageSize };
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
};

/** The tab to open from the address (?tab=...), "items" by default; "team" only for managers. */
export const tabFromSearch = (search, { isManager = false } = {}) => {
  const tab = new URLSearchParams(search || "").get("tab");
  if (!TABS.includes(tab)) return "items";
  if (tab === "team" && !isManager) return "items";
  return tab;
};

/** Body of a task form for the API: trimmed text, the date and time as text, empty values as null. */
export const taskPayload = (form) => {
  const body = {
    title: String(form.title || "").trim(),
    notes: String(form.notes || "").trim() || null,
    dueDate: form.dueDate,
    dueTime: form.dueTime || null,
    priority: form.priority || "normal",
    reminderMinutes: form.reminderMinutes === undefined ? null : form.reminderMinutes,
  };
  if (form.assignedTo) body.assignedTo = form.assignedTo;
  if (form.entity && form.entityId) {
    body.entity = form.entity;
    body.entityId = form.entityId;
  } else {
    body.entity = null;
    body.entityId = null;
  }
  return body;
};

/** Problems of a task form before it is sent (keys of the fields with their message keys). */
export const validateTask = (form) => {
  const errors = {};
  if (String(form.title || "").trim().length < 2) errors.title = "myWork.task.titleRequired";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.dueDate || ""))) errors.dueDate = "myWork.task.dueDateRequired";
  if (form.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.dueTime)) errors.dueTime = "myWork.task.timeInvalid";
  if ((form.entity && !form.entityId) || (!form.entity && form.entityId)) errors.entityId = "myWork.task.recordRequired";
  return errors;
};

/** "HH:MM" of a Date (the time picker), or null. */
export const timeOf = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : null);

/** A Date for the time picker from "HH:MM" (today's date; only the time is used), or null. */
export const dateOfTime = (time) => {
  if (!time) return null;
  const [h, m] = String(time).split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
