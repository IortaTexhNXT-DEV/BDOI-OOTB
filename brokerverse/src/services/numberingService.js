import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Document Numbering, Commission Rate Matrix and insurer credit terms (BrokerVerse masters API). */
const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authService.getAuthHeader(),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(json.errors) && json.errors.length ? json.errors.map((e) => e.message).join("; ") : "";
    throw new Error(detail || json.message || `Request failed (${response.status})`);
  }
  return json;
};

const qs = (params = {}) => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  return q ? `?${q}` : "";
};
const enc = encodeURIComponent;

const numberingService = {
  // Document Numbering
  listSeries: (params) => call(`/document-numbering${qs(params)}`),
  getSeries: (code) => call(`/document-numbering/${enc(code)}`).then((r) => r.data),
  previewSeries: (code, params) => call(`/document-numbering/${enc(code)}/preview${qs(params)}`).then((r) => r.data),
  updateSeries: (code, body) => call(`/document-numbering/${enc(code)}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.data),
  setNextNumber: (code, nextNumber) =>
    call(`/document-numbering/${enc(code)}/next-number`, { method: "PUT", body: JSON.stringify({ nextNumber }) }).then((r) => r.data),

  // Commission Rate Matrix
  listRates: (params) => call(`/commission-rates${qs(params)}`).then((r) => r.data || []),
  createRate: (body) => call("/commission-rates", { method: "POST", body: JSON.stringify(body) }).then((r) => r.data),
  updateRate: (id, body) => call(`/commission-rates/${enc(id)}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => r.data),
  deleteRate: (id) => call(`/commission-rates/${enc(id)}`, { method: "DELETE" }).then((r) => r.data),
  resolveRate: (params) => call(`/commission-rates/resolve${qs(params)}`).then((r) => r.data),
  creditTerms: (insurerId) => call(`/commission-rates/credit-terms/${enc(insurerId)}`).then((r) => r.data),

  // dropdown options from the masters API
  options: (type, valueField = "id") => call(`/masters/${enc(type)}/options?valueField=${valueField}`).then((r) => r.data || []),
};

export default numberingService;
