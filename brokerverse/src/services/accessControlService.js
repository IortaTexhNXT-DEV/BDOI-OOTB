import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Access control API (/access-control): user access matrix, role permissions and the changes of a role's access
 * waiting for approval, authority matrix and its limits, delegations, segregation-of-duties rules, access reviews and
 * ending a user's sessions.
 */
const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const request = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}/access-control${path}`, {
    method,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authService.getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const error = new Error(apiErrorMessage(json, response.status));
    error.status = response.status;
    throw error;
  }
  return json;
};

/** Download an Excel export and save it under the name the server gives. */
const download = async (path, fallbackName) => {
  const response = await fetch(`${BASE_URL}/access-control${path}`, { headers: authService.getAuthHeader() });
  if (!response.ok) throw new Error(`Could not download the file (${response.status})`);
  const name = (response.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const accessControlService = {
  userMatrix: (params) => request("GET", `/user-matrix${queryString(params)}`).then((r) => r.data),
  downloadUserMatrix: () => download("/user-matrix?format=xlsx", "user-access-matrix.xlsx"),

  roleAccess: () => request("GET", "/role-access").then((r) => r.data),
  checkRoleAccess: (role, { grant, revoke }) => request("POST", "/role-access/check", { role, grant, revoke }).then((r) => r.data),
  proposeRoleAccess: (role, body) => request("POST", `/role-access/${encodeURIComponent(role)}/changes`, body),
  downloadRoleAccess: (params) => download(`/role-access/export${queryString(params)}`, "role-permissions.xlsx"),
  accessChanges: (params) => request("GET", `/changes${queryString(params)}`).then((r) => r.data),
  decideAccessChange: (id, decision, remarks) => request("POST", `/changes/${id}/decision`, { decision, remarks }),
  withdrawAccessChange: (id) => request("POST", `/changes/${id}/withdraw`),

  transactionTypes: () => request("GET", "/transaction-types").then((r) => r.data),
  authorityMatrix: () => request("GET", "/authority-matrix").then((r) => r.data),
  limits: (params) => request("GET", `/authority-limits${queryString(params)}`).then((r) => r.data),
  proposeLimit: (body) => request("POST", "/authority-limits", body),
  decideLimit: (id, decision, note) => request("POST", `/authority-limits/${id}/decision`, { decision, note }),
  withdrawLimit: (id) => request("DELETE", `/authority-limits/${id}`),

  delegations: (params) => request("GET", `/delegations${queryString(params)}`).then((r) => r.data),
  createDelegation: (body) => request("POST", "/delegations", body),
  revokeDelegation: (id) => request("POST", `/delegations/${id}/revoke`),

  sodRules: () => request("GET", "/sod-rules").then((r) => r.data),
  saveSodRule: (rule) => (rule.id ? request("PUT", `/sod-rules/${rule.id}`, rule) : request("POST", "/sod-rules", rule)),
  switchOffSodRule: (id) => request("DELETE", `/sod-rules/${id}`),
  sodCheck: (roles) => request("POST", "/sod-check", { roles }).then((r) => r.data),

  reviews: () => request("GET", "/reviews").then((r) => r.data),
  review: (id) => request("GET", `/reviews/${id}`).then((r) => r.data),
  downloadReview: (id) => download(`/reviews/${id}?format=xlsx`, `access-review-${id}.xlsx`),
  startReview: (body) => request("POST", "/reviews", body),
  decideReviewItem: (id, itemId, decision, remarks) => request("POST", `/reviews/${id}/items/${itemId}`, { decision, remarks }),
  closeReview: (id) => request("POST", `/reviews/${id}/close`),

  signOutUser: (userId) => request("POST", `/users/${userId}/sign-out`),
};

export default accessControlService;
