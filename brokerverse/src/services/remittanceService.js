import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const toQuery = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  const search = new URLSearchParams();
  entries.forEach(([k, v]) => search.append(k, Array.isArray(v) ? v.join(",") : v));
  return `?${search.toString()}`;
};

const errorMessage = (body, status) => {
  const details = (body?.errors || []).map((e) => e.message).filter(Boolean).join(", ");
  const message = body?.message || body?.error?.message || body?.error || `Request failed (${status})`;
  return details ? `${message}: ${details}` : message;
};

/** Calls the API and returns the full JSON envelope ({ success, data, total, ... }); throws the server message on error. */
export const apiRequest = async (method, path, { body, params, form } = {}) => {
  const headers = { ...authService.getAuthHeader() };
  if (!form) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success === false) throw new Error(errorMessage(json, response.status));
  return json;
};

const get = async (path, params) => (await apiRequest("GET", path, { params })).data;
const post = async (path, body) => (await apiRequest("POST", path, { body: body || {} })).data;
const put = async (path, body) => (await apiRequest("PUT", path, { body })).data;
const patch = async (path, body) => (await apiRequest("PATCH", path, { body })).data;
const del = async (path) => apiRequest("DELETE", path);

const R = "/remittance";
const id = (v) => encodeURIComponent(v);

