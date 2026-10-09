import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Insurer statement reconciliation API (/insurer-reconciliation): statement formats, statement import with preview,
 * automatic and manual matching, resolutions, submit / approve / reject and the differences report download.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(apiErrorMessage(body, response.status));
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
const upload = async (path, file, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") form.append(k, String(v)); });
  form.append("file", file);
  return handle(await fetch(`${BASE_URL}${path}`, { method: "POST", body: form, headers: { ...authService.getAuthHeader() } }));
};

const R = "/insurer-reconciliation";
const id = (v) => encodeURIComponent(v);

const insurerReconciliationService = {
  formats: (params) => request(`${R}/formats${qs(params)}`),
  addFormat: (body) => post(`${R}/formats`, body),
  updateFormat: (code, body) => put(`${R}/formats/${id(code)}`, body),
  statements: (params) => request(`${R}/statements${qs(params)}`),
  statement: (statementId) => request(`${R}/statements/${id(statementId)}`),
  preview: (file, fields) => upload(`${R}/statements/preview`, file, fields),
  importStatement: (file, fields) => upload(`${R}/statements/import`, file, fields),
  autoMatch: (statementId) => post(`${R}/statements/${id(statementId)}/auto-match`),
  candidates: (statementId, search) => request(`${R}/statements/${id(statementId)}/candidates${qs({ search })}`),
  match: (statementId, lineId, body) => post(`${R}/statements/${id(statementId)}/lines/${id(lineId)}/match`, body),
  unmatch: (statementId, lineId) => del(`${R}/statements/${id(statementId)}/lines/${id(lineId)}/match`),
  resolve: (statementId, body) => post(`${R}/statements/${id(statementId)}/resolutions`, body),
  removeResolution: (statementId, resolutionId) => del(`${R}/statements/${id(statementId)}/resolutions/${id(resolutionId)}`),
  submit: (statementId) => post(`${R}/statements/${id(statementId)}/submit`),
  approve: (statementId, remarks) => post(`${R}/statements/${id(statementId)}/approve`, { remarks }),
  reject: (statementId, remarks) => post(`${R}/statements/${id(statementId)}/reject`, { remarks }),
  cancel: (statementId, reason) => post(`${R}/statements/${id(statementId)}/cancel`, { reason }),
  /** Download the differences report (xlsx, csv or pdf) with the session token. */
  downloadReport: async (statementId, format, fileBase) => {
    const response = await fetch(`${BASE_URL}${R}/statements/${id(statementId)}/report${qs({ format })}`, { headers: { ...authService.getAuthHeader() } });
    if (!response.ok) await handle(response);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export default insurerReconciliationService;
