import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/** Service level register and clocks (Master > System Configuration > Service Levels). */
const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...authService.getAuthHeader(), ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(json, response.status));
  return json;
};
const enc = encodeURIComponent;

const slaService = {
  list: () => call("/service-levels"),
  clocks: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    return call(`/service-levels/clocks${q ? `?${q}` : ""}`).then((r) => r.data || []);
  },
  update: (code, body) => call(`/service-levels/${enc(code)}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.data),
  run: () => call("/service-levels/run", { method: "POST" }).then((r) => r.data),
  roles: () => call("/roles").then((r) => r.data || []),
};

export default slaService;
