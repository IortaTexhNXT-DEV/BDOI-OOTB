import { getRequest, postRequest, putRequest } from "../utility/commonServices";
import request from "../utility/interceptor";

/**
 * Compliance API: Insurance Commission registers and reports (/compliance: licences, fit and proper, insurer
 * authority, IC annual statement and production report, complaints) and the personal data breach register
 * (/privacy/breaches).
 */
const enc = encodeURIComponent;
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** The server's message (with the field messages of a validation error), for toasts. */
export const errorMessage = (error, fallback) => {
  const body = error?.response?.data || {};
  const detail = Array.isArray(body.errors) ? body.errors.map((e) => e.message).filter(Boolean).join("; ") : "";
  if (body.message && detail && body.message !== "Validation failed") return body.message;
  return detail || body.message || error?.message || fallback;
};

const data = (promise) => promise.then((r) => r.data.data);
const withMessage = (promise) => promise.then((r) => ({ data: r.data.data, message: r.data.message, warnings: r.data.complianceWarnings || [] }));

/** Save a file answered by the server under the name it gives. */
const download = async (url, params, fallbackName) => {
  const response = await request.get(url, { params: clean(params), responseType: "blob" });
  const name = (response.headers?.["content-disposition"] || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const href = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
};

/** Upload a supporting document (stored like every other upload) and return it as { key, name, url }. */
const uploadDocument = async (file) => {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "compliance");
  const r = await request.post("s3/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
  return { key: r.data.key || r.data.data?.key, url: r.data.url || r.data.data?.url, name: file.name, uploadedAt: new Date().toISOString() };
};

const complianceService = {
  uploadDocument,
  // licence register
  licences: (params) => data(getRequest("compliance/licences", clean(params))),
  licenceDashboard: () => data(getRequest("compliance/licences/dashboard")),
  licenceHolders: (search) => data(getRequest("compliance/licences/holders", clean({ search }))),
  createLicence: (body) => withMessage(postRequest("compliance/licences", body)),
  updateLicence: (id, body) => withMessage(putRequest(`compliance/licences/${enc(id)}`, body)),
  renewLicence: (id, body) => withMessage(postRequest(`compliance/licences/${enc(id)}/renew`, body)),
  exportLicences: (params) => download("compliance/licences/export", params, "licence-register.xlsx"),
  // fit and proper
  fitProper: (params) => data(getRequest("compliance/fit-proper", clean(params))),
  createFitProper: (body) => withMessage(postRequest("compliance/fit-proper", body)),
  updateFitProper: (id, body) => withMessage(putRequest(`compliance/fit-proper/${enc(id)}`, body)),
  reviewFitProper: (id, body) => withMessage(postRequest(`compliance/fit-proper/${enc(id)}/review`, body)),
  exportFitProper: () => download("compliance/fit-proper/export", {}, "fit-and-proper-register.xlsx"),
  // insurer certificates of authority
  insurerAuthority: (params) => data(getRequest("compliance/insurer-authority", clean(params))),
  exportInsurerAuthority: (params) => download("compliance/insurer-authority/export", params, "insurer-certificates-of-authority.xlsx"),
  // IC reports
  annualStatement: (params) => data(getRequest("compliance/ic-reports/annual-statement", clean(params))),
  exportAnnualStatement: (params) => download("compliance/ic-reports/annual-statement/export", params, "ic-annual-statement.xlsx"),
  production: (params) => data(getRequest("compliance/ic-reports/production", clean(params))),
  exportProduction: (params) => download("compliance/ic-reports/production/export", params, "ic-production-report.xlsx"),
  statementMapping: () => data(getRequest("compliance/ic-reports/mapping")),
  updateStatementLine: (id, body) => withMessage(putRequest(`compliance/ic-reports/mapping/${enc(id)}`, body)),
  // complaints
  complaints: (params) => data(getRequest("compliance/complaints", clean(params))),
  complaintOptions: () => data(getRequest("compliance/complaints/options")),
  createComplaint: (body) => withMessage(postRequest("compliance/complaints", body)),
  updateComplaint: (id, body) => withMessage(putRequest(`compliance/complaints/${enc(id)}`, body)),
  complaintAction: (id, action, body = {}) => withMessage(postRequest(`compliance/complaints/${enc(id)}/${enc(action)}`, body)),
  complaintLetter: (id, kind) => download(`compliance/complaints/${enc(id)}/letter/${enc(kind)}`, {}, `complaint-${kind}.pdf`),
  regulatorReport: (params) => data(getRequest("compliance/complaints/regulator-report", clean(params))),
  exportRegulatorReport: (params) => download("compliance/complaints/regulator-report/export", params, "complaints-report.xlsx"),
  // personal data breach register
  breaches: (params) => data(getRequest("privacy/breaches", clean(params))),
  breachOptions: () => data(getRequest("privacy/breaches/options")),
  createBreach: (body) => withMessage(postRequest("privacy/breaches", body)),
  updateBreach: (id, body) => withMessage(putRequest(`privacy/breaches/${enc(id)}`, body)),
  breachAction: (id, action, body = {}) => withMessage(postRequest(`privacy/breaches/${enc(id)}/${enc(action)}`, body)),
  breachAnnualReport: (year) => data(getRequest("privacy/breaches/annual-report", clean({ year }))),
  exportBreachAnnualReport: (year) => download("privacy/breaches/annual-report/export", { year }, "security-incident-report.xlsx"),
};

export default complianceService;
