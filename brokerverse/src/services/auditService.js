import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Audit trail as business events (one entry per action with its changed fields, labelled and formatted by the
 * server): the history of one record and the filtered, paged log of Master > Audit Trail.
 */
const call = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Accept: "application/json", ...authService.getAuthHeader() } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || `Request failed (${response.status})`);
  return json;
};

/** Fetch a download and save it under the file name the server gives (else `fallback`). */
const saveFile = async (path, fallback) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message || `Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] || fallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const queryOf = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();

const auditService = {
  /**
   * Events of one record, newest first: { events, today } (today: the business date, for "Today" / "Yesterday").
   * `entity`: policy, quotation, claim, client, endorsement, receipt, master:<type> ...
   */
  getRecordHistory: async (entity, id, { sort = "desc" } = {}) => {
    const r = await call(`/audit/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}?${queryOf({ sort })}`);
    return { events: Array.isArray(r.data) ? r.data : [], today: r.today || null };
  },
  /** One page of the audit log: { rows, total }. Filters: from, to, username, entity, entityRef, action. */
  getEvents: async (filters = {}, { page = 1, pageSize = 20 } = {}) => {
    const r = await call(`/settings/audit/events?${queryOf({ ...filters, page, pageSize })}`);
    return { rows: Array.isArray(r.data) ? r.data : [], total: Number(r.total) || 0 };
  },
  /** Filter choices: { recordTypes, actions, users }. */
  getOptions: async () => (await call("/settings/audit/options")).data || { recordTypes: [], actions: [], users: [] },
  /** Download every event matching the filters (format: csv | excel), one row per changed field. */
  download: (filters = {}, format = "excel") => saveFile(`/settings/audit/events?${queryOf({ ...filters, export: format })}`, `audit-trail.${format === "csv" ? "csv" : "xlsx"}`),
  /** Download the history of one record (format: csv | excel), one row per changed field. */
  downloadRecordHistory: (entity, id, format = "excel") =>
    saveFile(`/audit/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}?${queryOf({ export: format })}`, `history.${format === "csv" ? "csv" : "xlsx"}`),
};

export default auditService;
