import { getRequest, postRequest, putRequest } from "../utility/commonServices";
import request from "../utility/interceptor";

/**
 * Data privacy API (/privacy): consents of clients and prospects, the data subject request register, the personal data
 * export and anonymisation (Data Privacy Act of 2012).
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
const withMessage = (promise) => promise.then((r) => ({ data: r.data.data, message: r.data.message }));

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

const privacyService = {
  consents: (partyType, partyId) => data(getRequest("privacy/consents", { partyType, partyId })),
  consentRegister: (params) => data(getRequest("privacy/consents/register", clean(params))),
  recordConsent: (body) => withMessage(postRequest("privacy/consents", body)),
  withdrawConsent: (id, reason) => withMessage(postRequest(`privacy/consents/${enc(id)}/withdraw`, { reason })),

  requests: (params) => data(getRequest("privacy/requests", clean(params))),
  createRequest: (body) => withMessage(postRequest("privacy/requests", body)),
  updateRequest: (id, body) => withMessage(putRequest(`privacy/requests/${enc(id)}`, body)),
  closeRequest: (id, body) => withMessage(postRequest(`privacy/requests/${enc(id)}/close`, body)),

  searchParties: (search) => data(getRequest("privacy/parties", { search })),
  assignees: () => data(getRequest("privacy/assignees")),
  exportParty: (type, id, requestId) => download(`privacy/parties/${enc(type)}/${enc(id)}/export`, { format: "json", download: "true", requestId }, "personal-data.json"),
  exportPartyXlsx: (type, id, requestId) => download(`privacy/parties/${enc(type)}/${enc(id)}/export`, { format: "xlsx", requestId }, "personal-data.xlsx"),
  anonymiseDryRun: (type, id) => data(getRequest(`privacy/parties/${enc(type)}/${enc(id)}/anonymise/dry-run`)),
  anonymise: (type, id, body) => withMessage(postRequest(`privacy/parties/${enc(type)}/${enc(id)}/anonymise`, body)),
};

export default privacyService;
