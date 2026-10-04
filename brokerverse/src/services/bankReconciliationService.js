import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Bank reconciliation API (/bank-reconciliation): bank account set-up, statement formats, bank transaction types,
 * match rules, statements (import with preview, manual entry), matching workspace, adjustments, stale cheques and
 * reconciliation runs with the printable Bank Reconciliation Statement.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = Array.isArray(body.errors) && body.errors.length ? ` (${body.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join("; ")})` : "";
    const error = new Error(`${body.message || `Request failed (${response.status})`}${detail}`);
    error.status = response.status;
    throw error;
  }
  return body.data;
};
const request = async (path, options = {}) => handle(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}));
const post = (path, payload = {}) => request(path, { method: "POST", body: JSON.stringify(payload) });
const put = (path, payload = {}) => request(path, { method: "PUT", body: JSON.stringify(payload) });
const del = (path) => request(path, { method: "DELETE" });
/** Multipart POST (statement file + form fields). */
const upload = async (path, file, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") form.append(k, String(v)); });
  form.append("file", file);
  return handle(await fetch(`${BASE_URL}${path}`, { method: "POST", body: form, headers: { ...authService.getAuthHeader() } }));
};

const R = "/bank-reconciliation";
const bankReconciliationService = {
  bankAccounts: () => request(`${R}/bank-accounts`),
  linkBankAccount: (code, body) => put(`${R}/bank-accounts/${encodeURIComponent(code)}`, body),

  formats: () => request(`${R}/formats`),
  addFormat: (body) => post(`${R}/formats`, body),
  updateFormat: (code, body) => put(`${R}/formats/${encodeURIComponent(code)}`, body),
  deleteFormat: (code) => del(`${R}/formats/${encodeURIComponent(code)}`),
  testFormat: (code, file) => upload(`${R}/formats/${encodeURIComponent(code)}/test`, file),

  transactionTypes: () => request(`${R}/transaction-types`),
  addTransactionType: (body) => post(`${R}/transaction-types`, body),
  updateTransactionType: (code, body) => put(`${R}/transaction-types/${encodeURIComponent(code)}`, body),
  deleteTransactionType: (code) => del(`${R}/transaction-types/${encodeURIComponent(code)}`),

  matchRules: () => request(`${R}/match-rules`),
  updateMatchRule: (code, body) => put(`${R}/match-rules/${encodeURIComponent(code)}`, body),

  previewStatement: (file, fields) => upload(`${R}/statements/preview`, file, fields),
  importStatement: (file, fields) => upload(`${R}/statements/import`, file, fields),
  manualStatement: (body) => post(`${R}/statements`, body),
  statements: (params) => request(`${R}/statements${qs(params)}`),
  statement: (id) => request(`${R}/statements/${id}`),
  deleteStatement: (id) => del(`${R}/statements/${id}`),

  workspace: (bankAccount, period) => request(`${R}/workspace${qs({ bankAccount, period })}`),
  autoMatch: (bankAccount) => post(`${R}/auto-match`, { bankAccount }),
  match: (body) => post(`${R}/matches`, body),
  matches: (params) => request(`${R}/matches${qs(params)}`),
  unmatch: (id, reason) => post(`${R}/matches/${id}/unmatch`, reason ? { reason } : {}),
  createAdjustment: (lineId, body) => post(`${R}/bank-lines/${lineId}/adjustment`, body),
  approveAdjustment: (lineId) => post(`${R}/bank-lines/${lineId}/adjustment/approve`),
  flagLine: (lineId, flag, remarks) => post(`${R}/bank-lines/${lineId}/flag`, { flag, remarks: remarks || undefined }),

  staleCheques: (bankAccount, asOf) => request(`${R}/stale-cheques${qs({ bankAccount, asOf })}`),
  cancelStaleCheque: (lineId, bankAccount, reason) => post(`${R}/stale-cheques/${lineId}/cancel`, { bankAccount, reason: reason || undefined }),

  reconciliations: (params) => request(`${R}/reconciliations${qs(params)}`),
  reconciliation: (id) => request(`${R}/reconciliations/${id}`),
  createReconciliation: (bankAccount, period, remarks) => post(`${R}/reconciliations`, { bankAccount, period, remarks: remarks || undefined }),
  prepare: (id, remarks) => post(`${R}/reconciliations/${id}/prepare`, { remarks: remarks || undefined }),
  approve: (id, remarks) => post(`${R}/reconciliations/${id}/approve`, { remarks: remarks || undefined }),
  reopen: (id, remarks) => post(`${R}/reconciliations/${id}/reopen`, { remarks }),
  cancel: (id, remarks) => post(`${R}/reconciliations/${id}/cancel`, { remarks: remarks || undefined }),
  /** The statement PDF as a blob URL (opened in a new tab by the caller). */
  pdfUrl: async (id) => {
    const response = await fetch(`${BASE_URL}${R}/reconciliations/${id}/pdf`, { headers: { ...authService.getAuthHeader() } });
    if (!response.ok) throw new Error(`Could not print the statement (${response.status})`);
    return URL.createObjectURL(await response.blob());
  },
};

export default bankReconciliationService;
