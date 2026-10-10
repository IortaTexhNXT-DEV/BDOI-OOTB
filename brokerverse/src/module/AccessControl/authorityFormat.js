/**
 * Authority Matrix: the rules of the screen, without React. The data is GET /access-control/authority-matrix: the
 * transaction types (rows) with the approval step that checks each, the roles (columns) with their department and
 * the types they can approve, and per cell the limit in effect, the scheduled one and the change waiting for approval.
 */
import { formatCurrency, numberLocale } from "../../utility/currencyConverter";
import { roleGroups } from "./roleAccess";

export const TABS = ["limits", "pending", "personal", "history"];
export const ROLE_SCOPES = ["approvers", "all"];

/** A limit as the screen shows it: "₱1,000,000.00", "10%" or the "No limit" text; "" without a value. */
export const limitValue = (measure, value, unlimited, noLimit) => {
  if (unlimited) return noLimit;
  if (value === null || value === undefined || value === "") return "";
  if (measure === "percent") return `${Number(value).toLocaleString(numberLocale(), { maximumFractionDigits: 2 })}%`;
  return formatCurrency(value);
};

/**
 * What a cell shows: kind "limit" (an amount or a percent), "unlimited", "notSet" (no limit; the rule for a cell
 * without a limit applies) or "cannot" (the role cannot reach the approval step and has no limit), with the pending
 * and scheduled changes.
 */
export const cellState = (row, role, cell) => {
  const c = cell || {};
  let kind = "notSet";
  if (c.set) kind = c.unlimited ? "unlimited" : "limit";
  else if (row.checked && !role.approves.includes(row.code) && !c.pending && !c.scheduled) kind = "cannot";
  return { kind, pending: c.pending || null, scheduled: c.scheduled || null, endsOn: c.endsOn || null };
};

/** An approver cell (a checked type the role can approve) with no limit in effect, scheduled or waiting: a gap to fill. */
export const isGap = (row, role, cell) => row.checked && role.approves.includes(row.code) && !cell?.set && !cell?.scheduled && !cell?.pending;

const fold = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Rows of the matrix: types an approval step checks (all with `unchecked`) matching the search; the gaps only with `gapsOnly`. */
export const visibleRows = (data, { query = "", unchecked = false, technical = false, gapsOnly = false, roles = [] } = {}) => {
  const q = fold(query).trim();
  return (data?.rows || [])
    .filter((r) => unchecked || r.checked)
    .filter((r) => !q || fold(r.name).includes(q) || (technical && fold(r.code).includes(q)))
    .filter((r) => !gapsOnly || roles.some((role) => isGap(r, role, r.cells[role.code])));
};

/**
 * Columns of the matrix: TISPH roles (the base platform ones too with `base`), of the chosen departments, and with
 * scope "approvers" only those that can approve one of the rows or already have a limit or a change in them.
 */
export const visibleRoles = (data, rows, { base = false, departments = [], scope = "approvers", gapsOnly = false } = {}) => (data?.roles || [])
  .filter((r) => base || !r.platform)
  .filter((r) => !departments.length || departments.includes(r.platform ? "platform" : r.department || "other"))
  .filter((r) => scope === "all" || rows.some((row) => {
    const c = row.cells[r.code] || {};
    return r.approves.includes(row.code) || c.set || c.scheduled || c.pending;
  }))
  .filter((r) => !gapsOnly || rows.some((row) => isGap(row, r, row.cells[r.code])));

/** Column groups of the matrix: the departments in order, then the roles in no department and the base platform roles. */
export const columnGroups = (data, roles, base) => roleGroups(roles, data?.departments || [], { base });

/** Number of approver cells without a limit (checked types only, TISPH roles unless `base`). */
export const gapCount = (data, { base = false } = {}) => (data?.rows || []).reduce((n, row) => n
  + (data.roles || []).filter((r) => (base || !r.platform) && isGap(row, r, row.cells[r.code])).length, 0);

/** Options of the department filter: the departments, then Other roles and Base platform roles when present. */
export const departmentOptions = (data, base, names) => {
  const out = (data?.departments || []).filter((d) => (data.roles || []).some((r) => !r.platform && r.department === d.name))
    .map((d) => ({ value: d.name, label: names.group({ key: d.name, label: d.name }) }));
  const known = new Set((data?.departments || []).map((d) => d.name));
  if ((data?.roles || []).some((r) => !r.platform && !known.has(r.department))) out.push({ value: "other", label: names.group({ key: "other" }) });
  if (base) out.push({ value: "platform", label: names.group({ key: "platform" }) });
  return out;
};

/** The form of the limit panel for a cell or a personal limit; `proposed` starts from the change waiting for approval. */
export const formFor = ({ transactionType, roleCode = null, userId = null, cell = null, today }) => {
  const c = cell || {};
  return {
    transactionType, roleCode, userId,
    maxAmount: c.set && !c.unlimited ? c.maxAmount : null,
    unlimited: !!c.unlimited,
    effectiveFrom: today,
    referenceNo: "",
    referenceDate: "",
    remarks: "",
  };
};

/** Field problems of the panel form (keys of the form): what Submit for approval waits for. */
export const formProblems = (form, { measure, referenceRequired, today }) => {
  const p = {};
  if (!form.transactionType) p.transactionType = "required";
  if (!form.roleCode && !form.userId) p.userId = "required";
  if (!form.unlimited) {
    if (form.maxAmount === null || form.maxAmount === undefined || form.maxAmount === "") p.maxAmount = "required";
    else if (Number(form.maxAmount) < 0) p.maxAmount = "negative";
    else if (measure === "percent" && Number(form.maxAmount) > 100) p.maxAmount = "percent";
  }
  if (!form.effectiveFrom) p.effectiveFrom = "required";
  else if (form.effectiveFrom < today) p.effectiveFrom = "past";
  if (referenceRequired && !String(form.referenceNo || "").trim()) p.referenceNo = "required";
  if (referenceRequired && !form.referenceDate) p.referenceDate = "required";
  else if (form.referenceDate && form.referenceDate > today) p.referenceDate = "future";
  return p;
};

/** The line to send for a form: a limit, or no limit. */
export const lineOf = (form) => ({
  transactionType: form.transactionType,
  roleCode: form.roleCode || undefined,
  userId: form.roleCode ? undefined : form.userId,
  maxAmount: form.unlimited ? null : Number(form.maxAmount),
  unlimited: !!form.unlimited,
  effectiveFrom: form.effectiveFrom,
  referenceNo: String(form.referenceNo || "").trim() || undefined,
  referenceDate: form.referenceDate || undefined,
  remarks: String(form.remarks || "").trim() || undefined,
});
