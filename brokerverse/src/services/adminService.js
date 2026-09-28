import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Configuration, schedules and audit trail: the administration API of the BrokerVerse backend. */
const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authService.getAuthHeader(),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || `Request failed (${response.status})`);
  return json;
};

const adminService = {
  getSettings: (group) => call(`/settings${group ? `?group=${encodeURIComponent(group)}` : ""}`).then((r) => r.data || []),
  saveSettings: (settings) => call("/settings", { method: "PUT", body: JSON.stringify({ settings }) }).then((r) => r.data || []),
  getSchedules: () => call("/schedules").then((r) => r.data || []),
  updateSchedule: (code, body) => call(`/schedules/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.data),
  runSchedule: (code) => call(`/schedules/${encodeURIComponent(code)}/run`, { method: "POST" }).then((r) => r.data),
  getScheduleRuns: (code) => call(`/schedules/${encodeURIComponent(code)}/runs`).then((r) => r.data || []),
  getAudit: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")).toString();
    return call(`/settings/audit${q ? `?${q}` : ""}`).then((r) => r.data || []);
  },
};

export default adminService;
