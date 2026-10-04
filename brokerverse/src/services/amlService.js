import { deleteRequest, getRequest, postRequest, putRequest } from "../utility/commonServices";
import request from "../utility/interceptor";

/**
 * AML/CFT API (/aml) and client onboarding (/clients/onboard): due diligence, risk rating, EDD, KYC refresh,
 * screening lists and hits, the screening provider, transaction alerts, AML cases and AMLC report files.
 */
const enc = encodeURIComponent;
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** The server's message (with the field messages of a validation error), for toasts. */
export const errorMessage = (error, fallback) => {
  const body = error?.response?.data || {};
  const detail = Array.isArray(body.errors) ? body.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).filter(Boolean).join("; ") : "";
  if (body.message && detail && body.message !== "Validation failed") return body.message;
  return detail || body.message || error?.message || fallback;
};

/** Field errors of a validation answer as { field: message }. */
export const fieldErrors = (error) => {
  const list = error?.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.filter((e) => e.path).map((e) => [String(e.path).split(".")[0], e.message])) : {};
};

const data = (promise) => promise.then((r) => r.data.data);
const withMessage = (promise) => promise.then((r) => ({ data: r.data.data, message: r.data.message }));
const upload = (url, file, fields = {}) => {
  const form = new FormData();
  form.append("file", file);
  Object.entries(clean(fields)).forEach(([k, v]) => form.append(k, v));
  return withMessage(request.post(url, form, { headers: { "Content-Type": "multipart/form-data" } }));
};

