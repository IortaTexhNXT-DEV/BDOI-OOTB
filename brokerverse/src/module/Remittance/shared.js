import { useCallback, useEffect, useState } from "react";
import { apiRequest, masterService } from "../../services/remittanceService";

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

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

/** Downloads rows as a CSV file (columns: [{ field, header }]). */
export const downloadCsv = (fileName, rows, columns) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  (rows || []).forEach((r) => lines.push(columns.map((c) => esc(typeof c.field === "function" ? c.field(r) : r[c.field])).join(",")));
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

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
