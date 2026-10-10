import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Period-end processing API (/period-end): fiscal calendar, period status, month-end close runs, recurring journals,
 * close checklist, year-end close, financial statements, tax codes and BIR Form 2307.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body.data;
};
const post = (path, payload = {}) => request(path, { method: "POST", body: JSON.stringify(payload) });
const put = (path, payload = {}) => request(path, { method: "PUT", body: JSON.stringify(payload) });
const del = (path) => request(path, { method: "DELETE" });

const periodEndService = {
  // fiscal calendar and periods
  fiscalYears: () => request("/period-end/fiscal-years"),
  fiscalYear: (code) => request(`/period-end/fiscal-years/${code}`),
  createFiscalYear: (startDate) => post("/period-end/fiscal-years", startDate ? { startDate } : {}),
  /** reason: { reasonCode, note } (components/ReasonPicker reasonPayload) */
  setPeriodStatus: (period, status, reason) => post(`/period-end/periods/${period}/status`, { status, ...reason }),
  statusPreview: (period, status) => request(`/period-end/periods/${period}/status-preview${qs({ status })}`),
  periodHistory: (period) => request(`/period-end/periods/${period}/history`),
  periodChecks: (period) => request(`/period-end/periods/${period}/checks`),

  // month-end close
  closeRuns: (params) => request(`/period-end/close-runs${qs(params)}`),
  closeRun: (id) => request(`/period-end/close-runs/${id}`),
  createCloseRun: (period, remarks) => post("/period-end/close-runs", { period, remarks: remarks || undefined }),
  executeRun: (id, steps) => post(`/period-end/close-runs/${id}/execute`, steps ? { steps } : {}),
  recheckRun: (id) => post(`/period-end/close-runs/${id}/checks`),
  signCheck: (id, code, remarks, signed = true) => post(`/period-end/close-runs/${id}/checks/${code}/sign`, { remarks: remarks || undefined, signed }),
  submitRun: (id, target, remarks) => post(`/period-end/close-runs/${id}/submit`, { target, remarks: remarks || undefined }),
  approveRun: (id, remarks) => post(`/period-end/close-runs/${id}/approve`, { remarks: remarks || undefined }),
  rejectRun: (id, reason) => post(`/period-end/close-runs/${id}/reject`, { reason }),
  cancelRun: (id, reason) => post(`/period-end/close-runs/${id}/cancel`, { reason: reason || undefined }),

  // checklist master
  checklist: () => request("/period-end/checklist"),
  addChecklistItem: (item) => post("/period-end/checklist", item),
  updateChecklistItem: (code, item) => put(`/period-end/checklist/${code}`, item),
  deleteChecklistItem: (code) => del(`/period-end/checklist/${code}`),

  // recurring journals
  recurringJournals: (params) => request(`/period-end/recurring-journals${qs(params)}`),
  recurringJournal: (id) => request(`/period-end/recurring-journals/${id}`),
  createRecurring: (body) => post("/period-end/recurring-journals", body),
  updateRecurring: (id, body) => put(`/period-end/recurring-journals/${id}`, body),
  runDueRecurring: (asOf, id) => post("/period-end/recurring-journals/run-due", { asOf: asOf || undefined, id: id || undefined }),

  // year-end
  yearEnd: () => request("/period-end/year-end"),
  yearEndRun: (id) => request(`/period-end/year-end/${id}`),
  createYearEnd: (fiscalYear) => post("/period-end/year-end", { fiscalYear }),
  checkYearEnd: (id) => post(`/period-end/year-end/${id}/check`),
  closeYearEnd: (id) => post(`/period-end/year-end/${id}/close`),
  reverseYearEnd: (id, reason) => post(`/period-end/year-end/${id}/reverse`, { reason }),
  cancelYearEnd: (id) => post(`/period-end/year-end/${id}/cancel`),
  createAdjustment: (body) => post("/period-end/adjustments", body),

  // statements and journals
  statement: (type, params) => request(`/period-end/statements/${type}${qs(params)}`),
  journalLines: (jvNumber) => request(`/accounting/entries/search${qs({ transactionCode: jvNumber, pageSize: 200 })}`),
  accounts: () => request("/accounting/accounts?status=active"),

  // tax
  taxCodes: (params) => request(`/period-end/tax-codes${qs(params)}`),
  createTaxCode: (body) => post("/period-end/tax-codes", body),
  updateTaxCode: (code, body) => put(`/period-end/tax-codes/${code}`, body),
  payees2307: (params) => request(`/period-end/bir/2307${qs(params)}`),
  certificate2307: (params) => request(`/period-end/bir/2307/certificate${qs(params)}`),
  issue2307: (body) => post("/period-end/bir/2307/issue", body),
  issueAll2307: (body) => post("/period-end/bir/2307/issue-all", body),
  certificates2307: (params) => request(`/period-end/bir/2307/certificates${qs(params)}`),
  cancel2307: (id, reason) => post(`/period-end/bir/2307/certificates/${id}/cancel`, { reason }),
};

export default periodEndService;
