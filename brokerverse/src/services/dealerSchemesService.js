import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Dealer schemes API: Scheme Master (/schemes, TIS-BRD-SCHM-02), Scheme Issuance (/scheme-issuance, TIS-BRD-SCHM-01,
 * CR-05) and the lock-in review (/lock-in, TIS-BRD-SCHM-03, TIS-BRD-RPT-SLS-05).
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const fail = (body, status) => {
  const error = new Error(apiErrorMessage(body, status));
  error.errors = Array.isArray(body?.errors) ? body.errors : [];
  return error;
};
const call = async (method, path, payload) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method, headers: { "Content-Type": "application/json", ...authService.getAuthHeader() }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw fail(body, response.status);
  return body;
};
const send = async (url, form) => {
  const response = await fetch(url, { method: "POST", headers: authService.getAuthHeader(), body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw fail(body, response.status);
  return body;
};
const blob = async (url) => {
  const response = await fetch(url, { headers: authService.getAuthHeader() });
  if (!response.ok) throw fail(await response.json().catch(() => ({})), response.status);
  return response.blob();
};
const fileForm = (file, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => (v === undefined || v === null ? null : form.append(k, v)));
  form.append("file", file);
  return form;
};
const id = (v) => encodeURIComponent(v);

/** Save a downloaded file. */
export const saveBlob = (data, fileName) => {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const schemesService = {
  list: (params) => call("GET", `/schemes${qs(params)}`),
  get: async (schemeId) => (await call("GET", `/schemes/${id(schemeId)}`)).data,
  choices: async () => (await call("GET", "/schemes/choices")).data,
  create: (body) => call("POST", "/schemes", body),
  update: (schemeId, body) => call("PUT", `/schemes/${id(schemeId)}`, body),
  remove: (schemeId) => call("DELETE", `/schemes/${id(schemeId)}`),
  copy: (schemeId, body) => call("POST", `/schemes/${id(schemeId)}/copy`, body),
  /** submit | recall | approve | return | suspend | resume | withdraw | amend | discard */
  act: (schemeId, action, body = {}) => call("POST", `/schemes/${id(schemeId)}/${action}`, body),
  preview: async (schemeId, params) => (await call("GET", `/schemes/${id(schemeId)}/preview${qs(params)}`)).data,
  policyScheme: async (policyId) => (await call("GET", `/schemes/policies/${id(policyId)}`)).data,
  exportList: (params) => blob(`${BASE_URL}/schemes/export${qs(params)}`),
  linesTemplate: () => blob(`${BASE_URL}/schemes/lines/template`),
  uploadLines: (schemeId, mode, file) => send(`${BASE_URL}/schemes/lines/upload`, fileForm(file, { schemeId, mode })),
};

export const schemeIssuanceService = {
  list: (params) => call("GET", `/scheme-issuance${qs(params)}`),
  get: async (appId) => (await call("GET", `/scheme-issuance/${id(appId)}`)).data,
  choices: async () => (await call("GET", "/scheme-issuance/choices")).data,
  create: (body) => call("POST", "/scheme-issuance", body),
  update: (appId, body) => call("PUT", `/scheme-issuance/${id(appId)}`, body),
  addItem: (appId, body) => call("POST", `/scheme-issuance/${id(appId)}/items`, body),
  uploadItem: (appId, itemId, file) => send(`${BASE_URL}/scheme-issuance/${id(appId)}/items/${id(itemId)}/upload`, fileForm(file)),
  /** receive | reopen | waive */
  itemAct: (appId, itemId, action, body) => call("POST", `/scheme-issuance/${id(appId)}/items/${id(itemId)}/${action}`, body),
  /** approve | reject */
  decideWaiver: (appId, itemId, decision, body) => call("POST", `/scheme-issuance/${id(appId)}/items/${id(itemId)}/waiver/${decision}`, body),
  sendToInsurer: (appId) => call("POST", `/scheme-issuance/${id(appId)}/send`, {}),
  decline: (appId, body) => call("POST", `/scheme-issuance/${id(appId)}/decline`, body),
  changeInsurer: (appId, body) => call("POST", `/scheme-issuance/${id(appId)}/insurer`, body),
  issue: (appId) => call("POST", `/scheme-issuance/${id(appId)}/issue`, {}),
  cancel: (appId, body) => call("POST", `/scheme-issuance/${id(appId)}/cancel`, body),
  bookings: async () => (await call("GET", "/scheme-issuance/bookings")).data,
  bookingsTemplate: () => blob(`${BASE_URL}/scheme-issuance/bookings/template`),
  uploadBookings: (file) => send(`${BASE_URL}/scheme-issuance/bookings/upload`, fileForm(file)),
};

export const lockInService = {
  reviews: (params) => call("GET", `/lock-in/reviews${qs(params)}`),
  review: async (reviewId) => (await call("GET", `/lock-in/reviews/${id(reviewId)}`)).data,
  decide: (reviewId, body) => call("POST", `/lock-in/reviews/${id(reviewId)}/decision`, body),
  /** approve | return */
  approve: (reviewId, action, body = {}) => call("POST", `/lock-in/reviews/${id(reviewId)}/${action}`, body),
  report: (params) => blob(`${BASE_URL}/lock-in/reviews/export${qs(params)}`),
  uploads: async () => (await call("GET", "/lock-in/uploads")).data,
  uploadsTemplate: () => blob(`${BASE_URL}/lock-in/uploads/template`),
  failedRows: (batchId) => blob(`${BASE_URL}/lock-in/uploads/${id(batchId)}/failed`),
  uploadStatus: (file) => send(`${BASE_URL}/lock-in/uploads`, fileForm(file)),
  panel: async (policyId) => (await call("GET", `/lock-in/policies/${id(policyId)}`)).data,
  setLoanStatus: (policyId, body) => call("PUT", `/lock-in/policies/${id(policyId)}/loan-status`, body),
  requestChange: (policyId, body) => call("POST", `/lock-in/policies/${id(policyId)}/changes`, body),
  /** approve | return */
  decideChange: (changeId, action, body = {}) => call("POST", `/lock-in/changes/${id(changeId)}/${action}`, body),
};