/** Save a file answered by the server under the name it gives. */
const download = async (url, fallbackName) => {
  const response = await request.get(url, { responseType: "blob" });
  const name = (response.headers?.["content-disposition"] || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const href = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
};

const amlService = {
  // onboarding (Operations > Clients > Onboard client)
  onboard: (body) => withMessage(postRequest("clients/onboard", body)),
  updateKyc: (id, body) => withMessage(putRequest(`clients/${enc(id)}/kyc`, body)),
  client: (id) => getRequest(`clients/${enc(id)}`).then((r) => r.data.data),
  options: (type, valueField = "label") => data(getRequest(`masters/${enc(type)}/options`, { valueField })).catch(() => []),

  dashboard: () => data(getRequest("aml/dashboard")),
  settings: () => data(getRequest("aml/settings")),
  saveSettings: (settings) => withMessage(putRequest("aml/settings", { settings })),
  factors: () => data(getRequest("aml/risk-factors")),
  addFactor: (body) => withMessage(postRequest("aml/risk-factors", body)),
  saveFactor: (id, body) => withMessage(putRequest(`aml/risk-factors/${enc(id)}`, body)),
  deleteFactor: (id) => withMessage(deleteRequest(`aml/risk-factors/${enc(id)}`)),
  rules: () => data(getRequest("aml/rules")),
  saveRule: (code, body) => withMessage(putRequest(`aml/rules/${enc(code)}`, body)),

  clients: (params) => data(getRequest("aml/clients", clean(params))),
  profile: (id) => data(getRequest(`aml/clients/${enc(id)}/profile`)),
  addSignatory: (id, body) => withMessage(postRequest(`aml/clients/${enc(id)}/signatories`, body)),
  saveSignatory: (id, rowId, body) => withMessage(putRequest(`aml/clients/${enc(id)}/signatories/${enc(rowId)}`, body)),
  addOwner: (id, body) => withMessage(postRequest(`aml/clients/${enc(id)}/beneficial-owners`, body)),
  saveOwner: (id, rowId, body) => withMessage(putRequest(`aml/clients/${enc(id)}/beneficial-owners/${enc(rowId)}`, body)),
  uploadDocument: (id, file, fields) => upload(`aml/clients/${enc(id)}/documents`, file, fields),
  documentUrl: (key) => getRequest(`s3/presigned-download-url/${key}`).then((r) => r.data.url || r.data.data?.url),
  assess: (id) => withMessage(postRequest(`aml/clients/${enc(id)}/assess`, {})),
  override: (id, body) => withMessage(postRequest(`aml/clients/${enc(id)}/override`, body)),
  screenClient: (id) => withMessage(postRequest(`aml/clients/${enc(id)}/screen`, {})),

  refreshDue: (params) => data(getRequest("aml/kyc-refresh", clean(params))),
  completeRefresh: (id, notes) => withMessage(postRequest(`aml/clients/${enc(id)}/kyc-refresh`, { notes: notes || undefined })),

  eddReviews: (params) => data(getRequest("aml/edd-reviews", clean(params))),
  eddReview: (id) => data(getRequest(`aml/edd-reviews/${enc(id)}`)),
  openEdd: (body) => withMessage(postRequest("aml/edd-reviews", body)),
  saveEdd: (id, body) => withMessage(putRequest(`aml/edd-reviews/${enc(id)}`, body)),
  submitEdd: (id) => withMessage(postRequest(`aml/edd-reviews/${enc(id)}/submit`, {})),
  decideEdd: (id, body) => withMessage(postRequest(`aml/edd-reviews/${enc(id)}/decide`, body)),

  lists: () => data(getRequest("aml/lists")),
  addList: (body) => withMessage(postRequest("aml/lists", body)),
  saveList: (id, body) => withMessage(putRequest(`aml/lists/${enc(id)}`, body)),
  versions: (id) => data(getRequest(`aml/lists/${enc(id)}/versions`)),
  entries: (id, params) => data(getRequest(`aml/lists/${enc(id)}/entries`, clean(params))),
  uploadVersion: (id, file, fields) => upload(`aml/lists/${enc(id)}/versions`, file, fields),
  addEntry: (id, body) => withMessage(postRequest(`aml/lists/${enc(id)}/entries`, body)),
  removeEntry: (id, entryId, reason) => withMessage(deleteRequest(`aml/lists/${enc(id)}/entries/${enc(entryId)}`, { reason })),
  rescreen: () => withMessage(postRequest("aml/rescreen", {})),
  screenName: (body) => withMessage(postRequest("aml/screen", body)),
  hits: (params) => data(getRequest("aml/hits", clean(params))),
  decideHit: (id, body) => withMessage(postRequest(`aml/hits/${enc(id)}/decide`, body)),

  provider: () => data(getRequest("aml/provider")),
  providerRequests: (params) => data(getRequest("aml/provider/requests", clean(params))),
  retryRequest: (id) => withMessage(postRequest(`aml/provider/requests/${enc(id)}/retry`, {})),
  testProvider: (name) => withMessage(postRequest("aml/provider/test", { name })),

  runMonitoring: (body) => withMessage(postRequest("aml/monitoring/run", clean(body))),
  alerts: (params) => data(getRequest("aml/alerts", clean(params))),
  closeAlert: (id, reason) => withMessage(postRequest(`aml/alerts/${enc(id)}/close`, { reason })),

  cases: (params) => data(getRequest("aml/cases", clean(params))),
  caseDetail: (id) => data(getRequest(`aml/cases/${enc(id)}`)),
  openCase: (body) => withMessage(postRequest("aml/cases", body)),
  saveCase: (id, body) => withMessage(putRequest(`aml/cases/${enc(id)}`, body)),
  addAlertsToCase: (id, alertIds) => withMessage(postRequest(`aml/cases/${enc(id)}/alerts`, { alertIds })),
  approveCase: (id) => withMessage(postRequest(`aml/cases/${enc(id)}/approve`, {})),
  closeCase: (id, reason) => withMessage(postRequest(`aml/cases/${enc(id)}/close`, { reason })),
  caseReport: (id) => withMessage(postRequest(`aml/cases/${enc(id)}/report`, {})),

  reports: (params) => data(getRequest("aml/reports", clean(params))),
  generateCtr: (body) => withMessage(postRequest("aml/reports/ctr", body)),
  downloadReport: (id, name) => download(`aml/reports/${enc(id)}/download`, name || "amlc-report.txt"),
  submitReport: (id, body) => withMessage(postRequest(`aml/reports/${enc(id)}/submit`, clean(body))),
};

export default amlService;
