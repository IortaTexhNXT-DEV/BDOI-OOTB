import { getRequest, postRequest, putRequest } from "../../../utility/commonServices";
import request from "../../../utility/interceptor";

/**
 * Client onboarding API (/clients): the client with its identification, its authorised signatories and beneficial
 * owners, KYC documents and the KYC profile (what is still missing), and the master lists of the form.
 */
const enc = encodeURIComponent;
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** The server's message (with the field messages of a validation error), for toasts. */
export const errorMessage = (error, fallback) => {
  const body = error?.response?.data || {};
  const detail = Array.isArray(body.errors) ? body.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).filter(Boolean).join("; ") : "";
  if (body.message && detail && body.message !== "Validation failed") return body.message;
  return detail || body.message || error?.message || fallback;
};

/** Field errors of a validation answer as { field: message }. */
export const fieldErrors = (error) => {
  const list = error?.response?.data?.errors;
  return Array.isArray(list) ? Object.fromEntries(list.filter((e) => e.path).map((e) => [String(e.path).split(".")[0], e.message])) : {};
};

const data = (promise) => promise.then((r) => r.data.data);
const withMessage = (promise) => promise.then((r) => ({ data: r.data.data, message: r.data.message }));

const onboardingService = {
  onboard: (body) => withMessage(postRequest("clients/onboard", body)),
  updateKyc: (id, body) => withMessage(putRequest(`clients/${enc(id)}/kyc`, body)),
  client: (id) => data(getRequest(`clients/${enc(id)}`)),
  profile: (id) => data(getRequest(`clients/${enc(id)}/profile`)),
  options: (type, valueField = "label") => data(getRequest(`masters/${enc(type)}/options`, { valueField })).catch(() => []),
  addSignatory: (id, body) => withMessage(postRequest(`clients/${enc(id)}/signatories`, body)),
  saveSignatory: (id, rowId, body) => withMessage(putRequest(`clients/${enc(id)}/signatories/${enc(rowId)}`, body)),
  addOwner: (id, body) => withMessage(postRequest(`clients/${enc(id)}/beneficial-owners`, body)),
  saveOwner: (id, rowId, body) => withMessage(putRequest(`clients/${enc(id)}/beneficial-owners/${enc(rowId)}`, body)),
  uploadDocument: (id, file, fields = {}) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(clean(fields)).forEach(([k, v]) => form.append(k, v));
    return withMessage(request.post(`clients/${enc(id)}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  documentUrl: (key) => getRequest(`s3/presigned-download-url/${key}`).then((r) => r.data.url || r.data.data?.url),
};

export default onboardingService;
