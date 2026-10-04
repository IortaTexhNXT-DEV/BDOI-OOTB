/**
 * One status colour scheme for every list: a status word maps to a PrimeReact Tag severity.
 *  - success: done, in force, paid, approved
 *  - info: open work moving normally (new, draft, sent, in progress)
 *  - warning: waiting on someone or due soon
 *  - danger: failed, overdue, rejected, cancelled for a problem
 *  - secondary: closed / inactive / no longer relevant
 */
const GROUPS = {
  success: ["active", "approved", "paid", "completed", "complete", "converted", "convertedtopolicy", "issued", "bound", "posted", "settled", "closed-paid",
    "confirmed", "accepted", "customeraccepted", "within", "within terms", "cleared", "reconciled", "matched", "success", "succeeded", "sent-ok", "delivered", "in force", "inforce", "renewed", "won", "verified"],
  info: ["new", "draft", "open", "offered", "responses-in", "responses in", "contacted", "qualified", "quotegenerated", "quoted", "sent", "submitted", "submittedtoinsurer", "registered", "processing",
    "in-progress", "in progress", "inprogress", "in-review", "in review", "under review", "partial", "partially paid", "scheduled", "queued", "generated", "due"],
  warning: ["pending", "pendingcustomer", "pending approval", "awaiting", "reviewing", "on hold", "on-hold", "hold", "expiring", "expiring soon", "at-risk", "at risk",
    "suspended", "unpaid", "outstanding", "retrying", "warning", "requested"],
  danger: ["rejected", "declined", "failed", "overdue", "breached", "lapsed", "error", "bounced", "dishonoured", "dishonored", "lost", "denied"],
  secondary: ["cancelled", "canceled", "expired", "inactive", "closed", "dropped", "void", "voided", "reversed", "withdrawn", "archived", "deleted", "superseded"],
};

const LOOKUP = Object.entries(GROUPS).reduce((map, [severity, words]) => {
  words.forEach((w) => { map[w] = severity; });
  return map;
}, {});

/** Tag severity for a status value (any case, spaces / dashes / underscores tolerated); "info" when unknown. */
export const statusSeverity = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "secondary";
  return LOOKUP[s] || LOOKUP[s.replace(/[_\s]+/g, "-")] || LOOKUP[s.replace(/[-_\s]+/g, "")] || LOOKUP[s.replace(/[-_]+/g, " ")] || "info";
};

/** "PendingCustomer" / "pending_customer" / "in-review" -> "Pending Customer" / "Pending customer" / "In review". */
export const statusLabel = (status) => {
  const text = String(status || "").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

export default statusSeverity;
