import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader(),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
};

const post = (path, payload) =>
  request(path, { method: "POST", body: JSON.stringify(payload) });

const toOptions = (rows, labelKey, valueKey) =>
  (rows || []).map((row) => ({ label: row[labelKey], value: row[valueKey] }));

const reportsService = {
  /** Reports the signed-in user may run (filtered by role and permission on the server). */
  getCatalogue: async () => (await request("/reports")).data || [],

  /** Report definition: filter schema (x-options), columns, criteria and formats. */
  getDefinition: async (code) => (await request(`/reports/${code}`)).data,

  /** On-screen preview: paged rows, totals and summary. */
  runReport: (code, params, { page = 1, perPage = 50 } = {}) =>
    post(`/reports/${code}/run`, { ...params, page, perPage }),

  /** Generates a file and returns { downloadUrl, fileName, rowCount, ... }. */
  generateReport: async (code, params, format = "xlsx") =>
    (await post(`/reports/${code}/generate`, { ...params, format })).data,

  /** Agent filter: served to every report reader (GET /users needs user administration rights). */
  getAgentOptions: async () =>
    toOptions((await request("/reports/filters/agents")).data, "label", "value"),

  getInsuranceCompanyOptions: async () =>
    toOptions((await request("/masters/insurance-company/options")).data, "label", "value"),

  getBranchOptions: async () =>
    toOptions((await request("/masters/branch/options")).data, "label", "value"),

  /** Client filter: served to every report reader within their record scope (GET /clients needs read:clients). */
  getClientOptions: async () =>
    toOptions((await request("/reports/filters/clients")).data, "label", "value"),
};

export default reportsService;
