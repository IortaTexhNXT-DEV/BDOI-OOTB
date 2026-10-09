import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Integration framework API: connectors, outbox and inbox (/integrations), message templates and messages
 * (/messaging), CTPL authentication (/ctpl), insurer integration (/insurer-integration) and bank payment files
 * (/bank-payments).
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

const handleBody = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = Array.isArray(body.errors) && body.errors.length ? ` (${body.errors.slice(0, 4).map((e) => `${e.path}: ${e.message}`).join("; ")})` : "";
    throw new Error(`${body.message || `Request failed (${response.status})`}${detail}`);
  }
  return body;
};
const request = async (path, options = {}) => handleBody(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}));
const get = async (path) => (await request(path)).data;
const getPage = async (path) => {
  const b = await request(path);
  return { rows: b.data || [], total: b.total || 0, counts: b.counts || {}, extra: b };
};
const post = async (path, payload = {}) => request(path, { method: "POST", body: JSON.stringify(payload) });
const put = async (path, payload = {}) => request(path, { method: "PUT", body: JSON.stringify(payload) });
const upload = async (path, file) => {
  const form = new FormData();
  form.append("file", file);
  return handleBody(await fetch(`${BASE_URL}${path}`, { method: "POST", body: form, headers: { ...authService.getAuthHeader() } }));
};
const download = async (path, fallbackName) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) await handleBody(response);
  const disposition = response.headers.get("Content-Disposition") || "";
  const name = (disposition.match(/filename="([^"]+)"/) || [])[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
const id = (v) => encodeURIComponent(v);

const integrationsService = {
  // connectors, outbox, inbox
  connectors: () => get("/integrations/connectors"),
  registry: () => get("/integrations/registry"),
  updateConnector: (code, body) => put(`/integrations/connectors/${id(code)}`, body),
  testConnector: (code) => post(`/integrations/connectors/${id(code)}/test`),
  outbox: (params) => getPage(`/integrations/outbox${qs(params)}`),
  message: (messageId) => get(`/integrations/outbox/${id(messageId)}`),
  resend: (messageId) => post(`/integrations/outbox/${id(messageId)}/resend`),
  cancel: (messageId, reason) => post(`/integrations/outbox/${id(messageId)}/cancel`, { reason }),
  processDue: () => post("/integrations/outbox/process"),
  inbox: (params) => getPage(`/integrations/inbox${qs(params)}`),
  reprocess: (inboxId) => post(`/integrations/inbox/${id(inboxId)}/reprocess`),

  // message templates and messages
  templates: async (params) => request(`/messaging/templates${qs(params)}`),
  createTemplate: (body) => post("/messaging/templates", body),
  updateTemplate: (code, body) => put(`/messaging/templates/${id(code)}`, body),
  previewTemplate: (body) => post("/messaging/templates/preview", { body }),
  testTemplate: (code, to) => post(`/messaging/templates/${id(code)}/test`, { to }),
  sendMessage: (body) => post("/messaging/send", body),
  messages: (params) => getPage(`/messaging/messages${qs(params)}`),

  // CTPL authentication
  ctplList: (params) => getPage(`/ctpl/authentications${qs(params)}`),
  ctplRegister: (body) => post("/ctpl/authentications", body),
  ctplUpdate: (recordId, body) => put(`/ctpl/authentications/${id(recordId)}`, body),
  ctplAuthenticate: (recordId) => post(`/ctpl/authentications/${id(recordId)}/authenticate`),
  ctplManual: (recordId, body) => post(`/ctpl/authentications/${id(recordId)}/manual`, body),
  ctplCancel: (recordId, reason) => post(`/ctpl/authentications/${id(recordId)}/cancel`, { reason }),
  ctplReport: (format) => download(`/ctpl/authentications/report${qs({ format, unauthenticated: "true" })}`, `unauthenticated-ctpl.${format}`),
  cocSeries: (params) => get(`/ctpl/coc-series${qs(params)}`),
  createCocSeries: (body) => post("/ctpl/coc-series", body),
  updateCocSeries: (seriesId, body) => put(`/ctpl/coc-series/${id(seriesId)}`, body),

  // insurer integration
  mappings: async () => request("/insurer-integration/mappings"),
  saveMapping: (insurerId, body) => put(`/insurer-integration/mappings/${id(insurerId)}`, body),
  previewMapping: (insurerId, policyNumber) => post(`/insurer-integration/mappings/${id(insurerId)}/preview`, { policyNumber }),
  insurerRequests: (params) => getPage(`/insurer-integration/requests${qs(params)}`),
  insurerRequest: (body) => post("/insurer-integration/requests", body),
  importClaimStatus: (file) => upload("/insurer-integration/claim-status/import", file),

  // bank payment files
  layouts: async (params) => request(`/bank-payments/layouts${qs(params)}`),
  createLayout: (body) => post("/bank-payments/layouts", body),
  updateLayout: (code, body) => put(`/bank-payments/layouts/${id(code)}`, body),
  previewLayout: (body) => post("/bank-payments/layouts/preview", body),
  payeeAccounts: (params) => get(`/bank-payments/payee-accounts${qs(params)}`),
  createPayeeAccount: (body) => post("/bank-payments/payee-accounts", body),
  updatePayeeAccount: (accountId, body) => put(`/bank-payments/payee-accounts/${id(accountId)}`, body),
  bankAccounts: () => get("/bank-payments/bank-accounts"),
  eligibleVouchers: (params) => get(`/bank-payments/eligible-vouchers${qs(params)}`),
  batches: (params) => getPage(`/bank-payments/batches${qs(params)}`),
  batch: (batchId) => get(`/bank-payments/batches/${id(batchId)}`),
  createBatch: (body) => post("/bank-payments/batches", body),
  submitBatch: (batchId) => post(`/bank-payments/batches/${id(batchId)}/submit`),
  approveBatch: (batchId) => post(`/bank-payments/batches/${id(batchId)}/approve`),
  rejectBatch: (batchId, reason) => post(`/bank-payments/batches/${id(batchId)}/reject`, { reason }),
  generateBatchFile: (batchId) => post(`/bank-payments/batches/${id(batchId)}/generate`),
  markBatchSent: (batchId) => post(`/bank-payments/batches/${id(batchId)}/sent`),
  cancelBatch: (batchId, reason) => post(`/bank-payments/batches/${id(batchId)}/cancel`, { reason }),
  downloadBatchFile: (batchId, name) => download(`/bank-payments/batches/${id(batchId)}/file`, name || "payment-file.txt"),
  importStatusFile: (batchId, file) => upload(`/bank-payments/batches/${id(batchId)}/status-file`, file),
  lineResult: (batchId, lineId, body) => post(`/bank-payments/batches/${id(batchId)}/lines/${id(lineId)}/result`, body),

  // SAP GL text files (Accounts > SAP GL Export)
  sapGlRuns: (params) => getPage(`/sap-gl/runs${qs(params)}`),
  sapGlSettings: () => get("/sap-gl/settings"),
  runSapGl: (date) => post("/sap-gl/runs", { date }),
  downloadSapGlFile: (runId, kind, name) => download(`/sap-gl/runs/${id(runId)}/files/${id(kind)}`, name || `${kind}.txt`),
};

export default integrationsService;
