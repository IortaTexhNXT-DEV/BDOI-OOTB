import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";
import importService from "./importService";

const toQuery = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  const search = new URLSearchParams();
  entries.forEach(([k, v]) => search.append(k, Array.isArray(v) ? v.join(",") : v));
  return `?${search.toString()}`;
};

/**
 * Calls the API and returns the full JSON envelope ({ success, data, total, ... }); throws the server message on error,
 * with the HTTP status, the code of the first error (MSG-RMT-007, WINDOW_DONE ...) and the field errors
 * ([{ path, code, message }]) on the error object.
 */
export const apiRequest = async (method, path, { body, params, form } = {}) => {
  const headers = { ...authService.getAuthHeader() };
  if (!form) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success === false) {
    const error = new Error(apiErrorMessage(json, response.status));
    error.status = response.status;
    error.errors = Array.isArray(json?.errors) ? json.errors : [];
    error.code = error.errors.find((e) => e?.code)?.code || null;
    throw error;
  }
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
  /** API path of the printable remittance advice (agency bill), for components/Print printPdf. */
  remittanceAdvicePath: (remId) => `${R}/remittances/${id(remId)}/pdf`,
  createRemittance: (payload) => post(`${R}/remittances`, payload),
  validateRemittances: (ids) => post(`${R}/remittances/validate`, { ids }),
  processRemittances: (ids) => post(`${R}/remittances/process`, { ids }),
  approveRemittance: (remId, comments) => post(`${R}/remittances/${id(remId)}/approve`, { comments }),
  rejectRemittance: (remId, reason) => post(`${R}/remittances/${id(remId)}/reject`, reason),
  settleRemittance: (remId, payload) => post(`${R}/remittances/${id(remId)}/settle`, payload),
  processingHistory: () => get(`${R}/processing-history`),
  automatedCandidates: (configCode) => get(`${R}/automated/candidates`, { configCode }),
  executeAutomated: (payload) => post(`${R}/automated/execute`, payload),
  automatedHistory: () => get(`${R}/automated/history`),

  // direct bill: the client pays the insurer; the broker bills its commission with a commission debit note
  directBillSummary: () => get(`${R}/direct-bill/summary`),
  directBillItems: (params) => apiRequest("GET", `${R}/direct-bill/policies`, { params }),
  listDebitNotes: (params) => apiRequest("GET", `${R}/direct-bill`, { params }),
  listDirectBills: (params) => get(`${R}/direct-bill`, params),
  getDebitNote: (dnId) => get(`${R}/direct-bill/${id(dnId)}`),
  raiseDebitNote: (payload) => post(`${R}/direct-bill`, payload),
  submitDebitNote: (dnId) => post(`${R}/direct-bill/${id(dnId)}/submit`),
  approveDebitNote: (dnId, remarks) => post(`${R}/direct-bill/${id(dnId)}/approve`, { remarks }),
  rejectDebitNote: (dnId, reason) => post(`${R}/direct-bill/${id(dnId)}/reject`, { reason }),
  cancelDebitNote: (dnId, reason) => post(`${R}/direct-bill/${id(dnId)}/cancel`, { reason }),
  sendDebitNote: (dnId, email) => post(`${R}/direct-bill/${id(dnId)}/send`, email ? { email } : {}),
  collectDebitNote: (dnId, payload) => post(`${R}/direct-bill/${id(dnId)}/collections`, payload),
  reverseDebitNoteCollection: (dnId, collectionId, reason) => post(`${R}/direct-bill/${id(dnId)}/collections/${id(collectionId)}/reverse`, { reason }),
  changeBillingMode: (payload) => post(`${R}/direct-bill/billing-mode`, payload),
  // the client's payment to the insurer on a direct-bill policy (recorded only, nothing is posted)
  clientPayments: (policyId) => get(`${R}/direct-bill/policies/${id(policyId)}/client-payments`),
  recordClientPayment: (policyId, payload) => post(`${R}/direct-bill/policies/${id(policyId)}/client-payments`, payload),
  voidClientPayment: (paymentId, reason) => post(`${R}/direct-bill/client-payments/${id(paymentId)}/void`, { reason }),
  listClientPayments: (params) => get(`${R}/direct-bill/client-payments`, params),
  /** Opens the printable debit note (PDF fetched with the session token). */
  openDebitNotePdf: async (dnId) => {
    const response = await fetch(`${BASE_URL}${R}/direct-bill/${id(dnId)}/pdf`, { headers: { ...authService.getAuthHeader() } });
    if (!response.ok) {
      const json = await response.json().catch(() => null);
      throw new Error(apiErrorMessage(json, response.status));
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  // agency bills
  agencies: (billPeriod) => get(`${R}/agency-bill/agencies`, { billPeriod }),
  generateAgencyBills: (payload) => post(`${R}/agency-bill/generate`, payload),
  listAgencyBills: (params) => get(`${R}/agency-bill`, params),
  sendBill: (billId, payload) => post(`${R}/bills/${id(billId)}/send`, payload),

  // approvals
  listApprovals: (params) => get(`${R}/approvals`, params),
  approvalHistory: () => get(`${R}/approvals/history`),
  approve: (approvalId, comments) => post(`${R}/approvals/${id(approvalId)}/approve`, { comments }),
  // reason: { reasonCode, note } of the remittance_reject context (ReasonPicker reasonPayload)
  reject: (approvalId, reason) => post(`${R}/approvals/${id(approvalId)}/reject`, reason),
  delegate: (approvalId, delegateTo, comments) => post(`${R}/approvals/${id(approvalId)}/delegate`, { delegateTo, comments }),
  listApprovers: () => get(`${R}/approvals/approvers`),

  // settlements
  settlementPolicies: (insurerCode) => get(`${R}/settlements/available-policies`, { insurerCode }),
  // refunds due from the insurer (return premium already remitted), netted against its next remittance voucher
  insurerCredits: (insurer, status = "open") => get(`${R}/insurer-credits`, { insurer, status }),
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
  updateSchedule: (scheduleId, payload) => put(`${R}/schedules/${id(scheduleId)}`, payload),
  setScheduleStatus: (scheduleId, status) => patch(`${R}/schedules/${id(scheduleId)}/status`, { status }),
  // Run now: an off-cycle run with a remittance_off_cycle reason ({ reasonCode, note }); the envelope carries MSG-RMT-008
  runSchedule: (scheduleId, reason) => apiRequest("POST", `${R}/schedules/${id(scheduleId)}/run`, { body: reason || {} }),
  getSchedule: (scheduleId) => get(`${R}/schedules/${id(scheduleId)}`),
  scheduleRuns: (scheduleId, params) => apiRequest("GET", `${R}/schedules/${id(scheduleId)}/runs`, { params }),
  scheduleActivity: (scheduleId) => get(`${R}/schedules/${id(scheduleId)}/activity`),
  previewRun: (scheduleId) => post(`${R}/schedules/${id(scheduleId)}/preview`),

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
  history: (params) => apiRequest("GET", `${R}/history`, { params }),
  auditTrail: (referenceNo) => get(`${R}/history/audit`, { referenceNo }),
  systemLogs: () => get(`${R}/history/system-logs`),

  // Accounts > Remittance (R1): the landing and menu counts, the register, approvals, insurer payments and imports
  summary: () => get(`${R}/summary`),
  /** Downloads a file of the API (XLSX, PDF) with the session token. */
  download: (path, fallbackName) => importService.downloadTemplate(path, fallbackName),
  listRegister: (params) => apiRequest("GET", `${R}/remittances`, { params }),
  exportRegisterPath: (params = {}) => `${R}/remittances/export.xlsx${toQuery(params)}`,
  // items: [{ id, version }]; per-item results
  submitRemittances: (items) => post(`${R}/remittances/submit`, { items }),
  remittanceActivity: (remId) => get(`${R}/remittances/${id(remId)}/activity`),
  remittanceActivityPath: (remId) => `${R}/remittances/${id(remId)}/activity?format=xlsx`,
  schedulePath: (remId, ext = "xlsx") => `${R}/remittances/${id(remId)}/schedule.${ext}`,
  advicePath: (remId) => `${R}/remittances/${id(remId)}/advice.pdf`,
  approvalInbox: (params) => apiRequest("GET", `${R}/approvals`, { params: { view: "mine", ...params } }),
  getApproval: (approvalId) => get(`${R}/approvals/${id(approvalId)}`),
  approvalExportPath: (params = {}) => `${R}/approvals/export.xlsx${toQuery(params)}`,
  // { items: [{ id, version }], action: approve | reject, reasonCode, note }; per-item results
  decideApprovals: (payload) => post(`${R}/approvals/decide`, payload),
  approveApproval: (approvalId, { version, comments } = {}) => post(`${R}/approvals/${id(approvalId)}/approve`, { version, comments }),
  // reason: { reasonCode, note } of the remittance_reject context, with the version shown
  rejectApproval: (approvalId, reason, version) => post(`${R}/approvals/${id(approvalId)}/reject`, { ...reason, version }),
  remindApprovers: (approvalId) => apiRequest("POST", `${R}/approvals/${id(approvalId)}/remind`, { body: {} }),
  listPayments: (params) => apiRequest("GET", `${R}/payments`, { params }),
  getPayment: (voucherId) => get(`${R}/payments/${id(voucherId)}`),
  revealPaymentAccount: (voucherId) => get(`${R}/payments/${id(voucherId)}/account`),
  legacyTransfers: (params) => apiRequest("GET", `${R}/transfers`, { params: { legacy: 1, ...params } }),
  getTransfer: (transferId) => get(`${R}/transfers/${id(transferId)}`),
  importTemplatePath: `${R}/imports/template`,
  importValidatePath: `${R}/imports/validate`,
  importLimits: () => get(`${R}/imports/limits`),
  listImports: (params) => apiRequest("GET", `${R}/imports`, { params }),
  getImport: (importId) => get(`${R}/imports/${id(importId)}`),
  importRows: (importId, params) => apiRequest("GET", `${R}/imports/${id(importId)}/rows`, { params }),
  importErrorsPath: (importId) => `${R}/imports/${id(importId)}/errors.xlsx`,
  commitImport: (importId, version) => apiRequest("POST", `${R}/imports/${id(importId)}/commit`, { body: { version } }),
  discardImport: (importId) => post(`${R}/imports/${id(importId)}/discard`),
  myExceptions: (params) => apiRequest("GET", `${R}/exceptions`, { params: { assignedTo: "me", ...params } }),
  myDebitNotes: (params) => apiRequest("GET", `${R}/direct-bill`, { params: { attention: "mine", ...params } }),

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
