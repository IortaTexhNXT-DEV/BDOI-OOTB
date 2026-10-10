import { hasPermission } from "../../../utils/canOpen";

/** Tabs of the log in screen order; the server counts each one (counts[tab]). follow-up and transmittals have their own lists. */
export const TABS = ["open", "at-tis", "with-partners", "awaiting", "follow-up", "bounced", "cancellation-pending", "deposit-due", "closed", "transmittals"];

const currentUser = () => {
  try {
    return localStorage.getItem("USER_ID") || null;
  } catch {
    return null;
  }
};

/**
 * The actions of a cheque for the signed-in user, in menu order, from its status, payee and custody and the user's
 * permissions (the server checks the same rules again). Each is { code, label key, allowed }.
 */
export const chequeActions = (c, { can = hasPermission, me = currentUser() } = {}) => {
  const write = can("write:pdc");
  const out = [{ code: "view", allowed: true }];
  if (!c) return out;
  const partner = c.payee === "insurance-partner";
  const liveAr = !!c.receiptNumber && !c.receiptCancelled;
  if (write && c.status === "on-hand") out.push({ code: "edit", allowed: true });
  if (write && partner && c.status === "forwarded" && c.transmittalId) out.push({ code: "partner-received", allowed: true });
  if (write && can("write:receipts") && partner && ["forwarded", "warehoused"].includes(c.status)) out.push({ code: "partner-cleared", allowed: true });
  if (write && partner && ["forwarded", "warehoused", "cleared"].includes(c.status)) out.push({ code: "partner-bounced", allowed: true });
  if (write && can("write:receipts") && !partner && c.status === "on-hand") out.push({ code: "deposit", allowed: true });
  if (write && !partner && c.status === "deposited") out.push({ code: "clear", allowed: true });
  if (write && !partner && ["deposited", "cleared"].includes(c.status)) out.push({ code: "bounce", allowed: true });
  if (write && ["on-hand", "forwarded", "warehoused", "bounced"].includes(c.status) && !liveAr) out.push({ code: "request-cancellation", allowed: true });
  const pending = c.status === "cancellation-pending" && c.cancellation;
  if (pending && !c.cancellation.approvedAt && can("approve:pdc") && c.cancellation.requestedById !== me) {
    out.push({ code: "approve-cancellation", allowed: true }, { code: "return-cancellation", allowed: true });
  }
  if (write && pending && c.cancellation.approvedAt) out.push({ code: "partner-returned", allowed: true });
  const replaceable = c.status === "bounced" || (c.status === "cancelled" && c.cancellation?.replacementFollows === "cheque");
  if (write && replaceable && !c.replacedById) out.push({ code: "replace", allowed: true });
  if (write && c.custody === "tis-vault" && ["on-hand", "cancelled"].includes(c.status)) out.push({ code: "return", allowed: true });
  return out;
};

/** Whether the ticked cheques can go on one transmittal: all Received at TIS, payable to the partner, of one partner. */
export const forwardable = (rows) => rows.length > 0 && rows.every((r) => r.status === "on-hand" && r.payee === "insurance-partner")
  && new Set(rows.map((r) => r.insurerId)).size === 1;

/** Whether the ticked cheques can be recorded as cleared together: all with the same partner. */
export const clearable = (rows) => rows.length > 0 && rows.every((r) => ["forwarded", "warehoused"].includes(r.status) && r.payee === "insurance-partner")
  && new Set(rows.map((r) => r.insurerId)).size === 1;

/** Field messages of an API validation error, keyed by their full path (rows[1].chequeNumber). */
export const pathErrors = (e) => Object.fromEntries((e?.errors || []).filter((x) => x.path).map((x) => [String(x.path), x.message]));
