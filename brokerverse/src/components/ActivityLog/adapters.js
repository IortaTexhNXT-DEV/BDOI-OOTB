/**
 * The history rows of the API, as each endpoint returns them, turned into ActivityLog entries:
 *   { id, at, seq, actionCode, actionLabel, user: { displayName, username, role }, fromStatus, toStatus, remarks,
 *     changes: [{ field, label, before, after, masked }], source }
 * Screens pass their rows as they are: <ActivityLog entries={fromRemittanceActivity(details.activityLog)} />.
 */
import i18n from "../../i18n";
import { formatDate } from "../../utility/dateFormat";
import { statusLabel } from "../../utils/statusSeverity";
import { humanize } from "./actions";

const field = (key) => i18n.t(`activityLog.fields.${key}`);
const roleOf = (roles) => (Array.isArray(roles) ? roles.filter(Boolean).join(", ") : roles || null);
const isStatusKey = (key) => /^(status|statuscode)$/i.test(String(key || "").split(".").pop());

// "2026-10-10 01:03" (the API's UTC text without a zone) as an instant
const utc = (text) => (typeof text === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text.trim()) ? `${text.trim().replace(" ", "T")}Z` : text);

// the user who acted: a job or an unknown user is shown as the system
const userOf = (displayName, username, roles) => {
  const known = (v) => (v && String(v).toLowerCase() !== "system" ? v : null);
  return { displayName: known(displayName) || known(username), username: known(username), role: roleOf(roles) };
};

/** One entry with the defaults: no status line when the status did not move, no changes list when there is none. */
export const toEntry = ({ id, at = null, seq = null, day, date, time, actionCode = null, actionLabel = null, user = null, fromStatus = null, toStatus = null, remarks = null, changes = [], source = null }, index = 0) => {
  const moved = (fromStatus || toStatus) && fromStatus !== toStatus;
  return {
    id: id ?? `${actionCode || "entry"}-${at || index}`, at, seq, day, date, time, actionCode, actionLabel, user: user || userOf(), fromStatus: moved ? fromStatus : null,
    toStatus: moved ? toStatus : null, remarks: remarks || null, changes: (changes || []).filter(Boolean), source,
  };
};

// a status change among the changed fields becomes the status line of the entry
const splitStatus = (changes, key = "key") => {
  const all = changes || [];
  const status = all.find((c) => isStatusKey(c[key]));
  return { status, rest: all.filter((c) => c !== status) };
};

/** GET /audit/records/:entity/:id (components/AuditTrail, the history of policies, quotations, journals, receipts ...). */
export const fromAuditEvents = (events = []) =>
  events.map((e, i) => {
    const { status, rest } = splitStatus(e.changes);
    return toEntry({
      id: e.id, at: e.at, day: e.day, date: e.date, time: e.time, actionCode: e.action, actionLabel: e.title,
      user: userOf(e.user?.displayName, e.user?.username, e.user?.roles), fromStatus: status?.from, toStatus: status?.to, remarks: e.note,
      changes: rest.map((c) => ({ field: c.key, label: c.label, before: c.from, after: c.to, masked: !!c.masked })), source: e.source,
    }, i);
  });

/** The activityLog of GET /remittance/remittances/:id (entries of this release, or { action, by, at, notes } of earlier ones). */
export const fromRemittanceActivity = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: r.id, at: r.at, day: r.day, date: r.date, time: r.time, actionCode: r.actionCode || r.action, actionLabel: r.actionLabel,
    user: r.user ? userOf(r.user.displayName, r.user.username, r.user.roles || r.user.role) : userOf(null, r.by),
    fromStatus: r.fromStatus, toStatus: r.toStatus, remarks: r.remarks ?? r.notes, changes: r.changes, source: r.source,
  }, i));

/** GET /remittance/history/audit (Remittance > History, Settlement > Workflow). */
export const fromRemittanceAudit = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: r.id, at: r.changedAt || utc(r.changeDate), actionCode: r.actionType, actionLabel: r.actionLabel,
    user: userOf(r.changedByName, r.changedBy, r.changedByRoles), fromStatus: r.previousValue, toStatus: r.newValue, remarks: r.reason,
  }, i));

/** GET /remittance/approvals/history (Remittance > Approval Workflow > Approval History). */
export const fromRemittanceApprovals = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: r.id ?? `${r.referenceNo}-${r.actionDate}-${i}`, at: utc(r.actionDate), actionCode: r.action, user: userOf(r.actionBy), remarks: r.remarks,
    changes: r.level ? [{ field: "level", label: field("approvalLevel"), before: null, after: String(r.level) }] : [],
  }, i));

/** GET /product-configurator/<kind>/:id/history and /risk-mappings/:id/history. */
export const fromConfigurationHistory = (rows = []) =>
  rows.map((r, i) => {
    const { status, rest } = splitStatus(r.changes, "field");
    return toEntry({
      id: r.id, at: r.at, actionCode: r.action, actionLabel: r.actionLabel, user: userOf(r.userName, r.user, r.roles),
      fromStatus: status?.from, toStatus: status?.to,
      changes: rest.map((c) => ({ field: c.field, label: c.label || humanize(c.field), before: c.from, after: c.to })),
    }, i);
  });

