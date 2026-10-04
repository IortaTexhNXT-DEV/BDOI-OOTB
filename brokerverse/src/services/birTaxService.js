import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * BIR forms, invoicing and tax API (/bir) and the overriding commission from insurers (/insurer-overrides):
 * withholding and percentage tax returns with filing records, DAT files, sales invoices, the EIS outbox, the CAS
 * pack, overriding commission agreements and computations.
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

/** File name from the Content-Disposition header. */
const fileNameOf = (response, fallback) => {
  const m = /filename="?([^";]+)"?/i.exec(response.headers.get("Content-Disposition") || "");
  return m ? m[1] : fallback;
};

/** Open a PDF in a new tab, or save any other file under its Content-Disposition name. */
const deliver = async (response, fallbackName) => {
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `Could not open the file (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if ((response.headers.get("Content-Type") || "").includes("application/pdf")) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameOf(response, fallbackName);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return response.headers;
};
/** GET a file with the session token. */
const openFile = async (path, { fallbackName = "download" } = {}) =>
  deliver(await fetch(`${BASE_URL}${path}`, { method: "GET", headers: { ...authService.getAuthHeader() } }), fallbackName);
/** POST and receive a file (the loose-leaf book print records the pages it used). */
const postFile = async (path, body, { fallbackName = "download" } = {}) =>
  deliver(await fetch(`${BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...authService.getAuthHeader() }, body: JSON.stringify(body) }), fallbackName);

const enc = encodeURIComponent;

const birTaxService = {
  // returns and filing records
  calendar: (year) => request(`/bir/returns/calendar${qs({ year })}`),
  returnOf: (form, params) => request(`/bir/returns/${enc(form)}${qs(params)}`),
  returnPdf: (form, params) => openFile(`/bir/returns/${enc(form)}/pdf${qs(params)}`),
  returnXlsx: (form, params) => openFile(`/bir/returns/${enc(form)}/xlsx${qs(params)}`, { fallbackName: `BIR-${form}.xlsx` }),
  recordFiling: (form, body) => post(`/bir/returns/${enc(form)}/filings`, body),
  filings: (params) => request(`/bir/filings${qs(params)}`),
  updateFiling: (id, body) => put(`/bir/filings/${enc(id)}`, body),
  cancelFiling: (id, reason) => post(`/bir/filings/${enc(id)}/cancel`, { reason }),

  // DAT files
  datLayout: () => request("/bir/dat-files/layout"),
  datPreview: (type, params) => request(`/bir/dat-files/${enc(type)}${qs(params)}`),
  datDownload: (type, params) => openFile(`/bir/dat-files/${enc(type)}/download${qs(params)}`, { fallbackName: `${type}.DAT` }),

  // sales invoices
  invoices: (params) => request(`/bir/invoices${qs(params)}`),
  invoice: (id) => request(`/bir/invoices/${enc(id)}`),
  seller: () => request("/bir/invoices/seller"),
  invoiceCandidates: (type) => request(`/bir/invoices/candidates${qs({ type })}`),
  issueInvoice: (body) => post("/bir/invoices", body),
  cancelInvoice: (id, reason) => post(`/bir/invoices/${enc(id)}/cancel`, { reason }),
  invoicePdf: (id) => openFile(`/bir/invoices/${enc(id)}/pdf`),
  recordPayment: (id, body) => post(`/bir/invoices/${enc(id)}/payments`, body),
  cancelPayment: (paymentId, reason) => post(`/bir/invoices/payments/${enc(paymentId)}/cancel`, { reason }),
  paymentPdf: (paymentId) => openFile(`/bir/invoices/payments/${enc(paymentId)}/pdf`),

  // EIS outbox
  eisStatus: () => request("/bir/eis/status"),
  eisSubmissions: (params) => request(`/bir/eis/submissions${qs(params)}`),
  eisSubmission: (id) => request(`/bir/eis/submissions/${enc(id)}`),
  eisProcess: () => post("/bir/eis/process"),
  eisQueueBacklog: (from, to) => post("/bir/eis/queue-backlog", { from, to }),
  eisRetry: (id) => post(`/bir/eis/submissions/${enc(id)}/retry`),
  eisManual: (id, reference) => post(`/bir/eis/submissions/${enc(id)}/manual`, { reference }),
  eisExport: () => openFile("/bir/eis/export", { fallbackName: "eis-payloads.json" }),

  // CAS pack
  casChecklist: () => request("/bir/cas/checklist"),
  bookPreview: (book, period) => request(`/bir/cas/books/${enc(book)}/preview${qs({ period })}`),
  bookXlsx: (book, period) => openFile(`/bir/cas/books/${enc(book)}/xlsx${qs({ period })}`, { fallbackName: `${book}-${period}.xlsx` }),
  printBook: (book, period) => postFile(`/bir/cas/books/${enc(book)}/print`, { period }),
  bookPrints: (params) => request(`/bir/cas/prints${qs(params)}`),
  reprintBook: (id) => openFile(`/bir/cas/prints/${enc(id)}/pdf`),
  voidPrint: (id, reason) => post(`/bir/cas/prints/${enc(id)}/void`, { reason }),
  systemDescription: () => openFile("/bir/cas/documents/system-description"),
  backupProcedure: () => openFile("/bir/cas/documents/backup-procedure"),
  auditExtract: (from, to, format) => openFile(`/bir/cas/audit-extract${qs({ from, to, format })}`, { fallbackName: `audit-trail.${format}` }),

  // overriding commission from insurers
  overrideAgreements: (params) => request(`/insurer-overrides/agreements${qs(params)}`),
  overrideAgreement: (id) => request(`/insurer-overrides/agreements/${enc(id)}`),
  createOverrideAgreement: (body) => post("/insurer-overrides/agreements", body),
  updateOverrideAgreement: (id, body) => put(`/insurer-overrides/agreements/${enc(id)}`, body),
  overridePeriods: (id, year) => request(`/insurer-overrides/agreements/${enc(id)}/periods${qs({ year })}`),
  overridePreview: (id, params) => request(`/insurer-overrides/agreements/${enc(id)}/preview${qs(params)}`),
  computeOverride: (id, body) => post(`/insurer-overrides/agreements/${enc(id)}/compute`, body),
  overrideComputations: (params) => request(`/insurer-overrides/computations${qs(params)}`),
  overrideComputation: (id) => request(`/insurer-overrides/computations/${enc(id)}`),
  overrideExport: (year) => openFile(`/insurer-overrides/computations/export${qs({ year })}`, { fallbackName: "overriding-commission.xlsx" }),
  submitOverride: (id) => post(`/insurer-overrides/computations/${enc(id)}/submit`),
  approveOverride: (id) => post(`/insurer-overrides/computations/${enc(id)}/approve`),
  rejectOverride: (id, reason) => post(`/insurer-overrides/computations/${enc(id)}/reject`, { reason }),
  cancelOverride: (id, reason) => post(`/insurer-overrides/computations/${enc(id)}/cancel`, { reason }),
  settleOverride: (id, body) => post(`/insurer-overrides/computations/${enc(id)}/settlements`, body),
};

export default birTaxService;