export const remittanceService = {
  // remittances / tracking / automated processing
  listRemittances: (params) => apiRequest("GET", `${R}/remittances`, { params }),
  getRemittance: (remId) => get(`${R}/remittances/${id(remId)}`),
  createRemittance: (payload) => post(`${R}/remittances`, payload),
  validateRemittances: (ids) => post(`${R}/remittances/validate`, { ids }),
  processRemittances: (ids) => post(`${R}/remittances/process`, { ids }),
  approveRemittance: (remId, comments) => post(`${R}/remittances/${id(remId)}/approve`, { comments }),
  rejectRemittance: (remId, comments) => post(`${R}/remittances/${id(remId)}/reject`, { comments }),
  settleRemittance: (remId, payload) => post(`${R}/remittances/${id(remId)}/settle`, payload),
  processingHistory: () => get(`${R}/processing-history`),
  automatedCandidates: (configCode) => get(`${R}/automated/candidates`, { configCode }),
  executeAutomated: (payload) => post(`${R}/automated/execute`, payload),
  automatedHistory: () => get(`${R}/automated/history`),

  // direct / agency bills
  directBillPolicies: (params) => get(`${R}/direct-bill/policies`, params),
  listDirectBills: (params) => get(`${R}/direct-bill`, params),
  createDirectBill: (payload) => post(`${R}/direct-bill`, payload),
  agencies: (billPeriod) => get(`${R}/agency-bill/agencies`, { billPeriod }),
  generateAgencyBills: (payload) => post(`${R}/agency-bill/generate`, payload),
  listAgencyBills: (params) => get(`${R}/agency-bill`, params),
  sendBill: (billId, payload) => post(`${R}/bills/${id(billId)}/send`, payload),

  // approvals
  listApprovals: (params) => get(`${R}/approvals`, params),
  approvalHistory: () => get(`${R}/approvals/history`),
  approve: (approvalId, comments) => post(`${R}/approvals/${id(approvalId)}/approve`, { comments }),
  reject: (approvalId, comments) => post(`${R}/approvals/${id(approvalId)}/reject`, { comments }),
  delegate: (approvalId, delegateTo, comments) => post(`${R}/approvals/${id(approvalId)}/delegate`, { delegateTo, comments }),
  listDelegations: () => get(`${R}/approvals/delegations`),
  createDelegation: (payload) => post(`${R}/approvals/delegations`, payload),

  // settlements
  settlementPolicies: (insurerCode) => get(`${R}/settlements/available-policies`, { insurerCode }),
  calculateSettlement: (payload) => post(`${R}/settlements/calculate`, payload),
  listSettlements: (params) => get(`${R}/settlements`, params),
  getSettlement: (settlementId) => get(`${R}/settlements/${id(settlementId)}`),
  createSettlement: (payload) => post(`${R}/settlements`, payload),
  updateSettlement: (settlementId, payload) => put(`${R}/settlements/${id(settlementId)}`, payload),
  submitSettlement: (settlementId, payload) => post(`${R}/settlements/${id(settlementId)}/submit`, payload),

  // adjustments
  listAdjustments: (params) => get(`${R}/adjustments`, params),
  adjustmentHistory: () => get(`${R}/adjustments/history`),
  createAdjustment: (payload) => post(`${R}/adjustments`, payload),
  completeAdjustment: (adjId) => post(`${R}/adjustments/${id(adjId)}/complete`),

  // electronic transfers
  transferMethods: () => get(`${R}/transfers/methods`),
  listTransfers: (params) => get(`${R}/transfers`, params),
  createTransfer: (payload) => post(`${R}/transfers`, payload),
  executeTransfer: (transferId, payload) => post(`${R}/transfers/${id(transferId)}/execute`, payload),

  // statements
  listStatements: () => get(`${R}/statements`),
  previewStatement: (params) => get(`${R}/statements/preview`, params),
  generateStatement: (payload) => post(`${R}/statements/generate`, payload),

  // exceptions
  listExceptions: (params) => get(`${R}/exceptions`, params),
  createException: (payload) => post(`${R}/exceptions`, payload),
  assignException: (excId, assignedTo) => post(`${R}/exceptions/${id(excId)}/assign`, { assignedTo }),
  resolveException: (excId, resolution) => post(`${R}/exceptions/${id(excId)}/resolve`, { resolution }),
  escalateException: (excId, reason) => post(`${R}/exceptions/${id(excId)}/escalate`, { reason }),

  // notifications
  inbox: () => get(`${R}/notifications/inbox`),
  sentNotifications: () => get(`${R}/notifications/sent`),
  notificationTemplates: () => get(`${R}/notifications/templates`),
  sendNotification: (payload) => post(`${R}/notifications`, payload),

  // scheduling
  listSchedules: () => get(`${R}/schedules`),
  createSchedule: (payload) => post(`${R}/schedules`, payload),
  setScheduleStatus: (scheduleId, status) => patch(`${R}/schedules/${id(scheduleId)}/status`, { status }),
  runSchedule: (scheduleId) => post(`${R}/schedules/${id(scheduleId)}/run`),

  // bulk processing
  listBulk: () => get(`${R}/bulk`),
  uploadBulk: async (file, configCode) => {
    const form = new FormData();
    form.append("file", file);
    if (configCode) form.append("configCode", configCode);
    return (await apiRequest("POST", `${R}/bulk/upload`, { form })).data;
  },
  processBulk: (uploadId) => post(`${R}/bulk/${id(uploadId)}/process`),

  // reconciliation
  reconciliation: () => get(`${R}/reconciliation`),
  importBankTransactions: (transactions) => post(`${R}/reconciliation/bank-transactions`, { transactions }),
  autoMatch: (tolerance) => post(`${R}/reconciliation/auto-match`, tolerance === undefined ? {} : { tolerance }),
  match: (bankId, remittanceId) => post(`${R}/reconciliation/match`, { bankId, remittanceId }),
  unmatch: (bankId) => post(`${R}/reconciliation/unmatch`, { bankId }),

  // analytics / reports / history
  analytics: (params) => get(`${R}/analytics`, params),
  reportTemplates: () => get(`${R}/reports/templates`),
  listReports: () => get(`${R}/reports`),
  generateReport: (payload) => post(`${R}/reports/generate`, payload),
  history: (params) => apiRequest("GET", `${R}/history`, { params }),
  auditTrail: (referenceNo) => get(`${R}/history/audit`, { referenceNo }),
  systemLogs: () => get(`${R}/history/system-logs`),

  // Remittance Master (configuration records live in /masters/<type>)
  masterOverview: (params) => get(`${R}/masters`, params),
};

/** Generic master store (/masters/<type>) used by the remittance and incentive configuration screens. */
export const masterService = {
  list: (type, params) => get(`/masters/${type}`, { perPage: 200, ...params }),
  options: (type, params) => get(`/masters/${type}/options`, params),
  definition: (type) => get(`/masters/${type}/definition`),
  getOne: (type, recordId) => get(`/masters/${type}/${id(recordId)}`),
  create: (type, payload) => post(`/masters/${type}`, payload),
  update: (type, recordId, payload) => put(`/masters/${type}/${id(recordId)}`, payload),
  setStatus: (type, recordId, status) => patch(`/masters/${type}/${id(recordId)}/status`, { status }),
  remove: (type, recordId) => del(`/masters/${type}/${id(recordId)}`),
};

export default remittanceService;
