/**
 * Delegations: the rules of the screen, without React. The data is GET /access-control/delegations (delegations
 * and requests with their status) and /delegations/options (the checked transactions and every active person with
 * the transactions he or she can approve and the authority today).
 */

export const VIEWS = ["current", "pending", "ended", "all"];
/** Statuses of each view (All: every status). */
export const IN_VIEW = { current: ["scheduled", "in-effect"], pending: ["pending"], ended: ["ended", "ended-early", "rejected", "withdrawn"], all: null };
export const inView = (rows = [], view) => rows.filter((d) => !IN_VIEW[view] || IN_VIEW[view].includes(d.status));
export const viewCounts = (rows = []) => Object.fromEntries(VIEWS.map((v) => [v, inView(rows, v).length]));
export const DELEGATION_WORDS = { pending: "Waiting for approval", scheduled: "Scheduled", "in-effect": "In effect", ended: "Ended", "ended-early": "Ended early",
  rejected: "Rejected", withdrawn: "Withdrawn" };

const DAY = 86400000;
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Days of a period, both ends included (0 when a date is missing or the end is before the start). */
export const periodDays = (from, to) => (from && to && to >= from ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1 : 0);

/** Approvers away: the people who can approve at least one checked transaction, grouped by department. */
export const approverGroups = (people = [], departments = [], { base = false, other = "Other" } = {}) => {
  const able = people.filter((p) => p.approves.length && (base || !p.platformOnly));
  const names = departments.map((d) => d.name);
  const groups = departments.map((d) => ({ label: d.name, items: able.filter((p) => p.department === d.name) }));
  groups.push({ label: other, items: able.filter((p) => !names.includes(p.department)) });
  return groups.filter((g) => g.items.length).map((g) => ({ ...g, items: g.items.map((p) => ({ label: p.name, value: p.id, person: p })) }));
};

/**
 * People who may cover: everyone active but the approver away (and the requester while approval is off), each with
 * the chosen transactions he or she cannot approve (`missing`; the option is then disabled).
 */
export const coverGroups = (people = [], departments = [], { delegatorId, types = [], me = null, approval = true, base = false, other = "Other" } = {}) => {
  const able = people.filter((p) => p.id !== delegatorId && (approval || p.id !== me) && (base || !p.platformOnly));
  const names = departments.map((d) => d.name);
  const groups = departments.map((d) => ({ label: d.name, items: able.filter((p) => p.department === d.name) }));
  groups.push({ label: other, items: able.filter((p) => !names.includes(p.department)) });
  return groups.filter((g) => g.items.length).map((g) => ({
    ...g,
    items: g.items.map((p) => {
      const missing = types.filter((t) => !p.approves.includes(t));
      return { label: p.name, value: p.id, person: p, missing, disabled: missing.length > 0 };
    }),
  }));
};

/** What is missing or wrong in a new delegation: { field: problem } (the server checks the same again). */
export const delegationProblems = (form, { asOf, maxDays = 90 } = {}) => {
  const out = {};
  if (!form.delegatorId) out.delegatorId = "required";
  if (!form.transactionTypes?.length) out.transactionTypes = "required";
  if (!form.delegateId) out.delegateId = "required";
  else if (form.delegateId === form.delegatorId) out.delegateId = "self";
  if (!form.dateFrom) out.dateFrom = "required";
  else if (asOf && form.dateFrom < asOf) out.dateFrom = "past";
  if (!form.dateTo) out.dateTo = "required";
  else if (form.dateFrom && form.dateTo < form.dateFrom) out.dateTo = "beforeStart";
  else if (form.dateFrom && periodDays(form.dateFrom, form.dateTo) > maxDays) out.dateTo = "tooLong";
  return out;
};

/** The rows a toolbar keeps: a person (either side), a department (either side), a transaction. */
export const filterDelegations = (rows = [], { search = "", department = null, type = null } = {}) => {
  const q = String(search || "").trim().toLowerCase();
  return rows.filter((d) => (!q || [d.delegatorName, d.delegateName].some((v) => String(v || "").toLowerCase().includes(q)))
    && (!department || d.delegatorDepartment === department || d.delegateDepartment === department)
    && (!type || !d.transactionTypes.length || d.transactionTypes.includes(type)));
};
