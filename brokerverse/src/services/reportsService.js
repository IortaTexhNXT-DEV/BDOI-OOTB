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
  /** Report definition: filter schema (x-options), columns, criteria and formats. */
  getDefinition: async (code) => (await request(`/reports/${code}`)).data,

  /** On-screen preview: paged rows, totals and summary. */
  runReport: (code, params, { page = 1, perPage = 50 } = {}) =>
    post(`/reports/${code}/run`, { ...params, page, perPage }),

  /** Generates a file and returns { downloadUrl, fileName, rowCount, ... }. */
  generateReport: async (code, params, format = "xlsx") =>
    (await post(`/reports/${code}/generate`, { ...params, format })).data,

  getAgentOptions: async () =>
    toOptions((await request("/users?role=agent&perPage=500")).data, "displayName", "userId"),

  getInsuranceCompanyOptions: async () =>
    toOptions((await request("/masters/insurance-company/options")).data, "label", "value"),

  getBranchOptions: async () =>
    toOptions((await request("/masters/branch/options")).data, "label", "value"),

  getClientOptions: async () =>
    toOptions((await request("/clients?perPage=500")).data?.clients, "displayName", "clientId"),
};

export default reportsService;
