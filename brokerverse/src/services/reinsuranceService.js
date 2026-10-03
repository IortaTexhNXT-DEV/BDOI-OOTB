import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const call = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}/reinsurance/${path}`, {
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
  return json.data;
};

const reinsuranceService = {
  getSecurityPolicy: () => call("GET", "security-policy"),
  getReinsurers: (params) => call("GET", `reinsurers${queryString(params)}`),

  getTreaties: (params) => call("GET", `treaties${queryString(params)}`),
  getTreatyById: (id) => call("GET", `treaties/${id}`),
  getTreatyCapacity: (id) => call("GET", `treaties/${id}/capacity`),
  getCessionsByTreaty: (id) => call("GET", `treaties/${id}/cessions`),
  getClaimsByTreaty: (id) => call("GET", `treaties/${id}/claims`),
  createTreaty: (payload) => call("POST", "treaties", payload),
  updateTreaty: (id, payload) => call("PUT", `treaties/${id}`, payload),
  approveTreaty: (id) => call("POST", `treaties/${id}/approve`, {}),
  rejectTreaty: (id, reason) => call("POST", `treaties/${id}/reject`, { reason }),

  getCessions: (params) => call("GET", `cessions${queryString(params)}`),
  createCession: (payload) => call("POST", "cessions", payload),
  confirmCession: (id) => call("POST", `cessions/${id}/confirm`, {}),
  rejectCession: (id, reason) => call("POST", `cessions/${id}/reject`, { reason }),

  getRecoveries: (params) => call("GET", `claims${queryString(params)}`),
  createRecovery: (payload) => call("POST", "claims", payload),
  submitRecovery: (id) => call("POST", `claims/${id}/submit-recovery`, {}),
  settleRecovery: (id, payload) => call("POST", `claims/${id}/settle`, payload),
  disputeRecovery: (id, reason) => call("POST", `claims/${id}/dispute`, { reason }),

  getBordereaux: (params) => call("GET", `bordereaux${queryString(params)}`),
  generateBordereau: (payload) => call("POST", "bordereaux/generate", payload),
  submitBordereau: (id) => call("POST", `bordereaux/${id}/submit`, {}),
  confirmBordereau: (id) => call("POST", `bordereaux/${id}/confirm`, {}),

  getAnalytics: () => call("GET", "analytics"),
  getReconciliation: () => call("GET", "reconciliation"),
  createReconciliation: (payload) => call("POST", "reconciliation", payload),
  resolveReconciliation: (id, resolution) =>
    call("POST", `reconciliation/${id}/resolve`, { resolution }),
  createException: (payload) => call("POST", "exceptions", payload),
  resolveException: (id, resolution) =>
    call("POST", `exceptions/${id}/resolve`, { resolution }),

  getReportTemplates: () => call("GET", "reports/templates"),
  generateReport: (templateId) => call("POST", "reports/generate", { templateId }),
};

export default reinsuranceService;
