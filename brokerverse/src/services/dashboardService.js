import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const get = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body.data;
};

/** Dashboard KPIs; every amount is a raw number, formatted by the screen. */
const dashboardService = {
  getExecutive: (period = "month") => get(`/dashboard/executive?period=${encodeURIComponent(period)}`),
  getSales: (scope = "mine") => get(`/dashboard/sales?scope=${encodeURIComponent(scope)}`),
  /** Sales Dashboard: { period } or { from, to }, optional salesPerson (user id). */
  getSalesOverview: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    return get(`/dashboard/sales/overview${qs ? `?${qs}` : ""}`);
  },
  getProcessing: () => get("/dashboard/processing"),
  getClaims: () => get("/dashboard/claims"),
  getAgentHome: (scope = "mine") => get(`/agent/get-dashboard-details?scope=${encodeURIComponent(scope)}`),
};

export default dashboardService;
