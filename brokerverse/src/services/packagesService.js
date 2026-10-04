import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Packaged products API: premium taxes and charges (/premium-charges), bundles, insurer rate tables, the insurer
 * comparison and package quotations / policies (/packages), payment gateways and payment links (/payment-gateways,
 * /payment-links) and the public checkout (/public/payments).
 */
const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const request = async (method, path, body, { auth = true } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(auth ? authService.getAuthHeader() : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const detail = Array.isArray(json.errors) ? json.errors.map((e) => e.message).filter(Boolean).join(", ") : "";
    const error = new Error(json.message && detail && json.message === "Validation failed" ? detail : json.message || detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return json;
};

/** Open a PDF response in a new tab. */
const showPdf = async (response) => {
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `Could not open the document (${response.status})`);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Fetch a PDF with GET (printed quotation, policy schedule) and open it in a new tab. */
const getPdf = (path) => fetch(`${BASE_URL}${path}`, { method: "GET", headers: { ...authService.getAuthHeader() } }).then(showPdf);

/** Fetch a PDF built from a request body (comparison) with POST and open it in a new tab. */
const postPdf = (path, body) => fetch(`${BASE_URL}${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
  body: JSON.stringify(body || {}),
}).then(showPdf);

const enc = encodeURIComponent;
const data = (p) => p.then((r) => r.data);

const packagesService = {
  // premium taxes and charges, LGU tax rates
  listChargeRules: (params) => data(request("GET", `/premium-charges/rules${queryString(params)}`)),
  createChargeRule: (body) => data(request("POST", "/premium-charges/rules", body)),
  updateChargeRule: (code, body) => data(request("PUT", `/premium-charges/rules/${enc(code)}`, body)),
  deleteChargeRule: (code) => data(request("DELETE", `/premium-charges/rules/${enc(code)}`)),
  listLguRates: (params) => data(request("GET", `/premium-charges/lgu-rates${queryString(params)}`)),
  createLguRate: (body) => data(request("POST", "/premium-charges/lgu-rates", body)),
  updateLguRate: (id, body) => data(request("PUT", `/premium-charges/lgu-rates/${enc(id)}`, body)),
  deleteLguRate: (id) => data(request("DELETE", `/premium-charges/lgu-rates/${enc(id)}`)),
  calculateCharges: (body) => data(request("POST", "/premium-charges/calculate", body)),

  // insurer rate tables
  listRateTables: (params) => data(request("GET", `/packages/rate-tables${queryString(params)}`)),
  createRateTable: (body) => data(request("POST", "/packages/rate-tables", body)),
  updateRateTable: (id, body) => data(request("PUT", `/packages/rate-tables/${enc(id)}`, body)),
  deleteRateTable: (id) => data(request("DELETE", `/packages/rate-tables/${enc(id)}`)),

  // bundle products
  listBundles: (params) => data(request("GET", `/packages/bundles${queryString(params)}`)),
  getBundle: (id) => data(request("GET", `/packages/bundles/${enc(id)}`)),
  createBundle: (body) => data(request("POST", "/packages/bundles", body)),
  updateBundle: (id, body) => data(request("PUT", `/packages/bundles/${enc(id)}`, body)),
  deleteBundle: (id) => data(request("DELETE", `/packages/bundles/${enc(id)}`)),

  // comparison
  compare: (body) => data(request("POST", "/packages/compare", body)),
  printComparison: (body) => postPdf("/packages/compare/pdf", body),
  quotationFromComparison: (body) => data(request("POST", "/packages/compare/quotation", body)),

  // package quotations and policies
  previewPackage: (body) => data(request("POST", "/packages/quotes/preview", body)),
  listPackageQuotes: (params) => request("GET", `/packages/quotes${queryString(params)}`),
  getPackageQuote: (id) => data(request("GET", `/packages/quotes/${enc(id)}`)),
  createPackageQuote: (body) => data(request("POST", "/packages/quotes", body)),
  updatePackageQuote: (id, body) => data(request("PUT", `/packages/quotes/${enc(id)}`, body)),
  quoteAction: (id, action) => data(request("POST", `/packages/quotes/${enc(id)}/${action}`, {})),
  issuePackageQuote: (id, body = {}) => data(request("POST", `/packages/quotes/${enc(id)}/issue`, body)),
  printPackageQuote: (id) => getPdf(`/packages/quotes/${enc(id)}/pdf`),
  listPackagePolicies: (params) => request("GET", `/packages/policies${queryString(params)}`),
  getPackagePolicy: (id) => data(request("GET", `/packages/policies/${enc(id)}`)),
  printSchedule: (id) => getPdf(`/packages/policies/${enc(id)}/schedule`),
  endorseSection: (id, sectionNo, body) => data(request("POST", `/packages/policies/${enc(id)}/sections/${enc(sectionNo)}/endorse`, body)),
  renewPackage: (id, body = {}) => data(request("POST", `/packages/policies/${enc(id)}/renew`, body)),

  // payment gateways and links
  listGateways: (params) => data(request("GET", `/payment-gateways${queryString(params)}`)),
  updateGateway: (code, body) => data(request("PUT", `/payment-gateways/${enc(code)}`, body)),
  listPaymentEvents: (params) => request("GET", `/payment-gateways/events${queryString(params)}`),
  listPaymentLinks: (params) => request("GET", `/payment-links${queryString(params)}`),
  getPaymentLink: (id) => data(request("GET", `/payment-links/${enc(id)}`)),
  createPaymentLink: (body) => data(request("POST", "/payment-links", body)),
  cancelPaymentLink: (id) => data(request("POST", `/payment-links/${enc(id)}/cancel`, {})),
  applyPaymentLink: (id) => data(request("POST", `/payment-links/${enc(id)}/apply`, {})),

  // public checkout (no sign-in)
  publicPayment: (token) => data(request("GET", `/public/payments/${enc(token)}`, undefined, { auth: false })),
  simulatePayment: (token, outcome) => data(request("POST", `/public/payments/${enc(token)}/sandbox`, { outcome }, { auth: false })),
  policyPdfUrl: (token) => `${BASE_URL}/public/payments/${enc(token)}/policy.pdf`,
};

export default packagesService;
