import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Master > Environment Promotion: the promotion path and the Setup Workbook (data-load) API (the sales promotions are services/promotionService.js). */
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
  if (!response.ok || json.success === false) {
    const error = new Error(json.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.errors = json.errors || [];
    throw error;
  }
  return json;
};

const environmentPromotionService = {
  getPath: () => call("/environment-promotion").then((r) => r.data),
  getHistory: () => call("/environment-promotion/history").then((r) => r.data || []),
  markEnvironment: (environment) => call("/environment-promotion/environment", { method: "PUT", body: JSON.stringify({ environment }) }),
  getKits: () => call("/data-load/kits").then((r) => r.data),
  templatePath: (prefill) => `/data-load/kits/configuration/template${prefill ? "?prefill=true" : ""}`,
  validatePath: "/data-load/batches",
  listBatches: (page = 1, perPage = 20) => call(`/data-load/batches?kit=configuration&page=${page}&perPage=${perPage}`),
  getBatch: (id) => call(`/data-load/batches/${encodeURIComponent(id)}`).then((r) => r.data),
  loadBatch: (id, validRowsOnly = false) => call(`/data-load/batches/${encodeURIComponent(id)}/load`, { method: "POST", body: JSON.stringify({ validRowsOnly }) }),
  errorsPath: (id) => `/data-load/batches/${encodeURIComponent(id)}/errors`,
  comparePath: "/data-load/compare",
  listComparisons: (page = 1, perPage = 20) => call(`/data-load/compare?page=${page}&perPage=${perPage}`),
  getComparison: (id) => call(`/data-load/compare/${encodeURIComponent(id)}`).then((r) => r.data),
  comparisonRows: (id, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    return call(`/data-load/compare/${encodeURIComponent(id)}/rows${qs ? `?${qs}` : ""}`);
  },
  comparisonWorkbookPath: (id) => `/data-load/compare/${encodeURIComponent(id)}/workbook`,
};

export default environmentPromotionService;
