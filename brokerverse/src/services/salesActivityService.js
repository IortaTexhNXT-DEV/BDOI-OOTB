import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Sales activities API (/sales-activities): the calls, meetings, e-mails and visits logged on prospects, quotations and
 * clients, their timelines, the activity list and the activity report; and the quote set-up of the governing product
 * template (/product-configurator/quote-setup) the quote wizard reads.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = Array.isArray(body.errors) && body.errors.length ? ` (${body.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join("; ")})` : "";
    throw new Error(`${body.message || `Request failed (${response.status})`}${detail}`);
  }
  return body;
};
const raw = async (path, options = {}) => handle(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}));
const request = async (path, options = {}) => (await raw(path, options)).data;
const id = (v) => encodeURIComponent(v);

/** Fetch a spreadsheet with the session token and save it. */
const download = async (path, fileName) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) await handle(response);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const salesActivityService = {
  options: () => request("/sales-activities/options"),
  timeline: (entity, recordId, params) => request(`/sales-activities/timeline/${id(entity)}/${id(recordId)}${qs(params)}`),
  list: (params) => request(`/sales-activities${qs(params)}`),
  report: (params) => request(`/sales-activities/report${qs(params)}`),
  downloadReport: (params) => download(`/sales-activities/report${qs({ ...params, format: "xlsx" })}`, "sales-activity-report.xlsx"),
  downloadList: (params) => download(`/sales-activities${qs({ ...params, format: "xlsx" })}`, "sales-activities.xlsx"),
  log: async (payload) => raw("/sales-activities", { method: "POST", body: JSON.stringify(payload) }),
  update: (activityId, payload) => request(`/sales-activities/${id(activityId)}`, { method: "PUT", body: JSON.stringify(payload) }),
  cancel: (activityId, reason) => request(`/sales-activities/${id(activityId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  // covers and risk fields of the product template governing a quotation
  quoteSetup: (params) => request(`/product-configurator/quote-setup${qs(params)}`),
};

export default salesActivityService;
