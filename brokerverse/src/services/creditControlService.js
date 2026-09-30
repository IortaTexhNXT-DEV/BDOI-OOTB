import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Credit control API (/credit-control): instalment plans, premium warranty monitor, client credit limits and the ageing
 * of premium not yet remitted to insurers.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = Array.isArray(body.errors) && body.errors.length ? ` (${body.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join("; ")})` : "";
    throw new Error(`${body.message || `Request failed (${response.status})`}${detail}`);
  }
  return body.data;
};
const request = async (path, options = {}) => handle(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}));
const post = (path, payload = {}) => request(path, { method: "POST", body: JSON.stringify(payload) });
const put = (path, payload = {}) => request(path, { method: "PUT", body: JSON.stringify(payload) });

const R = "/credit-control";
const id = (v) => encodeURIComponent(v);

const creditControlService = {
  plans: (policyRef) => request(`${R}/policies/${id(policyRef)}/instalment-plans`),
  previewPlan: (policyRef, body) => post(`${R}/policies/${id(policyRef)}/instalment-plans/preview`, body),
  savePlan: (policyRef, body) => post(`${R}/policies/${id(policyRef)}/instalment-plans`, body),
  cancelPlan: (planId, reason) => post(`${R}/instalment-plans/${id(planId)}/cancel`, { reason }),
  instalmentAgeing: (params) => request(`${R}/instalments/ageing${qs(params)}`),
  warranty: (params) => request(`${R}/warranty${qs(params)}`),
  pendingExtensions: () => request(`${R}/warranty/extensions`),
  warrantyActions: (policyId) => request(`${R}/warranty/${id(policyId)}/actions`),
  remind: (policyId, notes) => post(`${R}/warranty/${id(policyId)}/remind`, notes ? { notes } : {}),
  requestExtension: (policyId, body) => post(`${R}/warranty/${id(policyId)}/extensions`, body),
  decideExtension: (extensionId, action, remarks) => post(`${R}/warranty/extensions/${id(extensionId)}/${action}`, remarks ? { remarks } : {}),
  requestCancellation: (policyId, notes) => post(`${R}/warranty/${id(policyId)}/cancellation-request`, notes ? { notes } : {}),
  clientLimits: (params) => request(`${R}/clients${qs(params)}`),
  setCreditLimit: (clientId, creditLimit) => put(`${R}/clients/${id(clientId)}/credit-limit`, { creditLimit }),
  creditExceptions: (params) => request(`${R}/credit-exceptions${qs(params)}`),
  acknowledgeException: (exceptionId, remarks) => post(`${R}/credit-exceptions/${id(exceptionId)}/acknowledge`, remarks ? { remarks } : {}),
  remittanceAgeing: (params) => request(`${R}/remittance-ageing${qs(params)}`),
  /** Download the remittance ageing as Excel with the session token. */
  downloadRemittanceAgeing: async (params) => {
    const response = await fetch(`${BASE_URL}${R}/remittance-ageing${qs({ ...params, format: "xlsx" })}`, { headers: { ...authService.getAuthHeader() } });
    if (!response.ok) await handle(response);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `remittance-ageing-${params.asOf || "today"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export default creditControlService;
