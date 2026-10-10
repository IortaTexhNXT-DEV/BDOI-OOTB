/**
 * The rules of the Insurer payments page that are not layout: the segments (Legacy transfers only when TRF- items
 * exist), the chip colours of the payment states and batch statuses, the selection for a batch and the steps of the
 * payment record's timeline.
 */
export const PER_PAGE = 50;
export const SEGMENTS = ["to-pay", "in-payment", "paid", "failed", "all"];
export const LEGACY = "legacy";
export const METHODS = ["fund-transfer", "cheque"];

/** The segment shown: the one of the address when known, else To pay. */
export const segmentOf = (value) => (SEGMENTS.includes(value) || value === LEGACY ? value : "to-pay");

/** The segments of the tab bar: the five, and Legacy transfers when there are any (or it is the one asked for). */
export const segmentsShown = (legacyCount, current) => (legacyCount > 0 || current === LEGACY ? [...SEGMENTS, LEGACY] : SEGMENTS);

/** Chip colour of a payment state, a batch status or a transfer status; the chip text is always the server's label. */
const SEVERITY = {
  "to-pay": "warning",
  "in-payment": "info",
  paid: "success",
  failed: "danger",
  cancelled: "secondary",
  draft: "secondary",
  "for-approval": "warning",
  approved: "info",
  "file-generated": "info",
  sent: "info",
  completed: "success",
  pending: "warning",
  rejected: "danger",
};
export const severityOf = (code) => SEVERITY[String(code || "").toLowerCase()];

/** Rows of the page that may go on a batch now (the server's `selectable`). */
export const batchable = (rows) => (rows || []).filter((r) => r.selectable);

/** The disbursement ids of the selection, in the order of the table. */
export const selectedIds = (rows, selection) => {
  const ids = new Set((selection || []).map((r) => r.id));
  return (rows || []).filter((r) => ids.has(r.id)).map((r) => r.id);
};

/**
 * The timeline of a payment as DetailHeader steps: every step taken is done, the first one not taken is current, the
 * rest pending; a rejection carries the bank's reason in its label.
 */
export const timelineSteps = (timeline) => {
  const steps = timeline || [];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({
    key: s.code,
    label: s.reason ? `${s.label} · ${s.reason}` : s.label,
    state: s.done ? "done" : i === current ? "current" : "pending",
    date: s.at || undefined,
    person: s.by || undefined,
  }));
};
