import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, masterService } from "../../services/remittanceService";
import { calendarDateFormat, formatDate as formatConfiguredDate, formatInstant } from "../../utility/dateFormat";
import { codeAmount } from "../../utility/currencyConverter";

/** Accounts > Remittance routes (R1). */
export const REMITTANCE_ROUTES = {
  landing: "/finance/remittance",
  remittances: "/finance/remittance/remittances",
  record: (remId) => `/finance/remittance/remittances/${encodeURIComponent(remId)}`,
  approvals: "/finance/remittance/approvals",
  payments: "/finance/remittance/payments",
  reconciliation: "/finance/remittance/reconciliation/insurer-statements",
  statement: (statementId) => `/finance/remittance/reconciliation/statements/${encodeURIComponent(statementId)}`,
  exceptions: "/finance/remittance/exceptions",
  billing: "/finance/remittance/billing",
  setup: (tab = "schedules") => `/finance/remittance/setup/${tab}`,
};

/**
 * Chip colour of a remittance status code and of the other R1 states (schedule, run result, import). The chip always
 * carries the server's label as its text; the colour only repeats it. Returned is a warning, not an error: the maker
 * corrects and resubmits.
 */
export const R1_SEVERITY = {
  draft: "secondary",
  rejected: "warning",
  "for-approval": "warning",
  approved: "info",
  settled: "success",
  cancelled: "secondary",
  active: "success",
  paused: "warning",
  success: "success",
  nothing: "secondary",
  failed: "danger",
  running: "info",
  validated: "info",
  committed: "success",
  discarded: "secondary",
};

/** StatusChip props of a row: { code, label, severity } from its status code and label. */
export const statusChip = (code, label) => ({ code: code || null, label: label || null, severity: R1_SEVERITY[String(code || "").toLowerCase()] || undefined });

/** "PHP 409,141.43" (two decimals, thousands separators, a minus sign for negatives); "" when empty. */
export const money = (value) => codeAmount(value, "PHP");

/** "Oct 2026" for an accounting period "2026-10"; the value itself when it is not one. */
export const periodText = (period) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ""));
  if (!m) return period || null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
};

/** The folded activity of a panel: "3 entries · latest 10/10/2026 10:32", or "No activity yet". */
export const activitySummary = (t, entries) => {
  const list = entries || [];
  if (!list.length) return t("remittance.review.noActivity");
  return t("remittance.review.activityCount", { count: list.length, at: formatInstant(list[list.length - 1]?.at, { empty: "" }) });
};

/**
 * Segment, filters and page of a list kept in the address (?segment=drafts&insurerId=3&page=2), so a link or a reload
 * opens the same view. Returns [state, update]: state holds the defaults overlaid with the address; update(patch) sets
 * or clears (null / "") keys and goes back to page 1 unless the patch names the page.
 */
export const useUrlState = (defaults = {}) => {
  const [params, setParams] = useSearchParams();
  const key = JSON.stringify(defaults);
  const state = useMemo(() => {
    const out = { ...JSON.parse(key) };
    params.forEach((value, name) => { out[name] = value; });
    return out;
  }, [params, key]);
  const update = useCallback((patch) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([name, value]) => {
        if (value === null || value === undefined || value === "") next.delete(name);
        else next.set(name, String(value));
      });
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);
  return [state, update];
};

/** PrimeReact Calendar dateFormat for the configured display format (System Settings general.date_format). */
export { calendarDateFormat };

/** Reads /settings once and returns a { key: value } map. */
export const loadSettings = async () => {
  const res = await apiRequest("GET", "/settings");
  return Object.fromEntries((res.data || []).map((s) => [s.key, s.value]));
};

/** Insurer dropdown options from the insurance-company master ({ label: name, value: code }). */
export const loadInsurerOptions = async () => {
  const rows = await masterService.options("insurance-company");
  return (rows || []).map((r) => ({ label: r.label, value: r.code, id: r.id }));
};

/** Dropdown options from a master type ({ label, value: code }). */
export const loadMasterOptions = async (type, params) => {
  const rows = await masterService.options(type, params);
  return (rows || []).map((r) => ({ label: r.label, value: r.code, id: r.id }));
};

/** Status code -> PrimeReact tag severity (works with codes and labels). */
export const statusSeverity = (status) => {
  const s = String(status || "").toLowerCase();
  if (["completed", "settled", "approved", "success", "paid", "processed", "resolved", "matched", "sent", "delivered", "active"].includes(s)) return "success";
  if (["rejected", "failed", "cancelled", "critical", "error", "escalated", "overdue"].includes(s)) return "danger";
  if (["pending", "pending approval", "for-approval", "open", "high", "warning", "partial", "unmatched", "paused", "inactive"].includes(s)) return "warning";
  if (["processing", "in progress", "info", "calculated", "validated", "generated", "scheduled"].includes(s)) return "info";
  return "secondary";
};

export const showError = (toast, error, summary = "Error") =>
  toast.current?.show({ severity: "error", summary, detail: error?.message || String(error), life: 5000 });

export const showSuccess = (toast, detail, summary = "Success") =>
  toast.current?.show({ severity: "success", summary, detail, life: 3000 });

export const isoDate = (d) => {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const isoMonth = (d) => isoDate(d)?.slice(0, 7);

/** API timestamps come as "YYYY-MM-DD HH:MM" in UTC; read them as UTC so they show in local time. */
const normalise = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(d) ? `${d.replace(" ", "T")}Z` : d);
const hasTime = (d) => typeof d === "string" && /\d{2}:\d{2}/.test(d);

/** A date in the configured display format (e.g. DD/MM/YYYY); "" when empty. */
export const formatDate = (d) => formatConfiguredDate(normalise(d), { empty: "" });

/** A date and time in the configured display format (e.g. DD/MM/YYYY HH:MM); "" when empty. */
export const formatDateTime = (d) => formatConfiguredDate(normalise(d), { withTime: true, empty: "" });

/** DataTable body for a date field: configured format, with the time when the value carries one. */
export const dateBody = (field) => (row) => {
  const v = row?.[field];
  return hasTime(v) ? formatDateTime(v) : formatDate(v);
};

/** Downloads rows as a CSV file (columns: [{ field, header }]). */
export { downloadCsv } from "../../utility/csvExport";

/** Loads data with an async loader; returns [data, reload, loading]. Errors go to the toast. */
export const useLoader = (loader, initial, toast, deps = []) => {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const out = await loader();
      setData(out ?? initial);
      return out;
    } catch (e) {
      showError(toast, e);
      return undefined;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return [data, reload, loading, setData];
};