/** GET /posting-rules/:id/history. */
export const fromPostingRuleHistory = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: `${r.ruleId}-${r.at}-${i}`, at: r.at, actionCode: r.action, actionLabel: r.actionLabel, user: userOf(r.displayName, r.username, r.roles),
    remarks: r.changeNote, changes: r.version ? [{ field: "version", label: field("version"), before: null, after: String(r.version) }] : [],
  }, i));

const SOURCES = { manual: "manual", "close-run": "closeRun", "year-end": "yearEnd", "year-end-reversal": "yearEndReversal", job: "job" };

/**
 * Status histories { from, to, remarks, changedBy, changedAt, source }: periods (Period Management), bank
 * reconciliations, close runs. `statusLabels` labels the status codes ({ "soft-closed": "Soft closed" }).
 */
export const fromStatusHistory = (rows = [], { statusLabels = {} } = {}) => {
  const label = (code) => (code ? statusLabels[code] || statusLabel(code) : null);
  return rows.map((r, i) => toEntry({
    id: r.id, at: r.changedAt, actionCode: "status", user: userOf(r.changedBy), fromStatus: label(r.from), toStatus: label(r.to), remarks: r.remarks,
    source: r.source ? { channel: r.source === "job" ? "job" : "screen", label: SOURCES[r.source] ? i18n.t(`activityLog.sources.${SOURCES[r.source]}`) : humanize(r.source) } : null,
  }, i));
};

/** GET /lead-assignment/history/:leadId: who the prospect went to, from whom, by which rule or person. */
export const fromAssignmentHistory = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: r.id, at: r.assignedAt, actionCode: r.action, user: userOf(r.assignedBy), remarks: r.reason,
    changes: [
      { field: "assignee", label: field("assignedTo"), before: r.fromName || null, after: r.toName || null },
      r.ruleName ? { field: "rule", label: field("rule"), before: null, after: r.ruleName } : null,
    ],
  }, i));

/** GET /credit-control/warranty/:policyId/actions; `actionLabels` names the actions as the screen does. */
export const fromWarrantyActions = (rows = [], { actionLabels = {} } = {}) =>
  rows.map((r, i) => toEntry({
    id: r.id, at: r.createdAt, actionCode: r.action, actionLabel: actionLabels[r.action] || null, user: userOf(r.createdBy), remarks: r.notes,
    changes: r.endorsementNumber ? [{ field: "endorsement", label: field("endorsement"), before: null, after: r.endorsementNumber }] : [],
  }, i));

/** followUpActions of GET /collections/:id (calls, e-mails, notes, payment commitments). */
export const fromCollectionActions = (rows = []) =>
  rows.map((r, i) => toEntry({
    id: r.id, at: r.actionDate, actionCode: r.actionType, user: userOf(r.actionByName, r.actionBy, r.actionByRoles), remarks: r.notes,
    changes: [
      r.callOutcome ? { field: "callOutcome", label: field("outcome"), before: null, after: humanize(r.callOutcome) } : null,
      r.commitmentDate ? { field: "commitmentDate", label: field("commitmentDate"), before: null, after: formatDate(r.commitmentDate) } : null,
    ],
  }, i));

/** GET /schedules/:code/runs (Master > Schedules > Run history). */
export const fromJobRuns = (rows = []) =>
  rows.map((r, i) => {
    const scheduled = r.triggeredBy === "schedule";
    return toEntry({
      id: r.id, at: r.startedAt, actionCode: "run", user: scheduled ? userOf() : userOf(r.triggeredByName, r.triggeredBy, r.triggeredByRoles),
      toStatus: statusLabel(r.status), remarks: r.error,
      source: scheduled ? { channel: "job", label: i18n.t("activityLog.sources.scheduled") } : { channel: "screen", label: i18n.t("activityLog.sources.manualRun") },
    }, i);
  });

/**
 * A record that keeps its lifecycle in its own fields (incentive calculations, commission lines, override computations):
 * one entry per step that happened.
 *   fromLifecycle(batch, [
 *     { action: "create", at: "calculationDate", by: "createdBy" },
 *     { action: "approve", at: "approvalDate", by: "approvedBy", toStatus: "Approved" },
 *     { action: "reject", at: "rejectionDate", by: "rejectedBy", remarks: "rejectionReason", toStatus: "Rejected" },
 *   ])
 */
export const fromLifecycle = (record, steps = []) =>
  record
    ? steps
      .filter((s) => record[s.at])
      .map((s, i) => toEntry({
        id: `${s.action}-${i}`, at: record[s.at], seq: i, actionCode: s.action, actionLabel: s.label || null, user: userOf(s.by ? record[s.by] : null),
        toStatus: s.toStatus || null, remarks: s.remarks ? record[s.remarks] : null,
      }, i))
    : [];
