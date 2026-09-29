import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { toIsoDate } from "../utility/dateFormat";

/** Operations > Renewals workspace: /renewals/* (queue, quotes, notices, approvals, lapse, win-back, analytics). */
const QUEUE_PAGE_SIZE = 500;

const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const request = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const detail = json.errors?.map((e) => e.message).join(", ");
    throw new Error(detail || json.message || `Request failed (${response.status})`);
  }
  return json;
};

const call = async (method, path, body) => (await request(method, `renewals/${path}`, body)).data;

/** Negotiation rows carry the proposed premium and the dates of their first / last timeline entry. */
const toNegotiation = (row) => {
  const dates = (row.timeline || []).map((item) => item.date).filter(Boolean).sort();
  return {
    ...row,
    quotedPremium: row.proposedPremium,
    createdDate: dates[0] || row.expiryDate,
    lastUpdated: dates[dates.length - 1] || row.expiryDate,
  };
};

const MONTHS_BACK = { "Current Month": 0, "Last 3 Months": 3, "Last 6 Months": 6, "Last 12 Months": 12 };

/** { from, to } (YYYY-MM-DD) for the analytics time filters; custom uses the [start, end] calendar range. */
export const periodRange = (timeFilter, customRange = []) => {
  const today = new Date();
  const iso = (d) => toIsoDate(d);
  if (timeFilter === "Custom Range") {
    const [start, end] = customRange || [];
    return start && end ? { from: iso(start), to: iso(end) } : {};
  }
  if (timeFilter === "Year to Date") return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
  const months = MONTHS_BACK[timeFilter];
  if (months === undefined) return {};
  const from = months === 0
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  return { from: iso(from), to: iso(today) };
};

/** Product line keys of the performance breakdown as chart labels (motor -> Motor, eb -> EB). */
export const productLabel = (key) => (key.length <= 2 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));

const renewalsWorkspaceService = {
  /** Queue rows plus the dashboard counters ({ items, dashboard }). */
  async getQueue(params = {}) {
    const json = await request("GET", `renewals/queue${queryString({ pageSize: QUEUE_PAGE_SIZE, ...params })}`);
    return { items: json.data || [], dashboard: json.dashboard || {} };
  },
  refreshPipeline: () => call("POST", "pipeline/refresh", {}),
  getRenewal: (id) => call("GET", encodeURIComponent(id)),
  generateQuote: (id) => call("POST", `${id}/quote`, {}),
  sendNotice: (id, method = "Email") => call("POST", `${id}/notices`, { method }),
  sendReminder: (id, method, note) => call("POST", `${id}/reminders`, { method, note }),
  addActivity: (id, activity) => call("POST", `${id}/activities`, activity),
  submitForApproval: (id, note) => call("POST", `${id}/submit`, { note }),
  decide: (id, decision, note) => call("POST", `${id}/approve`, { decision, note }),
  complete: (id, payload = {}) => call("POST", `${id}/complete`, payload),
  lapse: (id, reason) => call("POST", `${id}/lapse`, { reason }),
  reinstate: (id, note) => call("POST", `${id}/reinstate`, { note }),
  winBack: (id, payload) => call("POST", `${id}/win-back`, payload),

  getAtRisk: () => call("GET", "at-risk"),
  async getNegotiations() {
    return (await call("GET", "negotiations")).map(toNegotiation);
  },
  getApprovals: () => call("GET", "approvals"),
  getLapsed: () => call("GET", "lapsed"),
  getCampaigns: () => call("GET", "campaigns"),
  createCampaign: (payload) => call("POST", "campaigns", payload),
  getPerformance: (params) => call("GET", `performance${queryString(params)}`),

  /** Configuration values of a settings group as { key: value } (e.g. "tax", "renewals"). */
  async getSettings(group) {
    const rows = (await request("GET", `settings${queryString({ group })}`)).data || [];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
};

export default renewalsWorkspaceService;
