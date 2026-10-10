import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Access control API (/access-control): role directory, user access matrix and the access of one person, role
 * permissions, authority matrix (limits, their changes, upload and exports), delegations, segregation of duties
 * (rules, conflicts by user, exceptions), access reviews, the changes of access waiting for approval and ending a
 * user's sessions.
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
  directory: () => request("GET", "/directory").then((r) => r.data),
  userMatrix: (params) => request("GET", `/user-matrix${queryString(params)}`).then((r) => r.data),
  userAccess: (userId) => request("GET", `/users/${encodeURIComponent(userId)}/access`).then((r) => r.data),
  userAuthority: (userId, date) => request("GET", `/users/${encodeURIComponent(userId)}/authority${queryString({ date })}`).then((r) => r.data),
  downloadUserMatrix: (params) => download(`/user-matrix${queryString({ format: "xlsx", ...params })}`, "user-access-matrix.xlsx"),

  roleAccess: () => request("GET", "/role-access").then((r) => r.data),
  checkRoleAccess: (role, { grant, revoke }) => request("POST", "/role-access/check", { role, grant, revoke }).then((r) => r.data),
  proposeRoleAccess: (role, body) => request("POST", `/role-access/${encodeURIComponent(role)}/changes`, body),
  downloadRoleAccess: (params) => download(`/role-access/export${queryString(params)}`, "role-permissions.xlsx"),
  accessChanges: (params) => request("GET", `/changes${queryString(params)}`).then((r) => r.data),
  decideAccessChange: (id, decision, remarks) => request("POST", `/changes/${id}/decision`, { decision, remarks }),
  withdrawAccessChange: (id) => request("POST", `/changes/${id}/withdraw`),
  accessControls: () => request("GET", "/controls").then((r) => r.data),
  proposeAccessControls: (body) => request("POST", "/controls", body),

  transactionTypes: () => request("GET", "/transaction-types").then((r) => r.data),
  authorityMatrix: () => request("GET", "/authority-matrix").then((r) => r.data),
  downloadAuthorityMatrix: () => download("/authority-matrix?format=xlsx", "authority-matrix.xlsx"),
  limits: (params) => request("GET", `/authority-limits${queryString(params)}`).then((r) => r.data),
  downloadLimitHistory: () => download("/authority-limits?status=all&format=xlsx", "authority-limit-history.xlsx"),
  proposeAuthorityChange: (body) => request("POST", "/authority-changes", body),
  decideLimit: (id, decision, note) => request("POST", `/authority-limits/${id}/decision`, { decision, note }),
  withdrawLimit: (id) => request("DELETE", `/authority-limits/${id}`),
  /** Upload target of the shared import dialog: the template carries the screen's filters. */
  authorityUploadTarget: (label, { base, unchecked, all } = {}) => ({
    label,
    templatePath: `/access-control/authority-matrix/template${queryString({ base: base ? 1 : undefined, unchecked: unchecked ? 1 : undefined, all: all ? 1 : undefined })}`,
    uploadPath: "/access-control/authority-matrix/uploads",
  }),

  delegations: (params) => request("GET", `/delegations${queryString(params)}`).then((r) => r.data),
  delegationOptions: () => request("GET", "/delegations/options").then((r) => r.data),
  previewDelegation: (body) => request("POST", "/delegations/preview", body).then((r) => r.data),
  requestDelegation: (body) => request("POST", "/delegations", body),
  endDelegation: (id, reason) => request("POST", `/delegations/${id}/end`, reason),
  downloadDelegations: (params) => download(`/delegations${queryString({ format: "xlsx", ...params })}`, "delegations.xlsx"),

  sodRules: () => request("GET", "/sod-rules").then((r) => r.data),
  requestSodRule: (rule) => (rule.id ? request("PUT", `/sod-rules/${rule.id}`, rule) : request("POST", "/sod-rules", rule)),
  switchOffSodRule: (id, reason) => request("DELETE", `/sod-rules/${id}`, reason),
  checkSodRule: (rule) => request("POST", "/sod-rules/check", rule).then((r) => r.data),
  sodConflicts: (params) => request("GET", `/sod-conflicts${queryString(params)}`).then((r) => r.data),
  requestSodException: (body) => request("POST", "/sod-exceptions", body),
  endSodException: (id) => request("POST", `/sod-exceptions/${id}/end`),
  sodCheck: (roles, userId) => request("POST", "/sod-check", { roles, userId }).then((r) => r.data),
  downloadSod: (params) => download(`/sod-rules${queryString({ format: "xlsx", ...params })}`, "segregation-of-duties.xlsx"),

  reviews: () => request("GET", "/reviews").then((r) => r.data),
  review: (id) => request("GET", `/reviews/${id}`).then((r) => r.data),
  previewReview: (scope) => request("POST", "/reviews/preview", scope).then((r) => r.data),
  downloadReviews: () => download("/reviews?format=xlsx", "access-reviews.xlsx"),
  downloadReview: (id, params) => download(`/reviews/${id}${queryString({ format: "xlsx", ...params })}`, `access-review-${id}.xlsx`),
  startReview: (body) => request("POST", "/reviews", body),
  decideReviewItem: (id, itemId, body) => request("POST", `/reviews/${id}/items/${itemId}`, body),
  keepReviewItems: (id, itemIds, note) => request("POST", `/reviews/${id}/items/keep`, { itemIds, note }),
  submitReview: (id) => request("POST", `/reviews/${id}/submit`),
  closeReview: (id) => request("POST", `/reviews/${id}/close`),

  signOutUser: (userId) => request("POST", `/users/${userId}/sign-out`),
};

export default accessControlService;
