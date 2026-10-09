import i18n from "../../i18n";

/**
 * The one dictionary of action codes for every activity log: the codes the API records (submit, approve, post ...),
 * their past forms (Approved) and the codes of particular histories, each to its entry in activityLog.actions.
 */
const ACTION_KEYS = {
  create: "create", created: "create", add: "create", added: "create", new: "create",
  update: "update", updated: "update", edit: "update", edited: "update", modify: "update", change: "update",
  submit: "submit", submitted: "submit",
  approve: "approve", approved: "approve",
  reject: "reject", rejected: "reject", decline: "reject", declined: "reject",
  return: "return", returned: "return",
  post: "post", posted: "post",
  reverse: "reverse", reversed: "reverse",
  cancel: "cancel", cancelled: "cancel", canceled: "cancel",
  void: "void", voided: "void",
  delete: "delete", deleted: "delete", remove: "delete", removed: "delete",
  send: "send", sent: "send",
  acknowledge: "acknowledge", acknowledged: "acknowledge",
  settle: "settle", settled: "settle",
  process: "process", processed: "process",
  generate: "generate", generated: "generate",
  issue: "issue", issued: "issue",
  print: "print", printed: "print", reprint: "print",
  assign: "assign", assigned: "assign",
  reassign: "reassign", reassigned: "reassign",
  delegate: "delegate", delegated: "delegate",
  escalate: "escalate", escalated: "escalate",
  resolve: "resolve", resolved: "resolve",
  close: "close", closed: "close",
  reopen: "reopen", reopened: "reopen",
  activate: "activate", activated: "activate",
  deactivate: "deactivate", deactivated: "deactivate",
  withdraw: "withdraw", withdrawn: "withdraw",
  match: "match", matched: "match",
  unmatch: "unmatch", unmatched: "unmatch",
  pay: "pay", paid: "pay", "mark-paid": "pay",
  remind: "remind", reminder: "remind", reminded: "remind",
  complete: "complete", completed: "complete", success: "complete",
  fail: "fail", failed: "fail",
  retry: "retry", retried: "retry",
  schedule: "schedule", scheduled: "schedule",
  run: "run",
  upload: "upload", uploaded: "upload",
  import: "import", imported: "import",
  export: "export", exported: "export",
  calculate: "calculate", calculated: "calculate",
  recalculate: "recalculate", recalculated: "recalculate", recompute: "recalculate",
  adjust: "adjust", adjusted: "adjust",
  "sign-off": "signOff", signoff: "signOff",
  collect: "collect", collection: "collect",
  status: "status", "status-change": "status",
  note: "note", call: "call", email: "email", commitment: "commitment",
  // lead assignment history (Operations > Sales & Marketing > Lead Assignment)
  auto: "assignAuto", queued: "assignQueued", manual: "assignManual", bulk: "assignBulk", taken: "assignTaken",
};

const TONES = {
  positive: ["create", "approve", "post", "settle", "complete", "issue", "activate", "pay", "resolve", "match", "generate", "collect"],
  negative: ["reject", "return", "cancel", "void", "delete", "reverse", "fail", "deactivate", "withdraw", "unmatch"],
  status: ["submit", "send", "acknowledge", "process", "assign", "reassign", "delegate", "escalate", "close", "reopen", "status", "signOff",
    "assignAuto", "assignQueued", "assignManual", "assignBulk", "assignTaken"],
};

const norm = (code) => String(code ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

/** "PendingCustomer" / "create-settlement" / "call_outcome" in words: "Pending customer", "Create settlement". */
export const humanize = (code) => {
  const text = String(code ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** The dictionary entry of an action code (activityLog.actions.<key>), null when the code is not a known action. */
export const actionKey = (code) => ACTION_KEYS[norm(code)] || null;

/** An action code in words: a known action from the dictionary ("submit" -> "Submitted"), any other code humanised. */
export const actionText = (code) => {
  const key = actionKey(code);
  return key ? i18n.t(`activityLog.actions.${key}`) : humanize(code);
};

/** Colour family of an entry's marker: positive, negative, status or neutral. */
export const actionTone = (code) => {
  const key = actionKey(code);
  const tone = Object.keys(TONES).find((t) => TONES[t].includes(key));
  return tone || "neutral";
};
